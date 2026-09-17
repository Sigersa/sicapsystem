import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { validateAndRenewSession } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { UTApi } from 'uploadthing/server';

// Interfaces para tipado seguro
interface Payroll extends RowDataPacket {
  PayrollID: number;
  ProjectID: number;
  Date: string | Date;
  Concept: string;
  MethodID: number;
  Total: number;
  Observations: string;
  Status: number;
  Archivos: string;
}

interface Project extends RowDataPacket {
  ProjectID: number;
  NameProject: string;
  AdminProjectID: number;
}

interface PaymentMethod extends RowDataPacket {
  MethodID: number;
  MethodName: string;
}

interface ArchivoAdjunto {
  nombre: string;
  url: string;
  tipo: string;
  key: string;
}

const utapi = new UTApi();

// Función para formatear fechas
function formatDate(date: string | Date): string {
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return date.includes('T') ? date.split('T')[0] : date;
}

// Helper para validar sesión
async function getAuthenticatedUser(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value;
  if (!sessionId) return null;
  return await validateAndRenewSession(sessionId);
}

// GET - Obtener nóminas por proyecto
export async function GET(request: NextRequest): Promise<NextResponse> {
  let connection;

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { message: 'Project ID es requerido' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    const [registros] = await connection.execute<(Payroll & PaymentMethod)[]>(
      `SELECT 
          p.PayrollID,
          p.ProjectID,
          p.Date,
          p.Concept,
          p.MethodID,
          pm.MethodName,
          p.Total,
          p.Observations,
          p.Status,
          p.Archivos
        FROM payroll p
        INNER JOIN paymentmethods pm ON p.MethodID = pm.MethodID
        WHERE p.ProjectID = ?
        ORDER BY p.Date DESC`,
      [projectId]
    );

    return NextResponse.json(registros);
  } catch (error) {
    console.error('Error al obtener registros:', error);
    return NextResponse.json(
      { message: 'Error al obtener registros' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// POST - Crear nueva nómina
export async function POST(request: NextRequest): Promise<NextResponse> {
  let connection;

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const {
      projectId,
      date,
      concept,
      total,
      observations,
      methodId,
      archivos = []
    } = await request.json();

    // Validación de campos requeridos
    if (!projectId || !date || !concept || !total || !methodId) {
      return NextResponse.json(
        { message: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Verificar que el proyecto existe
    const [projectRows] = await connection.execute<Project[]>(
      `SELECT ProjectID, AdminProjectID FROM projects WHERE ProjectID = ?`,
      [projectId]
    );

    if (projectRows.length === 0) {
      return NextResponse.json({ message: 'Proyecto no existe' }, { status: 400 });
    }

    // Verificar que el método de pago existe
    const [methodRows] = await connection.execute<PaymentMethod[]>(
      `SELECT MethodID FROM paymentmethods WHERE MethodID = ?`,
      [methodId]
    );

    if (methodRows.length === 0) {
      return NextResponse.json({ message: 'Método de pago no válido' }, { status: 400 });
    }

    // Crear el registro en la base de datos
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO payroll 
       (ProjectID, Date, Concept, Total, Observations, Status, MethodID, Archivos) 
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        projectId,
        formatDate(date),
        concept,
        total,
        observations || null,
        methodId,
        JSON.stringify(archivos)
      ]
    );

    // 🔥 URL absoluta para notificaciones
    const baseUrl = new URL(request.url).origin;

    // Llamar a la API de notificaciones para crear una nueva notificación
    try {
      await fetch(`${baseUrl}/api/notifications/notifications-payroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          payrollId: result.insertId,
          isUpdate: false
        }),
      });
    } catch (error) {
      console.error('Error al crear notificación:', error);
    }

    return NextResponse.json({
      message: 'Registro de nómina creado correctamente',
      id: result.insertId
    }, { status: 201 });
  } catch (error) {
    console.error('Error al crear registro de nómina:', error);
    return NextResponse.json(
      { message: 'Error al crear registro de nómina' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// PUT - Actualizar nómina existente
export async function PUT(request: NextRequest): Promise<NextResponse> {
  let connection;

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: 'ID es requerido' },
        { status: 400 }
      );
    }

    const {
      date,
      concept,
      total,
      observations,
      methodId,
      archivos = []
    } = await request.json();

    connection = await getConnection();

    // Verificar que el registro existe
    const [payrollRows] = await connection.execute<Payroll[]>(
      `SELECT * FROM payroll WHERE PayrollID = ?`,
      [id]
    );

    if (payrollRows.length === 0) {
      return NextResponse.json({ message: 'Registro no encontrado' }, { status: 404 });
    }

    const payroll = payrollRows[0];

    // Verificar que el método de pago existe
    const [methodRows] = await connection.execute<PaymentMethod[]>(
      `SELECT MethodID FROM paymentmethods WHERE MethodID = ?`,
      [methodId]
    );

    if (methodRows.length === 0) {
      return NextResponse.json({ message: 'Método de pago no válido' }, { status: 400 });
    }

    // Verificar si hay cambios reales
    const fechaFormateada = formatDate(date);
    const oldFechaFormateada = formatDate(payroll.Date);

    const hasChanges =
      oldFechaFormateada !== fechaFormateada ||
      payroll.Concept !== concept ||
      payroll.Total !== total ||
      payroll.Observations !== (observations || null) ||
      payroll.MethodID !== methodId ||
      JSON.stringify(JSON.parse(payroll.Archivos || '[]')) !== JSON.stringify(archivos || []);

    if (!hasChanges) {
      return NextResponse.json({
        message: 'No se detectaron cambios para actualizar',
        affectedRows: 0
      });
    }

    // Eliminar archivos antiguos si es necesario
    if (payroll.Archivos && archivos.length > 0) {
      const archivosAntiguos: ArchivoAdjunto[] = JSON.parse(payroll.Archivos);
      const filesToRemove = archivosAntiguos
        .filter((archivo: ArchivoAdjunto) =>
          archivo.key && !archivos.some((a: ArchivoAdjunto) => a.key === archivo.key)
        )
        .map((archivo: ArchivoAdjunto) => archivo.key);

      if (filesToRemove.length > 0) {
        await utapi.deleteFiles(filesToRemove);
      }
    }

    // Actualizar el registro
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE payroll SET
        Date = ?,
        Concept = ?,
        Total = ?,
        Observations = ?,
        MethodID = ?,
        Archivos = ?,
        Status = 0
       WHERE PayrollID = ?`,
      [
        fechaFormateada,
        concept,
        total,
        observations || null,
        methodId,
        JSON.stringify(archivos),
        id
      ]
    );

    // 🔥 URL absoluta para notificaciones
    const baseUrl = new URL(request.url).origin;

    // Llamar a la API de notificaciones solo si hubo cambios
    if (result.affectedRows > 0) {
      try {
        await fetch(`${baseUrl}/api/notifications/notifications-payroll`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId: payroll.ProjectID,
            payrollId: parseInt(id),
            isUpdate: true
          }),
        });
      } catch (error) {
        console.error('Error al crear notificación de actualización:', error);
      }
    }

    return NextResponse.json({
      message: 'Registro de nómina actualizado correctamente',
      affectedRows: result.affectedRows
    });
  } catch (error) {
    console.error('Error al actualizar registro de nómina:', error);
    return NextResponse.json(
      { message: 'Error al actualizar registro de nómina' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// DELETE - Eliminar nómina
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  let connection;

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: 'ID es requerido' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Obtener el registro para eliminar archivos asociados
    const [payrollRows] = await connection.execute<Payroll[]>(
      `SELECT PayrollID, Archivos, ProjectID FROM payroll WHERE PayrollID = ?`,
      [id]
    );

    if (payrollRows.length === 0) {
      return NextResponse.json({ message: 'Registro no encontrado' }, { status: 404 });
    }

    const payroll = payrollRows[0];
    let deleteSuccess = true;

    // Eliminar archivos de UploadThing si existen
    if (payroll.Archivos) {
      const archivos: ArchivoAdjunto[] = JSON.parse(payroll.Archivos);
      const filesToRemove = archivos
        .filter((archivo: ArchivoAdjunto) => archivo.key)
        .map((archivo: ArchivoAdjunto) => archivo.key);

      if (filesToRemove.length > 0) {
        try {
          await utapi.deleteFiles(filesToRemove);
        } catch (error) {
          console.error('Error al eliminar archivos:', error);
          deleteSuccess = false;
        }
      }
    }

    // Eliminar el registro de la base de datos
    const [result] = await connection.execute<ResultSetHeader>(
      `DELETE FROM payroll WHERE PayrollID = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { message: 'No se encontró el registro a eliminar' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: deleteSuccess
        ? 'Registro de nómina y archivos eliminados correctamente'
        : 'Registro de nómina eliminado pero hubo problemas eliminando algunos archivos',
      affectedRows: result.affectedRows
    });
  } catch (error: any) {
    console.error('Error al eliminar registro de nómina:', error);

    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return NextResponse.json(
        { message: 'No se puede eliminar: hay registros dependientes.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: 'Error al eliminar registro de nómina' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
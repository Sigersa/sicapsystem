import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { validateAndRenewSession } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { UTApi } from 'uploadthing/server';

// Interfaces para tipado seguro
interface ToolEquipment extends RowDataPacket {
  ToolsequipmentID: number;
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

// GET - Obtener registros de tools & equipment por proyecto
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

    const [registros] = await connection.execute<(ToolEquipment & PaymentMethod)[]>(
      `SELECT 
          t.ToolsequipmentID,
          t.ProjectID,
          t.Date,
          t.Concept,
          t.MethodID,
          pm.MethodName,
          t.Total,
          t.Observations,
          t.Status,
          t.Archivos
        FROM toolsequipment t
        INNER JOIN paymentmethods pm ON t.MethodID = pm.MethodID
        WHERE t.ProjectID = ?
        ORDER BY t.Date DESC`,
      [projectId]
    );

    return NextResponse.json(registros);
  } catch (error) {
    console.error('Error al obtener registros de tools & equipment:', error);
    return NextResponse.json(
      { message: 'Error al obtener registros de tools & equipment' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// POST - Crear nuevo registro de tool/equipment
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
      `SELECT ProjectID FROM projects WHERE ProjectID = ?`,
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
      `INSERT INTO toolsequipment 
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

    return NextResponse.json({
      message: 'Registro de tool/equipment creado correctamente',
      id: result.insertId
    }, { status: 201 });
  } catch (error) {
    console.error('Error al crear registro de tool/equipment:', error);
    return NextResponse.json(
      { message: 'Error al crear registro de tool/equipment' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// PUT - Actualizar registro existente de tool/equipment
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
    const [toolEquipmentRows] = await connection.execute<ToolEquipment[]>(
      `SELECT * FROM toolsequipment WHERE ToolsequipmentID = ?`,
      [id]
    );

    if (toolEquipmentRows.length === 0) {
      return NextResponse.json({ message: 'Registro no encontrado' }, { status: 404 });
    }

    const toolEquipment = toolEquipmentRows[0];

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
    const oldFechaFormateada = formatDate(toolEquipment.Date);

    const hasChanges =
      oldFechaFormateada !== fechaFormateada ||
      toolEquipment.Concept !== concept ||
      toolEquipment.Total !== total ||
      toolEquipment.Observations !== (observations || null) ||
      toolEquipment.MethodID !== methodId ||
      JSON.stringify(JSON.parse(toolEquipment.Archivos || '[]')) !== JSON.stringify(archivos || []);

    if (!hasChanges) {
      return NextResponse.json({
        message: 'No se detectaron cambios para actualizar',
        affectedRows: 0
      });
    }

    // Eliminar archivos antiguos si es necesario
    if (toolEquipment.Archivos && archivos.length > 0) {
      const archivosAntiguos: ArchivoAdjunto[] = JSON.parse(toolEquipment.Archivos);
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
      `UPDATE toolsequipment SET
        Date = ?,
        Concept = ?,
        Total = ?,
        Observations = ?,
        MethodID = ?,
        Archivos = ?,
        Status = 0
       WHERE ToolsequipmentID = ?`,
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

    return NextResponse.json({
      message: 'Registro de tool/equipment actualizado correctamente',
      affectedRows: result.affectedRows
    });
  } catch (error) {
    console.error('Error al actualizar registro de tool/equipment:', error);
    return NextResponse.json(
      { message: 'Error al actualizar registro de tool/equipment' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// DELETE - Eliminar registro de tool/equipment
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
    const [toolEquipmentRows] = await connection.execute<ToolEquipment[]>(
      `SELECT ToolsequipmentID, Archivos FROM toolsequipment WHERE ToolsequipmentID = ?`,
      [id]
    );

    if (toolEquipmentRows.length === 0) {
      return NextResponse.json({ message: 'Registro no encontrado' }, { status: 404 });
    }

    const toolEquipment = toolEquipmentRows[0];
    let deleteSuccess = true;

    // Eliminar archivos de UploadThing si existen
    if (toolEquipment.Archivos) {
      const archivos: ArchivoAdjunto[] = JSON.parse(toolEquipment.Archivos);
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
      `DELETE FROM toolsequipment WHERE ToolsequipmentID = ?`,
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
        ? 'Registro de tool/equipment y archivos eliminados correctamente'
        : 'Registro de tool/equipment eliminado pero hubo problemas eliminando algunos archivos',
      affectedRows: result.affectedRows
    });
  } catch (error: any) {
    console.error('Error al eliminar registro de tool/equipment:', error);

    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return NextResponse.json(
        { message: 'No se puede eliminar: hay registros dependientes.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: 'Error al eliminar registro de tool/equipment' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { validateAndRenewSession } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { UTApi } from 'uploadthing/server';

// Interfaces para tipado seguro
interface FuelClient extends RowDataPacket {
  FuelClientID: number;
  ProjectID: number;
  Date: string | Date;
  Liters: number;
  LitersCost: number;
  Total: number;
  MethodID: number;
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

// Función para calcular total TRUNCANDO a 2 decimales
function calculateTotal(liters: number, litersCost: number): number {
  const total = liters * litersCost;
  // Truncar a 2 decimales (no redondear)
  return Math.floor(total * 100) / 100;
}

// Helper para validar sesión
async function getAuthenticatedUser(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value;
  if (!sessionId) return null;
  return await validateAndRenewSession(sessionId);
}

// GET - Obtener registros de combustible por proyecto
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

    const [registros] = await connection.execute<(FuelClient & PaymentMethod)[]>(
      `SELECT 
          fc.FuelClientID,
          fc.ProjectID,
          fc.Date,
          fc.Liters,
          fc.LitersCost,
          fc.Total,
          fc.MethodID,
          pm.MethodName,
          fc.Observations,
          fc.Status,
          fc.Archivos
        FROM fuelclient fc
        INNER JOIN paymentmethods pm ON fc.MethodID = pm.MethodID
        WHERE fc.ProjectID = ?
        ORDER BY fc.Date DESC`,
      [projectId]
    );

    return NextResponse.json(registros);
  } catch (error) {
    console.error('Error al obtener registros de combustible:', error);
    return NextResponse.json(
      { message: 'Error al obtener registros de combustible' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// POST - Crear nuevo registro de combustible
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
      liters,
      litersCost,
      total,
      methodId,
      observations,
      archivos = []
    } = await request.json();

    // Validación de campos requeridos
    if (!projectId || !date || !liters || !litersCost || !total || !methodId) {
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

    // Calcular el total truncado (por si acaso el frontend no lo envió correctamente)
    const totalTruncado = calculateTotal(liters, litersCost);

    // Crear el registro en la base de datos
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO fuelclient 
       (ProjectID, Date, Liters, LitersCost, Total, MethodID, Observations, Status, Archivos) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        projectId,
        formatDate(date),
        liters,
        litersCost,
        totalTruncado,
        methodId,
        observations || null,
        JSON.stringify(archivos)
      ]
    );

    return NextResponse.json({
      message: 'Registro de combustible creado correctamente',
      id: result.insertId
    }, { status: 201 });
  } catch (error) {
    console.error('Error al crear registro de combustible:', error);
    return NextResponse.json(
      { message: 'Error al crear registro de combustible' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// PUT - Actualizar registro existente de combustible
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
      liters,
      litersCost,
      total,
      methodId,
      observations,
      archivos = []
    } = await request.json();

    connection = await getConnection();

    // Verificar que el registro existe
    const [fuelRows] = await connection.execute<FuelClient[]>(
      `SELECT * FROM fuelclient WHERE FuelClientID = ?`,
      [id]
    );

    if (fuelRows.length === 0) {
      return NextResponse.json({ message: 'Registro no encontrado' }, { status: 404 });
    }

    const fuel = fuelRows[0];

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
    const oldFechaFormateada = formatDate(fuel.Date);

    const hasChanges =
      oldFechaFormateada !== fechaFormateada ||
      fuel.Liters !== liters ||
      fuel.LitersCost !== litersCost ||
      fuel.Total !== total ||
      fuel.Observations !== (observations || null) ||
      fuel.MethodID !== methodId ||
      JSON.stringify(JSON.parse(fuel.Archivos || '[]')) !== JSON.stringify(archivos || []);

    if (!hasChanges) {
      return NextResponse.json({
        message: 'No se detectaron cambios para actualizar',
        affectedRows: 0
      });
    }

    // Eliminar archivos antiguos si es necesario
    if (fuel.Archivos && archivos.length > 0) {
      const archivosAntiguos: ArchivoAdjunto[] = JSON.parse(fuel.Archivos);
      const filesToRemove = archivosAntiguos
        .filter((archivo: ArchivoAdjunto) =>
          archivo.key && !archivos.some((a: ArchivoAdjunto) => a.key === archivo.key)
        )
        .map((archivo: ArchivoAdjunto) => archivo.key);

      if (filesToRemove.length > 0) {
        await utapi.deleteFiles(filesToRemove);
      }
    }

    // Calcular el total truncado
    const totalTruncado = calculateTotal(liters, litersCost);

    // Actualizar el registro
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE fuelclient SET
        Date = ?,
        Liters = ?,
        LitersCost = ?,
        Total = ?,
        MethodID = ?,
        Observations = ?,
        Archivos = ?,
        Status = 0
       WHERE FuelClientID = ?`,
      [
        fechaFormateada,
        liters,
        litersCost,
        totalTruncado,
        methodId,
        observations || null,
        JSON.stringify(archivos),
        id
      ]
    );

    return NextResponse.json({
      message: 'Registro de combustible actualizado correctamente',
      affectedRows: result.affectedRows
    });
  } catch (error) {
    console.error('Error al actualizar registro de combustible:', error);
    return NextResponse.json(
      { message: 'Error al actualizar registro de combustible' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// DELETE - Eliminar registro de combustible
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
    const [fuelRows] = await connection.execute<FuelClient[]>(
      `SELECT FuelClientID, Archivos FROM fuelclient WHERE FuelClientID = ?`,
      [id]
    );

    if (fuelRows.length === 0) {
      return NextResponse.json({ message: 'Registro no encontrado' }, { status: 404 });
    }

    const fuel = fuelRows[0];
    let deleteSuccess = true;

    // Eliminar archivos de UploadThing si existen
    if (fuel.Archivos) {
      const archivos: ArchivoAdjunto[] = JSON.parse(fuel.Archivos);
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
      `DELETE FROM fuelclient WHERE FuelClientID = ?`,
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
        ? 'Registro de combustible y archivos eliminados correctamente'
        : 'Registro de combustible eliminado pero hubo problemas eliminando algunos archivos',
      affectedRows: result.affectedRows
    });
  } catch (error: any) {
    console.error('Error al eliminar registro de combustible:', error);

    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return NextResponse.json(
        { message: 'No se puede eliminar: hay registros dependientes.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: 'Error al eliminar registro de combustible' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
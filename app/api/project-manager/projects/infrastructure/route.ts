import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { validateAndRenewSession } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { UTApi } from 'uploadthing/server';

interface InfrastructureService extends RowDataPacket {
  InfrastructureServiceID: number;
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

    const [registros] = await connection.execute<(InfrastructureService & PaymentMethod)[]>(
      `SELECT 
          i.InfrastructureServiceID,
          i.ProjectID,
          i.Date,
          i.Concept,
          i.MethodID,
          pm.MethodName,
          i.Total,
          i.Observations,
          i.Status,
          i.Archivos
        FROM infrastructureservices i
        INNER JOIN paymentmethods pm ON i.MethodID = pm.MethodID
        WHERE i.ProjectID = ?
        ORDER BY i.Date DESC`,
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

    if (!projectId || !date || !concept || !total || !methodId) {
      return NextResponse.json(
        { message: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    const [projectRows] = await connection.execute<Project[]>(
      `SELECT ProjectID FROM projects WHERE ProjectID = ?`,
      [projectId]
    );

    if (projectRows.length === 0) {
      return NextResponse.json({ message: 'Proyecto no existe' }, { status: 400 });
    }

    const [methodRows] = await connection.execute<PaymentMethod[]>(
      `SELECT MethodID FROM paymentmethods WHERE MethodID = ?`,
      [methodId]
    );

    if (methodRows.length === 0) {
      return NextResponse.json({ message: 'Método de pago no válido' }, { status: 400 });
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO infrastructureservices 
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
      message: 'Registro de infraestructura creado correctamente',
      id: result.insertId
    }, { status: 201 });
  } catch (error) {
    console.error('Error al crear registro de infraestructura:', error);
    return NextResponse.json(
      { message: 'Error al crear registro de infraestructura' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

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

    const [infraRows] = await connection.execute<InfrastructureService[]>(
      `SELECT * FROM infrastructureservices WHERE InfrastructureServiceID = ?`,
      [id]
    );

    if (infraRows.length === 0) {
      return NextResponse.json({ message: 'Registro no encontrado' }, { status: 404 });
    }

    const infra = infraRows[0];

    const [methodRows] = await connection.execute<PaymentMethod[]>(
      `SELECT MethodID FROM paymentmethods WHERE MethodID = ?`,
      [methodId]
    );

    if (methodRows.length === 0) {
      return NextResponse.json({ message: 'Método de pago no válido' }, { status: 400 });
    }

    const fechaFormateada = formatDate(date);
    const oldFechaFormateada = formatDate(infra.Date);

    const hasChanges =
      oldFechaFormateada !== fechaFormateada ||
      infra.Concept !== concept ||
      infra.Total !== total ||
      infra.Observations !== (observations || null) ||
      infra.MethodID !== methodId ||
      JSON.stringify(JSON.parse(infra.Archivos || '[]')) !== JSON.stringify(archivos || []);

    if (!hasChanges) {
      return NextResponse.json({
        message: 'No se detectaron cambios para actualizar',
        affectedRows: 0
      });
    }

    if (infra.Archivos && archivos.length > 0) {
      const archivosAntiguos: ArchivoAdjunto[] = JSON.parse(infra.Archivos);
      const filesToRemove = archivosAntiguos
        .filter((archivo: ArchivoAdjunto) =>
          archivo.key && !archivos.some((a: ArchivoAdjunto) => a.key === archivo.key)
        )
        .map((archivo: ArchivoAdjunto) => archivo.key);

      if (filesToRemove.length > 0) {
        await utapi.deleteFiles(filesToRemove);
      }
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE infrastructureservices SET
        Date = ?,
        Concept = ?,
        Total = ?,
        Observations = ?,
        MethodID = ?,
        Archivos = ?,
        Status = 0
       WHERE InfrastructureServiceID = ?`,
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
      message: 'Registro de infraestructura actualizado correctamente',
      affectedRows: result.affectedRows
    });
  } catch (error) {
    console.error('Error al actualizar registro de infraestructura:', error);
    return NextResponse.json(
      { message: 'Error al actualizar registro de infraestructura' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

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

    const [infraRows] = await connection.execute<InfrastructureService[]>(
      `SELECT InfrastructureServiceID, Archivos, ProjectID FROM infrastructureservices WHERE InfrastructureServiceID = ?`,
      [id]
    );

    if (infraRows.length === 0) {
      return NextResponse.json({ message: 'Registro no encontrado' }, { status: 404 });
    }

    const infra = infraRows[0];
    let deleteSuccess = true;

    if (infra.Archivos) {
      const archivos: ArchivoAdjunto[] = JSON.parse(infra.Archivos);
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

    const [result] = await connection.execute<ResultSetHeader>(
      `DELETE FROM infrastructureservices WHERE InfrastructureServiceID = ?`,
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
        ? 'Registro de infraestructura y archivos eliminados correctamente'
        : 'Registro de infraestructura eliminado pero hubo problemas eliminando algunos archivos',
      affectedRows: result.affectedRows
    });
  } catch (error: any) {
    console.error('Error al eliminar registro de infraestructura:', error);

    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return NextResponse.json(
        { message: 'No se puede eliminar: hay registros dependientes.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: 'Error al eliminar registro de infraestructura' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
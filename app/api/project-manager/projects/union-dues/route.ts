import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { validateAndRenewSession } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { UTApi } from 'uploadthing/server';

interface UnionDue extends RowDataPacket {
  UnionDuesID: number;
  ProjectID: number;
  MethodID: number;
  Date: string | Date;
  Concept: string;
  StartDate: string | Date;
  EndDate: string | Date;
  Total: number;
  Archivos: string;
  Observations: string;
  Status: number;
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

    const [registros] = await connection.execute<(UnionDue & PaymentMethod)[]>(
      `SELECT 
          ud.UnionDuesID,
          ud.ProjectID,
          ud.Date,
          ud.Concept,
          ud.StartDate,
          ud.EndDate,
          ud.MethodID,
          pm.MethodName,
          ud.Total,
          ud.Archivos,
          ud.Observations,
          ud.Status
        FROM uniondues ud
        INNER JOIN paymentmethods pm ON ud.MethodID = pm.MethodID
        WHERE ud.ProjectID = ?
        ORDER BY ud.Date DESC`,
      [projectId]
    );

    return NextResponse.json(registros);
  } catch (error) {
    console.error('Error al obtener registros de cuotas sindicales:', error);
    return NextResponse.json(
      { message: 'Error al obtener registros de cuotas sindicales' },
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
      startDate,
      endDate,
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
      `INSERT INTO uniondues 
       (ProjectID, Date, Concept, StartDate, EndDate, MethodID, Total, Observations, Status, Archivos) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        projectId,
        formatDate(date),
        concept,
        startDate ? formatDate(startDate) : null,
        endDate ? formatDate(endDate) : null,
        methodId,
        total,
        observations || null,
        JSON.stringify(archivos)
      ]
    );

    return NextResponse.json({
      message: 'Registro de cuota sindical creado correctamente',
      id: result.insertId
    }, { status: 201 });
  } catch (error) {
    console.error('Error al crear registro de cuota sindical:', error);
    return NextResponse.json(
      { message: 'Error al crear registro de cuota sindical' },
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
      startDate,
      endDate,
      total,
      observations,
      methodId,
      archivos = []
    } = await request.json();

    connection = await getConnection();

    const [unionDueRows] = await connection.execute<UnionDue[]>(
      `SELECT * FROM uniondues WHERE UnionDuesID = ?`,
      [id]
    );

    if (unionDueRows.length === 0) {
      return NextResponse.json({ message: 'Registro no encontrado' }, { status: 404 });
    }

    const unionDue = unionDueRows[0];

    const [methodRows] = await connection.execute<PaymentMethod[]>(
      `SELECT MethodID FROM paymentmethods WHERE MethodID = ?`,
      [methodId]
    );

    if (methodRows.length === 0) {
      return NextResponse.json({ message: 'Método de pago no válido' }, { status: 400 });
    }

    const fechaFormateada = formatDate(date);
    const oldFechaFormateada = formatDate(unionDue.Date);

    const hasChanges =
      unionDue.Concept !== concept ||
      unionDue.StartDate !== (startDate ? formatDate(startDate) : null) ||
      unionDue.EndDate !== (endDate ? formatDate(endDate) : null) ||
      oldFechaFormateada !== fechaFormateada ||
      unionDue.Total !== total ||
      unionDue.Observations !== (observations || null) ||
      unionDue.MethodID !== methodId ||
      JSON.stringify(JSON.parse(unionDue.Archivos || '[]')) !== JSON.stringify(archivos || []);

    if (!hasChanges) {
      return NextResponse.json({
        message: 'No se detectaron cambios para actualizar',
        affectedRows: 0
      });
    }

    if (unionDue.Archivos && archivos.length > 0) {
      const archivosAntiguos: ArchivoAdjunto[] = JSON.parse(unionDue.Archivos);
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
      `UPDATE uniondues SET
        Date = ?,
        Concept = ?,
        StartDate = ?,
        EndDate = ?,
        Total = ?,
        Observations = ?,
        MethodID = ?,
        Archivos = ?,
        Status = 0
       WHERE UnionDuesID = ?`,
      [
        fechaFormateada,
        concept,
        startDate ? formatDate(startDate) : null,
        endDate ? formatDate(endDate) : null,
        total,
        observations || null,
        methodId,
        JSON.stringify(archivos),
        id
      ]
    );

    return NextResponse.json({
      message: 'Registro de cuota sindical actualizado correctamente',
      affectedRows: result.affectedRows
    });
  } catch (error) {
    console.error('Error al actualizar registro de cuota sindical:', error);
    return NextResponse.json(
      { message: 'Error al actualizar registro de cuota sindical' },
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

    const [unionDueRows] = await connection.execute<UnionDue[]>(
      `SELECT UnionDuesID, Archivos FROM uniondues WHERE UnionDuesID = ?`,
      [id]
    );

    if (unionDueRows.length === 0) {
      return NextResponse.json({ message: 'Registro no encontrado' }, { status: 404 });
    }

    const unionDue = unionDueRows[0];
    let deleteSuccess = true;

    if (unionDue.Archivos) {
      const archivos: ArchivoAdjunto[] = JSON.parse(unionDue.Archivos);
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
      `DELETE FROM uniondues WHERE UnionDuesID = ?`,
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
        ? 'Registro de cuota sindical y archivos eliminados correctamente'
        : 'Registro de cuota sindical eliminado pero hubo problemas eliminando algunos archivos',
      affectedRows: result.affectedRows
    });
  } catch (error: any) {
    console.error('Error al eliminar registro de cuota sindical:', error);

    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return NextResponse.json(
        { message: 'No se puede eliminar: hay registros dependientes.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: 'Error al eliminar registro de cuota sindical' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
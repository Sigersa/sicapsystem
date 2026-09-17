import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { validateAndRenewSession } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { UTApi } from 'uploadthing/server';

// Interfaces para tipado seguro
interface Loan extends RowDataPacket {
  LoansID: number;
  ProjectID: number;
  Date: string | Date;
  Beneficiary: string;
  MethodID: number;
  Total: number;
  FirstDiscount: string | Date;
  NumberOfPayments: number;
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

// GET - Obtener préstamos por proyecto
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

    const [registros] = await connection.execute<(Loan & PaymentMethod)[]>(
      `SELECT 
          l.LoansID,
          l.ProjectID,
          l.Date,
          l.Beneficiary,
          l.MethodID,
          pm.MethodName,
          l.Total,
          l.FirstDiscount,
          l.Observations,
          l.Status,
          l.Archivos,
          l.NumberOfPayments
        FROM loans l
        INNER JOIN paymentmethods pm ON l.MethodID = pm.MethodID
        WHERE l.ProjectID = ?
        ORDER BY l.Date DESC`,
      [projectId]
    );

    return NextResponse.json(registros);
  } catch (error) {
    console.error('Error al obtener registros de préstamos:', error);
    return NextResponse.json(
      { message: 'Error al obtener registros de préstamos' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// POST - Crear nuevo registro de préstamo
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
      beneficiary,
      total,
      firstDiscount,
      observations,
      methodId,
      numberOfPayments,
      archivos = []
    } = await request.json();

    // Validación de campos requeridos
    if (!projectId || !date || !beneficiary || !total || !methodId || !firstDiscount) {
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
      `INSERT INTO loans 
        (ProjectID, Date, Beneficiary, MethodID, Total, FirstDiscount, NumberOfPayments, Observations, Status, Archivos) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        projectId,
        formatDate(date),
        beneficiary,
        methodId,
        total,
        formatDate(firstDiscount),
        numberOfPayments,
        observations || null,
        JSON.stringify(archivos)
      ]
    );

    return NextResponse.json({
      message: 'Registro de préstamo creado correctamente',
      id: result.insertId
    }, { status: 201 });
  } catch (error) {
    console.error('Error al crear registro de préstamo:', error);
    return NextResponse.json(
      { message: 'Error al crear registro de préstamo' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// PUT - Actualizar registro de préstamo existente
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
      beneficiary,
      total,
      firstDiscount,
      observations,
      methodId,
      numberOfPayments,
      archivos = []
    } = await request.json();

    connection = await getConnection();

    // Verificar que el registro existe
    const [loanRows] = await connection.execute<Loan[]>(
      `SELECT * FROM loans WHERE LoansID = ?`,
      [id]
    );

    if (loanRows.length === 0) {
      return NextResponse.json({ message: 'Registro no encontrado' }, { status: 404 });
    }

    const loan = loanRows[0];

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
    const oldFechaFormateada = formatDate(loan.Date);
    const firstDiscountFormateada = formatDate(firstDiscount);
    const oldFirstDiscountFormateada = formatDate(loan.FirstDiscount);

    const hasChanges =
      loan.Beneficiary !== beneficiary ||
      oldFechaFormateada !== fechaFormateada ||
      oldFirstDiscountFormateada !== firstDiscountFormateada ||
      loan.Total !== total ||
      loan.NumberOfPayments !== numberOfPayments ||
      loan.Observations !== (observations || null) ||
      loan.MethodID !== methodId ||
      JSON.stringify(JSON.parse(loan.Archivos || '[]')) !== JSON.stringify(archivos || []);

    if (!hasChanges) {
      return NextResponse.json({
        message: 'No se detectaron cambios para actualizar',
        affectedRows: 0
      });
    }

    // Eliminar archivos antiguos si es necesario
    if (loan.Archivos && archivos.length > 0) {
      const archivosAntiguos: ArchivoAdjunto[] = JSON.parse(loan.Archivos);
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
      `UPDATE loans SET
        Date = ?,
        Beneficiary = ?,
        MethodID = ?,
        Total = ?,
        FirstDiscount = ?,
        NumberOfPayments = ?,
        Observations = ?,
        Archivos = ?,
        Status = 0
       WHERE LoansID = ?`,
      [
        fechaFormateada,
        beneficiary,
        methodId,
        total,
        firstDiscountFormateada,
        numberOfPayments,
        observations || null,
        JSON.stringify(archivos),
        id
      ]
    );

    return NextResponse.json({
      message: 'Registro de préstamo actualizado correctamente',
      affectedRows: result.affectedRows
    });
  } catch (error) {
    console.error('Error al actualizar registro de préstamo:', error);
    return NextResponse.json(
      { message: 'Error al actualizar registro de préstamo' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// DELETE - Eliminar registro de préstamo
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
    const [loanRows] = await connection.execute<Loan[]>(
      `SELECT LoansID, Archivos FROM loans WHERE LoansID = ?`,
      [id]
    );

    if (loanRows.length === 0) {
      return NextResponse.json({ message: 'Registro no encontrado' }, { status: 404 });
    }

    const loan = loanRows[0];
    let deleteSuccess = true;

    // Eliminar archivos de UploadThing si existen
    if (loan.Archivos) {
      const archivos: ArchivoAdjunto[] = JSON.parse(loan.Archivos);
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
      `DELETE FROM loans WHERE LoansID = ?`,
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
        ? 'Registro de préstamo y archivos eliminados correctamente'
        : 'Registro de préstamo eliminado pero hubo problemas eliminando algunos archivos',
      affectedRows: result.affectedRows
    });
  } catch (error: any) {
    console.error('Error al eliminar registro de préstamo:', error);

    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return NextResponse.json(
        { message: 'No se puede eliminar: hay registros dependientes.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: 'Error al eliminar registro de préstamo' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
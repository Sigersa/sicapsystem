import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { validateAndRenewSession } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { UTApi } from 'uploadthing/server';

// ============ INTERFACES ============

interface PersonnelTransfer extends RowDataPacket {
  PersonnelTransferID: number;
  ProjectID: number;
  Date: string | Date;
  MeansOfTransportation: string;
  StartingPoint: string;
  ArrivalPoint: string;
  MethodID: number;
  Total: number;
  Archivos: string;
  Observations: string;
  Status: number;
  ProjectPersonnelID: number | null;
  VoucherType: string | null;
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

interface ProjectEmployee extends RowDataPacket {
  ProjectPersonnelID: number;
  FirstName: string;
  LastName: string;
  MiddleName: string;
  EmployeeID: number;
  Position: string | null;
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

// ============ GET - Obtener traslados por proyecto ============
export async function GET(request: NextRequest): Promise<NextResponse> {
  let connection;

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const includeEmployees = searchParams.get('includeEmployees') === 'true';

    if (!projectId) {
      return NextResponse.json(
        { message: 'Project ID es requerido' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // 1. Traer los traslados del proyecto
    const [registros] = await connection.execute<(PersonnelTransfer & PaymentMethod)[]>(
      `SELECT 
          pt.PersonnelTransferID,
          pt.ProjectID,
          pt.Date,
          pt.MeansOfTransportation,
          pt.StartingPoint,
          pt.ArrivalPoint,
          pt.MethodID,
          pm.MethodName,
          pt.Total,
          pt.Archivos,
          pt.Observations,
          pt.Status,
          pt.ProjectPersonnelID,
          pt.VoucherType
        FROM personneltransfer pt
        INNER JOIN paymentmethods pm ON pt.MethodID = pm.MethodID
        WHERE pt.ProjectID = ?
        ORDER BY pt.Date DESC`,
      [projectId]
    );

    // 2. Si se solicitan, traer los empleados de proyecto asignados a este proyecto
    let employees: ProjectEmployee[] = [];
    if (includeEmployees) {
      const [empRows] = await connection.execute<ProjectEmployee[]>(
        `SELECT DISTINCT
            pp.ProjectPersonnelID,
            pp.FirstName,
            pp.LastName,
            pp.MiddleName,
            pp.EmployeeID,
            pc.Position
          FROM projectpersonnel pp
          INNER JOIN employees e ON e.EmployeeID = pp.EmployeeID
          INNER JOIN projectcontracts pc ON pc.ProjectPersonnelID = pp.ProjectPersonnelID
          WHERE pc.ProjectID = ?
            AND e.EmployeeType = 'PROJECT'
            AND (e.Status = 1 OR e.Status IS NULL)
            AND (pc.Status = 1 OR pc.Status IS NULL)
          ORDER BY pp.FirstName, pp.LastName`,
        [projectId]
      );
      employees = empRows;
    }

    // Si se pidió solo los empleados, devolver solo eso (útil para selects)
    if (includeEmployees && searchParams.get('onlyEmployees') === 'true') {
      return NextResponse.json({ employees });
    }

    return NextResponse.json({
      registros,
      employees
    });
  } catch (error) {
    console.error('Error al obtener registros de traslado:', error);
    return NextResponse.json(
      { message: 'Error al obtener registros de traslado' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// ============ POST - Crear nuevo registro ============
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
      meansOfTransportation,
      startingPoint,
      arrivalPoint,
      total,
      observations,
      methodId,
      projectPersonnelId,
      voucherType,
      archivos = []
    } = await request.json();

    // Validación de campos requeridos
    if (!projectId || !date || !meansOfTransportation || !startingPoint || !arrivalPoint || !total || !methodId) {
      return NextResponse.json(
        { message: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Validar VoucherType
    const VALID_VOUCHER_TYPES = ['FACTURA', 'TICKET', 'S/C'];
    if (voucherType && !VALID_VOUCHER_TYPES.includes(voucherType)) {
      return NextResponse.json(
        { message: 'Tipo de comprobante no válido' },
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

    // Verificar que el ProjectPersonnelID existe y está asignado al proyecto
    if (projectPersonnelId) {
      const [empRows] = await connection.execute<RowDataPacket[]>(
        `SELECT pp.ProjectPersonnelID
         FROM projectpersonnel pp
         INNER JOIN projectcontracts pc ON pc.ProjectPersonnelID = pp.ProjectPersonnelID
         WHERE pp.ProjectPersonnelID = ? AND pc.ProjectID = ?`,
        [projectPersonnelId, projectId]
      );
      if (empRows.length === 0) {
        return NextResponse.json(
          { message: 'El empleado seleccionado no está asignado a este proyecto' },
          { status: 400 }
        );
      }
    }

    // Insertar
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO personneltransfer 
       (ProjectID, Date, MeansOfTransportation, StartingPoint, ArrivalPoint, MethodID, Total, Observations, Status, Archivos, ProjectPersonnelID, VoucherType) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        projectId,
        formatDate(date),
        meansOfTransportation,
        startingPoint,
        arrivalPoint,
        methodId,
        total,
        observations || null,
        JSON.stringify(archivos),
        projectPersonnelId || null,
        voucherType || null
      ]
    );

    return NextResponse.json({
      message: 'Registro de traslado creado correctamente',
      id: result.insertId
    }, { status: 201 });
  } catch (error) {
    console.error('Error al crear registro de traslado:', error);
    return NextResponse.json(
      { message: 'Error al crear registro de traslado' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// ============ PUT - Actualizar ============
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
      meansOfTransportation,
      startingPoint,
      arrivalPoint,
      total,
      observations,
      methodId,
      projectPersonnelId,
      voucherType,
      archivos = []
    } = await request.json();

    // Validar VoucherType
    const VALID_VOUCHER_TYPES = ['FACTURA', 'TICKET', 'S/C'];
    if (voucherType && !VALID_VOUCHER_TYPES.includes(voucherType)) {
      return NextResponse.json(
        { message: 'Tipo de comprobante no válido' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    const [transferRows] = await connection.execute<PersonnelTransfer[]>(
      `SELECT * FROM personneltransfer WHERE PersonnelTransferID = ?`,
      [id]
    );

    if (transferRows.length === 0) {
      return NextResponse.json({ message: 'Registro no encontrado' }, { status: 404 });
    }

    const transfer = transferRows[0];

    const [methodRows] = await connection.execute<PaymentMethod[]>(
      `SELECT MethodID FROM paymentmethods WHERE MethodID = ?`,
      [methodId]
    );

    if (methodRows.length === 0) {
      return NextResponse.json({ message: 'Método de pago no válido' }, { status: 400 });
    }

    // Verificar empleado si se especificó
    if (projectPersonnelId) {
      const [empRows] = await connection.execute<RowDataPacket[]>(
        `SELECT pp.ProjectPersonnelID
         FROM projectpersonnel pp
         INNER JOIN projectcontracts pc ON pc.ProjectPersonnelID = pp.ProjectPersonnelID
         WHERE pp.ProjectPersonnelID = ? AND pc.ProjectID = ?`,
        [projectPersonnelId, transfer.ProjectID]
      );
      if (empRows.length === 0) {
        return NextResponse.json(
          { message: 'El empleado seleccionado no está asignado a este proyecto' },
          { status: 400 }
        );
      }
    }

    const fechaFormateada = formatDate(date);
    const oldFechaFormateada = formatDate(transfer.Date);

    const hasChanges =
      transfer.MeansOfTransportation !== meansOfTransportation ||
      transfer.StartingPoint !== startingPoint ||
      transfer.ArrivalPoint !== arrivalPoint ||
      oldFechaFormateada !== fechaFormateada ||
      transfer.Total !== total ||
      transfer.Observations !== (observations || null) ||
      transfer.MethodID !== methodId ||
      transfer.ProjectPersonnelID !== (projectPersonnelId || null) ||
      transfer.VoucherType !== (voucherType || null) ||
      JSON.stringify(JSON.parse(transfer.Archivos || '[]')) !== JSON.stringify(archivos || []);

    if (!hasChanges) {
      return NextResponse.json({
        message: 'No se detectaron cambios para actualizar',
        affectedRows: 0
      });
    }

    // Eliminar archivos antiguos
    if (transfer.Archivos && archivos.length > 0) {
      const archivosAntiguos: ArchivoAdjunto[] = JSON.parse(transfer.Archivos);
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
      `UPDATE personneltransfer SET
        Date = ?,
        MeansOfTransportation = ?,
        StartingPoint = ?,
        ArrivalPoint = ?,
        Total = ?,
        Observations = ?,
        MethodID = ?,
        Archivos = ?,
        ProjectPersonnelID = ?,
        VoucherType = ?,
        Status = 0
       WHERE PersonnelTransferID = ?`,
      [
        fechaFormateada,
        meansOfTransportation,
        startingPoint,
        arrivalPoint,
        total,
        observations || null,
        methodId,
        JSON.stringify(archivos),
        projectPersonnelId || null,
        voucherType || null,
        id
      ]
    );

    return NextResponse.json({
      message: 'Registro de traslado actualizado correctamente',
      affectedRows: result.affectedRows
    });
  } catch (error) {
    console.error('Error al actualizar registro de traslado:', error);
    return NextResponse.json(
      { message: 'Error al actualizar registro de traslado' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// ============ DELETE ============
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

    const [transferRows] = await connection.execute<PersonnelTransfer[]>(
      `SELECT PersonnelTransferID, Archivos FROM personneltransfer WHERE PersonnelTransferID = ?`,
      [id]
    );

    if (transferRows.length === 0) {
      return NextResponse.json({ message: 'Registro no encontrado' }, { status: 404 });
    }

    const transfer = transferRows[0];
    let deleteSuccess = true;

    if (transfer.Archivos) {
      const archivos: ArchivoAdjunto[] = JSON.parse(transfer.Archivos);
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
      `DELETE FROM personneltransfer WHERE PersonnelTransferID = ?`,
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
        ? 'Registro de traslado y archivos eliminados correctamente'
        : 'Registro de traslado eliminado pero hubo problemas eliminando algunos archivos',
      affectedRows: result.affectedRows
    });
  } catch (error: any) {
    console.error('Error al eliminar registro de traslado:', error);

    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return NextResponse.json(
        { message: 'No se puede eliminar: hay registros dependientes.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: 'Error al eliminar registro de traslado' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
import { NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import type { FieldPacket, RowDataPacket } from 'mysql2';
import { validateAndRenewSession } from '@/lib/auth';

interface ValidationRecord extends RowDataPacket {
  [key: string]: any;
}

async function getUserFromSession() {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session')?.value;

    if (!sessionId) {
      return null;
    }

    return await validateAndRenewSession(sessionId);
  } catch (error) {
    console.error('Error getting user from session:', error);
    return null;
  }
}

// Mapa de tablas con su columna ID real y columna de estado
const TABLE_CONFIG: Record<string, { table: string; idColumn: string; statusColumn: string }> = {
  administrativeconsumable: { table: 'administrativeconsumable', idColumn: 'AdministrativeConsumableID', statusColumn: 'Status' },
  consumableclient:         { table: 'consumableclient',         idColumn: 'ConsumableClientID',         statusColumn: 'Status' },
  epp:                      { table: 'epp',                      idColumn: 'EppID',                       statusColumn: 'Status' },
  financingservices:        { table: 'financingservices',        idColumn: 'FinancingServicesID',         statusColumn: 'Status' },
  fuelclient:               { table: 'fuelclient',               idColumn: 'FuelClientID',                statusColumn: 'Status' },
  infrastructuretransfer:   { table: 'infrastructuretransfer',   idColumn: 'InfrastructureTransferID',    statusColumn: 'Status' },
  infrastructureservices:   { table: 'infrastructureservices',   idColumn: 'InfrastructureServiceID',     statusColumn: 'Status' },
  installationmaterials:    { table: 'installationmaterials',    idColumn: 'InstallationMaterialID',      statusColumn: 'Status' },
  loans:                    { table: 'loans',                    idColumn: 'LoansID',                     statusColumn: 'Status' },
  localtransportationfuel:  { table: 'localtransportationfuel',  idColumn: 'FuelID',                      statusColumn: 'Status' },
  lodging:                  { table: 'lodging',                  idColumn: 'LodgingID',                   statusColumn: 'Status' },
  operativeconsumable:      { table: 'operativeconsumable',      idColumn: 'OperativeConsumableID',       statusColumn: 'Status' },
  outsourcedservices:       { table: 'outsourcedservices',       idColumn: 'OutsourcedServiceID',         statusColumn: 'Status' },
  payroll:                  { table: 'payroll',                  idColumn: 'PayrollID',                   statusColumn: 'status' },
  personneltransfer:        { table: 'personneltransfer',        idColumn: 'PersonnelTransferID',         statusColumn: 'Status' },
  toolsequipment:           { table: 'toolsequipment',           idColumn: 'ToolsequipmentID',            statusColumn: 'Status' },
  uniondues:                { table: 'uniondues',                idColumn: 'UnionDuesID',                 statusColumn: 'Status' },
  waterice:                 { table: 'waterice',                 idColumn: 'WaterIceID',                  statusColumn: 'Status' }
};

const TABLES = Object.keys(TABLE_CONFIG);

// Bloque SQL reutilizable: obtiene el nombre completo del aprobador.
// Prioridad: basepersonnel → projectpersonnel → UserName (fallback).
const APPROVER_JOINS = `
  LEFT JOIN systemusers u ON t.ApprovedBy = u.SystemUserID
  LEFT JOIN basepersonnel bp ON u.EmployeeID = bp.EmployeeID
  LEFT JOIN projectpersonnel pp ON u.EmployeeID = pp.EmployeeID
`;

const APPROVER_SELECT = `
  u.UserName as ApprovedByName,
  NULLIF(TRIM(CONCAT_WS(' ',
    COALESCE(NULLIF(bp.FirstName, ''), NULLIF(pp.FirstName, '')),
    COALESCE(NULLIF(bp.MiddleName, ''), NULLIF(pp.MiddleName, '')),
    COALESCE(NULLIF(bp.LastName, ''), NULLIF(pp.LastName, ''))
  )), '') as FullNameFromEmployee
`;

export async function GET(request: Request) {
  let connection;
  try {
    connection = await getConnection();

    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json(
        { message: 'No autorizado - usuario no autenticado' },
        { status: 401 }
      );
    }

    if (user.UserTypeID !== 5) {
      return NextResponse.json(
        { message: 'Acceso denegado' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const results: Record<string, ValidationRecord[]> = {};

    for (const key of TABLES) {
      const { table, idColumn, statusColumn } = TABLE_CONFIG[key];

      try {
        const whereProject = projectId && projectId !== '0' ? ' AND t.ProjectID = ?' : '';
        const queryParams: any[] = [];
        if (projectId && projectId !== '0') {
          queryParams.push(parseInt(projectId));
        }

        let query: string;

        switch (key) {
          case 'fuelclient':
            query = `
              SELECT t.FuelClientID as id, t.Date, t.Liters, t.LitersCost, t.Total,
                     t.MethodID, m.MethodName, t.Observations, t.Archivos, t.Status, t.ProjectID,
                     p.NameProject, t.ApprovedBy,
                     ${APPROVER_SELECT},
                     CONCAT('Combustible: ', t.Liters, ' litros') as Concept
              FROM ${table} t
              LEFT JOIN paymentmethods m ON t.MethodID = m.MethodID
              LEFT JOIN projects p ON t.ProjectID = p.ProjectID
              ${APPROVER_JOINS}
              WHERE t.${statusColumn} IN (0, 1, 2)${whereProject}
            `;
            break;

          case 'infrastructuretransfer':
            query = `
              SELECT t.InfrastructureTransferID as id, t.Date, t.Vehicle, t.StartingPoint,
                     t.ArrivalPoint, t.Total, t.MethodID, m.MethodName, t.Observations,
                     t.Archivos, t.Status, t.ProjectID, t.ApprovedBy,
                     ${APPROVER_SELECT},
                     p.NameProject,
                     CONCAT('Traslado: ', t.Vehicle) as Concept
              FROM ${table} t
              LEFT JOIN paymentmethods m ON t.MethodID = m.MethodID
              LEFT JOIN projects p ON t.ProjectID = p.ProjectID
              ${APPROVER_JOINS}
              WHERE t.${statusColumn} IN (0, 1, 2)${whereProject}
            `;
            break;

          case 'loans':
            query = `
              SELECT t.LoansID as id, t.Date, t.Beneficiary, t.Total, t.MethodID,
                     m.MethodName, t.FirstDiscount, t.NumberOfPayments, t.Observations,
                     t.Archivos, t.Status, t.ProjectID, t.ApprovedBy,
                     ${APPROVER_SELECT},
                     p.NameProject,
                     CONCAT('Préstamo: ', t.Beneficiary) as Concept
              FROM ${table} t
              LEFT JOIN paymentmethods m ON t.MethodID = m.MethodID
              LEFT JOIN projects p ON t.ProjectID = p.ProjectID
              ${APPROVER_JOINS}
              WHERE t.${statusColumn} IN (0, 1, 2)${whereProject}
            `;
            break;

          case 'localtransportationfuel':
            query = `
              SELECT t.FuelID as id, t.Date, t.Vehicle, t.Liters, t.LiterCost as LitersCost,
                     t.Total, t.MethodID, m.MethodName, t.Observations, t.Archivos,
                     t.Status, t.ProjectID, t.ApprovedBy,
                     ${APPROVER_SELECT},
                     p.NameProject,
                     CONCAT('Combustible local: ', t.Vehicle) as Concept
              FROM ${table} t
              LEFT JOIN paymentmethods m ON t.MethodID = m.MethodID
              LEFT JOIN projects p ON t.ProjectID = p.ProjectID
              ${APPROVER_JOINS}
              WHERE t.${statusColumn} IN (0, 1, 2)${whereProject}
            `;
            break;

          case 'lodging':
            query = `
              SELECT t.LodgingID as id, t.PlaceAccommodation, t.CheckInDate as Date,
                     t.CheckInDate, t.Fee, t.Nights, t.Total, t.MethodID, m.MethodName, t.Observations,
                     t.Archivos, t.Status, t.ProjectID, t.ApprovedBy,
                     ${APPROVER_SELECT},
                     p.NameProject,
                     CONCAT('Hospedaje: ', t.PlaceAccommodation) as Concept,
                     DATE_ADD(t.CheckInDate, INTERVAL t.Nights DAY) as CheckOutDate
              FROM ${table} t
              LEFT JOIN paymentmethods m ON t.MethodID = m.MethodID
              LEFT JOIN projects p ON t.ProjectID = p.ProjectID
              ${APPROVER_JOINS}
              WHERE t.${statusColumn} IN (0, 1, 2)${whereProject}
            `;
            break;

          case 'personneltransfer':
            query = `
              SELECT t.PersonnelTransferID as id, t.Date, t.MeansOfTransportation as Vehicle,
                     t.StartingPoint, t.ArrivalPoint, t.Total, t.MethodID, m.MethodName,
                     t.Observations, t.Archivos, t.Status, t.ProjectID, t.ApprovedBy,
                     ${APPROVER_SELECT},
                     p.NameProject,
                     CONCAT('Traslado personal: ', t.MeansOfTransportation) as Concept
              FROM ${table} t
              LEFT JOIN paymentmethods m ON t.MethodID = m.MethodID
              LEFT JOIN projects p ON t.ProjectID = p.ProjectID
              ${APPROVER_JOINS}
              WHERE t.${statusColumn} IN (0, 1, 2)${whereProject}
            `;
            break;

          case 'uniondues':
            query = `
              SELECT t.UnionDuesID as id, t.Date, t.Concept, t.StartDate, t.EndDate,
                     t.Total, t.MethodID, m.MethodName, t.Observations, t.Archivos,
                     t.Status, t.ProjectID, t.ApprovedBy,
                     ${APPROVER_SELECT},
                     p.NameProject
              FROM ${table} t
              LEFT JOIN paymentmethods m ON t.MethodID = m.MethodID
              LEFT JOIN projects p ON t.ProjectID = p.ProjectID
              ${APPROVER_JOINS}
              WHERE t.${statusColumn} IN (0, 1, 2)${whereProject}
            `;
            break;

          case 'payroll':
            query = `
              SELECT t.PayrollID as id, t.Date, t.Concept, t.Total, t.MethodID,
                     m.MethodName, t.Observations, t.Archivos,
                     t.status as Status, t.ProjectID, t.ApprovedBy,
                     ${APPROVER_SELECT},
                     p.NameProject
              FROM ${table} t
              LEFT JOIN paymentmethods m ON t.MethodID = m.MethodID
              LEFT JOIN projects p ON t.ProjectID = p.ProjectID
              ${APPROVER_JOINS}
              WHERE (t.status IN (0, 1, 2) OR t.status IS NULL)${whereProject}
            `;
            break;

          default:
            query = `
              SELECT t.*, m.MethodName, p.NameProject,
                     ${APPROVER_SELECT}
              FROM ${table} t
              LEFT JOIN paymentmethods m ON t.MethodID = m.MethodID
              LEFT JOIN projects p ON t.ProjectID = p.ProjectID
              ${APPROVER_JOINS}
              WHERE t.${statusColumn} IN (0, 1, 2)${whereProject}
            `;
        }

        const [rows]: [ValidationRecord[], FieldPacket[]] = await connection.query<ValidationRecord[]>(
          query,
          queryParams.length > 0 ? queryParams : undefined
        );

        const processedRows = rows
          .map(row => {
            let rowId =
              row[idColumn] ??
              row.id ??
              row[`${table}ID`] ??
              (() => {
                const idKey = Object.keys(row).find(k => k.endsWith('ID') || k === 'id');
                return idKey ? row[idKey] : null;
              })();

            if (!rowId) {
              console.warn(`Registro sin ID en tabla ${table}:`, row);
              return null;
            }

            // Prioridad: nombre completo del empleado → UserName → vacío
            const fullNameFromEmployee = (row.FullNameFromEmployee || '').trim();
            const approvedByName = (row.ApprovedByName || '').trim();
            const FullName = fullNameFromEmployee || approvedByName || '';

            // Limpiamos el campo auxiliar para no enviarlo al frontend
            delete row.FullNameFromEmployee;

            return {
              ...row,
              id: rowId,
              type: key,
              FullName
            };
          })
          .filter(row => row !== null) as ValidationRecord[];

        results[`${key}s`] = processedRows;
      } catch (tableError) {
        console.error(`Error querying table ${table}:`, tableError);
        results[`${key}s`] = [];
      }
    }

    return NextResponse.json(results);

  } catch (error: any) {
    console.error('Error fetching validations:', error);
    return NextResponse.json(
      { message: 'Error fetching validations', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (error) {
        console.error('Error al cerrar la conexión:', error);
      }
    }
  }
}

export async function PUT(request: Request) {
  let connection;
  try {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { message: 'Content-Type debe ser application/json' },
        { status: 415 }
      );
    }

    const body = await request.json();

    if (!body.id || isNaN(Number(body.id))) {
      return NextResponse.json(
        { message: 'ID debe ser un número válido' },
        { status: 400 }
      );
    }

    if (!body.type || typeof body.type !== 'string') {
      return NextResponse.json(
        { message: 'Tipo de gasto no especificado' },
        { status: 400 }
      );
    }

    if (body.status === undefined || (body.status !== 1 && body.status !== 2)) {
      return NextResponse.json(
        { message: 'Status debe ser 1 (aprobado) o 2 (rechazado)' },
        { status: 400 }
      );
    }

    if (body.status === 2 && (!body.rejectionReason || body.rejectionReason.trim() === '')) {
      return NextResponse.json(
        { message: 'Debe proporcionar una razón para el rechazo' },
        { status: 400 }
      );
    }

    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json(
        { message: 'No autorizado - usuario no autenticado' },
        { status: 401 }
      );
    }

    if (user.UserTypeID !== 5) {
      return NextResponse.json(
        { message: 'Acceso denegado - Solo usuarios administrativos pueden aprobar/rechazar' },
        { status: 403 }
      );
    }

    const { id, type, status, rejectionReason } = body;
    const userId = user.SystemUserID;

    connection = await getConnection();

    const tableConfig = TABLE_CONFIG[type];
    if (!tableConfig) {
      return NextResponse.json(
        { message: 'Tipo de gasto no válido', validTypes: Object.keys(TABLE_CONFIG) },
        { status: 400 }
      );
    }

    await connection.beginTransaction();

    try {
      let updateExpenseQuery: string;
      let updateParams: any[];

      if (status === 1) {
        updateExpenseQuery = `UPDATE ${tableConfig.table} SET ${tableConfig.statusColumn} = ?, ApprovedBy = ? WHERE ${tableConfig.idColumn} = ?`;
        updateParams = [status, userId, id];
      } else {
        updateExpenseQuery = `UPDATE ${tableConfig.table} SET ${tableConfig.statusColumn} = ? WHERE ${tableConfig.idColumn} = ?`;
        updateParams = [status, id];
      }

      const [result]: any = await connection.query(updateExpenseQuery, updateParams);

      if (result.affectedRows === 0) {
        await connection.rollback();
        return NextResponse.json(
          {
            message: 'No se encontró el registro para actualizar',
            details: { table: tableConfig.table, idColumn: tableConfig.idColumn, id }
          },
          { status: 404 }
        );
      }

      if (status === 2 && rejectionReason) {
        const [expenseRows]: any = await connection.query(
          `SELECT ProjectID FROM ${tableConfig.table} WHERE ${tableConfig.idColumn} = ?`,
          [id]
        );

        const projectId = expenseRows[0]?.ProjectID || null;

        const insertRejectionQuery = `
          INSERT INTO expense_rejections
          (ExpenseID, ExpenseType, RejectionReason, RejectedBy, ProjectID)
          VALUES (?, ?, ?, ?, ?)
        `;

        await connection.query(insertRejectionQuery, [
          id,
          type,
          rejectionReason,
          userId,
          projectId
        ]);
      }

      await connection.commit();

      return NextResponse.json(
        {
          message: status === 1 ? 'Gasto aprobado correctamente' : 'Gasto rechazado correctamente',
          data: {
            table: tableConfig.table,
            id,
            newStatus: status,
            approvedBy: status === 1 ? userId : null,
            rejectionReason: status === 2 ? rejectionReason : null
          }
        },
        { status: 200 }
      );

    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    }

  } catch (error: any) {
    console.error('Error updating validation status:', error);
    return NextResponse.json(
      {
        message: 'Error al actualizar el estado',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (error) {
        console.error('Error al cerrar la conexión:', error);
      }
    }
  }
}
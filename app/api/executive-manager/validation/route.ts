import { NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import type { FieldPacket, RowDataPacket } from 'mysql2';
import { validateAndRenewSession } from '@/lib/auth';

interface ValidationRecord extends RowDataPacket {
  [key: string]: any;
}

// Función para obtener usuario de la sesión
async function getUserFromSession() {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies(); // IMPORTANTE: usar await
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

    // Solo permitir acceso a ejecutivos (UserTypeID = 4)
    if (user.UserTypeID !== 4) {
      return NextResponse.json(
        { message: 'Acceso denegado - Solo ejecutivos pueden acceder' },
        { status: 403 }
      );
    }

    const tables = [
      'administrativeconsumable',
      'consumableclient',
      'epp',
      'financingservices',
      'fuelclient',
      'infrastructuretransfer',
      'infrastructureservices',
      'installationmaterials',
      'loans',
      'localtransportationfuel',
      'lodging',
      'operativeconsumable',
      'outsourcedservices',
      'payroll',
      'personneltransfer',
      'toolsequipment',
      'uniondues',
      'waterice'
    ];

    const results: Record<string, ValidationRecord[]> = {};

    let userCondition = '';
    let queryParams: any[] = [];

    // Para usuarios tipo 4 (ejecutivos), solo ver sus proyectos
    if (user.UserTypeID === 5) {
      userCondition = ' AND p.CreatedBy = ?';
      queryParams = [user.SystemUserID];
    }

    for (const table of tables) {
      try {
        let query = '';
        const idColumn = `${table}ID`;
        
        // Obtener el nombre de la columna ID correcta
        let idColumnName = idColumn;
        if (table === 'infrastructureservices') {
          idColumnName = 'InfrastructureServiceID';
        } else if (table === 'toolsequipment') {
          idColumnName = 'ToolsequipmentID';
        } else if (table === 'localtransportationfuel') {
          idColumnName = 'FuelID';
        }

        const baseQuery = `SELECT t.*, m.MethodName, p.NameProject, u.UserName as ApprovedByName
                          FROM ${table} t 
                          LEFT JOIN paymentmethods m ON t.MethodID = m.MethodID 
                          LEFT JOIN projects p ON t.ProjectID = p.ProjectID
                          LEFT JOIN systemusers u ON t.ApprovedBy = u.SystemUserID
                          WHERE t.Status = 0${userCondition}`;

        switch (table) {
          case 'administrativeconsumable':
          case 'consumableclient':
          case 'epp':
          case 'financingservices':
          case 'installationmaterials':
          case 'operativeconsumable':
          case 'outsourcedservices':
          case 'payroll':
          case 'toolsequipment':
          case 'waterice':
          case 'infrastructureservices':
            query = baseQuery;
            break;
          case 'fuelclient':
            query = `SELECT t.FuelClientID as id, t.Date, t.Liters, t.LitersCost, t.Total, 
                    t.MethodID, m.MethodName, t.Observations, t.Archivos, t.Status, t.ProjectID,
                    p.NameProject, t.ApprovedBy, u.UserName as ApprovedByName,
                    CONCAT('Combustible: ', t.Liters, ' litros') as Concept
                    FROM ${table} t 
                    LEFT JOIN paymentmethods m ON t.MethodID = m.MethodID 
                    LEFT JOIN projects p ON t.ProjectID = p.ProjectID
                    LEFT JOIN systemusers u ON t.ApprovedBy = u.SystemUserID
                    WHERE t.Status = 0${userCondition}`;
            break;
          case 'infrastructuretransfer':
            query = `SELECT t.InfrastructureTransferID as id, t.Date, t.Vehicle, t.StartingPoint, 
                    t.ArrivalPoint, t.Total, t.MethodID, m.MethodName, t.Observations, 
                    t.Archivos, t.Status, t.ProjectID, t.ApprovedBy, u.UserName as ApprovedByName,
                    p.NameProject,
                    CONCAT('Traslado: ', t.Vehicle) as Concept
                    FROM ${table} t 
                    LEFT JOIN paymentmethods m ON t.MethodID = m.MethodID 
                    LEFT JOIN projects p ON t.ProjectID = p.ProjectID
                    LEFT JOIN systemusers u ON t.ApprovedBy = u.SystemUserID
                    WHERE t.Status = 0${userCondition}`;
            break;
          case 'loans':
            query = `SELECT t.LoansID as id, t.Date, t.Beneficiary, t.Total, t.MethodID, 
                    m.MethodName, t.FirstDiscount, t.NumberOfPayments, t.Observations, 
                    t.Archivos, t.Status, t.ProjectID, t.ApprovedBy, u.UserName as ApprovedByName,
                    p.NameProject,
                    CONCAT('Préstamo: ', t.Beneficiary) as Concept
                    FROM ${table} t 
                    LEFT JOIN paymentmethods m ON t.MethodID = m.MethodID 
                    LEFT JOIN projects p ON t.ProjectID = p.ProjectID
                    LEFT JOIN systemusers u ON t.ApprovedBy = u.SystemUserID
                    WHERE t.Status = 0${userCondition}`;
            break;
          case 'localtransportationfuel':
            query = `SELECT t.FuelID as id, t.Date, t.Vehicle, t.Liters, t.LiterCost as LitersCost, 
                    t.Total, t.MethodID, m.MethodName, t.Observations, t.Archivos, 
                    t.Status, t.ProjectID, t.ApprovedBy, u.UserName as ApprovedByName,
                    p.NameProject,
                    CONCAT('Combustible local: ', t.Vehicle) as Concept
                    FROM ${table} t 
                    LEFT JOIN paymentmethods m ON t.MethodID = m.MethodID 
                    LEFT JOIN projects p ON t.ProjectID = p.ProjectID
                    LEFT JOIN systemusers u ON t.ApprovedBy = u.SystemUserID
                    WHERE t.Status = 0${userCondition}`;
            break;
          case 'lodging':
            query = `SELECT t.LodgingID as id, t.PlaceAccommodation, t.CheckInDate as Date, 
                    t.CheckInDate, t.Fee, t.Nights, t.Total, t.MethodID, m.MethodName, t.Observations, 
                    t.Archivos, t.Status, t.ProjectID, t.ApprovedBy, u.UserName as ApprovedByName,
                    p.NameProject,
                    CONCAT('Hospedaje: ', t.PlaceAccommodation) as Concept,
                    DATE_ADD(t.CheckInDate, INTERVAL t.Nights DAY) as CheckOutDate
                    FROM ${table} t 
                    LEFT JOIN paymentmethods m ON t.MethodID = m.MethodID 
                    LEFT JOIN projects p ON t.ProjectID = p.ProjectID
                    LEFT JOIN systemusers u ON t.ApprovedBy = u.SystemUserID
                    WHERE t.Status = 0${userCondition}`;
            break;
          case 'personneltransfer':
            query = `SELECT t.PersonnelTransferID as id, t.Date, t.MeansOfTransportation as Vehicle, 
                    t.StartingPoint, t.ArrivalPoint, t.Total, t.MethodID, m.MethodName, 
                    t.Observations, t.Archivos, t.Status, t.ProjectID, t.ApprovedBy, u.UserName as ApprovedByName,
                    p.NameProject,
                    CONCAT('Traslado personal: ', t.MeansOfTransportation) as Concept
                    FROM ${table} t 
                    LEFT JOIN paymentmethods m ON t.MethodID = m.MethodID 
                    LEFT JOIN projects p ON t.ProjectID = p.ProjectID
                    LEFT JOIN systemusers u ON t.ApprovedBy = u.SystemUserID
                    WHERE t.Status = 0${userCondition}`;
            break;
          case 'uniondues':
            query = `SELECT t.UnionDuesID as id, t.Date, t.Concept, t.StartDate, t.EndDate, 
                    t.Total, t.MethodID, m.MethodName, t.Observations, t.Archivos, 
                    t.Status, t.ProjectID, t.ApprovedBy, u.UserName as ApprovedByName,
                    p.NameProject
                    FROM ${table} t 
                    LEFT JOIN paymentmethods m ON t.MethodID = m.MethodID 
                    LEFT JOIN projects p ON t.ProjectID = p.ProjectID
                    LEFT JOIN systemusers u ON t.ApprovedBy = u.SystemUserID
                    WHERE t.Status = 0${userCondition}`;
            break;
          default:
            query = baseQuery;
        }

        const [rows]: [ValidationRecord[], FieldPacket[]] = await connection.query<ValidationRecord[]>(
          query, 
          queryParams
        );
        
        const processedRows = rows.map(row => {
          let rowId;
          if (row[idColumnName]) {
            rowId = row[idColumnName];
          } else if (row.id) {
            rowId = row.id;
          } else if (row[`${table}ID`]) {
            rowId = row[`${table}ID`];
          } else {
            const idKey = Object.keys(row).find(key => key.endsWith('ID') || key === 'id');
            rowId = idKey ? row[idKey] : null;
          }

          if (!rowId) {
            console.warn(`Registro sin ID en tabla ${table}:`, row);
            return null;
          }
          
          return {
            ...row,
            id: rowId,
            type: table
          };
        }).filter(row => row !== null) as ValidationRecord[];
        
        results[`${table}s`] = processedRows;
      } catch (tableError) {
        console.error(`Error querying table ${table}:`, tableError);
        results[`${table}s`] = [];
      }
    }

    return NextResponse.json(results);

  } catch (error: any) {
    console.error('Error fetching pending validations:', error);
    return NextResponse.json(
      { 
        message: 'Error fetching pending validations', 
        error: error.message 
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

    // Validar que si es rechazo, haya razón
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

    // Solo permitir acceso a ejecutivos (UserTypeID = 4)
    if (user.UserTypeID !== 4) {
      return NextResponse.json(
        { message: 'Acceso denegado - Solo ejecutivos pueden aprobar/rechazar' },
        { status: 403 }
      );
    }

    const { id, type, status, rejectionReason } = body;
    const userId = user.SystemUserID;
    
    connection = await getConnection();

    const tableMap: Record<string, {table: string, idColumn: string}> = {
      administrativeconsumable: { table: 'administrativeconsumable', idColumn: 'AdministrativeConsumableID' },
      consumableclient: { table: 'consumableclient', idColumn: 'ConsumableClientID' },
      epp: { table: 'epp', idColumn: 'EppID' },
      financingservices: { table: 'financingservices', idColumn: 'FinancingServicesID' },
      fuelclient: { table: 'fuelclient', idColumn: 'FuelClientID' },
      infrastructuretransfer: { table: 'infrastructuretransfer', idColumn: 'InfrastructureTransferID' },
      infrastructureservices: { table: 'infrastructureservices', idColumn: 'InfrastructureServiceID' },
      installationmaterials: { table: 'installationmaterials', idColumn: 'InstallationMaterialID' },
      loans: { table: 'loans', idColumn: 'LoansID' },
      localtransportationfuel: { table: 'localtransportationfuel', idColumn: 'FuelID' },
      lodging: { table: 'lodging', idColumn: 'LodgingID' },
      operativeconsumable: { table: 'operativeconsumable', idColumn: 'OperativeConsumableID' },
      outsourcedservices: { table: 'outsourcedservices', idColumn: 'OutsourcedServiceID' },
      payroll: { table: 'payroll', idColumn: 'PayrollID' },
      personneltransfer: { table: 'personneltransfer', idColumn: 'PersonnelTransferID' },
      toolsequipment: { table: 'toolsequipment', idColumn: 'ToolsequipmentID' },
      uniondues: { table: 'uniondues', idColumn: 'UnionDuesID' },
      waterice: { table: 'waterice', idColumn: 'WaterIceID' }
    };

    const tableConfig = tableMap[type];
    if (!tableConfig) {
      return NextResponse.json(
        { message: 'Tipo de gasto no válido', validTypes: Object.keys(tableMap) },
        { status: 400 }
      );
    }

    await connection.beginTransaction();

    try {
      // Verificar permisos para usuarios tipo 4 (ejecutivos)
      if (user.UserTypeID === 5) {
        const verifyOwnershipQuery = `
          SELECT COUNT(*) as canUpdate 
          FROM ${tableConfig.table} t 
          INNER JOIN projects p ON t.ProjectID = p.ProjectID 
          WHERE t.${tableConfig.idColumn} = ? AND p.CreatedBy = ?
        `;
        
        const [ownershipResult]: any = await connection.query(
          verifyOwnershipQuery, 
          [id, userId]
        );

        if (ownershipResult[0].canUpdate === 0) {
          await connection.rollback();
          return NextResponse.json(
            { 
              message: 'No autorizado - solo puede actualizar gastos de sus propios proyectos',
              details: {
                table: tableConfig.table,
                idColumn: tableConfig.idColumn,
                id: id,
                userType: user.UserTypeID,
                userId: userId
              }
            },
            { status: 403 }
          );
        }
      }

      // 1. Actualizar el estado del gasto y el ApprovedBy (solo cuando se aprueba)
      let updateExpenseQuery;
      let updateParams;
      
      if (status === 1) {
        // Aprobación: actualizar Status y ApprovedBy
        updateExpenseQuery = `UPDATE ${tableConfig.table} SET Status = ?, ApprovedBy = ? WHERE ${tableConfig.idColumn} = ?`;
        updateParams = [status, userId, id];
      } else {
        // Rechazo: solo actualizar Status, ApprovedBy queda null
        updateExpenseQuery = `UPDATE ${tableConfig.table} SET Status = ? WHERE ${tableConfig.idColumn} = ?`;
        updateParams = [status, id];
      }
      
      const [result]: any = await connection.query(updateExpenseQuery, updateParams);

      if (result.affectedRows === 0) {
        await connection.rollback();
        return NextResponse.json(
          { 
            message: 'No se encontró el registro para actualizar',
            details: {
              table: tableConfig.table,
              idColumn: tableConfig.idColumn,
              id: id
            }
          },
          { status: 404 }
        );
      }

      // 2. Si es rechazo, guardar la razón en la tabla de rechazos
      if (status === 2 && rejectionReason) {
        // Obtener el ProjectID del gasto
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

      // 3. Actualizar notificaciones
      const updateNotificationsQuery = `
        UPDATE usernotification un
        JOIN notification n ON un.NotificationID = n.NotificationID
        SET un.IsRead = 1
        WHERE un.UserID = ? 
          AND n.RelatedEntity = ? 
          AND n.EntityID = ? 
          AND un.IsRead = 0
      `;

      const [notificationResult]: any = await connection.query(
        updateNotificationsQuery, 
        [userId, type, id]
      );

      await connection.commit();

      return NextResponse.json(
        { 
          message: status === 1 ? 'Gasto aprobado correctamente' : 'Gasto rechazado correctamente',
          data: {
            table: tableConfig.table,
            id: id,
            newStatus: status,
            approvedBy: status === 1 ? userId : null,
            rejectionReason: status === 2 ? rejectionReason : null,
            notificationsUpdated: notificationResult.affectedRows
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
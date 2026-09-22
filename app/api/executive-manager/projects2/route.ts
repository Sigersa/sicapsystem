import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { Connection } from 'mysql2/promise';

interface Project extends RowDataPacket {
  ProjectID: number;
  NameProject: string;
  ProjectAddress: string | null;
  AdminProjectID: number | null;
  StartDate: string | null;
  EndDate: string | null;
  Status: number;
  ProjectType: number;
  ProjectBudget: number | null;
  ClientID: number | null;
  AreaID: number | null;
  ExternalProjectManagerID: number | null;
  CreatedBy: number | null;
}

interface Employee extends RowDataPacket {
  EmployeeID: number;
  EmployeeType: string;
  Status: number;
}

interface Client extends RowDataPacket {
  ClientID: number;
  ClientName: string;
}

interface ExternalProjectManager extends RowDataPacket {
  ExternalProjectManagerID: number;
  NameProjectManager: string;
  ClientID: number;
  Email: string;
  Phone: string;
}

interface Area extends RowDataPacket {
  AreaID: number;
  AreaName: string;
  ClientID: number;
}

interface ProjectWithManager extends Project {
  ExternalProjectManagerName?: string;
  ExternalProjectManagerEmail?: string;
  ExternalProjectManagerPhone?: string;
}

interface CountResult extends RowDataPacket {
  count: number;
}

const tablesToCheck = [
  'administrativeconsumable',
  'consumableclient',
  'epp',
  'financingservices',
  'fuelclient',
  'infrastructuretransfer',
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

async function checkInvalidRecords(projectId: string, connection: Connection) {
  let invalidRecords: { table: string; count: number }[] = [];

  for (const table of tablesToCheck) {
    const [rows] = await connection.query<CountResult[]>(
      `SELECT COUNT(*) as count FROM ${table} WHERE ProjectID = ? AND Status = 0`,
      [projectId]
    );

    if (rows[0].count > 0) {
      invalidRecords.push({
        table,
        count: rows[0].count
      });
    }
  }

  return {
    hasInvalidRecords: invalidRecords.length > 0,
    invalidRecords,
    invalidTables: invalidRecords.map(r => `${r.table} (${r.count})`).join(', ')
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  let connection;
  
  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

    if (![4].includes(user.UserTypeID)) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    connection = await getConnection();

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const checkRecords = searchParams.get('checkRecords');
    const userId = searchParams.get('userId');
    const checkActive = searchParams.get('checkActive');
    const excludeProjectId = searchParams.get('excludeProjectId');
    const externalManagers = searchParams.get('externalManagers');
    const employeesList = searchParams.get('employees');

    // Obtener lista de empleados (para el frontend)
    if (employeesList) {
      const [employeeRows] = await connection.query<Employee[]>(`
        SELECT EmployeeID, EmployeeType, Status FROM employees
      `);
      return NextResponse.json(employeeRows);
    }

    // Obtener detalles específicos de un proyecto
    if (projectId && !checkRecords) {
      let query = `
        SELECT p.*, epm.NameProjectManager as ExternalProjectManagerName, 
               epm.Email as ExternalProjectManagerEmail, epm.Phone as ExternalProjectManagerPhone
        FROM projects p
        LEFT JOIN externalprojectmanager epm ON p.ExternalProjectManagerID = epm.ExternalProjectManagerID
        WHERE p.ProjectID = ?
      `;
      const params: any[] = [projectId];

      if (user.UserTypeID === 5) {
        query += ` AND p.CreatedBy = ?`;
        params.push(user.UserID);
      }

      const [projectRows] = await connection.query<ProjectWithManager[]>(query, params);

      if (projectRows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Proyecto no encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json(projectRows[0]);
    }

    // Obtener administradores externos
    if (externalManagers) {
      const [managers] = await connection.query<ExternalProjectManager[]>(`
        SELECT * FROM externalprojectmanager ORDER BY NameProjectManager ASC
      `);
      return NextResponse.json(managers);
    }

    // Verificar registros no validados
    if (checkRecords && projectId) {
      let permissionQuery = `SELECT ProjectID FROM projects WHERE ProjectID = ?`;
      const permissionParams: any[] = [projectId];

      if (user.UserTypeID === 5) {
        permissionQuery += ` AND CreatedBy = ?`;
        permissionParams.push(user.UserID);
      }

      const [permissionRows] = await connection.query<RowDataPacket[]>(permissionQuery, permissionParams);

      if (permissionRows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'No tiene permisos para acceder a este proyecto' },
          { status: 403 }
        );
      }

      const { hasInvalidRecords, invalidTables } = await checkInvalidRecords(projectId, connection);
      return NextResponse.json({ hasInvalidRecords, invalidTables });
    }

    // Verificar proyectos activos del usuario
    if (checkActive && userId) {
      if (user.UserTypeID === 5 && parseInt(userId) !== user.UserID) {
        return NextResponse.json(
          { success: false, message: 'No tiene permisos para verificar proyectos de otros usuarios' },
          { status: 403 }
        );
      }

      let query = `SELECT COUNT(*) as count FROM projects WHERE AdminProjectID = ? AND Status = 0`;
      const params: any[] = [userId];

      if (excludeProjectId) {
        query += ` AND ProjectID != ?`;
        params.push(excludeProjectId);
      }

      const [rows] = await connection.query<CountResult[]>(query, params);
      const hasActiveProject = rows[0].count > 0;
      return NextResponse.json({ hasActiveProject });
    }

    // Obtener todos los proyectos con información del manager externo
    let projectsQuery = `
      SELECT p.*, epm.NameProjectManager as ExternalProjectManagerName, 
             epm.Email as ExternalProjectManagerEmail, epm.Phone as ExternalProjectManagerPhone
      FROM projects p
      LEFT JOIN externalprojectmanager epm ON p.ExternalProjectManagerID = epm.ExternalProjectManagerID
    `;
    const projectsParams: any[] = [];

    if (user.UserTypeID === 5) {
      projectsQuery += ` WHERE p.CreatedBy = ?`;
      projectsParams.push(user.UserID);
    }

    projectsQuery += ` ORDER BY p.ProjectID DESC`;

    const [projects] = await connection.query<ProjectWithManager[]>(projectsQuery, projectsParams);

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error en GET /api/projects2:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Error al obtener datos de proyectos',
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  let connection;
  
  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

    if (![4].includes(user.UserTypeID)) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    const {
      NameProject,
      ProjectAddress,
      Status = 0,
      AdminProjectID,
      ClientID,
      ProjectType,
      ProjectBudget,
      ExternalProjectManagerName,
      ExternalProjectManagerEmail,
      ExternalProjectManagerPhone,
      AreaID,
      StartDate
    } = body;

    if (!NameProject) {
      return NextResponse.json(
        { success: false, message: 'El nombre del proyecto es requerido' },
        { status: 400 }
      );
    }

    if (!AdminProjectID) {
      return NextResponse.json(
        { success: false, message: 'El administrador de proyecto es requerido' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Verificar que el empleado exista
    const [employeeRows] = await connection.query<Employee[]>(
      'SELECT EmployeeID FROM employees WHERE EmployeeID = ?',
      [AdminProjectID]
    );
    if (employeeRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'El empleado especificado no existe' },
        { status: 400 }
      );
    }

    if (ClientID) {
      const [clientRows] = await connection.query<Client[]>(
        'SELECT ClientID FROM clients WHERE ClientID = ?',
        [ClientID]
      );
      if (clientRows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'El cliente especificado no existe' },
          { status: 400 }
        );
      }
    }

    // Validar área si el cliente es Siemens (ClientID = 1)
    if (ClientID == 1 && !AreaID) {
      return NextResponse.json(
        { success: false, message: 'El área es requerida para proyectos de Siemens' },
        { status: 400 }
      );
    }

    if (ClientID == 1 && AreaID) {
      const [areaRows] = await connection.query<Area[]>(
        'SELECT AreaID FROM areas WHERE AreaID = ? AND ClientID = ?',
        [AreaID, ClientID]
      );
      if (areaRows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'El área especificada no existe para este cliente' },
          { status: 400 }
        );
      }
    }

    // Crear o encontrar el administrador externo
    let externalManagerId = null;
    if (ExternalProjectManagerName) {
      const [existingManager] = await connection.query<ExternalProjectManager[]>(
        `SELECT ExternalProjectManagerID FROM externalprojectmanager 
         WHERE NameProjectManager = ? AND Email = ? AND Phone = ? AND ClientID = ?`,
        [ExternalProjectManagerName, ExternalProjectManagerEmail || '', ExternalProjectManagerPhone || '', ClientID]
      );

      if (existingManager.length > 0) {
        externalManagerId = existingManager[0].ExternalProjectManagerID;
      } else {
        const [managerResult] = await connection.query<ResultSetHeader>(
          `INSERT INTO externalprojectmanager 
           (NameProjectManager, ClientID, Email, Phone) 
           VALUES (?, ?, ?, ?)`,
          [ExternalProjectManagerName, ClientID, ExternalProjectManagerEmail || '', ExternalProjectManagerPhone || '']
        );
        externalManagerId = managerResult.insertId;
      }
    }

    const startDate = StartDate || new Date().toISOString().split('T')[0];

    const [result] = await connection.query<ResultSetHeader>(`
      INSERT INTO projects 
      (NameProject, ProjectAddress, AdminProjectID, StartDate, Status, ProjectType, ProjectBudget, AreaID, ClientID, ExternalProjectManagerID, CreatedBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      NameProject,
      ProjectAddress || null,
      AdminProjectID,
      startDate,
      Status,
      ProjectType || null,
      ProjectBudget || null,
      ClientID == 1 ? AreaID : null,
      ClientID || null,
      externalManagerId,
      user.UserID
    ]);

    const [projectRows] = await connection.query<Project[]>(`
      SELECT * FROM projects WHERE ProjectID = ?
    `, [result.insertId]);

    const newProject = projectRows[0];

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    console.error('Error al crear proyecto:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Error al crear proyecto',
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
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

export async function PUT(request: NextRequest): Promise<NextResponse> {
  let connection;
  
  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

    if (![4].includes(user.UserTypeID)) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('id');
    const isCompleteAction = searchParams.get('complete') === 'true';

    if (!projectId) {
      return NextResponse.json(
        { success: false, message: 'ID de proyecto es requerido' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Verificar permisos para el proyecto
    let permissionQuery = `SELECT * FROM projects WHERE ProjectID = ?`;
    const permissionParams: any[] = [projectId];

    if (user.UserTypeID === 5) {
      permissionQuery += ` AND CreatedBy = ?`;
      permissionParams.push(user.UserID);
    }

    const [projectRows] = await connection.query<Project[]>(permissionQuery, permissionParams);

    if (projectRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Proyecto no encontrado o no tiene permisos para editarlo' },
        { status: 404 }
      );
    }

    const project = projectRows[0];

    if (isCompleteAction) {
      if (project.Status === 1) {
        return NextResponse.json(
          { success: true, message: 'El proyecto ya está concluido' },
          { status: 200 }
        );
      }

      const { hasInvalidRecords, invalidTables } = await checkInvalidRecords(projectId, connection);

      if (hasInvalidRecords) {
        return NextResponse.json(
          {
            success: false,
            message: 'No se puede concluir el proyecto porque tiene registros no validados',
            invalidTables
          },
          { status: 400 }
        );
      }

      const [result] = await connection.query<ResultSetHeader>(
        'UPDATE projects SET Status = 1, EndDate = NOW() WHERE ProjectID = ?',
        [projectId]
      );

      if (result.affectedRows === 0) {
        return NextResponse.json(
          { success: false, message: 'No se pudo actualizar el proyecto' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: true, message: 'Proyecto marcado como concluido correctamente' },
        { status: 200 }
      );
    } else {
      const body = await request.json();
      
      const {
        NameProject,
        AdminProjectID,
        ClientID,
        ProjectType,
        ProjectBudget,
        ExternalProjectManagerName,
        ExternalProjectManagerEmail,
        ExternalProjectManagerPhone,
        AreaID
      } = body;

      if (!NameProject) {
        return NextResponse.json(
          { success: false, message: 'El nombre del proyecto es requerido' },
          { status: 400 }
        );
      }

      if (AdminProjectID) {
        const [employeeRows] = await connection.query<Employee[]>(
          'SELECT EmployeeID FROM employees WHERE EmployeeID = ?',
          [AdminProjectID]
        );
        if (employeeRows.length === 0) {
          return NextResponse.json(
            { success: false, message: 'El empleado especificado no existe' },
            { status: 400 }
          );
        }
      }

      if (ClientID) {
        const [clientRows] = await connection.query<Client[]>(
          'SELECT ClientID FROM clients WHERE ClientID = ?',
          [ClientID]
        );
        if (clientRows.length === 0) {
          return NextResponse.json(
            { success: false, message: 'El cliente especificado no existe' },
            { status: 400 }
          );
        }
      }

      if (ClientID == 1 && !AreaID) {
        return NextResponse.json(
          { success: false, message: 'El área es requerida para proyectos de Siemens' },
          { status: 400 }
        );
      }

      if (ClientID == 1 && AreaID) {
        const [areaRows] = await connection.query<Area[]>(
          'SELECT AreaID FROM areas WHERE AreaID = ? AND ClientID = ?',
          [AreaID, ClientID]
        );
        if (areaRows.length === 0) {
          return NextResponse.json(
            { success: false, message: 'El área especificada no existe para este cliente' },
            { status: 400 }
          );
        }
      }

      let externalManagerId = null;
      if (ExternalProjectManagerName) {
        const [existingManager] = await connection.query<ExternalProjectManager[]>(
          `SELECT ExternalProjectManagerID FROM externalprojectmanager 
           WHERE NameProjectManager = ? AND Email = ? AND Phone = ? AND ClientID = ?`,
          [ExternalProjectManagerName, ExternalProjectManagerEmail || '', ExternalProjectManagerPhone || '', ClientID]
        );

        if (existingManager.length > 0) {
          externalManagerId = existingManager[0].ExternalProjectManagerID;
        } else {
          const [managerResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO externalprojectmanager 
             (NameProjectManager, ClientID, Email, Phone) 
             VALUES (?, ?, ?, ?)`,
            [ExternalProjectManagerName, ClientID, ExternalProjectManagerEmail || '', ExternalProjectManagerPhone || '']
          );
          externalManagerId = managerResult.insertId;
        }
      }

      const [result] = await connection.query<ResultSetHeader>(`
        UPDATE projects 
        SET NameProject = ?, AdminProjectID = ?, ClientID = ?, ProjectType = ?, ProjectBudget = ?, 
            ExternalProjectManagerID = ?, AreaID = ?
        WHERE ProjectID = ?
      `, [
        NameProject,
        AdminProjectID || null,
        ClientID || null,
        ProjectType || null,
        ProjectBudget || null,
        externalManagerId,
        ClientID == 1 ? AreaID : null,
        projectId
      ]);

      if (result.affectedRows === 0) {
        return NextResponse.json(
          { success: false, message: 'No se pudo actualizar el proyecto' },
          { status: 400 }
        );
      }

      const [updatedProjectRows] = await connection.query<ProjectWithManager[]>(
        `SELECT p.*, epm.NameProjectManager as ExternalProjectManagerName, 
                epm.Email as ExternalProjectManagerEmail, epm.Phone as ExternalProjectManagerPhone
         FROM projects p
         LEFT JOIN externalprojectmanager epm ON p.ExternalProjectManagerID = epm.ExternalProjectManagerID
         WHERE p.ProjectID = ?`,
        [projectId]
      );

      const updatedProject = updatedProjectRows[0];

      return NextResponse.json(updatedProject, { status: 200 });
    }
  } catch (error) {
    console.error('Error al actualizar proyecto:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Error al actualizar proyecto',
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
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

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  let connection;
  
  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

    if (![4].includes(user.UserTypeID)) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('id');

    if (!projectId) {
      return NextResponse.json(
        { success: false, message: 'ID de proyecto es requerido' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    let permissionQuery = `SELECT * FROM projects WHERE ProjectID = ?`;
    const permissionParams: any[] = [projectId];

    if (user.UserTypeID === 5) {
      permissionQuery += ` AND CreatedBy = ?`;
      permissionParams.push(user.UserID);
    }

    const [projectRows] = await connection.query<Project[]>(permissionQuery, permissionParams);

    if (projectRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Proyecto no encontrado o no tiene permisos para eliminarlo' },
        { status: 404 }
      );
    }

    const [result] = await connection.query<ResultSetHeader>(
      'DELETE FROM projects WHERE ProjectID = ?',
      [projectId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: 'No se pudo eliminar el proyecto' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Proyecto eliminado correctamente' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error al eliminar proyecto:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Error al eliminar proyecto',
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
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
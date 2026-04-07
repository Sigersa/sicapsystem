import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

// Interface para empleado base
interface BaseEmployee {
  EmployeeID: number;
  BasePersonnelID: number;
  FirstName: string;
  LastName: string;
  MiddleName: string | null;
  Position: string;
  Area: string;
  Salary: number;
  WorkSchedule: string;
  RFC: string;
  CURP: string;
  NSS: string;
  Email: string;
  Phone: string;
  tipo: 'BASE';
  Status?: number;
}

// Interface para empleado de proyecto
interface ProjectEmployee {
  EmployeeID: number;
  ProjectPersonnelID: number;
  FirstName: string;
  LastName: string;
  MiddleName: string | null;
  ProjectName: string;
  ProjectID: number;
  Position: string;
  Salary: number;
  WorkSchedule: string;
  StartDate: string;
  EndDate: string | null;
  RFC: string;
  CURP: string;
  NSS: string;
  Email: string;
  Phone: string;
  tipo: 'PROJECT';
  Status?: number;
}

export async function GET(request: NextRequest) {
  let connection;
  
  try {
    // Validar sesión
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    // Validar y renovar la sesión
    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

    // Verificar permisos (solo administradores)
    if (user.UserTypeID !== 2) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    // Obtener conexión a la base de datos
    connection = await getConnection();

    // Obtener parámetros de consulta (opcional)
    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo');
    const search = url.searchParams.get('search');

    // Array para almacenar todos los empleados
    let allEmployees: (BaseEmployee | ProjectEmployee)[] = [];

    // 1. Obtener personal base incluyendo Status
    const [baseEmployees] = await connection.execute(`
      SELECT 
        e.EmployeeID,
        e.Status,
        bp.BasePersonnelID,
        bp.FirstName,
        bp.LastName,
        bp.MiddleName,
        bp.Position,
        bp.Area,
        bp.Salary,
        bp.WorkSchedule,
        bpi.RFC,
        bpi.CURP,
        bpi.NSS,
        bpi.Email,
        bpi.Phone
      FROM basepersonnel bp
      INNER JOIN employees e ON bp.EmployeeID = e.EmployeeID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      ORDER BY bp.LastName, bp.FirstName
    `);

    // 2. Obtener personal de proyecto incluyendo Status
    const [projectEmployees] = await connection.execute(`
      SELECT 
        e.EmployeeID,
        e.Status,
        pp.ProjectPersonnelID,
        pp.FirstName,
        pp.LastName,
        pp.MiddleName,
        p.NameProject as ProjectName,
        pc.ProjectID,
        pc.Position,
        pc.Salary,
        pc.WorkSchedule,
        pc.StartDate,
        pc.EndDate,
        ppi.RFC,
        ppi.CURP,
        ppi.NSS,
        ppi.Email,
        ppi.Phone
      FROM projectpersonnel pp
      INNER JOIN employees e ON pp.EmployeeID = e.EmployeeID
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN projects p ON pc.ProjectID = p.ProjectID
      ORDER BY pp.LastName, pp.FirstName
    `);

    // Combinar resultados y agregar el tipo
    allEmployees = [
      ...(baseEmployees as any[]).map(emp => ({ ...emp, tipo: 'BASE' as const })),
      ...(projectEmployees as any[]).map(emp => ({ ...emp, tipo: 'PROJECT' as const }))
    ];

    // Filtrar por tipo si se especifica
    if (tipo && tipo !== 'TODOS') {
      allEmployees = allEmployees.filter(emp => emp.tipo === tipo);
    }

    // Filtrar por búsqueda si se especifica
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      allEmployees = allEmployees.filter(emp => 
        emp.FirstName.toLowerCase().includes(searchLower) ||
        emp.LastName.toLowerCase().includes(searchLower) ||
        (emp.MiddleName?.toLowerCase() || '').includes(searchLower) ||
        `${emp.FirstName} ${emp.LastName}`.toLowerCase().includes(searchLower) ||
        (emp.RFC?.toLowerCase() || '')?.includes(searchLower) ||
        (emp.CURP?.toLowerCase() || '')?.includes(searchLower) ||
        (emp.Email?.toLowerCase() || '')?.includes(searchLower) ||
        (emp.NSS?.toLowerCase() || '')?.includes(searchLower)
      );
    }

    // Ordenar por apellido y nombre
    allEmployees.sort((a, b) => {
      const nameA = `${a.LastName} ${a.FirstName}`;
      const nameB = `${b.LastName} ${b.FirstName}`;
      return nameA.localeCompare(nameB);
    });

    return NextResponse.json({
      success: true,
      employees: allEmployees,
      total: allEmployees.length
    });

  } catch (error) {
    console.error('Error al obtener empleados:', error);
    
    let errorMessage = 'ERROR AL OBTENER LA LISTA DE EMPLEADOS';
    
    if (error instanceof Error) {
      console.error('Detalles del error:', error.message);
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      },
      { status: 500 }
    );
  } finally {
    // Cerrar conexión
    if (connection) {
      try {
        await connection.release();
      } catch (error) {
        console.error('Error al cerrar la conexión:', error);
      }
    }
  }
}

// PUT - Actualizar status del empleado (dar de baja/alta)
export async function PUT(request: NextRequest) {
  let connection;
  
  try {
    // Validar sesión
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    // Validar y renovar la sesión
    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

    // Verificar permisos (solo administradores)
    if (user.UserTypeID !== 2) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    // Obtener datos de la petición
    const body = await request.json();
    const { EmployeeID, Status } = body;

    // Validar datos requeridos
    if (!EmployeeID || Status === undefined) {
      return NextResponse.json(
        { success: false, message: 'Faltan datos requeridos: EmployeeID y Status' },
        { status: 400 }
      );
    }

    // Validar que Status sea 0 o 1
    if (Status !== 0 && Status !== 1) {
      return NextResponse.json(
        { success: false, message: 'El status debe ser 0 (inactivo) o 1 (activo)' },
        { status: 400 }
      );
    }

    // Obtener conexión a la base de datos
    connection = await getConnection();

    // Verificar si el empleado existe
    const [existingEmployee] = await connection.execute(
      'SELECT EmployeeID, Status FROM employees WHERE EmployeeID = ?',
      [EmployeeID]
    );

    if ((existingEmployee as any[]).length === 0) {
      return NextResponse.json(
        { success: false, message: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Actualizar el status del empleado
    await connection.execute(
      'UPDATE employees SET Status = ? WHERE EmployeeID = ?',
      [Status, EmployeeID]
    );

    const actionText = Status === 0 ? 'dado de baja' : 'reactivado';

    return NextResponse.json({
      success: true,
      message: `Empleado ${actionText} exitosamente`,
      data: { EmployeeID, Status }
    });

  } catch (error) {
    console.error('Error al actualizar status del empleado:', error);
    
    let errorMessage = 'ERROR AL ACTUALIZAR EL ESTADO DEL EMPLEADO';
    
    if (error instanceof Error) {
      console.error('Detalles del error:', error.message);
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      },
      { status: 500 }
    );
  } finally {
    // Cerrar conexión
    if (connection) {
      try {
        await connection.release();
      } catch (error) {
        console.error('Error al cerrar la conexión:', error);
      }
    }
  }
}

// DELETE - Eliminar empleado permanentemente (solo si está inactivo)
export async function DELETE(request: NextRequest) {
  let connection;
  
  try {
    // Validar sesión
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    // Validar y renovar la sesión
    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

    // Verificar permisos (solo administradores)
    if (user.UserTypeID !== 2) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    // Obtener datos de la petición
    const body = await request.json();
    const { EmployeeID } = body;

    // Validar datos requeridos
    if (!EmployeeID) {
      return NextResponse.json(
        { success: false, message: 'Falta el EmployeeID' },
        { status: 400 }
      );
    }

    // Obtener conexión a la base de datos
    connection = await getConnection();

    // Verificar si el empleado existe y su estado
    const [existingEmployee] = await connection.execute(
      'SELECT EmployeeID, Status FROM employees WHERE EmployeeID = ?',
      [EmployeeID]
    );

    if ((existingEmployee as any[]).length === 0) {
      return NextResponse.json(
        { success: false, message: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    const employee = (existingEmployee as any[])[0];
    
    // Verificar que el empleado esté inactivo para poder eliminarlo
    if (employee.Status !== 0) {
      return NextResponse.json(
        { success: false, message: 'Solo se pueden eliminar empleados que están dados de baja (Status = 0)' },
        { status: 400 }
      );
    }

    // Iniciar transacción
    await connection.beginTransaction();

    try {
      // Primero, obtener el tipo de empleado y sus IDs relacionados
      const [employeeType] = await connection.execute(
        `SELECT 
          CASE 
            WHEN EXISTS (SELECT 1 FROM basepersonnel WHERE EmployeeID = ?) THEN 'BASE'
            WHEN EXISTS (SELECT 1 FROM projectpersonnel WHERE EmployeeID = ?) THEN 'PROJECT'
            ELSE 'UNKNOWN'
          END as EmployeeType`,
        [EmployeeID, EmployeeID]
      );

      const type = (employeeType as any[])[0]?.EmployeeType;

      if (type === 'BASE') {
        // Obtener BasePersonnelID
        const [basePersonnel] = await connection.execute(
          'SELECT BasePersonnelID FROM basepersonnel WHERE EmployeeID = ?',
          [EmployeeID]
        );
        
        if ((basePersonnel as any[]).length > 0) {
          const basePersonnelID = (basePersonnel as any[])[0].BasePersonnelID;
          
          // Eliminar información personal del personal base
          await connection.execute(
            'DELETE FROM basepersonnelpersonalinfo WHERE BasePersonnelID = ?',
            [basePersonnelID]
          );
          
          // Eliminar el registro de personal base
          await connection.execute(
            'DELETE FROM basepersonnel WHERE EmployeeID = ?',
            [EmployeeID]
          );
        }
      } else if (type === 'PROJECT') {
        // Obtener ProjectPersonnelID
        const [projectPersonnel] = await connection.execute(
          'SELECT ProjectPersonnelID FROM projectpersonnel WHERE EmployeeID = ?',
          [EmployeeID]
        );
        
        if ((projectPersonnel as any[]).length > 0) {
          const projectPersonnelID = (projectPersonnel as any[])[0].ProjectPersonnelID;
          
          // Eliminar información personal del personal de proyecto
          await connection.execute(
            'DELETE FROM projectpersonnelpersonalinfo WHERE ProjectPersonnelID = ?',
            [projectPersonnelID]
          );
          
          // Eliminar contratos de proyecto
          await connection.execute(
            'DELETE FROM projectcontracts WHERE ProjectPersonnelID = ?',
            [projectPersonnelID]
          );
          
          // Eliminar el registro de personal de proyecto
          await connection.execute(
            'DELETE FROM projectpersonnel WHERE EmployeeID = ?',
            [EmployeeID]
          );
        }
      }

      // Finalmente, eliminar el empleado
      await connection.execute(
        'DELETE FROM employees WHERE EmployeeID = ?',
        [EmployeeID]
      );

      // Confirmar transacción
      await connection.commit();

      return NextResponse.json({
        success: true,
        message: 'Empleado eliminado permanentemente'
      });

    } catch (error) {
      // Revertir transacción en caso de error
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al eliminar empleado:', error);
    
    let errorMessage = 'ERROR AL ELIMINAR EL EMPLEADO';
    
    if (error instanceof Error) {
      console.error('Detalles del error:', error.message);
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      },
      { status: 500 }
    );
  } finally {
    // Cerrar conexión
    if (connection) {
      try {
        await connection.release();
      } catch (error) {
        console.error('Error al cerrar la conexión:', error);
      }
    }
  }
}
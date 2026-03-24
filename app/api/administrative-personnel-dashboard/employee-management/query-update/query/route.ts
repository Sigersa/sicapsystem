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

    // 1. Obtener personal base
    const [baseEmployees] = await connection.execute(`
      SELECT 
        e.EmployeeID,
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

    // 2. Obtener personal de proyecto
    const [projectEmployees] = await connection.execute(`
      SELECT 
        e.EmployeeID,
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
        (emp.RFC?.toLowerCase() || '').includes(searchLower) ||
        (emp.CURP?.toLowerCase() || '').includes(searchLower) ||
        (emp.Email?.toLowerCase() || '').includes(searchLower) ||
        (emp.NSS?.toLowerCase() || '').includes(searchLower)
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
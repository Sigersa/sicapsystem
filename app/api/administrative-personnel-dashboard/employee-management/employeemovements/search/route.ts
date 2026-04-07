// app/api/administrative-personnel-dashboard/employee-management/employeemovements/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

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

    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');

    if (!term) {
      return NextResponse.json({
        success: true,
        employees: []
      });
    }

    connection = await getConnection();

    // Buscar en basepersonnel (BASE)
    const [baseResults] = await connection.execute(
      `SELECT 
        bp.EmployeeID,
        bp.FirstName,
        bp.LastName,
        bp.MiddleName,
        bp.Position,
        bp.Area,
        e.Status,
        'BASE' as tipo
      FROM basepersonnel bp
      INNER JOIN employees e ON e.EmployeeID = bp.EmployeeID
      WHERE bp.EmployeeID LIKE ? 
         OR bp.FirstName LIKE ? 
         OR bp.LastName LIKE ?
         OR CONCAT(bp.FirstName, ' ', bp.LastName, ' ', COALESCE(bp.MiddleName, '')) LIKE ?
         AND e.Status = 1
      LIMIT 10`,
      [`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`]
    );

    // Buscar en projectpersonnel (PROJECT)
    const [projectResults] = await connection.execute(
      `SELECT 
        pp.EmployeeID,
        pp.FirstName,
        pp.LastName,
        pp.MiddleName,
        pc.Position,
        p.NameProject,
        e.Status,
        'PROJECT' as tipo
      FROM projectpersonnel pp
      INNER JOIN employees e ON e.EmployeeID = pp.EmployeeID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN projects p ON pc.ProjectID = p.ProjectID
      WHERE pp.EmployeeID LIKE ? 
         OR pp.FirstName LIKE ? 
         OR pp.LastName LIKE ?
         OR CONCAT(pp.FirstName, ' ', pp.LastName, ' ', COALESCE(pp.MiddleName, '')) LIKE ?
         AND e.Status = 1
      LIMIT 10`,
      [`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`]
    );

    const employees = [...(baseResults as any[]), ...(projectResults as any[])];

    return NextResponse.json({
      success: true,
      employees
    });

  } catch (error) {
    console.error('Error al buscar empleados:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL BUSCAR EMPLEADOS',
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
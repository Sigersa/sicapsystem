import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
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

    if (user.UserTypeID !== 2 && user.UserTypeID !== 1) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    connection = await getConnection();

    const [projects] = await connection.execute(
      `SELECT 
          p.ProjectID,
          p.NameProject,
          p.ProjectAddress,
          p.AdminProjectID,
          p.StartDate,
          p.EndDate,
          p.Status,
          CONCAT(
            COALESCE(bp.FirstName, ''), ' ', 
            COALESCE(bp.LastName, ''), ' ', 
            COALESCE(bp.MiddleName, '')
          ) as AdminName,
          bp.Position as AdminPosition
      FROM projects p
      LEFT JOIN employees e ON e.EmployeeID = p.AdminProjectID
      LEFT JOIN basepersonnel bp ON bp.EmployeeID = e.EmployeeID
      WHERE p.Status = 1
      ORDER BY p.NameProject ASC`
    );

    await connection.release();

    return NextResponse.json(projects);

  } catch (error) {
    console.error('Error al obtener proyectos:', error);
    
    if (connection) {
      try {
        await connection.release();
      } catch (err) {
        console.error('Error al cerrar la conexión:', err);
      }
    }
    
    return NextResponse.json(
      { error: 'ERROR AL OBTENER LOS PROYECTOS' },
      { status: 500 }
    );
  }
}
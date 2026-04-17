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

    // Obtener conexión a la base de datos
    connection = await getConnection();

    // Consultar proyectos activos (Status = 1)
    const [projects] = await connection.execute(
      `SELECT 
        ProjectID,
        NameProject,
        ProjectAddress,
        AdminProjectID,
        StartDate,
        EndDate,
        Status
      FROM projects 
      WHERE Status = 1
      ORDER BY NameProject ASC`
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
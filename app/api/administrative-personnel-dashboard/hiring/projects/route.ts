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

    // Verificar permisos (usuario administrativo)
    if (user.UserTypeID !== 2) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
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

    return NextResponse.json({
      success: true,
      projects: projects,
      message: 'PROYECTOS OBTENIDOS EXITOSAMENTE'
    });

  } catch (error) {
    console.error('Error al obtener proyectos:', error);
    
    if (connection) {
      try {
        await connection.release();
      } catch (err) {
        console.error('Error al cerrar la conexión:', err);
      }
    }
    
    let errorMessage = 'ERROR AL OBTENER LOS PROYECTOS. POR FAVOR, INTENTE NUEVAMENTE.';
    
    if (error instanceof Error) {
      console.error('Detalles del error:', error.message);
      if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'ERROR DE CONEXIÓN A LA BASE DE DATOS. VERIFIQUE EL SERVIDOR.';
      } else if (error.message.includes('ER_NO_SUCH_TABLE')) {
        errorMessage = 'ERROR: TABLA DE PROYECTOS NO ENCONTRADA.';
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
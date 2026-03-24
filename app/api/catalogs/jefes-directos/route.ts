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

    // Verificar permisos (UserTypeID 2 = Administrativo, 1 = Admin General, 3 = RH)
    if (![1, 2, 3].includes(user.UserTypeID)) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    connection = await getConnection();

    // Obtener todos los empleados que pueden ser jefes directos
    // Incluimos tanto personal base como de proyecto
    const query = `
      SELECT 
        e.EmployeeID as id,
        bp.FirstName,
        bp.LastName,
        bp.MiddleName,
        bp.Position as puesto,
        'BASE' as tipoPersonal,
        CONCAT(bp.FirstName, ' ', bp.LastName, IFNULL(CONCAT(' ', bp.MiddleName), '')) as nombreCompleto
      FROM basepersonnel bp
      INNER JOIN employees e ON e.EmployeeID = bp.EmployeeID
      WHERE e.EmployeeType = 'BASE'
      
      UNION ALL
      
      SELECT 
        e.EmployeeID as id,
        pp.FirstName,
        pp.LastName,
        pp.MiddleName,
        pc.Position as puesto,
        'PROJECT' as tipoPersonal,
        CONCAT(pp.FirstName, ' ', pp.LastName, IFNULL(CONCAT(' ', pp.MiddleName), '')) as nombreCompleto
      FROM projectpersonnel pp
      INNER JOIN employees e ON e.EmployeeID = pp.EmployeeID
      INNER JOIN projectcontracts pc ON pc.ProjectPersonnelID = pp.ProjectPersonnelID
      WHERE e.EmployeeType = 'PROJECT'
      
      ORDER BY nombreCompleto
    `;

    const [rows] = await connection.execute(query);

    return NextResponse.json(rows, { status: 200 });

  } catch (error) {
    console.error('Error al obtener jefes directos:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL OBTENER LA LISTA DE JEFES DIRECTOS',
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
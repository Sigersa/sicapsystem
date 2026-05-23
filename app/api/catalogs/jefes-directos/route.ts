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
    // Usamos COALESCE para priorizar un tipo si el empleado aparece en ambas tablas
    const query = `
      SELECT DISTINCT
        e.EmployeeID as id,
        bp.FirstName,
        bp.LastName,
        bp.MiddleName,
        bp.Position,
		TRIM(CONCAT(
          COALESCE(bp.FirstName), ' ',
          COALESCE(bp.LastName), ' ',
          COALESCE(bp.MiddleName), '')
        ) as nombreCompleto
      FROM employees e
      LEFT JOIN basepersonnel bp ON e.EmployeeID = bp.EmployeeID
      WHERE e.Status = 1
        AND (bp.BasePersonnelID IS NOT NULL)
      ORDER BY nombreCompleto
    `;

    const [rows] = await connection.execute(query);

    // Asegurar que no haya IDs duplicados usando un Map
    const uniqueJefesMap = new Map<number, any>();
    
    for (const jefe of (rows as any[])) {
      if (!uniqueJefesMap.has(jefe.id)) {
        uniqueJefesMap.set(jefe.id, jefe);
      }
    }
    
    const uniqueJefes = Array.from(uniqueJefesMap.values());

    return NextResponse.json(uniqueJefes, { status: 200 });

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
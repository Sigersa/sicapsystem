import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { validateAndRenewSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  let connection;
  
  try {
    const sessionId = req.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "NO AUTORIZADO" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json({ error: "SESIÓN INVÁLIDA" }, { status: 401 });
    }

    if (user.UserTypeID !== 2 && user.UserTypeID !== 1) {
      return NextResponse.json({ error: "ACCESO DENEGADO" }, { status: 403 });
    }

    connection = await getConnection();
    
    const [personalBase] = await connection.execute(
      `SELECT 
          e.EmployeeID as id,
          CONCAT(
            bp.FirstName, ' ', 
            bp.LastName, ' ', 
            COALESCE(bp.MiddleName, '')
          ) as nombreCompleto,
          bp.FirstName,
          bp.LastName,
          bp.MiddleName,
          bp.Position as puesto
      FROM employees e
      INNER JOIN basepersonnel bp ON bp.EmployeeID = e.EmployeeID
      WHERE e.Status = 1
      ORDER BY bp.FirstName ASC, bp.LastName ASC`
    );
    
    return NextResponse.json(personalBase, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching personal base:', error);
    return NextResponse.json(
      { error: 'ERROR AL OBTENER EL PERSONAL BASE' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
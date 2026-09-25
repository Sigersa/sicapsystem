import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  let connection;

  try {
    const sessionId = req.cookies.get("session")?.value;
    
    if (!sessionId) {
        return NextResponse.json({ error: "NO AUTORIZADO" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);
    
    if (!user || user.UserTypeID !== 5) {
        return NextResponse.json({ error: "ACCESO DENEGADO" }, { status: 403 });
    }

    connection = await getConnection();

    const [rows] = await connection.execute(
        `SELECT 
            MethodID as id, 
            MethodName as name 
        FROM paymentmethods 
        ORDER BY MethodName
    `);

    return NextResponse.json(rows, { status: 200 });

  } catch (error) {

    console.error('Error fetching projects:', error);
    return NextResponse.json(
        { error: 'ERROR AL OBTENER LOS MÉTODOS DE PAGO'}, 
        { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
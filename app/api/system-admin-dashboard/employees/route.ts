import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  let connection;

  try {
    const sessionId = req.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 1) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    connection = await getConnection();

    // Obtener empleados base personnel que no tienen usuario (solo base personnel, sin proyectos)
    const [rows]: any = await connection.execute(`
      SELECT 
        e.EmployeeID,
        CONCAT(bp.FirstName, ' ', bp.LastName, ' ', IFNULL(bp.MiddleName, '')) AS FullName,
        bpi.Email
      FROM employees e
      INNER JOIN basepersonnel bp 
        ON e.BasePersonnelID = bp.BasePersonnelID
      LEFT JOIN basepersonnelpersonalinfo bpi 
        ON bp.BasePersonnelID = bpi.BasePersonnelID
      LEFT JOIN systemusers su 
        ON e.EmployeeID = su.EmployeeID
      WHERE su.SystemUserID IS NULL
      ORDER BY bp.LastName, bp.FirstName
    `);

    return NextResponse.json(rows, { status: 200 });

  } catch (error) {
    console.error("Fetch employees error:", error);
    return NextResponse.json(
      { error: "Error al obtener empleados" },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
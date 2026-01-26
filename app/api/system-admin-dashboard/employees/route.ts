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

    // Obtener todos los empleados con su información de basepersonnel o projectpersonnel
    const [rows]: any = await connection.execute(`
      SELECT 
        e.EmployeeID,
        COALESCE(
          CONCAT(bp.FirstName, ' ', bp.LastName, ' ', IFNULL(bp.MiddleName, '')),
          CONCAT(pp.FirstName, ' ', pp.LastName, ' ', IFNULL(pp.MiddleName, ''))
        ) AS FullName,
        COALESCE(bpi.Email) AS Email
      FROM employees e
      LEFT JOIN basepersonnel bp ON e.BasePersonnelID = bp.BasePersonnelID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      LEFT JOIN projectpersonnel pp ON e.ProjectPersonnelID = pp.ProjectPersonnelID
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      WHERE e.EmployeeID IS NOT NULL
      ORDER BY e.EmployeeID
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
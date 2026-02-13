import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

/* =========================
   GET -> OBTENER USUARIOS
========================= */
export async function GET(req: NextRequest) {
  let connection;

  try {
    const sessionId = req.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "NO AUTORIZADO" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 1) {
      return NextResponse.json({ error: "ACCESO DENEGADO" }, { status: 403 });
    }

    connection = await getConnection();

    // Consulta mejorada - solo con base personnel (sin proyectos)
    const [rows]: any = await connection.execute(`
      SELECT 
        su.SystemUserID,
        su.UserName,
        su.UserTypeID,
        su.EmployeeID,
        ut.Type AS UserType,
        CONCAT(bp.FirstName, ' ', bp.LastName, ' ', IFNULL(bp.MiddleName, '')) AS EmployeeName,
        bpi.Email AS EmployeeEmail
      FROM systemusers su
      INNER JOIN userstypes ut 
        ON su.UserTypeID = ut.UserTypeID
      INNER JOIN employees e 
        ON su.EmployeeID = e.EmployeeID
      INNER JOIN basepersonnel bp 
        ON e.BasePersonnelID = bp.BasePersonnelID
      LEFT JOIN basepersonnelpersonalinfo bpi 
        ON bp.BasePersonnelID = bpi.BasePersonnelID
      ORDER BY su.SystemUserID DESC
    `);

    return NextResponse.json(rows, { status: 200 });

  } catch (error) {
    console.error("Fetch users error:", error);
    return NextResponse.json(
      { error: "ERROR AL OBTENER USUARIOS" },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

/* =========================
   POST → CREAR USUARIO
========================= */
export async function POST(req: NextRequest) {
  let connection;

  try {
    const sessionId = req.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "NO AUTORIZADO" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 1) {
      return NextResponse.json({ error: "ACCESO DENEGADO" }, { status: 403 });
    }

    const data = await req.json();

    connection = await getConnection();
    await connection.beginTransaction();

    // Verificar si el empleado ya tiene un usuario
    const [existingUser]: any = await connection.execute(
      `SELECT SystemUserID FROM systemusers WHERE EmployeeID = ?`,
      [data.EmployeeID]
    );

    if (existingUser.length > 0) {
      await connection.rollback();
      return NextResponse.json(
        { error: "EL EMPLEADO YA TIENE UN USUARIO ASIGNADO" },
        { status: 400 }
      );
    }

    // Verificar si el nombre de usuario ya existe
    const [existingUsername]: any = await connection.execute(
      `SELECT SystemUserID FROM systemusers WHERE UserName = ?`,
      [data.UserName]
    );

    if (existingUsername.length > 0) {
      await connection.rollback();
      return NextResponse.json(
        { error: "EL NOMBRE DE USUARIO YA EXISTE" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(data.Password, 10);

    const [result]: any = await connection.execute(
      `
      INSERT INTO systemusers 
        (UserName, Password, UserTypeID, EmployeeID, CreationDate) 
      VALUES (?, ?, ?, ?, NOW())
      `,
      [data.UserName, hashedPassword, data.UserTypeID, data.EmployeeID]
    );

    const systemUserID = result.insertId;

    await connection.commit();

    return NextResponse.json(
      { message: "USUARIO CREADO CORRECTAMENTE", systemUserID },
      { status: 201 }
    );

  } catch (error: any) {
    if (connection) await connection.rollback();

    console.error("Create user error:", error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: "EL NOMBRE DE USUARIO YA EXISTE" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "ERROR AL CREAR USUARIO: " + error.message },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
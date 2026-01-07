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
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 1) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    connection = await getConnection();

    const [rows]: any = await connection.execute(`
      SELECT 
        su.SystemUserID,
        su.UserName,
        su.UserTypeID,
        ut.Type AS UserType,
        ud.FirstName,
        ud.LastName,
        ud.MiddleName,
        ud.Email
      FROM systemusers su
      INNER JOIN userdetails ud 
        ON su.SystemUserID = ud.SystemUserID
      INNER JOIN userstypes ut 
        ON su.UserTypeID = ut.UserTypeID
      ORDER BY su.SystemUserID
    `);

    return NextResponse.json(rows, { status: 200 });

  } catch (error) {
    console.error("Fetch users error:", error);
    return NextResponse.json(
      { error: "Error al obtener usuarios" },
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
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 1) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const data = await req.json();

    connection = await getConnection();
    await connection.beginTransaction();

    const hashedPassword = await bcrypt.hash(data.Password, 10);

    const [result]: any = await connection.execute(
      `
      INSERT INTO systemusers 
        (UserName, Password, UserTypeID, CreationDate) 
      VALUES (?, ?, ?, NOW())
      `,
      [data.UserName, hashedPassword, data.UserTypeID]
    );

    await connection.execute(
      `
      INSERT INTO userdetails 
        (SystemUserID, FirstName, LastName, MiddleName, Email) 
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        result.insertId,
        data.FirstName,
        data.LastName,
        data.MiddleName || "",
        data.Email
      ]
    );

    await connection.commit();

    return NextResponse.json(
      { message: "Usuario creado correctamente" },
      { status: 201 }
    );

  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "Error al crear usuario" },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

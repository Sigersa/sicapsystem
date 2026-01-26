import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

/* ======================
   PUT -> EDITAR USUARIOS
=======================*/
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  let connection;

  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 1) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    } 

    const { id } = await params;
    const data = await request.json();
    
    connection = await getConnection();
    await connection.beginTransaction();

    // Solo actualizamos UserTypeID y Password si se proporciona
    let updateQuery = `UPDATE systemusers SET UserTypeID = ?`;
    const queryParams: any[] = [Number(data.UserTypeID)];

    if (data.Password) {
      const hashedPassword = await bcrypt.hash(data.Password, 10);
      updateQuery += `, Password = ?`;
      queryParams.push(hashedPassword);
    }

    updateQuery += ` WHERE SystemUserID = ?`;
    queryParams.push(id);

    const [updateUser]: any = await connection.execute(updateQuery, queryParams);

    if (updateUser.affectedRows === 0) {
      await connection.rollback();
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    await connection.commit();

    return NextResponse.json(
      { message: "Usuario actualizado correctamente" },
      { status: 200 }
    );

  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Error al actualizar usuario" },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
} 

/* ======================
   PATCH -> DAR DE BAJA/REACTIVAR USUARIO
=======================*/
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let connection;

  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 1) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { id } = await params;
    const data = await request.json();
    
    connection = await getConnection();
    await connection.beginTransaction();

    const userTypeID = data.UserTypeID !== undefined ? Number(data.UserTypeID) : 0;

    const [result]: any = await connection.execute(
      `UPDATE systemusers 
       SET UserTypeID = ? 
       WHERE SystemUserID = ?`,
      [userTypeID, id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    await connection.commit();

    const message = userTypeID === 0 
      ? "Usuario dado de baja correctamente"
      : "Usuario reactivado correctamente";

    return NextResponse.json(
      { message },
      { status: 200 }
    );

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Deactivate/Reactivate user error:", error);
    return NextResponse.json(
      { error: "Error al actualizar el estado del usuario" },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

/*==========================
   DELETE -> ELIMINAR USUARIO
==========================*/
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  let connection;

  try {
    const sessionId = _request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 1 ){
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { id } = await params;
    connection = await getConnection();
    await connection.beginTransaction();

    const [result]: any = await connection.execute(
      "DELETE FROM systemusers WHERE SystemUserID = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    await connection.commit();

    return NextResponse.json(
      { message: "Usuario eliminado correctamente" },
      { status: 200 }
    );

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Error al eliminar usuario" },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
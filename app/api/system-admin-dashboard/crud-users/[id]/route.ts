import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

export async function PUT(
  request: NextRequest, 
  context: { params: Promise<{ id: string }> }
) {
  let connection;
  const params = await context.params;
  const { id } = params;

  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 1) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    } 

    const data = await request.json();
    
    // Validaciones
    if (!data.UserTypeID || data.UserTypeID === 0) {
      return NextResponse.json({ error: "UserTypeID es requerido" }, { status: 400 });
    }

    connection = await getConnection();
    await connection.beginTransaction();

    // Verificar que el usuario existe
    const [existingUser]: any = await connection.execute(
      `SELECT SystemUserID FROM systemusers WHERE SystemUserID = ?`,
      [id]
    );

    if (existingUser.length === 0) {
      await connection.rollback();
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    let updateQuery = `UPDATE systemusers SET UserTypeID = ?`;
    const queryParams: any[] = [Number(data.UserTypeID)];

    if (data.Password && data.Password.trim() !== '') {
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
        { error: "No se pudo actualizar el usuario" },
        { status: 400 }
      );
    }

    await connection.commit();

    return NextResponse.json(
      { message: "Usuario actualizado correctamente" },
      { status: 200 }
    );

  } catch (error: any) {
    if (connection) await connection.rollback();

    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Error al actualizar usuario: " + error.message },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let connection;
  const params = await context.params;
  const { id } = params;

  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 1) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const data = await request.json();
    
    if (data.UserTypeID === undefined) {
      return NextResponse.json({ error: "UserTypeID es requerido" }, { status: 400 });
    }

    const userTypeID = Number(data.UserTypeID);
    
    connection = await getConnection();
    await connection.beginTransaction();

    // Verificar que el usuario existe
    const [existingUser]: any = await connection.execute(
      `SELECT SystemUserID FROM systemusers WHERE SystemUserID = ?`,
      [id]
    );

    if (existingUser.length === 0) {
      await connection.rollback();
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Verificar que no se está modificando el usuario actual
    if (Number(id) === user.SystemUserID) {
      await connection.rollback();
      return NextResponse.json(
        { error: "No puedes modificar tu propio estado" },
        { status: 400 }
      );
    }

    const [result]: any = await connection.execute(
      `UPDATE systemusers 
       SET UserTypeID = ? 
       WHERE SystemUserID = ?`,
      [userTypeID, id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return NextResponse.json(
        { error: "No se pudo actualizar el estado del usuario" },
        { status: 400 }
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

  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error("Deactivate/Reactivate user error:", error);
    return NextResponse.json(
      { error: "Error al actualizar el estado del usuario: " + error.message },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let connection;
  const params = await context.params;
  const { id } = params;

  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 1){
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }
    
    // Verificar que no se está eliminando el usuario actual
    if (Number(id) === user.SystemUserID) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propio usuario" },
        { status: 400 }
      );
    }

    connection = await getConnection();
    await connection.beginTransaction();

    // Verificar que el usuario existe
    const [existingUser]: any = await connection.execute(
      `SELECT SystemUserID FROM systemusers WHERE SystemUserID = ?`,
      [id]
    );

    if (existingUser.length === 0) {
      await connection.rollback();
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Eliminar de systemusers
    const [result]: any = await connection.execute(
      "DELETE FROM systemusers WHERE SystemUserID = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return NextResponse.json(
        { error: "No se pudo eliminar el usuario" },
        { status: 400 }
      );
    }

    await connection.commit();

    return NextResponse.json(
      { message: "Usuario eliminado correctamente" },
      { status: 200 }
    );

  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Error al eliminar usuario: " + error.message },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
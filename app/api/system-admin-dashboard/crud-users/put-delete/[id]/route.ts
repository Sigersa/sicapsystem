import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getConnection } from "@/lib/db";


export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let connection;

  try {
    const { id } = await params;
    const data = await request.json();
    
    connection = await getConnection();
    await connection.beginTransaction();

      const [updateUser]: any = await connection.execute(
        `UPDATE systemusers 
         SET UserName = ?, UserTypeID = ?
         WHERE SystemUserID = ?`,
        [
          data.UserName,
          Number(data.UserTypeID),
          id
        ]
      );

      if (updateUser.affectedRows === 0) {
        await connection.rollback();
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 404 }
        );
      }

      await connection.execute(
        `UPDATE userdetails 
         SET FirstName = ?, LastName = ?, MiddleName = ?, Email = ?
         WHERE SystemUserID = ?`,
        [
          data.FirstName ?? null,
          data.LastName ?? null,
          data.MiddleName ?? null,
          data.Email ?? null,
          id
        ]
      );

      if (data.Password) {
        const hashedPassword = await bcrypt.hash(data.Password, 10);

        await connection.execute(
          `UPDATE systemusers 
           SET Password = ?
           WHERE SystemUserID = ?`,
          [hashedPassword, id]
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



export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  let connection;

  try {
    const { id } = await params;
    connection = await getConnection();
    await connection.beginTransaction();

      await connection.execute(
        "DELETE FROM userdetails WHERE SystemUserID = ?",
        [id]
      );

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

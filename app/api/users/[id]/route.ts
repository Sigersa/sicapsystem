import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getConnection } from "@/lib/db";


export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await req.json();
    const conn = await getConnection();

    try {
      const [result]: any = await conn.execute(
        `UPDATE systemusers 
         SET UserName = ?, UserTypeID = ?
         WHERE SystemUserID = ?`,
        [
          data.UserName,
          Number(data.UserTypeID),
          id
        ]
      );

      if (result.affectedRows === 0) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 404 }
        );
      }

      await conn.execute(
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
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(data.Password, salt);

        await conn.execute(
          `UPDATE systemusers 
           SET Password = ?
           WHERE SystemUserID = ?`,
          [hashedPassword, id]
        );
      }

      return NextResponse.json({
        message: "Usuario actualizado correctamente"
      });

    } finally {
      conn.release();
    }

  } catch (error) {
    console.error("ERROR PUT /api/users/[id]:", error);
    return NextResponse.json(
      { error: "Error al actualizar usuario" },
      { status: 500 }
    );
  }
}


export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conn = await getConnection();

    try {
      await conn.execute(
        "DELETE FROM userdetails WHERE SystemUserID = ?",
        [id]
      );

      const [result]: any = await conn.execute(
        "DELETE FROM systemusers WHERE SystemUserID = ?",
        [id]
      );

      if (result.affectedRows === 0) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        message: "Usuario eliminado correctamente"
      });

    } finally {
      conn.release();
    }

  } catch (error) {
    console.error("ERROR DELETE /api/users/[id]:", error);
    return NextResponse.json(
      { error: "Error al eliminar usuario" },
      { status: 500 }
    );
  }
}

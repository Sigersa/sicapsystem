import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
   let connection;

  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Validar y renovar la sesión
    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { error: 'Sesión inválida o expirada' },
        { status: 401 }
      );
    }

    connection = await getConnection();


        const [rows] = await connection.execute(
            'SELECT UserTypeID, Type FROM userstypes ORDER BY Type'
        );

        return NextResponse.json(rows, { status: 200 });

    } catch (error) {
        console.error('Fetch user types error:', error);
        return NextResponse.json(
            { error: 'Error al obtener tipos de usuario' },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
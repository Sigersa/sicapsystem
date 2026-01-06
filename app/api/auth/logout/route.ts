import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  let connection;

  try {
    const session = request.cookies.get('session')?.value;

    if (session) {
      connection = await getConnection();
      await connection.execute(
        'DELETE FROM sessions WHERE id = ?',
        [session]
      );
    }

    const response = NextResponse.json({ success: true }, { status: 200 });

    response.cookies.set({
      name: 'session',
      value: '',
      maxAge: 0,
      path: '/'
    });

    return response;

  } catch (error){
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Error al cerrar la sesión" },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

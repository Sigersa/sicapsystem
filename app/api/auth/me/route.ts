import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function GET(request: NextRequest) {
  let connection;

  try {
    const session = request.cookies.get('session')?.value;

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    connection = await getConnection();

    const [rows] = await connection.execute(
      `SELECT su.SystemUserID, su.UserName, su.UserTypeID
       FROM sessions s
       INNER JOIN systemusers su ON su.SystemUserID = s.user_id
       WHERE s.id = ? AND s.expires_at > NOW()`,
      [session]
    );

    const users = rows as any[];

    if (users.length === 0) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        SystemUserID: users[0].SystemUserID,
        UserName: users[0].UserName,
        UserTypeID: users[0].UserTypeID
      }
    }, 
    { status: 200 }
  );

  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.release();
  }
}
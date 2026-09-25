import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import type { FieldPacket, RowDataPacket } from 'mysql2';
import { validateAndRenewSession } from '@/lib/auth';

interface Project extends RowDataPacket {
  ProjectID: number;
  NameProject: string;
}

async function getUserFromSession() {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session')?.value;

    if (!sessionId) {
      return null;
    }

    return await validateAndRenewSession(sessionId);
  } catch (error) {
    console.error('Error getting user from session:', error);
    return null;
  }
}

export async function GET() {
  let connection;
  try {
    connection = await getConnection();

    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json(
        { message: 'No autorizado - usuario no autenticado' },
        { status: 401 }
      );
    }

    const query = `
      SELECT ProjectID, NameProject
      FROM projects
      ORDER BY NameProject ASC
    `;

    const [rows]: [Project[], FieldPacket[]] = await connection.query<Project[]>(query);

    return NextResponse.json(rows);

  } catch (error: any) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      {
        message: 'Error fetching projects',
        error: error.message
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (error) {
        console.error('Error al cerrar la conexión:', error);
      }
    }
  }
}
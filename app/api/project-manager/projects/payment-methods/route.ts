import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { validateAndRenewSession } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

interface PaymentMethod extends RowDataPacket {
  methodId: number;
  methodName: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  let connection;

  try {
    const sessionId = request.cookies.get('session')?.value;

    if (!sessionId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { error: 'Sesión inválida o expirada' },
        { status: 401 }
      );
    }

    connection = await getConnection();

    const [methods] = await connection.execute<PaymentMethod[]>(
      `SELECT 
        MethodID as methodId,
        MethodName as methodName
      FROM paymentmethods
      ORDER BY MethodName ASC`
    );

    return NextResponse.json(methods);
  } catch (error) {
    console.error('Error al obtener métodos de pago:', error);
    return NextResponse.json(
      { message: 'Error al obtener métodos de pago' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
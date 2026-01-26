import { getConnection } from '@/lib/db';

export async function validateAndRenewSession(sessionId: string) {
  const connection = await getConnection();

  try {
    const [rows]: any = await connection.execute(
      `
      SELECT 
        s.SessionID,
        u.SystemUserID,
        u.UserName,
        u.UserTypeID
      FROM sessions s
      JOIN systemusers u ON u.SystemUserID = s.SystemUserID
      WHERE s.SessionID = ?
        AND s.ExpiresAt > NOW()
      `,
      [sessionId]
    );

    if (rows.length === 0) {
      return null;
    }

    // Renovar sesión
    await connection.execute(
      `
      UPDATE sessions
      SET ExpiresAt = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
      WHERE SessionID = ?
      `,
      [sessionId]
    );

    return rows[0];

  } finally {
    connection.release();
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

export async function GET(request: NextRequest) {
    let connection;

    try {
         connection = await getConnection();

       
            const [rows] = await connection.execute(
                'SELECT UserTypeID, Type FROM userstypes ORDER BY Type'
            );

            return NextResponse.json(rows, { status: 200});
      
        }  catch (error) {
            console.error('Fetch user types error:', error);
            return NextResponse.json(
                { error: 'Error al obtener tipos de usuario' },
                { status: 500 }
            );
        } finally {
            if (connection) connection.release();
        }
}

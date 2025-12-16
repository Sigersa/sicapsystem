import { NextRequest, NextResponse } from "next/server";
import pool, { getConnection } from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(
                'SELECT UserTypeID, Type FROM userstypes ORDER BY Type'
            );
            connection.release();
            return NextResponse.json(rows, { status: 200});
        } catch (error) {
            connection.release();
            throw error;
        } 
        }  catch (error) {
            console.error('Error fetching user types:', error);
            return NextResponse.json(
                { error: 'Error al obtener tipos de usuario' },
                { status: 500 }
            );
        }
}

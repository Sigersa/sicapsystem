import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getConnection } from "@/lib/db";

export async function GET(request: NextRequest) {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute(
        `SELECT 
            su.SystemUserID, 
            su.UserName, 
            su.UserTypeID, 
            ut.Type AS UserType, 
            ud.FirstName, 
            ud.LastName, 
            ud.MiddleName, 
            ud.Email
        FROM systemusers su
        INNER JOIN userdetails ud 
        ON su.SystemUserID = ud.SystemUserID
        INNER JOIN userstypes ut 
        ON su.UserTypeID = ut.UserTypeID
        ORDER BY su.SystemUserID`
    );
        return NextResponse.json(rows, { status: 200 });

    } catch (error){
        console.error("Fetch users error:", error);
        return NextResponse.json(
            { error: "Error al obtener usuarios" },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    
    try{
        const data = await request.json();

        connection = await getConnection();
        await connection.beginTransaction();

        const hashedPassword = await bcrypt.hash(data.Password, 10);

        const [result]: any = await connection.execute(
            `INSERT INTO systemusers 
            (UserName, Password, UserTypeID, CreationDate) 
            VALUES (?, ?, ?, CURDATE ())`,
            [data.UserName, hashedPassword, data.UserTypeID]
        );
        
        await connection.execute(
            `INSERT INTO userdetails 
            (SystemUserID, FirstName, LastName, MiddleName, Email) 
            VALUES (?, ?, ?, ?, ?)`,
            [
                result.insertId,
                data.FirstName,
                data.LastName, 
                data.MiddleName || '', 
                data.Email
            ]
        );
      await connection.commit();
      return NextResponse.json(
        { message: 'Usuario Creado' }, 
        { status: 201 }
    );
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("Create use error:", error);
        return NextResponse.json(
            { error: "Error al crear usuario" },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

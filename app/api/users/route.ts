import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool, { getConnection } from "@/lib/db";

export async function GET() {
    const conn = await getConnection();
    const [rows] = await conn.execute(
        `SELECT su.SystemUserID, su.UserName, su.UserTypeID, ut.Type AS UserType, ud.FirstName, ud.LastName, ud.MiddleName, ud.Email
        FROM systemusers su
        JOIN userdetails ud ON su.SystemUserID = ud.SystemUserID
        JOIN userstypes ut ON su.UserTypeID = ut.UserTypeID`
    );
    conn.release();
    return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
        const data = await req.json();
        const conn = await getConnection();

        const hashed = await bcrypt.hash(data.Password, 10);

        await conn.beginTransaction();

        const [res]: any = await conn.execute(
            'INSERT INTO systemusers (UserName, Password, UserTypeID, CreationDate) VALUES (?, ?, ?, CURDATE ())',
            [data.UserName, hashed, data.UserTypeID]
        );
  
        await conn.execute(
            'INSERT INTO userdetails (SystemUserID, FirstName, LastName, MiddleName, Email) VALUES (?, ?, ?, ?, ?)',
            [res.insertId, data.FirstName, data.LastName, data.MiddleName || '', data.Email]
        );

        await conn.commit();
        conn.release();

        return NextResponse.json({ message: 'Usuario Creado' }, { status: 201 });
}

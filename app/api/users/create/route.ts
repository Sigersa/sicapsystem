import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool, { getConnection } from "@/lib/db";

export async function POST(request: NextRequest) {
    let connection;

    try {
        const data = await request.json();

        //Validación de campos requeridos
        const requiredFields = [
            'UserName',
            'Password',
            'UserTypeID',
            'FirstName',
            'LastName',
            'Email'
        ];

        for (const field of requiredFields) {
            if (!data[field] || data[field].toString().trim() === '') {
                return NextResponse.json(
                    { error: `El campo ${field} es requerido` },
                    { status: 400 }
                );
            }
        }

        //Validar longitud mínima de contraseña
        if (data.Password.length < 6) {
            return NextResponse.json(
                { error: 'La contraseña debe de tener al menos 6 caracteres' },
                { status: 400 }
            );
        }

        //Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.Email)) {
            return NextResponse.json(
                { error: 'El formato de email es inválido' },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        //Iniciar transacción
        await connection.beginTransaction();

        try {
            //Verificar su el nombre de usuario ya existe
            const [existingUsers] = await connection.execute(
                'SELECT SystemUserID FROM systemusers WHERE UserName = ?',
                [data.UserName.trim()]
            );

            if (Array.isArray(existingUsers) && existingUsers.length > 0) {
                await connection.rollback();
                return NextResponse.json(
                    { error: 'El nombre de usuario ya existe' },
                    { status: 400 }
                );
            }

            //Verificar si el email ya existe
            const [existingEmails] = await connection.execute(
                'SELECT SystemUserID FROM userdetails WHERE Email = ?',
                [data.Email.trim()]
            );

            if (Array.isArray(existingEmails) && existingEmails.length > 0) {
                await connection.rollback();
                return NextResponse.json(
                    { error: 'El email ya está registrado' },
                    { status: 400 }
                );
            }

            //Cifrar contraseña
            const hashedPassword = await bcrypt.hash(data.Password, 10);

            //Insertar usuario en systemusers
            const [userResult] = await connection.execute(
                'INSERT INTO systemusers (UserName, Password, CreationDate, UserTypeID) VALUES (?, ?, CURDATE(), ?)',
                [
                    data.UserName.trim(),
                    hashedPassword,
                    parseInt(data.UserTypeID)
                ]
            );

            const userId = (userResult as any).insertId;

            //Insertar detalles del usuario en user details
            await connection.execute(
                'INSERT INTO userdetails (SystemUserID, FirstName, LastName, MiddleName, Email) VALUES (?, ?, ?, ?, ?)',
                [
                    userId,
                    data.FirstName.trim(),
                    data.LastName.trim(),
                    data.MiddleName.trim() || '',
                    data.Email.trim()
                ]
            );

            //Confirmar transacción
            await connection.commit();

            return NextResponse.json(
                {
                    message: 'Usuario creado exitosamente',
                    userId: userId
                },
                { status: 201 }
            );

        } catch (error) {
            //Revertir transacción en caso de error
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Error creating user:', error);

        //Si hay una conexión abierta, liberarla
        if (connection) {
            connection.release();
        }

        return NextResponse.json(
            { error: 'Error interno del servidor al crear usuario' },
            { status: 500 }
        );
    }
}
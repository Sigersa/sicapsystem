// app/api/download/edit/FT-RH-27/route.ts

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import path from "path";
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import fs from "fs";

export async function GET(request: NextRequest) {
  let connection;
  
  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

    if (user.UserTypeID !== 2) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const incidenceId = searchParams.get("incidenceId");

    if (!incidenceId) {
      return NextResponse.json(
        { success: false, message: "Se requiere el ID de la incidencia" },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Obtener información de la incidencia y del empleado
    const [rows] = await connection.execute<any[]>(
      `SELECT 
        ei.IncidenceID,
        ei.EmployeeID,
        ei.InicidenceNumber,
        ei.Description,
        ei.Rule,
        ei.FileURL,
        ei.IncidenceDate,
        bp.Area,
        pj.NameProject,
        -- Datos del empleado
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        COALESCE(bc.StartDate, pc.StartDate) as StartDatee,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          ELSE 'PROJECT'
        END as tipo
      FROM employeeincidence ei
      -- Datos del empleado (BASE)
      LEFT JOIN basepersonnel bp ON ei.EmployeeID = bp.EmployeeID
      LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID
      -- Datos del empleado (PROJECT)
      LEFT JOIN projectpersonnel pp ON ei.EmployeeID = pp.EmployeeID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN projects pj ON pc.ProjectID = pj.ProjectID
      WHERE ei.IncidenceID = ?`,
      [incidenceId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Incidencia no encontrada' },
        { status: 404 }
      );
    }

    const inc = rows[0];

    // Función para formatear fecha como en el ejemplo de FT-RH-21
    const formatDate = (dateValue: any): string => {
      if (!dateValue) return 'NO ESPECIFICADO';
      
      try {
        const date = new Date(dateValue);
        // Verificar si es una fecha válida
        if (isNaN(date.getTime())) {
          return 'NO ESPECIFICADO';
        }
        // Usar el mismo formato que en FT-RH-21: toLocaleDateString('es-MX')
        return date.toLocaleDateString('es-MX');
      } catch (error) {
        console.error('Error al formatear fecha:', error);
        return 'NO ESPECIFICADO';
      }
    };

    // Construir nombre completo del empleado
    const employeeName = [
      inc.FirstName || '',
      inc.LastName || '',
      inc.MiddleName || ''
    ].filter(part => part && part.trim() !== '').join(' ').trim() || 'NO ESPECIFICADO';

    // Cargar plantilla Excel
    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "personnel-management",
      "FT-RH-27.xlsx"
    );

    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { success: false, message: 'Plantilla FT-RH-27 no encontrada' },
        { status: 500 }
      );
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet(1)!;

    ws.getCell('A6').value = inc.LastName || 'NO ESPECIFICADO';
    ws.getCell('E6').value = inc.MiddleName || 'NO ESPECIFICADO';
    ws.getCell('H6').value = inc.FirstName || 'NO ESPECIFICADO';
    ws.getCell('A9').value = formatDate(inc.StartDatee);
    ws.getCell('C9').value = inc.Position || 'NO ESPECIFICADO';
    ws.getCell('A12').value = inc.InicidenceNumber || 'NO ESPECIFICADO';
    ws.getCell('B12').value = formatDate(inc.IncidenceDate);
    ws.getCell('D12').value = inc.Description || 'NO ESPECIFICADO';
    ws.getCell('H12').value = inc.Rule || 'NO ESPECIFICADO';
    ws.getCell('E17').value = employeeName || 'NO ESPECIFICADO';
    ws.getCell('G9').value = inc.NameProject || 'N/A';
    ws.getCell('I9').value = inc.Area || 'N/A';

    // Leer el archivo como buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    const tipoEmpleado = inc.tipo || 'DESCONOCIDO';
    const fileName = `FT-RH-27-${tipoEmpleado}-${inc.EmployeeID}.xlsx`;

   return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });

  } catch (error: any) {
    console.error("Error al generar FT-RH-27 editable:", error);
    return NextResponse.json(
      { 
        success: false,
        message: error.sqlMessage || error.message || "Error al generar el documento" 
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
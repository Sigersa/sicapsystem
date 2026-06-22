// app/api/download/edit/DC-3/route.ts

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
    const dc3Id = searchParams.get("dc3Id");

    if (!dc3Id) {
      return NextResponse.json(
        { success: false, message: "Se requiere el ID del registro DC3" },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Obtener información del registro DC3, del empleado y del instructor
    const [rows] = await connection.execute<any[]>(
      `SELECT 
        dc.DC3ID,
        dc.EmployeeID,
        dc.SpecificOccupation,
        dc.CourseName,
        dc.StartDate,
        dc.EndDate,
        dc.Area,
        dc.Duration,
        dc.TrainerID,
        dc.ExternalTrainerName,  -- Importante: incluir el instructor externo
        -- Datos del empleado que recibe el curso
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          ELSE 'PROJECT'
        END as tipo,
        COALESCE(bp.Area, p.NameProject) as AreaOrProject,
        -- CURP del empleado que recibe el curso
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN bpi.CURP
          ELSE ppi.CURP
        END as CURP,
        -- Datos del instructor (Trainer) - SOLO SI ES INTERNO
        trainer_bp.FirstName as TrainerFirstName,
        trainer_bp.LastName as TrainerLastName,
        trainer_bp.MiddleName as TrainerMiddleName,
        trainer_pp.FirstName as TrainerPpFirstName,
        trainer_pp.LastName as TrainerPpLastName,
        trainer_pp.MiddleName as TrainerPpMiddleName
      FROM employeedc3 dc
      -- Datos del empleado que recibe el curso (BASE)
      LEFT JOIN basepersonnel bp ON dc.EmployeeID = bp.EmployeeID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      -- Datos del empleado que recibe el curso (PROJECT)
      LEFT JOIN projectpersonnel pp ON dc.EmployeeID = pp.EmployeeID
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN projects p ON pc.ProjectID = p.ProjectID
      -- Datos del instructor (Trainer) - BASE
      LEFT JOIN basepersonnel trainer_bp ON dc.TrainerID = trainer_bp.EmployeeID
      -- Datos del instructor (Trainer) - PROJECT
      LEFT JOIN projectpersonnel trainer_pp ON dc.TrainerID = trainer_pp.EmployeeID
      WHERE dc.DC3ID = ?`,
      [dc3Id]
    );

    if (!rows.length) {
      return NextResponse.json(
        { success: false, message: 'Registro DC3 no encontrado' },
        { status: 404 }
      );
    }

    const dc3Record = rows[0];

    // Construir nombre completo del empleado en el orden: Apellido Paterno, Apellido Materno, Nombre(s)
    const employeeName = [
      dc3Record.LastName || '',        // Apellido Paterno
      dc3Record.MiddleName || '',      // Apellido Materno
      dc3Record.FirstName || ''        // Nombre(s)
    ].filter(part => part.trim() !== '').join(' ');

    // CONSTRUIR EL NOMBRE DEL INSTRUCTOR - PRIORIZANDO EL EXTERNO
    let trainerName = "INSTRUCTOR NO ESPECIFICADO";
    
    // 1. PRIMERO: Verificar si hay un instructor externo
    if (dc3Record.ExternalTrainerName && dc3Record.ExternalTrainerName.trim() !== '') {
      trainerName = dc3Record.ExternalTrainerName.trim();
      console.log(`Usando instructor externo: ${trainerName}`);
    } 
    // 2. SEGUNDO: Buscar instructor interno (BASE)
    else if (dc3Record.TrainerID !== null && dc3Record.TrainerFirstName) {
      trainerName = [
        dc3Record.TrainerFirstName || '',
        dc3Record.TrainerLastName || '',
        dc3Record.TrainerMiddleName || ''
      ].filter(part => part.trim() !== '').join(' ');
      console.log(`Usando instructor interno BASE: ${trainerName}`);
    }
    // 3. TERCERO: Buscar instructor interno (PROJECT)
    else if (dc3Record.TrainerID !== null && dc3Record.TrainerPpFirstName) {
      trainerName = [
        dc3Record.TrainerPpFirstName || '',
        dc3Record.TrainerPpLastName || '',
        dc3Record.TrainerPpMiddleName || ''
      ].filter(part => part.trim() !== '').join(' ');
      console.log(`Usando instructor interno PROJECT: ${trainerName}`);
    }
    // 4. Si hay TrainerID pero no se encontró el nombre
    else if (dc3Record.TrainerID !== null) {
      trainerName = `INSTRUCTOR ID: ${dc3Record.TrainerID}`;
      console.log(`Instructor ID ${dc3Record.TrainerID} sin nombre encontrado`);
    }

    // Extraer fechas
    const startYear = dc3Record.StartDate 
      ? new Date(dc3Record.StartDate).getFullYear().toString()
      : '';

    const startMonth = dc3Record.StartDate 
      ? (new Date(dc3Record.StartDate).getMonth() + 1).toString().padStart(2, '0')
      : '';

    const startDay = dc3Record.StartDate 
      ? new Date(dc3Record.StartDate).getDate().toString().padStart(2, '0')
      : '';

    const endYear = dc3Record.EndDate 
      ? new Date(dc3Record.EndDate).getFullYear().toString()
      : '';

    const endMonth = dc3Record.EndDate 
      ? (new Date(dc3Record.EndDate).getMonth() + 1).toString().padStart(2, '0')
      : '';

    const endDay = dc3Record.EndDate 
      ? new Date(dc3Record.EndDate).getDate().toString().padStart(2, '0')
      : '';

    // Cargar plantilla Excel
    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "personnel-management",
      "DC-3.xlsx"
    );

    if (!fs.existsSync(templatePath)) {
      console.error(`Plantilla no encontrada en: ${templatePath}`);
      return NextResponse.json(
        { success: false, message: 'Plantilla DC-3 no encontrada' },
        { status: 500 }
      );
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet(1)!;

    // Llenar datos en la plantilla
    ws.getCell("A7").value = dc3Record.CURP || "CURP NO ESPECIFICADO";
    ws.getCell("A5").value = employeeName || "NOMBRE NO ESPECIFICADO";
    ws.getCell("A9").value = dc3Record.Position || "NO ESPECIFICADO";
    ws.getCell("A19").value = dc3Record.CourseName || "NO ESPECIFICADO";
    ws.getCell("A23").value = dc3Record.Area || "NO ESPECIFICADO";
    ws.getCell("B32").value = trainerName; // Instructor (prioriza externo)
    ws.getCell("H7").value = dc3Record.SpecificOccupation || "NO ESPECIFICADO";
    ws.getCell("A21").value = dc3Record.Duration || "NO ESPECIFICADO";
    ws.getCell("I21").value = startYear || "";
    ws.getCell("J21").value = startMonth || "";
    ws.getCell("K21").value = startDay || "";
    ws.getCell("M21").value = endYear || "";
    ws.getCell("N21").value = endMonth || "";
    ws.getCell("O21").value = endDay || "";

    const buffer = await workbook.xlsx.writeBuffer();

    const tipoEmpleado = dc3Record.tipo || 'DESCONOCIDO';
    const fileName = `DC-3-${tipoEmpleado}-${dc3Record.EmployeeID}.xlsx`;

    console.log(`Excel editable generado exitosamente para DC3 ID: ${dc3Id}`);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });

  } catch (error: any) {
    console.error("Error al generar DC-3 editable:", error);
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
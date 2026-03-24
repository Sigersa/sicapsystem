// app/api/download/pdf/DC-3/route.ts

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import os from "os";
import ConvertAPI from "convertapi";
import { getConnection } from "@/lib/db";
import { UTApi } from "uploadthing/server";
import { validateAndRenewSession } from "@/lib/auth";

const convertapi = new ConvertAPI(process.env.CONVERTAPI_SECRET!);
const utapi = new UTApi();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dc3Id = searchParams.get("dc3Id");
  const isPreview = searchParams.get("preview") === "1";
  const saveToUploadThing = searchParams.get("saveUploadThing") === "1";

  if (!dc3Id) {
    return NextResponse.json(
      { error: "Se requiere el ID del registro DC3" },
      { status: 400 }
    );
  }

  const tempExcelPath = path.join(
    os.tmpdir(),
    `DC-3-${Date.now()}-${dc3Id}.xlsx`
  );
  const tempPdfPath = path.join(
    os.tmpdir(),
    `DC-3-${Date.now()}-${dc3Id}.pdf`
  );

  let connection;

  try {
    // Validar sesión
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
        dc.DocumentURL,
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
        -- Datos del instructor (Trainer)
        COALESCE(trainer_bp.FirstName, trainer_pp.FirstName) as TrainerFirstName,
        COALESCE(trainer_bp.LastName, trainer_pp.LastName) as TrainerLastName,
        COALESCE(trainer_bp.MiddleName, trainer_pp.MiddleName) as TrainerMiddleName
      FROM employeedc3 dc
      -- Datos del empleado que recibe el curso (BASE)
      LEFT JOIN basepersonnel bp ON dc.EmployeeID = bp.EmployeeID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      -- Datos del empleado que recibe el curso (PROJECT)
      LEFT JOIN projectpersonnel pp ON dc.EmployeeID = pp.EmployeeID
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN projects p ON pc.ProjectID = p.ProjectID
      -- Datos del instructor (Trainer)
      LEFT JOIN basepersonnel trainer_bp ON dc.TrainerID = trainer_bp.EmployeeID
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
      dc3Record.LastName || '',
      dc3Record.MiddleName || '',
      dc3Record.FirstName || ''
    ].filter(part => part.trim() !== '').join(' ');

    // Construir nombre completo del instructor
    const trainerName = [
      dc3Record.TrainerFirstName || '',
      dc3Record.TrainerLastName || '',
      dc3Record.TrainerMiddleName || ''
    ].filter(part => part.trim() !== '').join(' ') || "INSTRUCTOR NO ESPECIFICADO";

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
    ws.getCell("B32").value = trainerName;
    ws.getCell("H7").value = dc3Record.SpecificOccupation || "NO ESPECIFICADO";
    ws.getCell("A21").value = dc3Record.Duration || "NO ESPECIFICADO";
    ws.getCell("I21").value = startYear || "";
    ws.getCell("J21").value = startMonth || "";
    ws.getCell("K21").value = startDay || "";
    ws.getCell("M21").value = endYear || "";
    ws.getCell("N21").value = endMonth || "";
    ws.getCell("O21").value = endDay || "";
    
    // Guardar Excel temporal
    await workbook.xlsx.writeFile(tempExcelPath);

    // Convertir a PDF usando ConvertAPI
    const result = await convertapi.convert("pdf", {
      File: tempExcelPath,
    });

    // Descargar el PDF
    const pdfResponse = await fetch(result.file.url);
    const pdfBuffer = await pdfResponse.arrayBuffer();

    const tipoEmpleado = dc3Record.tipo || 'DESCONOCIDO';
    const fileName = `DC-3-${tipoEmpleado}-${dc3Record.EmployeeID}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": isPreview
          ? `inline; filename="${fileName}"`
          : `attachment; filename="${fileName}"`,
      },
    });

  } catch (error: any) {
    console.error("Error al generar DC-3 PDF:", error);
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
    // Limpiar archivos temporales
    try {
      if (fs.existsSync(tempExcelPath)) {
        fs.unlinkSync(tempExcelPath);
      }
      if (fs.existsSync(tempPdfPath)) {
        fs.unlinkSync(tempPdfPath);
      }
    } catch (cleanupError) {
      console.warn("Error al limpiar archivos temporales:", cleanupError);
    }
  }
}
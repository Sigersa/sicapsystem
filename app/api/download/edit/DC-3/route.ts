// app/api/download/edit/DC-3/route.ts

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import path from "path";
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import fs from "fs"; 

// Mapeo de horas por curso
const COURSE_HOURS: Record<string, number> = {
  "IDENTIFICACIÓN DE PELIGROS Y EVALUACIÓN DE RIESGOS": 12,
  "MANEJO DE SUSTANCIAS QUÍMICAS": 8,
  "IDENTIFICACIÓN DE ASPECTOS AMBIENTALES": 8,
  "MANIOBRAS E IZAJE": 18,
  "USO Y MANEJO DE EXTINTORES": 8,
  "MANEJO DE LAS HERRAMIENTAS DE TRABAJO (MANUALES Y DE PODER)": 8,
  "MONTACARGAS (USO Y MANEJO, PROCEDIMIENTOS DE SEGURIDAD)": 8,
  "USO DE EQUIPO DE PROTECCIÓN PERSONAL (EPP)": 8,
  "CONDICIONES DE SEGURIDAD PARA REALIZAR TRABAJO EN ALTURA NOM-009-STPS-2011": 12,
  "CONTROL DE ENERGÍAS PELIGROSAS SISTEMA LOTO": 30,
  "CONDICIONES DE SEGURIDAD PARA REALIZAR TRABAJOS EN ESPACIOS CONFINADOS NOM-033-STPS-2015": 12,
  "MANEJO MANUAL Y MECÁNICO DE CARGAS": 3,
  "ARMADO DE ANDAMIOS PROCEDIMIENTOS DE SEGURIDAD E HIGIENE": 20,
  "BRIGADAS DE EMERGENCIA Y EVALUACIÓN": 12,
  "LEGISLACIÓN AMBIENTAL": 24,
  "ANÁLISIS DE SEGURIDAD EN EL TRABAJO (AST)": 10,
  "NOM-027-STPS-2008 ACTIVIDADES DE SOLDADURA Y CORTE, CONDICIONES DE SEGURIDAD E HIGIENE (TRABAJOS EN CALIENTE)": 5,
  "PRIMEROS AUXILIOS": 12,
  "PROTECCIÓN RESPIRATORIA": 12
};

const getCourseHours = (courseName: string | null): number | null => {
  if (!courseName) return null;
  return COURSE_HOURS[courseName] ?? null;
};

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

    // Obtener información del registro DC3, del empleado 
    const [rows] = await connection.execute<any[]>(
      `SELECT 
        dc.DC3ID,
        dc.EmployeeID,
        dc.CourseName,
        dc.StartDate,
        dc.EndDate,
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
        END as CURP
      FROM employeedc3 dc
      -- Datos del empleado que recibe el curso (BASE)
      LEFT JOIN basepersonnel bp ON dc.EmployeeID = bp.EmployeeID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      -- Datos del empleado que recibe el curso (PROJECT)
      LEFT JOIN projectpersonnel pp ON dc.EmployeeID = pp.EmployeeID
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN projects p ON pc.ProjectID = p.ProjectID
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

    // Obtener horas según el curso
    const courseHours = getCourseHours(dc3Record.CourseName);

    // Cargar plantilla Excel
    const templatePath = path.join(
      process.cwd(),
      "public",
      "human-resources-dashboard",
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
    ws.getCell("A21").value = courseHours ?? "NO ESPECIFICADO";
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
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import os from "os";
import ConvertAPI from "convertapi";
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

const convertapi = new ConvertAPI(process.env.CONVERTAPI_SECRET!);

// Función auxiliar para obtener el texto de la regla según la descripción
function getRuleText(description: string): string {
  const upper = (description || '').toUpperCase().trim();
  if (upper === 'RETARDO') {
    return 'ARTICULO 7. Lo permitido seria un retardo de 5 minutos por semana que no aplicaría descuento, si excede de esto, el trabajador ingresará a laborar remunerando una hora laboral en la semana que se este generando el retardo por segunda ocasión, lo cual aplica cuando el horario de retardo sea antes de las 08:20 hrs o 15:15 hrs. Si el horario de ingreso es antes de las 09:00 hrs o 16:00 hrs, el trabajador debera de remunerar media jornada laboral en la misma semana que este generando el retardo (solo por unica ocasión). En el tercer retardo, el trabajador debera ser regresado a su casa y se contara como falta injustificada. En el caso de que el trabajador decida no laborar se tomará como falta injustificada. El registro injusttificado de salida antes de las 14:00 hrs para hora de descanso o de las 18:00 hrs para salida por termino de jornada laboral se sancionará con un 50% de remuneración diaria.';
  }
  if (upper === 'FALTA') {
    return 'a) Falta injustificada por inasistencia, sanción económica equivalente al número de días no laborados.\na) Más de tres faltas injustificadas por inasistencia y por lo indicado el artículo 14 y 51 en un periodo de treinta días dará lugar a la rescisión contractual, sin responsabilidad para la Empresa.';
  }
  return 'NO ESPECIFICADO';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const incidenceId = searchParams.get("incidenceId");
  const isPreview = searchParams.get("preview") === "1";

  if (!incidenceId) {
    return NextResponse.json(
      { error: "Se requiere el ID del permiso" },
      { status: 400 }
    );
  }

  const tempExcelPath = path.join(
      os.tmpdir(),
      `FT-RH-27-${Date.now()}-${incidenceId}.xlsx`
    );
    const tempPdfPath = path.join(
      os.tmpdir(),
      `FT-RH-27-${Date.now()}-${incidenceId}.pdf`
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

     // Obtener información de la incidencia y del empleado
    const [rows] = await connection.execute<any[]>(
      `SELECT 
        ei.IncidenceID,
        ei.EmployeeID,
        ei.InicidenceNumber,
        ei.Description,
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
      "human-resources-dashboard",
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
    // Regla generada automáticamente según la descripción
    ws.getCell('G12').value = getRuleText(inc.Description);
    ws.getCell('E17').value = employeeName || 'NO ESPECIFICADO';
    ws.getCell('G9').value = inc.NameProject || 'N/A';
    ws.getCell('I9').value = inc.Area || 'N/A';

    await workbook.xlsx.writeFile(tempExcelPath);

    // Convertir a PDF usando ConvertAPI
    const result = await convertapi.convert("pdf", {
      File: tempExcelPath,
    });

    // Descargar el PDF
    const pdfResponse = await fetch(result.file.url);
    const pdfBuffer = await pdfResponse.arrayBuffer();

    const tipoEmpleado = inc.tipo || 'DESCONOCIDO';
    const fileName = `FT-RH-27-${tipoEmpleado}-${inc.EmployeeID}.pdf`;
    return new NextResponse(Buffer.from(pdfBuffer), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": isPreview
              ? `inline; filename="${fileName}"`
              : `attachment; filename="${fileName}"`,
          },
        });
    
      } catch (error: any) {
        console.error("Error al generar FT-RH-27 PDF:", error);
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
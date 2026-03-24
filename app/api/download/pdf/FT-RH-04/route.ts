import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import os from "os";
import ConvertAPI from "convertapi";
import { getConnection } from "@/lib/db";
import { UTApi } from "uploadthing/server";

const convertapi = new ConvertAPI(process.env.CONVERTAPI_SECRET!);
const utapi = new UTApi();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const empleadoId = searchParams.get("empleadoId");
  const isPreview = searchParams.get("preview") === "1";
  const saveToUploadThing = searchParams.get("saveUploadThing") === "1";

  if (!empleadoId) {
    return NextResponse.json(
      { error: "Se requiere el ID del empleado" },
      { status: 400 }
    );
  }

  const tempExcelPath = path.join(
    os.tmpdir(),
    `FT-RH-04-${Date.now()}-${empleadoId}.xlsx`
  );
  const tempPdfPath = path.join(
    os.tmpdir(),
    `FT-RH-04-${Date.now()}-${empleadoId}.pdf`
  );

  let connection;
  let pdfUrl = "";

  try {
    connection = await getConnection();

    // Primero, obtener información del empleado desde la tabla employees
    const [employeeInfo] = await connection.query<any[]>(`
      SELECT EmployeeType 
      FROM employees 
      WHERE EmployeeID = ?
    `, [empleadoId]);

    if (!employeeInfo.length) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }

    const employee = employeeInfo[0];
    let fullName = "";
    let projectName = "N/A";
    let startDate = "";
    let position = "";
    let workSchedule = "";
    let salary = 0;
    let area = "";
    
    // Obtener documentos según el tipo de empleado
    let documentationQuery;
    let docParams: any[] = [];

    if (employee.EmployeeType === 'PROJECT') {
      // Personal de Proyecto
      const [rows] = await connection.query<any[]>(`
        SELECT 
          pp.FirstName,
          pp.LastName,
          pp.MiddleName,
          pd.*,
          DATE_FORMAT(pc.StartDate, '%Y/%m/%d') AS StartDate,
          pc.Position,
          pc.WorkSchedule,
          pc.Salary,
          pr.NameProject,
          pp.ProjectPersonnelID,
          pc.WarningFileURL
        FROM projectpersonnel pp
        LEFT JOIN projectpersonneldocumentation pd ON pp.ProjectPersonnelID = pd.ProjectPersonnelID
        LEFT JOIN projectcontracts pc ON pc.ProjectPersonnelID = pp.ProjectPersonnelID
        LEFT JOIN projects pr ON pr.ProjectID = pc.ProjectID
        WHERE pp.EmployeeID = ?
      `, [empleadoId]);

      if (!rows.length) {
        return NextResponse.json({ error: "Información de proyecto no encontrada" }, { status: 404 });
      }

      const r = rows[0];
      fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
      projectName = r.NameProject || "N/A";
      startDate = r.StartDate || "";
      position = r.Position || "";
      workSchedule = r.WorkSchedule || "";
      salary = r.Salary || 0;

      // Si ya existe un WarningFileURL, usarlo
      if (r.WarningFileURL && !saveToUploadThing) {
        pdfUrl = r.WarningFileURL;
      }

      documentationQuery = `
        SELECT * FROM projectpersonneldocumentation 
        WHERE ProjectPersonnelID = ?
      `;
      docParams = [r.ProjectPersonnelID];

    } else {
      // Personal Base
      const [rows] = await connection.query<any[]>(`
        SELECT 
          bp.FirstName,
          bp.LastName,
          bp.MiddleName,
          bp.Position,
          bp.WorkSchedule,
          bp.Salary,
          bp.Area,
          bd.*,
          DATE_FORMAT(bc.StartDate, '%Y/%m/%d') AS StartDate,
          bp.BasePersonnelID,
          bc.WarningFileURL
        FROM basepersonnel bp
        LEFT JOIN basepersonneldocumentation bd ON bp.BasePersonnelID = bd.BasePersonnelID
        LEFT JOIN basecontracts bc ON bc.BasePersonnelID = bp.BasePersonnelID
        WHERE bp.EmployeeID = ?
      `, [empleadoId]);

      if (!rows.length) {
        return NextResponse.json({ error: "Información de personal base no encontrada" }, { status: 404 });
      }

      const r = rows[0];
      fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
      startDate = r.StartDate || "";
      position = r.Position || "";
      workSchedule = r.WorkSchedule || "";
      salary = r.Salary || 0;
      area = r.Area || "";

      // Si ya existe un WarningFileURL, usarlo
      if (r.WarningFileURL && !saveToUploadThing) {
        pdfUrl = r.WarningFileURL;
      }

      documentationQuery = `
        SELECT * FROM basepersonneldocumentation 
        WHERE BasePersonnelID = ?
      `;
      docParams = [r.BasePersonnelID];
    }

    // Si ya tenemos un PDF guardado y no estamos forzando la regeneración, retornarlo
    if (pdfUrl && !saveToUploadThing) {
      try {
        const pdfResponse = await fetch(pdfUrl);
        if (pdfResponse.ok) {
          const pdfBuffer = await pdfResponse.arrayBuffer();
          
          const fileName = employee.EmployeeType === 'PROJECT'
            ? `FT-RH-04-PROYECTO-${empleadoId}.pdf`
            : `FT-RH-04-BASE-${empleadoId}.pdf`;

          return new NextResponse(pdfBuffer, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": isPreview
                ? `inline; filename="${fileName}"`
                : `attachment; filename="${fileName}"`,
            },
          });
        }
      } catch (error) {
        console.warn("Error al obtener PDF existente, generando uno nuevo:", error);
      }
    }

    // Obtener documentos
    const [docRows] = await connection.query<any[]>(documentationQuery, docParams);
    
    // Si no hay documentos, crear un objeto vacío
    const doc = docRows.length > 0 ? docRows[0] : {};

    // Cargar plantilla Excel
    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "hiring",
      "FT-RH-04.xlsx"
    );

    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet(1)!;

    const yesNo = (v: any) => (v ? "SI" : "NO");

    // Llenar datos comunes
    ws.getCell("F6").value = employee.EmployeeType === 'PROJECT' ? projectName : area || "NO ESPECIFICADO";
    ws.getCell("F7").value = fullName || "NO ESPECIFICADO";
    ws.getCell("F8").value = startDate || "NO ESPECIFICADO";
    ws.getCell("F9").value = position || "NO ESPECIFICADO";
    ws.getCell("F10").value = workSchedule || "NO ESPECIFICADO";

    if (salary > 0) {
      ws.getCell("F11").value = Number(salary);
      ws.getCell("F11").numFmt = '"$"#,##0.00';
    } else {
      ws.getCell("F11").value = 0;
      ws.getCell("F11").numFmt = '"$"#,##0.00';
    }

    ws.getCell("F12").value = employee.EmployeeType === 'PROJECT' ? "PROYECTO" : "BASE";

    // Documentos
    ws.getCell("F18").value = yesNo(doc.CVFileURL);
    ws.getCell("F19").value = yesNo(doc.ANFileURL);
    ws.getCell("F20").value = yesNo(doc.CURPFileURL);
    ws.getCell("F21").value = yesNo(doc.RFCFileURL);
    ws.getCell("F22").value = yesNo(doc.IMSSFileURL);
    ws.getCell("F23").value = yesNo(doc.INEFileURL);
    ws.getCell("F24").value = yesNo(doc.CDFileURL);
    ws.getCell("F25").value = yesNo(doc.CEFileURL);

    ws.getCell("L18").value = yesNo(doc.CPFileURL);
    ws.getCell("L19").value = yesNo(doc.LMFileURL);
    ws.getCell("L20").value = yesNo(doc.ANPFileURL);
    ws.getCell("L21").value = yesNo(doc.CRFileURL);
    ws.getCell("L22").value = yesNo(doc.RIFileURL);
    ws.getCell("L23").value = yesNo(doc.EMFileURL);
    ws.getCell("L24").value = yesNo(doc.FotoFileURL);
    ws.getCell("L25").value = yesNo(doc.FolletoFileURL);

    ws.getCell("F45").value = fullName || "NO ESPECIFICADO";

    // Guardar Excel temporal
    await workbook.xlsx.writeFile(tempExcelPath);

    // Convertir a PDF usando ConvertAPI
    const result = await convertapi.convert("pdf", {
      File: tempExcelPath,
    });

    // Descargar el PDF
    const pdfResponse = await fetch(result.file.url);
    const pdfBuffer = await pdfResponse.arrayBuffer();
    
    // Guardar temporalmente para subir a UploadThing
    fs.writeFileSync(tempPdfPath, Buffer.from(pdfBuffer));

    // Subir a UploadThing si se solicita
    if (saveToUploadThing) {
      try {
        const fileName = `FT-RH-04-${fullName.replace(/\s+/g, '_')}-${Date.now()}.pdf`;
        const file = new File([Buffer.from(pdfBuffer)], fileName, { type: 'application/pdf' });
        
        // Usar UTApi para subir el archivo
        const uploadResult = await utapi.uploadFiles(file);
        
        if (uploadResult && uploadResult.data && uploadResult.data.url) {
          pdfUrl = uploadResult.data.url;
          
          // Actualizar el campo WarningFileURL en la base de datos
          if (employee.EmployeeType === 'PROJECT') {
            await connection.execute(
              `UPDATE projectcontracts SET WarningFileURL = ? WHERE ProjectPersonnelID = ?`,
              [pdfUrl, docParams[0]]
            );
          } else {
            await connection.execute(
              `UPDATE basecontracts SET WarningFileURL = ? WHERE BasePersonnelID = ?`,
              [pdfUrl, docParams[0]]
            );
          }
          
          console.log(`PDF subido a UploadThing: ${pdfUrl}`);
        }
      } catch (uploadError) {
        console.error("Error al subir PDF a UploadThing:", uploadError);
        // Continuar sin subir, solo mostrar el PDF
      }
    }

    const fileName = employee.EmployeeType === 'PROJECT'
      ? `FT-RH-04-PROYECTO-${empleadoId}.pdf`
      : `FT-RH-04-BASE-${empleadoId}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": isPreview
          ? `inline; filename="${fileName}"`
          : `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Error al generar FT-RH-04 PDF:", error);
    return NextResponse.json(
      { error: error.message || "Error al generar PDF" },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
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

// Nuevo endpoint para subir y guardar el PDF
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { empleadoId } = body;

    if (!empleadoId) {
      return NextResponse.json(
        { error: "Se requiere el ID del empleado" },
        { status: 400 }
      );
    }

    // Llamar al endpoint GET con el parámetro saveUploadThing
    const pdfResponse = await fetch(
      `${request.nextUrl.origin}/api/download/pdf/FT-RH-04?empleadoId=${empleadoId}&saveUploadThing=1`
    );

    if (!pdfResponse.ok) {
      const error = await pdfResponse.json().catch(() => ({ error: "Error desconocido" }));
      return NextResponse.json(
        { error: error.error || "Error al generar el PDF" },
        { status: 500 }
      );
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();

    return NextResponse.json({
      success: true,
      message: "PDF generado exitosamente",
      fileName: `FT-RH-04-${empleadoId}.pdf`,
    });

  } catch (error: any) {
    console.error("Error en POST FT-RH-04:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
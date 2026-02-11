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
      SELECT EmployeeType, BasePersonnelID, ProjectPersonnelID 
      FROM employees 
      WHERE EmployeeID = ?
    `, [empleadoId]);

    if (!employeeInfo.length) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }

    const employee = employeeInfo[0];
    let query;
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
          pc.ProjectPersonnelID,
          pc.WarningFileURL
        FROM projectpersonnel pp
        INNER JOIN projectpersonneldocumentation pd ON pp.ProjectPersonnelID = pd.ProjectPersonnelID
        LEFT JOIN projectcontracts pc ON pc.ProjectPersonnelID = pp.ProjectPersonnelID
        LEFT JOIN projects pr ON pr.ProjectID = pc.ProjectID
        WHERE pp.ProjectPersonnelID = ?
      `, [employee.ProjectPersonnelID]);

      if (!rows.length) {
        return NextResponse.json({ error: "Información de proyecto no encontrada" }, { status: 404 });
      }

      const r = rows[0];
      fullName = `${r.FirstName} ${r.LastName} ${r.MiddleName || ""}`.trim();
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
      docParams = [employee.ProjectPersonnelID];

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
          bc.BasePersonnelID,
          bc.WarningFileURL
        FROM basepersonnel bp
        LEFT JOIN basepersonneldocumentation bd ON bp.BasePersonnelID = bd.BasePersonnelID
        LEFT JOIN basecontracts bc ON bc.BasePersonnelID = bp.BasePersonnelID
        WHERE bp.BasePersonnelID = ?
      `, [employee.BasePersonnelID]);

      if (!rows.length) {
        return NextResponse.json({ error: "Información de personal base no encontrada" }, { status: 404 });
      }

      const r = rows[0];
      fullName = `${r.FirstName} ${r.LastName} ${r.MiddleName || ""}`.trim();
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
      docParams = [employee.BasePersonnelID];
    }

    // Si ya tenemos un PDF guardado y no estamos forzando la regeneración, retornarlo
    if (pdfUrl && !saveToUploadThing) {
      const pdfResponse = await fetch(pdfUrl);
      const pdfBuffer = await pdfResponse.arrayBuffer();
      
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": isPreview
            ? 'inline; filename="FT-RH-04.pdf"'
            : 'attachment; filename="FT-RH-04.pdf"',
        },
      });
    }

    // Obtener documentos
    const [docRows] = await connection.query<any[]>(documentationQuery, docParams);
    
    if (!docRows.length) {
      return NextResponse.json({ error: "Documentación no encontrada" }, { status: 404 });
    }

    const doc = docRows[0];

    // Cargar plantilla Excel
    const templatePath = path.join(
      process.cwd(),
      "public",
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
    ws.getCell("F6").value = employee.EmployeeType === 'PROJECT' ? projectName : area;
    ws.getCell("F7").value = fullName;
    ws.getCell("F8").value = startDate;
    ws.getCell("F9").value = position;
    ws.getCell("F10").value = workSchedule;

    if (salary > 0) {
      ws.getCell("F11").value = Number(salary);
      ws.getCell("F11").numFmt = '"$"#,##0.00';
    }

    ws.getCell("F12").value = employee.EmployeeType === 'PROJECT' ? "TEMPORAL" : "BASE";

    // Documentos
    if (employee.EmployeeType === 'PROJECT') {
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
    } else {
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
    }

    ws.getCell("F45").value = fullName;

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
        const fileName = `contrato_${fullName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
        const file = new File([Buffer.from(pdfBuffer)], fileName, { type: 'application/pdf' });
        
        // Usar UTApi para subir el archivo
        const uploadResult = await utapi.uploadFiles(file);
        
        if (uploadResult && uploadResult.data && uploadResult.data.url) {
          pdfUrl = uploadResult.data.url;
          
          // Actualizar el campo WarningFileURL en la base de datos
          if (employee.EmployeeType === 'PROJECT') {
            await connection.execute(
              `UPDATE projectcontracts SET WarningFileURL = ? WHERE ProjectPersonnelID = ?`,
              [pdfUrl, employee.ProjectPersonnelID]
            );
          } else {
            await connection.execute(
              `UPDATE basecontracts SET WarningFileURL = ? WHERE BasePersonnelID = ?`,
              [pdfUrl, employee.BasePersonnelID]
            );
          }
          
          console.log(`PDF subido a UploadThing: ${pdfUrl}`);
        }
      } catch (uploadError) {
        console.error("Error al subir PDF a UploadThing:", uploadError);
        // Continuar sin subir, solo mostrar el PDF
      }
    }

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": isPreview
          ? 'inline; filename="FT-RH-04.pdf"'
          : 'attachment; filename="FT-RH-04.pdf"',
      },
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: error.message || "Error al generar PDF" },
      { status: 500 }
    );
  } finally {
    connection?.release?.();
    // Limpiar archivos temporales
    if (fs.existsSync(tempExcelPath)) {
      fs.unlinkSync(tempExcelPath);
    }
    if (fs.existsSync(tempPdfPath)) {
      fs.unlinkSync(tempPdfPath);
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
      return NextResponse.json(
        { error: "Error al generar el PDF" },
        { status: 500 }
      );
    }

    // Obtener la URL del PDF de la respuesta
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfUrl = pdfResponse.headers.get("x-uploadthing-url") || "";

    return NextResponse.json({
      success: true,
      message: "PDF generado y guardado exitosamente",
      pdfUrl: pdfUrl,
      pdfBuffer: Buffer.from(pdfBuffer).toString("base64")
    });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: error.message || "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
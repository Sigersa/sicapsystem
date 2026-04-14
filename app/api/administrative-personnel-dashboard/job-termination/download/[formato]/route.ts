// app/api/administrative-personnel-dashboard/job-termination/download/[formato]/route.ts
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";
import { getConnection } from "@/lib/db";
import { createReport } from "docx-templates";
import { validateAndRenewSession } from "@/lib/auth";
import ConvertAPI from "convertapi";
import { UTApi } from "uploadthing/server";

const convertapi = new ConvertAPI(process.env.CONVERTAPI_SECRET!);
const utapi = new UTApi();

function formatDateToSpanish(dateString: string | Date): string {
  if (!dateString) return "NO ESPECIFICADO";
  
  try {
    const dateObj = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    if (isNaN(dateObj.getTime())) {
      return "NO ESPECIFICADO";
    }
    
    const dia = dateObj.getDate().toString().padStart(2, "0");
    const mes = new Intl.DateTimeFormat("es-MX", {
      month: "long",
    }).format(dateObj).toUpperCase();
    const anio = dateObj.getFullYear();
    
    return `${dia} DE ${mes} DEL ${anio}`;
  } catch (error) {
    console.warn("Error al formatear fecha:", error);
    return "NO ESPECIFICADO";
  }
}

async function uploadToUploadThing(fileBuffer: Buffer, fileName: string): Promise<string | null> {
  try {
    const uint8Array = new Uint8Array(fileBuffer);
    const blob = new Blob([uint8Array], { type: 'application/pdf' });
    const file = new File([blob], fileName, { type: 'application/pdf' });
    
    const uploadedFiles = await utapi.uploadFiles([file]);
    
    if (uploadedFiles[0] && uploadedFiles[0].data) {
      // Usar ufsUrl en lugar de url (para compatibilidad con v9)
      const fileUrl = (uploadedFiles[0].data as any).ufsUrl || uploadedFiles[0].data.url;
      return fileUrl;
    }
    
    return null;
  } catch (error) {
    console.error('Error al subir a UploadThing:', error);
    return null;
  }
}

async function updateDocumentUrl(employeeId: number, formato: string, fileUrl: string) {
  let connection;
  try {
    connection = await getConnection();
    
    const fieldMap: Record<string, string> = {
      'FT-RH-12': 'CDFileURL',
      'FT-RH-13': 'CRFileURL',
      'FT-RH-14': 'OFFileURL'
    };
    
    const fieldName = fieldMap[formato];
    if (!fieldName) return;
    
    await connection.execute(
      `UPDATE jobtermination SET ${fieldName} = ? WHERE EmployeeID = ?`,
      [fileUrl, employeeId]
    );
    
    console.log(`URL de ${formato} actualizada para EmployeeID: ${employeeId}`);
  } catch (error) {
    console.error(`Error al actualizar URL de ${formato}:`, error);
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

async function getSavedDocumentUrl(employeeId: number, formato: string): Promise<string | null> {
  let connection;
  try {
    connection = await getConnection();
    
    const fieldMap: Record<string, string> = {
      'FT-RH-12': 'CDFileURL',
      'FT-RH-13': 'CRFileURL',
      'FT-RH-14': 'OFFileURL'
    };
    
    const fieldName = fieldMap[formato];
    if (!fieldName) return null;
    
    const [rows] = await connection.execute(
      `SELECT ${fieldName} FROM jobtermination WHERE EmployeeID = ?`,
      [employeeId]
    );
    
    if ((rows as any[]).length > 0) {
      const url = (rows as any[])[0][fieldName];
      if (url) return url;
    }
    
    return null;
  } catch (error) {
    console.error(`Error al obtener URL guardada de ${formato}:`, error);
    return null;
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formato: string }> | { formato: string } }
) {
  const resolvedParams = await params;
  const formato = resolvedParams.formato;
  
  const { searchParams } = new URL(request.url);
  const empleadoId = searchParams.get("empleadoId");
  const format = searchParams.get("format") || "pdf";
  const isPreview = searchParams.get("preview") === "1";
  const saveToDb = searchParams.get("save") === "1";

  console.log(`Solicitud: formato=${formato}, empleadoId=${empleadoId}, format=${format}, saveToDb=${saveToDb}`);

  if (!empleadoId) {
    return NextResponse.json(
      { error: "Se requiere el ID del empleado" },
      { status: 400 }
    );
  }

  const formatosPermitidos = ['FT-RH-12', 'FT-RH-13', 'FT-RH-14'];
  if (!formatosPermitidos.includes(formato)) {
    return NextResponse.json(
      { error: `Formato no válido. Permitidos: ${formatosPermitidos.join(', ')}` },
      { status: 400 }
    );
  }

  const sessionId = request.cookies.get("session")?.value;
  if (!sessionId) {
    return NextResponse.json(
      { success: false, message: 'NO AUTORIZADO' },
      { status: 401 }
    );
  }

  const user = await validateAndRenewSession(sessionId);
  if (!user || user.UserTypeID !== 2) {
    return NextResponse.json(
      { success: false, message: 'ACCESO DENEGADO' },
      { status: 401 }
    );
  }

  if (isPreview && !saveToDb) {
    const savedUrl = await getSavedDocumentUrl(parseInt(empleadoId), formato);
    if (savedUrl) {
      console.log(`Usando URL guardada para ${formato}: ${savedUrl}`);
      return NextResponse.json({ success: true, fileUrl: savedUrl });
    }
  }

  const tempWordPath = path.join(
    os.tmpdir(),
    `${formato}-${Date.now()}-${empleadoId}.docx`
  );
  const tempPdfPath = path.join(
    os.tmpdir(),
    `${formato}-${Date.now()}-${empleadoId}.pdf`
  );

  let connection;

  try {
    connection = await getConnection();

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
    let position = "";
    let monthw = "";
    let startDate = "";
    let address = "";
    let endDate = "";
    const applicationDate = formatDateToSpanish(new Date());

    if (employee.EmployeeType === 'PROJECT') {
      const [rows] = await connection.query<any[]>(`
        SELECT 
          pp.FirstName,
          pp.LastName,
          pp.MiddleName,
          pc.Position,
          pc.StartDate,
          pc.EndDate,
          TIMESTAMPDIFF(MONTH, pc.StartDate, CURDATE()) AS meses_trabajados,
          pr.ProjectAddress
        FROM projectpersonnel pp
        INNER JOIN projectcontracts pc ON pc.ProjectPersonnelID = pp.ProjectPersonnelID
        LEFT JOIN projects pr ON pr.ProjectID = pc.ProjectID
        WHERE pp.EmployeeID = ?
      `, [empleadoId]);

      if (rows.length) {
        const r = rows[0];
        fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
        position = r.Position || "";
        monthw = r.meses_trabajados || 0;
        startDate = r.StartDate;
        address = r.ProjectAddress || "";
        endDate = r.EndDate;
      }
    } else {
      const [rows] = await connection.query<any[]>(`
        SELECT 
          bp.FirstName,
          bp.LastName,
          bp.MiddleName,
          bp.Position,
          bc.StartDate,
          TIMESTAMPDIFF(MONTH, bc.StartDate, CURDATE()) AS meses_trabajados
        FROM basepersonnel bp
        INNER JOIN employees e ON e.EmployeeID = bp.EmployeeID
        LEFT JOIN basecontracts bc ON bc.BasePersonnelID = bp.BasePersonnelID
        WHERE bp.EmployeeID = ?
      `, [empleadoId]);

      if (rows.length) {
        const r = rows[0];
        fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
        position = r.Position || "";
        monthw = r.meses_trabajados || 0;
        startDate = r.StartDate;
        address = "AV. EL SAUZ 7, EL DEPOSITO, 42795 TLAHUELILPAN, HGO";
        endDate = "";
      }
    }

    if (!fullName) {
      return NextResponse.json({ error: "No se pudo obtener el nombre del empleado" }, { status: 404 });
    }

    const startDatee = formatDateToSpanish(startDate);
    const endDatee = formatDateToSpanish(endDate);

    const templateMap: Record<string, string> = {
      'FT-RH-12': 'FT-RH-12.docx',
      'FT-RH-13': 'FT-RH-13.docx',
      'FT-RH-14': 'FT-RH-14.docx'
    };

    const templateFileName = templateMap[formato];
    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "job-termination",
      templateFileName
    );

    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: `Plantilla ${templateFileName} no encontrada` },
        { status: 404 }
      );
    }

    const template = fs.readFileSync(templatePath);

    let reportData: any = {
      NOMBRE_COMPLETO: fullName,
      FECHA_GENERACION: applicationDate,
    };

    if (formato === 'FT-RH-14') {
      reportData = {
        ...reportData,
        PUESTO: position || "",
        MESES: monthw?.toString() || "0",
        FECHA_INICIO: startDatee,
        DIRECCION: address || "",
        FECHA_TERMINO: endDatee,
      };
    }

    const report = await createReport({
      template,
      data: reportData,
      cmdDelimiter: ["[[", "]]"],
    });

    const wordBuffer = Buffer.from(report);
    fs.writeFileSync(tempWordPath, wordBuffer);

    if (format === 'docx') {
      const fileName = `${formato}_${empleadoId}.docx`;
      return new NextResponse(wordBuffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    }

    console.log("Convirtiendo a PDF con ConvertAPI...");
    const result = await convertapi.convert("pdf", {
      File: tempWordPath,
      PageRange: "1-10",
      PdfResolution: "300",
    });

    const pdfResponse = await fetch(result.file.url);
    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuffer);
    fs.writeFileSync(tempPdfPath, pdfBuffer);

    let fileUrl: string | null = null;
    
    if (saveToDb) {
      const fileName = `${formato}_${empleadoId}_${Date.now()}.pdf`;
      fileUrl = await uploadToUploadThing(pdfBuffer, fileName);
      
      if (fileUrl) {
        await updateDocumentUrl(parseInt(empleadoId), formato, fileUrl);
        console.log(`Documento ${formato} subido a UploadThing: ${fileUrl}`);
      }
    }

    const fileName = `${formato}_${empleadoId}.pdf`;

    if (saveToDb) {
      return NextResponse.json({
        success: true,
        fileUrl: fileUrl,
        message: 'Documento generado y guardado exitosamente'
      });
    }

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": isPreview
          ? `inline; filename="${fileName}"`
          : `attachment; filename="${fileName}"`,
      },
    });

  } catch (error: any) {
    console.error(`Error al generar ${formato}:`, error);
    return NextResponse.json(
      { error: "Error al generar el documento: " + (error.message || "Error desconocido") },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.release();
    }
    try {
      if (fs.existsSync(tempWordPath)) fs.unlinkSync(tempWordPath);
      if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
    } catch (cleanupError) {
      console.warn("Error al limpiar archivos temporales:", cleanupError);
    }
  }
}
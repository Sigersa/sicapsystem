// app/api/download/pdf/FT-RH-14/route.ts
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";
import ConvertAPI from "convertapi";
import { getConnection } from "@/lib/db";
import { createReport } from "docx-templates";
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
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' });
    const file = new File([blob], fileName, { type: 'application/pdf' });
    
    const uploadResponse = await utapi.uploadFiles([file]);
    
    if (uploadResponse && uploadResponse[0] && uploadResponse[0].data) {
      return uploadResponse[0].data.ufsUrl || uploadResponse[0].data.url;
    }
    return null;
  } catch (error) {
    console.error('Error al subir a UploadThing:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const empleadoId = searchParams.get("empleadoId");
  const isPreview = searchParams.get("preview") === "1";
  const saveToDb = searchParams.get("save") === "1";

  console.log(`FT-RH-14: empleadoId=${empleadoId}, isPreview=${isPreview}, saveToDb=${saveToDb}`);

  if (!empleadoId) {
    return NextResponse.json(
      { error: "Se requiere el ID del empleado" },
      { status: 400 }
    );
  }

  // Si es vista previa y hay URL guardada, redirigir
  if (isPreview && !saveToDb) {
    let connection;
    try {
      connection = await getConnection();
      const [rows] = await connection.execute(
        'SELECT OFFileURL FROM jobtermination WHERE EmployeeID = ?',
        [parseInt(empleadoId)]
      );
      
      if (rows && (rows as any[]).length > 0 && (rows as any[])[0].OFFileURL) {
        const fileUrl = (rows as any[])[0].OFFileURL;
        console.log(`FT-RH-14 Vista previa: redirigiendo a ${fileUrl}`);
        return NextResponse.redirect(fileUrl);
      }
    } catch (error) {
      console.error('Error al obtener URL de BD:', error);
    } finally {
      if (connection) connection.release();
    }
  }

  const tempWordPath = path.join(
    os.tmpdir(),
    `FT-RH-14-${Date.now()}-${empleadoId}.docx`
  );
  const tempPdfPath = path.join(
    os.tmpdir(),
    `FT-RH-14-${Date.now()}-${empleadoId}.pdf`
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
    let mesesTrabajados = 0;
    let startDate = "";
    let address = "";
    let endDate = "";

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
        LEFT JOIN projectcontracts pc ON pc.ProjectPersonnelID = pp.ProjectPersonnelID
        LEFT JOIN projects pr ON pr.ProjectID = pc.ProjectID
        WHERE pp.EmployeeID = ?
      `, [empleadoId]);

      if (rows.length) {
        const r = rows[0];
        fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
        position = r.Position || "NO ESPECIFICADO";
        mesesTrabajados = r.meses_trabajados || 0;
        startDate = r.StartDate;
        address = r.ProjectAddress || "AV. EL SAUZ 7, EL DEPOSITO, 42795 TLAHUELILPAN, HGO";
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
        LEFT JOIN basecontracts bc ON bc.BasePersonnelID = bp.BasePersonnelID
        WHERE bp.EmployeeID = ?
      `, [empleadoId]);

      if (rows.length) {
        const r = rows[0];
        fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
        position = r.Position || "NO ESPECIFICADO";
        mesesTrabajados = r.meses_trabajados || 0;
        startDate = r.StartDate;
        address = "AV. EL SAUZ 7, EL DEPOSITO, 42795 TLAHUELILPAN, HGO";
        endDate = "";
      }
    }

    if (!fullName) {
      return NextResponse.json({ error: "No se pudo obtener el nombre del empleado" }, { status: 404 });
    }

    const startDateFormatted = formatDateToSpanish(startDate);
    const endDateFormatted = formatDateToSpanish(endDate);
    const applicationDate = formatDateToSpanish(new Date());

    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "job-termination",
      "FT-RH-14.docx"
    );

    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: "Plantilla FT-RH-14.docx no encontrada" },
        { status: 404 }
      );
    }

    const template = fs.readFileSync(templatePath);

    const report = await createReport({
      template,
      data: {
        NOMBRE_COMPLETO: fullName,
        PUESTO: position,
        MESES: mesesTrabajados.toString(),
        FECHA_INICIO: startDateFormatted,
        DIRECCION: address,
        FECHA_TERMINO: endDateFormatted,
        FECHA_GENERACION: applicationDate,
      },
      cmdDelimiter: ["[[", "]]"],
    });

    const wordBuffer = Buffer.from(report);
    fs.writeFileSync(tempWordPath, wordBuffer);

    console.log("Convirtiendo a PDF con ConvertAPI...");
    const result = await convertapi.convert("pdf", {
      File: tempWordPath,
      PageRange: "1-10",
      PdfResolution: "300",
    });

    const pdfResponse = await fetch(result.file.url);
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBufferNode = Buffer.from(pdfBuffer);
    fs.writeFileSync(tempPdfPath, pdfBufferNode);

    // *** IMPORTANTE: Si saveToDb=true, devolver JSON ***
    if (saveToDb) {
      console.log(`FT-RH-14: saveToDb=true, subiendo a UploadThing...`);
      
      let fileUrl = null;
      try {
        const fileName = `FT-RH-14-${empleadoId}-${Date.now()}.pdf`;
        fileUrl = await uploadToUploadThing(pdfBufferNode, fileName);
        console.log(`PDF subido: ${fileUrl}`);
        
        if (fileUrl) {
          const updateConnection = await getConnection();
          try {
            await updateConnection.execute(
              `UPDATE jobtermination SET OFFileURL = ? WHERE EmployeeID = ?`,
              [fileUrl, parseInt(empleadoId)]
            );
            console.log(`BD actualizada para EmployeeID: ${empleadoId}`);
          } finally {
            await updateConnection.release();
          }
        }
      } catch (uploadError) {
        console.error('Error en upload:', uploadError);
      }
      
      // RETORNAR JSON, NO PDF
      return NextResponse.json({
        success: true,
        fileUrl: fileUrl,
        message: "PDF generado y guardado exitosamente"
      });
    }

    // Si es preview, mostrar inline
    if (isPreview) {
      const fileName = employee.EmployeeType === 'PROJECT'
        ? `FT-RH-14-PROYECTO-${empleadoId}.pdf`
        : `FT-RH-14-BASE-${empleadoId}.pdf`;
      
      return new NextResponse(pdfBufferNode, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${fileName}"`,
        },
      });
    }

    // Descarga normal
    const fileName = employee.EmployeeType === 'PROJECT'
      ? `FT-RH-14-PROYECTO-${empleadoId}.pdf`
      : `FT-RH-14-BASE-${empleadoId}.pdf`;

    return new NextResponse(pdfBufferNode, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
    
  } catch (error: any) {
    console.error("Error al generar FT-RH-14 PDF:", error);
    return NextResponse.json(
      { error: error.message || "Error al generar PDF" },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
    try {
      if (fs.existsSync(tempWordPath)) fs.unlinkSync(tempWordPath);
      if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
    } catch (cleanupError) {
      console.warn("Error al limpiar archivos temporales:", cleanupError);
    }
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
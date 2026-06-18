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
    
    const diasSemana = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
    const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    
    const diaSemana = diasSemana[dateObj.getDay()];
    const dia = dateObj.getDate().toString().padStart(2, "0");
    const mes = meses[dateObj.getMonth()];
    const anio = dateObj.getFullYear();
    
    return `${diaSemana} ${dia} DE ${mes} DEL ${anio}`;
  } catch (error) {
    console.warn("Error al formatear fecha:", error);
    return "NO ESPECIFICADO";
  }
}

function formatSimpleDateToSpanish(dateString: string | Date): string {
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
  const terminationDateParam = searchParams.get("terminationDate");

  console.log(`FT-RH-14: empleadoId=${empleadoId}, isPreview=${isPreview}, saveToDb=${saveToDb}, terminationDate=${terminationDateParam}`);

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
    let terminationDate = terminationDateParam;

    // Obtener la fecha de baja de la BD si no se recibió como parámetro
    if (!terminationDate) {
      const [terminationRow] = await connection.query<any[]>(`
        SELECT EndDate FROM jobtermination WHERE EmployeeID = ?
      `, [empleadoId]);
      
      if (terminationRow && terminationRow.length > 0 && terminationRow[0].EndDate) {
        terminationDate = terminationRow[0].EndDate;
        console.log(`FT-RH-14: Fecha de baja obtenida de BD: ${terminationDate}`);
      }
    }

    // Si aún no hay fecha de baja, usar la fecha actual
    if (!terminationDate) {
      terminationDate = new Date().toISOString().split('T')[0];
      console.log(`FT-RH-14: Usando fecha actual como fecha de baja: ${terminationDate}`);
    }

    if (employee.EmployeeType === 'PROJECT') {
      // Personal de Proyecto - Obtener datos del proyecto directamente
      const [rows] = await connection.query<any[]>(`
        SELECT 
          pp.FirstName,
          pp.LastName,
          pp.MiddleName,
          pc.Position,
          p.StartDate,
          p.EndDate,
          TIMESTAMPDIFF(MONTH, p.StartDate, ?) AS meses_trabajados,
          p.ProjectAddress
        FROM projectpersonnel pp
        INNER JOIN projectcontracts pc ON pc.ProjectPersonnelID = pp.ProjectPersonnelID
        INNER JOIN projects p ON p.ProjectID = pc.ProjectID
        WHERE pp.EmployeeID = ? AND pc.Status = 1
        LIMIT 1
      `, [terminationDate, empleadoId]);

      if (rows.length) {
        const r = rows[0];
        fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
        position = r.Position || "NO ESPECIFICADO";
        mesesTrabajados = r.meses_trabajados || 0;
        startDate = r.StartDate;        // Fecha de inicio del proyecto
        terminationDate = r.EndDate;    // Fecha de fin del proyecto
        address = r.ProjectAddress || "AV. EL SAUZ 7, EL DEPOSITO, 42795 TLAHUELILPAN, HGO";
        
        console.log(`FT-RH-14 PROYECTO: StartDate=${startDate}, EndDate=${r.EndDate}`);
      }
    } else {
      // Personal Base
      const [rows] = await connection.query<any[]>(`
        SELECT 
          bp.FirstName,
          bp.LastName,
          bp.MiddleName,
          bp.Position,
          bc.StartDate,
          TIMESTAMPDIFF(MONTH, bc.StartDate, ?) AS meses_trabajados
        FROM basepersonnel bp
        LEFT JOIN basecontracts bc ON bc.BasePersonnelID = bp.BasePersonnelID
        WHERE bp.EmployeeID = ?
      `, [terminationDate, empleadoId]);

      if (rows.length) {
        const r = rows[0];
        fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
        position = r.Position || "NO ESPECIFICADO";
        mesesTrabajados = r.meses_trabajados || 0;
        startDate = r.StartDate;
        address = "AV. EL SAUZ 7, EL DEPOSITO, 42795 TLAHUELILPAN, HGO";
        // Para personal base, la fecha de terminación se obtiene de jobtermination
        const [terminationRow] = await connection.query<any[]>(`
          SELECT EndDate FROM jobtermination WHERE EmployeeID = ?
        `, [empleadoId]);
        
        if (terminationRow && terminationRow.length > 0) {
          terminationDate = terminationRow[0].EndDate || terminationDate;
        }
        
        console.log(`FT-RH-14 BASE: StartDate=${startDate}, EndDate=${terminationDate}`);
      }
    }

    if (!fullName) {
      return NextResponse.json({ error: "No se pudo obtener el nombre del empleado" }, { status: 404 });
    }

    // Formatear las fechas correctamente
    const startDateObj = startDate ? new Date(startDate) : null;
    const terminationDateObj = terminationDate ? new Date(terminationDate) : new Date();
    const currentDateObj = new Date();
    
    const startDateFormatted = startDateObj ? formatSimpleDateToSpanish(startDateObj) : "NO ESPECIFICADO";
    const terminationDateFormatted = formatSimpleDateToSpanish(terminationDateObj);
    const applicationDateFormatted = formatDateToSpanish(currentDateObj);
    
    // Calcular años, meses y días trabajados
    const start = startDateObj || new Date();
    const end = terminationDateObj;
    let yearsWorked = end.getFullYear() - start.getFullYear();
    let monthsWorked = end.getMonth() - start.getMonth();
    let daysWorked = end.getDate() - start.getDate();
    
    if (daysWorked < 0) {
      monthsWorked--;
      const lastMonth = new Date(end.getFullYear(), end.getMonth(), 0);
      daysWorked += lastMonth.getDate();
    }
    
    if (monthsWorked < 0) {
      yearsWorked--;
      monthsWorked += 12;
    }
    
    // Construir el texto de antigüedad
    let antiguedadTexto = "";
    if (yearsWorked > 0) {
      antiguedadTexto += `${yearsWorked} AÑO${yearsWorked !== 1 ? 'S' : ''}`;
    }
    if (monthsWorked > 0) {
      if (antiguedadTexto) antiguedadTexto += " ";
      antiguedadTexto += `${monthsWorked} MES${monthsWorked !== 1 ? 'ES' : ''}`;
    }
    if (daysWorked > 0 && yearsWorked === 0 && monthsWorked === 0) {
      antiguedadTexto = `${daysWorked} DÍA${daysWorked !== 1 ? 'S' : ''}`;
    }
    if (!antiguedadTexto) {
      antiguedadTexto = "MENOS DE UN MES";
    }

    console.log(`FT-RH-14: Fecha de inicio: ${startDateFormatted}`);
    console.log(`FT-RH-14: Fecha de terminación: ${terminationDateFormatted}`);
    console.log(`FT-RH-14: Fecha de aplicación: ${applicationDateFormatted}`);
    console.log(`FT-RH-14: Antigüedad: ${antiguedadTexto}`);

    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "job-termination",
      "FT-RH-14.docx"
    );

    if (!fs.existsSync(templatePath)) {
      console.error(`Plantilla no encontrada en: ${templatePath}`);
      return NextResponse.json(
        { error: "Plantilla FT-RH-14.docx no encontrada" },
        { status: 404 }
      );
    }

    const template = fs.readFileSync(templatePath);

    // Preparar los datos para la plantilla
    const templateData = {
      NOMBRE_COMPLETO: fullName.toUpperCase(),
      PUESTO: position.toUpperCase(),
      ANTIGUEDAD: antiguedadTexto,
      MESES: mesesTrabajados,
      FECHA_INICIO: startDateFormatted,
      DIRECCION: address.toUpperCase(),
      FECHA_TERMINO: terminationDateFormatted,
      FECHA_GENERACION: applicationDateFormatted,
    };

    console.log("Datos para la plantilla:", templateData);

    const report = await createReport({
      template,
      data: templateData,
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

    // Si saveToDb=true, guardar y devolver JSON
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
            const [existing] = await updateConnection.execute(
              `SELECT JobTerminationID FROM jobtermination WHERE EmployeeID = ?`,
              [parseInt(empleadoId)]
            );
            
            if ((existing as any[]).length === 0) {
              await updateConnection.execute(
                `INSERT INTO jobtermination (EmployeeID, OFFileURL, EndDate) VALUES (?, ?, ?)`,
                [parseInt(empleadoId), fileUrl, terminationDate]
              );
            } else {
              await updateConnection.execute(
                `UPDATE jobtermination SET OFFileURL = ?, EndDate = ? WHERE EmployeeID = ?`,
                [fileUrl, terminationDate, parseInt(empleadoId)]
              );
            }
            console.log(`BD actualizada para EmployeeID: ${empleadoId} con OFFileURL y EndDate`);
          } finally {
            await updateConnection.release();
          }
        }
      } catch (uploadError) {
        console.error('Error en upload:', uploadError);
      }
      
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
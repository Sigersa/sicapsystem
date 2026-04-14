import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";
import ConvertAPI from "convertapi";
import { getConnection } from "@/lib/db";
import { createReport } from "docx-templates";

const convertapi = new ConvertAPI(process.env.CONVERTAPI_SECRET!);

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const empleadoId = searchParams.get("empleadoId");
  const isPreview = searchParams.get("preview") === "1";

  if (!empleadoId) {
    return NextResponse.json(
      { error: "Se requiere el ID del empleado" },
      { status: 400 }
    );
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

    const result = await convertapi.convert("pdf", {
      File: tempWordPath,
      PageRange: "1-10",
      PdfResolution: "300",
    });

    const pdfResponse = await fetch(result.file.url);
    const pdfBuffer = await pdfResponse.arrayBuffer();
    fs.writeFileSync(tempPdfPath, Buffer.from(pdfBuffer));

    const fileName = employee.EmployeeType === 'PROJECT'
      ? `FT-RH-14-PROYECTO-${empleadoId}.pdf`
      : `FT-RH-14-BASE-${empleadoId}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": isPreview
          ? `inline; filename="${fileName}"`
          : `attachment; filename="${fileName}"`,
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
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";
import ConvertAPI from "convertapi";
import { getConnection } from "@/lib/db";
import { createReport } from "docx-templates";

const convertapi = new ConvertAPI(process.env.CONVERTAPI_SECRET!);

/* ================================
   FUNCIÓN PARA FORMATEAR FECHAS
================================== */
function formatFecha(fecha: string): string {
  if (!fecha) return "";
  try {
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return fecha;
    const dia = d.getDate().toString().padStart(2, "0");
    const mes = new Intl.DateTimeFormat("es-MX", { month: "long" }).format(d);
    const anio = d.getFullYear();
    return `${dia} de ${mes} del ${anio}`;
  } catch (error) {
    console.warn("Error al formatear fecha:", error);
    return fecha;
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
    `FT-RH-29-${Date.now()}-${empleadoId}.docx`
  );
  const tempPdfPath = path.join(
    os.tmpdir(),
    `FT-RH-29-${Date.now()}-${empleadoId}.pdf`
  );

  let connection;

  try {
    connection = await getConnection();

    // Primero, obtener información del empleado desde la tabla employees
    const [employeeInfo] = await connection.query<any[]>(
      `
      SELECT EmployeeType
      FROM employees 
      WHERE EmployeeID = ?
    `,
      [empleadoId]
    );

    if (!employeeInfo.length) {
      return NextResponse.json(
        { error: "Empleado no encontrado" },
        { status: 404 }
      );
    }

    const employee = employeeInfo[0];
    let fullName = "";
    let startDate = "";
    let position = "";
    let agreementFileURL = "";

    // Obtener información según el tipo de empleado
    if (employee.EmployeeType === "PROJECT") {
      // Personal de Proyecto
      const [rows] = await connection.query<any[]>(
        `
        SELECT 
          pp.FirstName,
          pp.LastName,
          pp.MiddleName,
          DATE_FORMAT(pr.StartDate, '%Y/%m/%d') AS StartDate,
          pc.Position,
          pc.Status
        FROM projectpersonnel pp
        LEFT JOIN projectcontracts pc ON pc.ProjectPersonnelID = pp.ProjectPersonnelID
        LEFT JOIN projects pr 
          ON pr.ProjectID = pc.ProjectID
        WHERE pp.EmployeeID = ? AND pc.Status = 1
      `,
        [empleadoId]
      );

      if (!rows.length) {
        return NextResponse.json(
          { error: "Información de proyecto no encontrada" },
          { status: 404 }
        );
      }

      const r = rows[0];
      fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
      position = r.Position || "";
      startDate = r.StartDate || "";
      agreementFileURL = r.AgreementFileURL || "";
    } else {
      // Personal Base
      const [rows] = await connection.query<any[]>(
        `
        SELECT 
          bp.FirstName,
          bp.LastName,
          bp.MiddleName,
          bp.Position,
          DATE_FORMAT(bc.StartDate, '%Y/%m/%d') AS StartDate,
          bc.AgreementFileURL
        FROM basepersonnel bp
        LEFT JOIN basecontracts bc ON bc.BasePersonnelID = bp.BasePersonnelID
        WHERE bp.EmployeeID = ?
      `,
        [empleadoId]
      );

      if (!rows.length) {
        return NextResponse.json(
          { error: "Información de personal base no encontrada" },
          { status: 404 }
        );
      }

      const r = rows[0];
      fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
      position = r.Position || "";
      startDate = r.StartDate || "";
      agreementFileURL = r.AgreementFileURL || "";
    }

    // Validar que se obtuvo el nombre
    if (!fullName) {
      return NextResponse.json(
        { error: "No se pudo obtener el nombre del empleado" },
        { status: 404 }
      );
    }

    // Formatear la fecha de ingreso
    const fechaFormateada = formatFecha(startDate);

    // Si ya tenemos un PDF guardado, retornarlo
    if (agreementFileURL) {
      try {
        const pdfResponse = await fetch(agreementFileURL);

        if (pdfResponse.ok) {
          const pdfBuffer = await pdfResponse.arrayBuffer();

          // Nombre del archivo según tipo de empleado
          const fileName =
            employee.EmployeeType === "PROJECT"
              ? `FT-RH-29-PROYECTO-${empleadoId}.pdf`
              : `FT-RH-29-BASE-${empleadoId}.pdf`;

          return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": isPreview
                ? `inline; filename="${fileName}"`
                : `attachment; filename="${fileName}"`,
            },
          });
        }
      } catch (error) {
        console.warn(
          "Error al obtener PDF existente, generando uno nuevo:",
          error
        );
      }
    }

    // Usar la plantilla FT-RH-29
    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "hiring",
      "FT-RH-29.docx"
    );

    // Verificar si la plantilla existe
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: "Plantilla FT-RH-29.docx no encontrada" },
        { status: 404 }
      );
    }

    const template = fs.readFileSync(templatePath);

    // Generar el documento Word con los datos
    const report = await createReport({
      template,
      data: {
        NOMBRE_COMPLETO: fullName || "NO ESPECIFICADO",
        FECHA_DE_INGRESO: fechaFormateada || "NO ESPECIFICADO",
        PUESTO_DEL_EMPLEADO: position || "NO ESPECIFICADO",
        FECHA_GENERACION: new Date().toLocaleDateString("es-MX", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        }),
      },
      cmdDelimiter: ["[[", "]]"],
    });

    const wordBuffer = Buffer.from(report);

    // Guardar Word temporal
    fs.writeFileSync(tempWordPath, wordBuffer);

    // Convertir a PDF usando ConvertAPI
    const result = await convertapi.convert("pdf", {
      File: tempWordPath,
      PageRange: "1-10",
      PdfResolution: "300",
    });

    // Descargar el PDF
    const pdfResponse = await fetch(result.file.url);
    const pdfBuffer = await pdfResponse.arrayBuffer();

    // Guardar temporalmente
    fs.writeFileSync(tempPdfPath, Buffer.from(pdfBuffer));

    // Nombre del archivo según tipo de empleado
    const fileName =
      employee.EmployeeType === "PROJECT"
        ? `FT-RH-29-PROYECTO-${empleadoId}.pdf`
        : `FT-RH-29-BASE-${empleadoId}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": isPreview
          ? `inline; filename="${fileName}"`
          : `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Error al generar FT-RH-29 PDF:", error);
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
      if (fs.existsSync(tempWordPath)) {
        fs.unlinkSync(tempWordPath);
      }
      if (fs.existsSync(tempPdfPath)) {
        fs.unlinkSync(tempPdfPath);
      }
    } catch (cleanupError) {
      console.warn("Error al limpiar archivos temporales:", cleanupError);
    }
  }
}

// Endpoint para generar y guardar el PDF
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

    // Llamar al endpoint GET para generar el PDF
    const pdfResponse = await fetch(
      `${request.nextUrl.origin}/api/download/pdf/FT-RH-29?empleadoId=${empleadoId}`
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
      fileName: `FT-RH-29-${empleadoId}.pdf`,
    });
  } catch (error: any) {
    console.error("Error en POST FT-RH-29:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
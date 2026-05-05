import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getConnection } from "@/lib/db";
import { createReport } from "docx-templates";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const empleadoId = searchParams.get("empleadoId");

  if (!empleadoId) {
    return NextResponse.json(
      { error: "Se requiere el ID del empleado" },
      { status: 400 }
    );
  }

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
    } else {
      // Personal Base
      const [rows] = await connection.query<any[]>(
        `
        SELECT 
          bp.FirstName,
          bp.LastName,
          bp.MiddleName,
          bp.Position,
          DATE_FORMAT(bc.StartDate, '%Y/%m/%d') AS StartDate
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
    }

    // Validar que se obtuvieron los datos necesarios
    if (!fullName) {
      return NextResponse.json(
        { error: "No se pudo obtener el nombre del empleado" },
        { status: 404 }
      );
    }

    // Formatear la fecha de ingreso
    let fechaFormateada = "";
    if (startDate) {
      try {
        const dateObj = new Date(startDate);
        // Verificar si la fecha es válida
        if (!isNaN(dateObj.getTime())) {
          const dia = dateObj.getDate().toString().padStart(2, "0");
          const mes = new Intl.DateTimeFormat("es-MX", {
            month: "long",
          }).format(dateObj);
          const anio = dateObj.getFullYear();
          fechaFormateada = `${dia} de ${mes} del ${anio}`;
        } else {
          fechaFormateada = startDate;
        }
      } catch (error) {
        console.warn("Error al formatear fecha:", error);
        fechaFormateada = startDate;
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
        NOMBRE_COMPLETO: fullName,
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

    const fileBuffer = Buffer.from(report);

    // Nombre del archivo con tipo de empleado e ID
    const fileName =
      employee.EmployeeType === "PROJECT"
        ? `FT-RH-29-PROYECTO-${empleadoId}.docx`
        : `FT-RH-29-BASE-${empleadoId}.docx`;

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Error al generar FT-RH-29:", error);
    return NextResponse.json(
      { error: "Error al generar el documento: " + (error.message || "Error desconocido") },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
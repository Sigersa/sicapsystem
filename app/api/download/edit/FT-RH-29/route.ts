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
      SELECT EmployeeType, BasePersonnelID, ProjectPersonnelID 
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
          DATE_FORMAT(pc.StartDate, '%Y/%m/%d') AS StartDate,
          pc.Position
        FROM projectpersonnel pp
        LEFT JOIN projectcontracts pc ON pc.ProjectPersonnelID = pp.ProjectPersonnelID
        WHERE pp.ProjectPersonnelID = ?
      `,
        [employee.ProjectPersonnelID]
      );

      if (!rows.length) {
        return NextResponse.json(
          { error: "Información de proyecto no encontrada" },
          { status: 404 }
        );
      }

      const r = rows[0];
      fullName = `${r.FirstName} ${r.LastName} ${r.MiddleName || ""}`.trim();
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
        WHERE bp.BasePersonnelID = ?
      `,
        [employee.BasePersonnelID]
      );

      if (!rows.length) {
        return NextResponse.json(
          { error: "Información de personal base no encontrada" },
          { status: 404 }
        );
      }

      const r = rows[0];
      fullName = `${r.FirstName} ${r.LastName} ${r.MiddleName || ""}`.trim();
      position = r.Position || "";
      startDate = r.StartDate || "";
    }

    // Formatear la fecha de ingreso
    let fechaFormateada = "";
    if (startDate) {
      try {
        const dateObj = new Date(startDate);
        const dia = dateObj.getDate().toString().padStart(2, "0");
        const mes = new Intl.DateTimeFormat("es-MX", {
          month: "long",
        }).format(dateObj);
        const anio = dateObj.getFullYear();
        fechaFormateada = `${dia} de ${mes} del ${anio}`;
      } catch (error) {
        console.warn("Error al formatear fecha:", error);
        fechaFormateada = startDate;
      }
    }

    // Usar la plantilla FT-RH-29
    const templatePath = path.join(
      process.cwd(),
      "public",
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
        FECHA_DE_INGRESO: fechaFormateada,
        PUESTO_DEL_EMPLEADO: position,
        FECHA_GENERACION: new Date().toLocaleDateString("es-MX"),
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
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    connection?.release?.();
  }
}
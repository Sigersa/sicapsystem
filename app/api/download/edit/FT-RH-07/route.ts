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
    const [employeeInfo] = await connection.query<any[]>(`
      SELECT EmployeeType, BasePersonnelID, ProjectPersonnelID 
      FROM employees 
      WHERE EmployeeID = ?
    `, [empleadoId]);

    if (!employeeInfo.length) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }

    const employee = employeeInfo[0];
    let fullName = "";

    // Obtener nombre según el tipo de empleado
    if (employee.EmployeeType === 'PROJECT') {
      // Personal de Proyecto
      const [rows] = await connection.query<any[]>(`
        SELECT 
          pp.FirstName,
          pp.LastName,
          pp.MiddleName
        FROM projectpersonnel pp
        WHERE pp.ProjectPersonnelID = ?
      `, [employee.ProjectPersonnelID]);

      if (!rows.length) {
        return NextResponse.json({ error: "Información de proyecto no encontrada" }, { status: 404 });
      }

      const r = rows[0];
      fullName = `${r.FirstName} ${r.LastName} ${r.MiddleName || ""}`.trim();

    } else {
      // Personal Base
      const [rows] = await connection.query<any[]>(`
        SELECT 
          bp.FirstName,
          bp.LastName,
          bp.MiddleName
        FROM basepersonnel bp
        WHERE bp.BasePersonnelID = ?
      `, [employee.BasePersonnelID]);

      if (!rows.length) {
        return NextResponse.json({ error: "Información de personal base no encontrada" }, { status: 404 });
      }

      const r = rows[0];
      fullName = `${r.FirstName} ${r.LastName} ${r.MiddleName || ""}`.trim();
    }

    // Usar la misma plantilla para ambos tipos
    const templatePath = path.join(
      process.cwd(),
      "public",
      "hiring",
      "FT-RH-07.docx"
    );

    // Verificar si la plantilla existe
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: "Plantilla FT-RH-07.docx no encontrada" },
        { status: 404 }
      );
    }

    const template = fs.readFileSync(templatePath);

    // Generar el documento Word con los datos
    const report = await createReport({
      template,
      data: {
        NOMBRE_COMPLETO: fullName,
      },
      cmdDelimiter: ["[[", "]]"],
    });

    const fileBuffer = Buffer.from(report);

    // Nombre del archivo con tipo de empleado e ID
    const fileName = employee.EmployeeType === 'PROJECT'
      ? `FT-RH-07-PROYECTO-${empleadoId}.docx`
      : `FT-RH-07-BASE-${empleadoId}.docx`;

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
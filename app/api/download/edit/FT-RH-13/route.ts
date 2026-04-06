import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getConnection } from "@/lib/db";
import { createReport } from "docx-templates";

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
      SELECT EmployeeType 
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
        WHERE pp.EmployeeID = ?
      `, [empleadoId]);

      if (!rows.length) {
        return NextResponse.json({ error: "Información de proyecto no encontrada" }, { status: 404 });
      }

      const r = rows[0];
      fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();

    } else {
      // Personal Base
      const [rows] = await connection.query<any[]>(`
        SELECT 
          bp.FirstName,
          bp.LastName,
          bp.MiddleName
        FROM basepersonnel bp
        WHERE bp.EmployeeID = ?
      `, [empleadoId]);

      if (!rows.length) {
        return NextResponse.json({ error: "Información de personal base no encontrada" }, { status: 404 });
      }

      const r = rows[0];
      fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
    }

    // Si no se pudo obtener el nombre completo
    if (!fullName) {
      return NextResponse.json({ error: "No se pudo obtener el nombre del empleado" }, { status: 404 });
    }
    
    const applicationDate = formatDateToSpanish(new Date());

    // Usar la misma plantilla para ambos tipos
    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "job-termination",
      "FT-RH-13.docx"
    );

    // Verificar si la plantilla existe
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: "Plantilla FT-RH-13.docx no encontrada" },
        { status: 404 }
      );
    }

    const template = fs.readFileSync(templatePath);

    // Generar el documento Word con los datos
    const report = await createReport({
      template,
      data: {
        NOMBRE_COMPLETO: fullName,
        FECHA_GENERACION: applicationDate,
      },
      cmdDelimiter: ["[[", "]]"],
    });

    const fileBuffer = Buffer.from(report);

    // Nombre del archivo con tipo de empleado e ID
    const fileName = employee.EmployeeType === 'PROJECT'
      ? `FT-RH-13-PROYECTO-${empleadoId}.docx`
      : `FT-RH-13-BASE-${empleadoId}.docx`;

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Error al generar FT-RH-13:", error);
    return NextResponse.json({ 
      error: "Error al generar el documento: " + (error.message || "Error desconocido") 
    }, { status: 500 });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
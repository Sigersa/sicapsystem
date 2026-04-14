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
    let position = "";
    let monthw = "";
    let startDate = "";
    let address = "";
    let endDate = "";

    // Obtener nombre según el tipo de empleado
    if (employee.EmployeeType === 'PROJECT') {
      // Personal de Proyecto
      const [rows] = await connection.query<any[]>(`
        SELECT 
          pp.FirstName,
          pp.LastName,
          pp.MiddleName,
          pc.Position,
          pc.StartDate,
          TIMESTAMPDIFF(MONTH, pc.StartDate, CURDATE()) AS meses_trabajados,
          pc.EndDate
	      pr.ProjectAddress
        FROM projectpersonnel pp
        INNER JOIN projectcontracts pc ON pc.ProjectPersonnelID = pp.ProjectPersonnelID
        LEFT JOIN projects pr ON pr.ProjectID = pc.ProjectID
        WHERE pp.EmployeeID = ?
      `, [empleadoId]);

      if (!rows.length) {
        return NextResponse.json({ error: "Información de proyecto no encontrada" }, { status: 404 });
      }

      const r = rows[0];
      fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
      position = r.Position;
      monthw = r.meses_trabajados;
      startDate = r.StartDate;
      address = r.ProjectAddress;
      endDate = r.EndDate;
    } else {
      // Personal Base
      const [rows] = await connection.query<any[]>(`
        SELECT 
          bp.FirstName,
          bp.LastName,
          bp.MiddleName,
          bp.Position,
          bc.StartDate,
          TIMESTAMPDIFF(MONTH, bc.StartDate, CURDATE()) AS meses_trabajados,
          jt.EndDate
        FROM basepersonnel bp
        INNER JOIN jobtermination jt ON jt.EmployeeID = bp.EmployeeID
        LEFT JOIN basecontracts bc ON bc.BasePersonnelID = bp.BasePersonnelID
        WHERE bp.EmployeeID = = ?
      `, [empleadoId]);

      if (!rows.length) {
        return NextResponse.json({ error: "Información de personal base no encontrada" }, { status: 404 });
      }

      const r = rows[0];
      fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
      position = r.Position;
      monthw = r.meses_trabajados;
      startDate = r.StartDate;
      address = "AV. EL SAUZ 7, EL DEPOSITO, 42795 TLAHUELILPAN, HGO";
      endDate = r.EndDate;
    }

    // Si no se pudo obtener el nombre completo
    if (!fullName) {
      return NextResponse.json({ error: "No se pudo obtener el nombre del empleado" }, { status: 404 });
    }
    
    const applicationDate = formatDateToSpanish(new Date());
    const startDatee = formatDateToSpanish(startDate);
    const endDatee = formatDateToSpanish(endDate);

    // Usar la misma plantilla para ambos tipos
    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "job-termination",
      "FT-RH-14.docx"
    );

    // Verificar si la plantilla existe
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: "Plantilla FT-RH-14.docx no encontrada" },
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
        PUESTO: position || "",
        MESES: monthw || "",
        FECHA_INICIO: startDatee,
        DIRECCION: address || "",
        FECHA_TERMINO: endDatee,
      },
      cmdDelimiter: ["[[", "]]"],
    });

    const fileBuffer = Buffer.from(report);

    // Nombre del archivo con tipo de empleado e ID
    const fileName = employee.EmployeeType === 'PROJECT'
      ? `FT-RH-14-PROYECTO-${empleadoId}.docx`
      : `FT-RH-14-BASE-${empleadoId}.docx`;

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Error al generar FT-RH-14:", error);
    return NextResponse.json({ 
      error: "Error al generar el documento: " + (error.message || "Error desconocido") 
    }, { status: 500 });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
// app/api/download/pdf/FT-RH-08/route.ts
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";
import ConvertAPI from "convertapi";
import { getConnection } from "@/lib/db";
import { createReport } from "docx-templates";
import { UTApi } from 'uploadthing/server';

const convertapi = new ConvertAPI(process.env.CONVERTAPI_SECRET!);
const utapi = new UTApi();

// Función para calcular años de antigüedad
const calcularAniosAntiguedad = (fechaInicio: string | Date): number => {
  if (!fechaInicio) return 0;
  
  const startDate = new Date(fechaInicio);
  const currentDate = new Date();
  
  let years = currentDate.getFullYear() - startDate.getFullYear();
  const monthDiff = currentDate.getMonth() - startDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && currentDate.getDate() < startDate.getDate())) {
    years--;
  }
  
  return years;
};

// Función para calcular días de vacaciones según años de antigüedad
const calcularDiasVacaciones = (aniosAntiguedad: number): number => {
  if (aniosAntiguedad >= 1 && aniosAntiguedad <= 5) {
    return 12 + (aniosAntiguedad - 1) * 2;
  } else if (aniosAntiguedad >= 6 && aniosAntiguedad <= 10) {
    return 22;
  } else if (aniosAntiguedad >= 11 && aniosAntiguedad <= 15) {
    return 24;
  } else if (aniosAntiguedad >= 16 && aniosAntiguedad <= 20) {
    return 26;
  } else if (aniosAntiguedad >= 21 && aniosAntiguedad <= 25) {
    return 28;
  } else if (aniosAntiguedad >= 26 && aniosAntiguedad <= 30) {
    return 30;
  } else if (aniosAntiguedad >= 31 && aniosAntiguedad <= 35) {
    return 32;
  } else if (aniosAntiguedad > 35) {
    return 32;
  } else {
    return 12;
  }
};

// Función para obtener los días totales usados en vacaciones
const getTotalUsedVacationDays = async (connection: any, employeeId: number): Promise<number> => {
  const [vacations] = await connection.execute(
    `SELECT SUM(Days) as totalUsed
     FROM employeevacations 
     WHERE EmployeeID = ?`,
    [employeeId]
  );
  
  return (vacations as any[])[0]?.totalUsed || 0;
};

function dias(num: number): string {
  if (num < 0 || num > 100) {
    throw new Error("La cantidad de días tiene que ser entre el rango de 0 y 100");
  }

  const unidades = [
    "CERO", "UNO", "DOS", "TRES", "CUATRO",
    "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE",
  ];

  const especiales: Record<number, string> = {
    10: "DIEZ",
    11: "ONCE",
    12: "DOCE",
    13: "TRECE",
    14: "CATORCE",
    15: "QUINCE",
    20: "VEINTE",
    100: "CIEN"
  };

  const decenas = [
    "", "", "VEINTE", "TREINTA", "CUARENTA",
    "CINCUENTA", "SESENTA", "SETENTA",
    "OCHENTA", "NOVENTA",
  ];

  function convertir(n: number): string {
    if (n < 10) return unidades[n];
    if (especiales[n]) return especiales[n];
    if (n < 20) return "DIECI" + unidades[n - 10];
    if (n < 30) return "VEINTI" + unidades[n - 20];
    if (n <= 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      return u === 0 ? decenas[d] : `${decenas[d]} Y ${unidades[u]}`;
    }
    return "";
  }

  return convertir(num);
}

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
  const vacationId = searchParams.get("vacationId");
  const isPreview = searchParams.get("preview") === "1";
  const saveToUploadThing = searchParams.get("save") === "1";

  if (!empleadoId) {
    return NextResponse.json(
      { error: "Se requiere el ID del empleado" },
      { status: 400 }
    );
  }

  // Si es solo vista previa y tenemos vacationId, buscar la URL en la BD
  if (isPreview && vacationId) {
    let connection;
    try {
      connection = await getConnection();
      const [rows] = await connection.execute(
        'SELECT FileURL FROM employeevacations WHERE VacationID = ? AND EmployeeID = ?',
        [vacationId, empleadoId]
      );
      
      if (rows && (rows as any[]).length > 0 && (rows as any[])[0].FileURL) {
        const fileUrl = (rows as any[])[0].FileURL;
        console.log(`Vista previa: usando URL existente ${fileUrl}`);
        
        // Redirigir a la URL del PDF
        return NextResponse.redirect(fileUrl);
      }
    } catch (error) {
      console.error('Error al obtener URL de BD para vista previa:', error);
    } finally {
      if (connection) connection.release();
    }
  }

  const tempWordPath = path.join(
    os.tmpdir(),
    `FT-RH-08-${Date.now()}-${empleadoId}${vacationId ? `-${vacationId}` : ''}.docx`
  );

  let connection;

  try {
    connection = await getConnection();

    const [employeeInfo] = await connection.query<any[]>(
      `SELECT EmployeeType FROM employees WHERE EmployeeID = ?`,
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
    let position = "";
    let contractStartDate = "";
    let yearsOfSeniority = 0;
    let daysOfVacations = 0;
    let vacationStartDate = "";
    let vacationEndDate = "";
    let totalUsedDays = 0;
    let remainingDays = 0;
    let currentVacationDays = 0;
    let employeeType = "";

    if (employee.EmployeeType === "PROJECT") {
      employeeType = "PROYECTO";
      const [rows] = await connection.query<any[]>(
        `SELECT pp.FirstName, pp.LastName, pp.MiddleName, pp.Position, pc.StartDate AS ContractStartDate
         FROM projectpersonnel pp
         LEFT JOIN projectcontracts pc ON pc.ProjectPersonnelID = pp.ProjectPersonnelID
         WHERE pp.EmployeeID = ?`,
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
      contractStartDate = r.ContractStartDate || "";
      
      if (contractStartDate) {
        yearsOfSeniority = calcularAniosAntiguedad(contractStartDate);
      }
      
      daysOfVacations = calcularDiasVacaciones(yearsOfSeniority);
    } else {
      employeeType = "BASE";
      const [rows] = await connection.query<any[]>(
        `SELECT bp.FirstName, bp.LastName, bp.MiddleName, bp.Position, bc.StartDate AS ContractStartDate
         FROM basepersonnel bp
         LEFT JOIN basecontracts bc ON bc.BasePersonnelID = bp.BasePersonnelID
         WHERE bp.EmployeeID = ?`,
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
      contractStartDate = r.ContractStartDate || "";
      
      if (contractStartDate) {
        yearsOfSeniority = calcularAniosAntiguedad(contractStartDate);
      }
      
      daysOfVacations = calcularDiasVacaciones(yearsOfSeniority);
    }

    if (vacationId) {
      const [vacationRows] = await connection.query<any[]>(
        `SELECT StartDate, EndDate, Days FROM employeevacations WHERE VacationID = ? AND EmployeeID = ?`,
        [vacationId, empleadoId]
      );
      
      if (vacationRows.length) {
        vacationStartDate = vacationRows[0].StartDate || "";
        vacationEndDate = vacationRows[0].EndDate || "";
        currentVacationDays = vacationRows[0].Days || 0;
      }
    } else {
      const [vacationRows] = await connection.query<any[]>(
        `SELECT StartDate, EndDate, Days FROM employeevacations WHERE EmployeeID = ? ORDER BY StartDate DESC LIMIT 1`,
        [empleadoId]
      );
      
      if (vacationRows.length) {
        vacationStartDate = vacationRows[0].StartDate || "";
        vacationEndDate = vacationRows[0].EndDate || "";
        currentVacationDays = vacationRows[0].Days || 0;
      }
    }
    
    totalUsedDays = await getTotalUsedVacationDays(connection, parseInt(empleadoId));
    remainingDays = daysOfVacations - totalUsedDays;

    if (!fullName) {
      return NextResponse.json(
        { error: "No se pudo obtener el nombre del empleado" },
        { status: 404 }
      );
    }

    const formattedContractStartDate = formatDateToSpanish(contractStartDate);
    const applicationDate = formatDateToSpanish(new Date());
    const formattedVacationStartDate = formatDateToSpanish(vacationStartDate);
    const formattedVacationEndDate = formatDateToSpanish(vacationEndDate);
    
    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "personnel-management",
      "FT-RH-08.docx"
    );
  
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: "Plantilla FT-RH-08.docx no encontrada" },
        { status: 404 }
      );
    }

    const template = fs.readFileSync(templatePath);

    const report = await createReport({
      template,
      data: {
        NOMBRE_COMPLETO: fullName.toUpperCase(),
        FECHA_DE_INGRESO: formattedContractStartDate,
        PUESTO_DEL_EMPLEADO: position.toUpperCase() || "NO ESPECIFICADO",
        FECHA_GENERACION: applicationDate,
        AÑOS: yearsOfSeniority.toString(),
        DIAS_TOTALES: dias(daysOfVacations),
        DIAS_USADOS: dias(totalUsedDays),
        DIAS_RESTANTES: dias(remainingDays),
        FECHA_INICIO: formattedVacationStartDate,
        FECHA_TERMINO: formattedVacationEndDate,
        DIAS_VACACIONES: currentVacationDays ? dias(currentVacationDays) : "NO ESPECIFICADO",
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

    let fileUrl = null;
    
    // Si se solicita guardar en UploadThing y hay vacationId
    if (saveToUploadThing && vacationId) {
      try {
        console.log(`Subiendo PDF a UploadThing para VacationID: ${vacationId}`);
        
        const fileName = `FT-RH-08-${employeeType}-${empleadoId}-${vacationId}.pdf`;
        const file = new File([Buffer.from(pdfBuffer)], fileName, { type: 'application/pdf' });
        
        const uploadResponse = await utapi.uploadFiles([file]);
        
        if (uploadResponse && uploadResponse[0] && uploadResponse[0].data) {
          // Usar ufsUrl en lugar de url (nueva versión)
          fileUrl = uploadResponse[0].data.ufsUrl || uploadResponse[0].data.url;
          console.log(`PDF subido exitosamente: ${fileUrl}`);
          
          // Actualizar el campo FileURL en la tabla employeevacations
          const updateConnection = await getConnection();
          try {
            await updateConnection.execute(
              `UPDATE employeevacations SET FileURL = ? WHERE VacationID = ?`,
              [fileUrl, vacationId]
            );
            console.log(`URL actualizada en BD para VacationID: ${vacationId}`);
          } finally {
            await updateConnection.release();
          }
        } else {
          console.error('Error: No se recibió URL de UploadThing');
        }
      } catch (uploadError) {
        console.error('Error al subir PDF a UploadThing:', uploadError);
      }
    }

    // Si es una solicitud de guardado (save=1), devolvemos JSON con la URL
    if (saveToUploadThing) {
      return NextResponse.json({
        success: true,
        fileUrl: fileUrl,
        message: "PDF generado y guardado exitosamente"
      });
    }

    const fileName = `FT-RH-08-${employeeType}-${empleadoId}${vacationId ? `-${vacationId}` : ''}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": isPreview
          ? `inline; filename="${fileName}"`
          : `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Error al generar FT-RH-08 PDF:", error);
    return NextResponse.json(
      { error: error.message || "Error al generar PDF" },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
    try {
      if (fs.existsSync(tempWordPath)) {
        fs.unlinkSync(tempWordPath);
      }
    } catch (cleanupError) {
      console.warn("Error al limpiar archivos temporales:", cleanupError);
    }
  }
}

// Endpoint para generar y guardar el PDF (POST)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { empleadoId, vacationId } = body;

    if (!empleadoId) {
      return NextResponse.json(
        { error: "Se requiere el ID del empleado" },
        { status: 400 }
      );
    }

    if (!vacationId) {
      return NextResponse.json(
        { error: "Se requiere el ID del período de vacaciones" },
        { status: 400 }
      );
    }

    // Construir la URL con los parámetros para generar y guardar
    let url = `${request.nextUrl.origin}/api/download/pdf/FT-RH-08?empleadoId=${empleadoId}&vacationId=${vacationId}&save=1`;

    // Llamar al endpoint GET para generar y guardar el PDF
    const pdfResponse = await fetch(url);

    if (!pdfResponse.ok) {
      const error = await pdfResponse.json().catch(() => ({ error: "Error desconocido" }));
      return NextResponse.json(
        { error: error.error || "Error al generar el PDF" },
        { status: 500 }
      );
    }

    const result = await pdfResponse.json();
    
    return NextResponse.json({
      success: true,
      message: "PDF generado y guardado exitosamente",
      fileUrl: result.fileUrl,
      vacationId: vacationId
    });
  } catch (error: any) {
    console.error("Error en POST FT-RH-08:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
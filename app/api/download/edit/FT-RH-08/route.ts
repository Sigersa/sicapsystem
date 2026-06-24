// app/api/download/edit/FT-RH-08/route.ts
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getConnection } from "@/lib/db";
import { createReport } from "docx-templates";

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

// Función para formatear fechas cortas para períodos
function formatDateShort(dateString: string | Date): string {
  if (!dateString) return "";
  
  try {
    const dateObj = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    if (isNaN(dateObj.getTime())) {
      return "";
    }
    
    const dia = dateObj.getDate().toString().padStart(2, "0");
    const mes = new Intl.DateTimeFormat("es-MX", {
      month: "long",
    }).format(dateObj).toUpperCase();
    const anio = dateObj.getFullYear();
    
    return `${dia} DE ${mes} DEL ${anio}`;
  } catch (error) {
    return "";
  }
}

// Función para obtener todos los períodos de vacaciones de un empleado
const getVacationPeriods = async (connection: any, employeeId: number): Promise<any[]> => {
  const [periods] = await connection.execute(
    `SELECT VacationID, Days, StartDate, EndDate, Observations
     FROM employeevacations 
     WHERE EmployeeID = ?
     ORDER BY StartDate ASC`,
    [employeeId]
  );
  
  return periods as any[];
};

// Función para formatear los períodos de vacaciones en el formato solicitado
const formatPeriods = (periods: any[]): string => {
  if (!periods || periods.length === 0) {
    return "NO SE REGISTRARON PERÍODOS DE VACACIONES";
  }

  const formattedPeriods = periods.map((period, index) => {
    const days = period.Days;
    const startDateFormatted = formatDateShort(period.StartDate);
    const endDateFormatted = formatDateShort(period.EndDate);
    
    // Si es un solo día, mostrar "1 DÍA EL [fecha]"
    if (days === 1) {
      return `1 DÍA EL ${startDateFormatted}`;
    }
    
    // Si son varios días, mostrar "X DÍAS DEL [inicio] AL [fin]"
    return `${days} DÍAS DEL ${startDateFormatted} AL ${endDateFormatted}`;
  });

  // Unir con comas y punto final
  let result = formattedPeriods.join(", ");
  
  // Asegurar que termine con punto
  if (result.length > 0 && !result.endsWith('.')) {
    result += '.';
  }
  
  return result;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const empleadoId = searchParams.get("empleadoId");
  const vacationId = searchParams.get("vacationId");

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
    let position = "";
    let contractStartDate = "";
    let yearsOfSeniority = 0;
    let daysOfVacations = 0;
    let totalUsedDays = 0;
    let remainingDays = 0;
    let allPeriods: any[] = [];

    // Obtener todos los períodos de vacaciones del empleado
    allPeriods = await getVacationPeriods(connection, parseInt(empleadoId));

    // Obtener información del personal base
    const [basePersonnelRows] = await connection.query<any[]>(
      `
      SELECT     
        bp.FirstName,
        bp.LastName,
        bp.MiddleName,
        bp.Position,
        bc.StartDate AS ContractStartDate
      FROM basepersonnel bp
      INNER JOIN employees e ON e.EmployeeID = bp.EmployeeID
      LEFT JOIN basecontracts bc ON bc.BasePersonnelID = bp.BasePersonnelID
      WHERE bp.EmployeeID = ?
      `,
      [empleadoId]
    );

    if (!basePersonnelRows.length) {
      return NextResponse.json(
        { error: "Información de personal base no encontrada" },
        { status: 404 }
      );
    }

    const baseInfo = basePersonnelRows[0];
    fullName = `${baseInfo.FirstName || ""} ${baseInfo.LastName || ""} ${baseInfo.MiddleName || ""}`.trim();
    position = baseInfo.Position || "";
    contractStartDate = baseInfo.ContractStartDate || "";
    
    // Calcular años de antigüedad
    if (contractStartDate) {
      yearsOfSeniority = calcularAniosAntiguedad(contractStartDate);
    }
    
    // Calcular días de vacaciones según los años de antigüedad
    daysOfVacations = calcularDiasVacaciones(yearsOfSeniority);
    
    // Obtener días totales usados
    totalUsedDays = await getTotalUsedVacationDays(connection, parseInt(empleadoId));
    
    // Calcular días restantes
    remainingDays = daysOfVacations - totalUsedDays;

    // Validar que se obtuvieron los datos necesarios
    if (!fullName) {
      return NextResponse.json(
        { error: "No se pudo obtener el nombre del empleado" },
        { status: 404 }
      );
    }

    // Formatear fechas
    const formattedContractStartDate = formatDateToSpanish(contractStartDate);
    const applicationDate = formatDateToSpanish(new Date());
    
    // Formatear períodos de vacaciones
    const periodsText = formatPeriods(allPeriods);
    
    // Usar la plantilla FT-RH-08
    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "personnel-management",
      "FT-RH-08.docx"
    );
  
    // Verificar si la plantilla existe
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: "Plantilla FT-RH-08.docx no encontrada" },
        { status: 404 }
      );
    }

    const template = fs.readFileSync(templatePath);

    // Generar el documento Word con los datos
    const report = await createReport({
      template,
      data: {
        NOMBRE_COMPLETO: fullName.toUpperCase(),
        FECHA_DE_INGRESO: formattedContractStartDate,
        PUESTO_DEL_EMPLEADO: position.toUpperCase() || "NO ESPECIFICADO",
        FECHA_GENERACION: applicationDate,
        AÑOS: yearsOfSeniority.toString(),
        DIAS_VACACIONES: dias(daysOfVacations), // Días totales que le corresponden
        DIAS_USADOS: dias(totalUsedDays),
        DIAS_RESTANTES: dias(remainingDays),
        PERIODOS: periodsText,
      },
      cmdDelimiter: ["[[", "]]"],
    });

    const fileBuffer = Buffer.from(report);

    // Nombre del archivo con tipo de empleado e ID
    const fileName = `FT-RH-08-BASE-${empleadoId}${vacationId ? `-${vacationId}` : ''}.docx`;

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Error al generar FT-RH-08:", error);
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
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";
import ConvertAPI from "convertapi";
import { getConnection } from "@/lib/db";
import { createReport } from "docx-templates";

const convertapi = new ConvertAPI(process.env.CONVERTAPI_SECRET!);

/* ================================
   FUNCIÓN SALARIO A LETRA (0–50000)
   INCLUYE DECIMALES (MÁXIMO 2)
================================== */
function salarioIMSSALetras(num: number): string {
  if (num < 0 || num > 50000) {
    throw new Error("El salario debe estar entre 0 y 50,000");
  }

  // Separar parte entera y decimal
  const partes = num.toString().split('.');
  const parteEntera = parseInt(partes[0]);
  const parteDecimal = partes.length > 1 ? parseInt(partes[1].padEnd(2, '0').slice(0, 2)) : 0;

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
  };

  const decenas = [
    "", "", "VEINTE", "TREINTA", "CUARENTA",
    "CINCUENTA", "SESENTA", "SETENTA",
    "OCHENTA", "NOVENTA",
  ];

  const centenas = [
    "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS",
    "CUATROCIENTOS", "QUINIENTOS",
    "SEISCIENTOS", "SETECIENTOS",
    "OCHOCIENTOS", "NOVECIENTOS",
  ];

  function convertir(n: number): string {
    if (n < 10) return unidades[n];
    if (especiales[n]) return especiales[n];
    if (n < 20) return "DIECI" + unidades[n - 10];
    if (n < 30) return n === 20 ? "VEINTE" : "VEINTI" + unidades[n - 20];

    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      return u === 0 ? decenas[d] : `${decenas[d]} Y ${unidades[u]}`;
    }

    if (n === 100) return "CIEN";

    if (n < 1000) {
      const c = Math.floor(n / 100);
      const r = n % 100;
      return `${centenas[c]}${r ? " " + convertir(r) : ""}`;
    }

    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    const textoMiles = miles === 1 ? "MIL" : `${convertir(miles)} MIL`;

    return resto ? `${textoMiles} ${convertir(resto)}` : textoMiles;
  }

  // Convertir parte entera
  let textoEntero = parteEntera === 0 ? "CERO" : convertir(parteEntera);
  
  // Si no hay decimales o el decimal es 0
  if (parteDecimal === 0) {
    return `${textoEntero} PESOS CON 00/100 M.N.`;
  }

  // Convertir parte decimal
  let textoDecimal = "";
  
  if (parteDecimal < 10) {
    textoDecimal = unidades[parteDecimal];
  } else if (especiales[parteDecimal]) {
    textoDecimal = especiales[parteDecimal];
  } else if (parteDecimal < 20) {
    textoDecimal = "DIECI" + unidades[parteDecimal - 10];
  } else if (parteDecimal < 100) {
    const d = Math.floor(parteDecimal / 10);
    const u = parteDecimal % 10;
    if (u === 0) {
      textoDecimal = decenas[d];
    } else if (d === 2) {
      textoDecimal = "VEINTI" + unidades[u];
    } else {
      textoDecimal = `${decenas[d]} Y ${unidades[u]}`;
    }
  }

  return `${textoEntero} PESOS CON ${textoDecimal} CENTAVOS`;
}

/* ================================
   FUNCIÓN PARA FORMATEAR FECHAS
================================== */
function formatFecha(fecha: string): string {
  if (!fecha) return "";
  try {
    const d = new Date(fecha);
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
    `FT-RH-02-${Date.now()}-${empleadoId}.docx`
  );
  const tempPdfPath = path.join(
    os.tmpdir(),
    `FT-RH-02-${Date.now()}-${empleadoId}.pdf`
  );

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
    let letterFileURL = "";
    let employeeData: any = {};

    // Obtener información según el tipo de empleado
    if (employee.EmployeeType === "PROJECT") {
      // Personal de Proyecto
      const [rows] = await connection.query<any[]>(
        `
        SELECT 
          pp.FirstName,
          pp.LastName,
          pp.MiddleName,
          pi.Municipality,
          pi.Nationality,
          pi.Gender,
          pi.Birthdate,
          pi.MaritalStatus,
          pi.RFC,
          pi.NSS,
          pi.CURP,
          pi.Address,
          pc.EndDate,
          pc.SalaryIMSS,
          pc.Position,
          DATE_FORMAT(pc.StartDate, '%Y-%m-%d') AS StartDate,
          pr.NameProject,
          pr.ProjectAddress,
          pb.BeneficiaryFirstName,
          pb.BeneficiaryLastName,
          pb.BeneficiaryMiddleName,
          pb.Relationship,
          pb.Percentage,
          pc.LetterFileURL
        FROM projectpersonnel pp
        LEFT JOIN projectpersonnelpersonalinfo pi 
          ON pi.ProjectPersonnelID = pp.ProjectPersonnelID
        LEFT JOIN projectpersonnelbeneficiaries pb 
          ON pb.ProjectPersonnelID = pp.ProjectPersonnelID
        LEFT JOIN projectcontracts pc 
          ON pc.ProjectPersonnelID = pp.ProjectPersonnelID
        LEFT JOIN projects pr 
          ON pr.ProjectID = pc.ProjectID
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

      employeeData = rows[0];
      letterFileURL = employeeData.LetterFileURL || "";
    } else {
      // Personal Base
      const [rows] = await connection.query<any[]>(
        `
        SELECT 
          bp.FirstName,
          bp.LastName,
          bp.MiddleName,
          bpi.Municipality,
          bpi.Nationality,
          bpi.Gender,
          bpi.Birthdate,
          bpi.MaritalStatus,
          bpi.RFC,
          bpi.NSS,
          bpi.CURP,
          bpi.Address,
          bc.EndDate,
          bc.SalaryIMSS,
          bp.Position,
          DATE_FORMAT(bc.StartDate, '%Y-%m-%d') AS StartDate,
          bb.BeneficiaryFirstName,
          bb.BeneficiaryLastName,
          bb.BeneficiaryMiddleName,
          bb.Relationship,
          bb.Percentage,
          bc.LetterFileURL
        FROM basepersonnel bp
        LEFT JOIN basepersonnelpersonalinfo bpi 
          ON bpi.BasePersonnelID = bp.BasePersonnelID
        LEFT JOIN basepersonnelbeneficiaries bb 
          ON bb.BasePersonnelID = bp.BasePersonnelID
        LEFT JOIN basecontracts bc 
          ON bc.BasePersonnelID = bp.BasePersonnelID
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

      employeeData = rows[0];
      letterFileURL = employeeData.LetterFileURL || "";
      
      // Agregar la dirección fija de SIGERSA para personal base
      employeeData.CompanyName = "SIGERSA INNOVACIONES S.A DE C.V.";
      employeeData.CompanyAddress = "AV. EL SAUZ 7, EL DEPOSITO, 42795 TLAHUELILPAN, HGO.";
    }

    // Procesar los datos del empleado
    const nombreCompleto = `${employeeData.FirstName || ""} ${employeeData.LastName || ""} ${employeeData.MiddleName || ""}`.trim();
    const nombreCompletoB = `${employeeData.BeneficiaryFirstName || ""} ${employeeData.BeneficiaryLastName || ""} ${employeeData.BeneficiaryMiddleName || ""}`.trim();

    // Calcular salario a letra con decimales
    const salarioNumero = Number(employeeData.SalaryIMSS) || 0;
    let SALARIO_IMSS_LETRA = "";
    try {
      SALARIO_IMSS_LETRA = salarioIMSSALetras(salarioNumero);
    } catch (error) {
      console.warn("Error al convertir salario a letra:", error);
      SALARIO_IMSS_LETRA = `${salarioNumero.toFixed(2)} (${salarioNumero.toString()})`;
    }

    // Si ya tenemos un PDF guardado, retornarlo
    if (letterFileURL) {
      try {
        const pdfResponse = await fetch(letterFileURL);

        if (pdfResponse.ok) {
          const pdfBuffer = await pdfResponse.arrayBuffer();

          // Nombre del archivo según tipo de empleado
          const fileName =
            employee.EmployeeType === "PROJECT"
              ? `FT-RH-02-PROYECTO-${empleadoId}.pdf`
              : `FT-RH-02-BASE-${empleadoId}.pdf`;

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

    // Usar la plantilla FT-RH-02
    const templatePath = path.join(
      process.cwd(),
      "public",
      "hiring",
      "FT-RH-02.docx"
    );

    // Verificar si la plantilla existe
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: "Plantilla FT-RH-02.docx no encontrada" },
        { status: 404 }
      );
    }

    const template = fs.readFileSync(templatePath);

    // Generar el documento Word con los datos
    const report = await createReport({
      template,
      data: {
        NOMBRE_COMPLETO: nombreCompleto,
        FECHA_DE_INGRESO: formatFecha(employeeData.StartDate),
        FECHA_DE_NACIMIENTO_DEL_EMPLEADO: formatFecha(employeeData.Birthdate),
        FECHA_TERMINO: formatFecha(employeeData.EndDate),
        PUESTO_DEL_EMPLEADO: employeeData.Position || "",
        MUNICIPIO_DEL_EMPLEADO: employeeData.Municipality || "",
        NACIONALIDAD_DEL_EMPLEADO: employeeData.Nationality || "",
        GENERO_DEL_EMPLEADO: employeeData.Gender || "",
        ESTADO_CIVIL_DEL_EMPLEADO: employeeData.MaritalStatus || "",
        RFC_DEL_EMPLEADO: employeeData.RFC || "",
        NSS_DEL_EMPLEADO: employeeData.NSS || "",
        CURP_DEL_EMPLEADO: employeeData.CURP || "",
        DIRECCION_DEL_EMPLEADO: employeeData.Address || "",
        NOMBRE_DEL_PROYECTO: employeeData.NameProject || employeeData.CompanyName || "",
        DIRECCION_DEL_PROYECTO: employeeData.ProjectAddress || employeeData.CompanyAddress || "",
        SALARIO_IMSS_DEL_EMPLEADO: salarioNumero.toFixed(2),
        SALARIO_IMSS_LETRA: SALARIO_IMSS_LETRA,
        NOMBRE_COMPLETO_B: nombreCompletoB || "NO ESPECIFICADO",
        PARENTESCO_B: employeeData.Relationship || "NO ESPECIFICADO",
        PORCENTAGE_B: employeeData.Percentage || "0",
        FECHA_GENERACION: new Date().toLocaleDateString("es-MX"),
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
        ? `FT-RH-02-PROYECTO-${empleadoId}.pdf`
        : `FT-RH-02-BASE-${empleadoId}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": isPreview
          ? `inline; filename="${fileName}"`
          : `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: error.message || "Error al generar PDF" },
      { status: 500 }
    );
  } finally {
    connection?.release?.();
    // Limpiar archivos temporales
    if (fs.existsSync(tempWordPath)) {
      fs.unlinkSync(tempWordPath);
    }
    if (fs.existsSync(tempPdfPath)) {
      fs.unlinkSync(tempPdfPath);
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
      `${request.nextUrl.origin}/api/download/pdf/FT-RH-02?empleadoId=${empleadoId}`
    );

    if (!pdfResponse.ok) {
      const error = await pdfResponse.json();
      return NextResponse.json(
        { error: error.error || "Error al generar el PDF" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "PDF generado exitosamente",
      fileName: `FT-RH-02-${empleadoId}.pdf`,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: error.message || "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import path from "path";
import { getConnection } from "@/lib/db";

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

    // Obtener información del empleado y su último préstamo
    const [employeeInfo] = await connection.execute<any[]>(
      `SELECT 
        e.EmployeeType,
        el.Amount,
        el.ApplicationDate,
        el.NumberOfPayments,
        el.DiscountAmount,
        el.FirstDiscountDate,
        el.Observations
       FROM employees e
       LEFT JOIN employeeloans el ON e.EmployeeID = el.EmployeeID
       WHERE e.EmployeeID = ?
       ORDER BY el.LoanID DESC
       LIMIT 1`,
      [empleadoId]
    );

    if (!employeeInfo.length) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }

    const employee = employeeInfo[0];
    let fullName = "";
    let tipo = "";
    let area = "";
    let amount = employee.Amount || 0;
    let applicationDate = employee.ApplicationDate || "";
    let numberOfPayments = employee.NumberOfPayments || 0;
    let discountAmount = employee.DiscountAmount || 0;
    let firstDiscountDate = employee.FirstDiscountDate || "";
    let observations = employee.Observations || "";
    let position = "";
    let jefeDirectoNombre = "NO ESPECIFICADO";

    // Obtener nombre completo y área según el tipo de empleado
    if (employee.EmployeeType === 'PROJECT') {
      // Personal de Proyecto - Incluir jefe directo (puede ser BASE o PROJECT)
      const [rows] = await connection.execute<any[]>(
        `SELECT 
          pp.FirstName,
          pp.LastName,
          pp.MiddleName,
          pp.ProjectPersonnelID,
          pc.Position,
          p.NameProject,
          'PROJECT' as tipo,
          -- Intentar obtener nombre del jefe desde basepersonnel primero
          CONCAT(bp_jefe.FirstName, ' ', bp_jefe.LastName, ' ', IFNULL(bp_jefe.MiddleName, '')) as JefeDirectoNombreBase,
          -- Si no, obtener desde projectpersonnel
          CONCAT(pp_jefe.FirstName, ' ', pp_jefe.LastName, ' ', IFNULL(pp_jefe.MiddleName, '')) as JefeDirectoNombreProject
        FROM projectpersonnel pp
        LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
        LEFT JOIN projects p ON pc.ProjectID = p.ProjectID
        LEFT JOIN employees je ON pc.jefeDirectoId = je.EmployeeID
        -- LEFT JOIN para jefe BASE
        LEFT JOIN basepersonnel bp_jefe ON je.EmployeeID = bp_jefe.EmployeeID AND je.EmployeeType = 'BASE'
        -- LEFT JOIN para jefe PROJECT
        LEFT JOIN projectpersonnel pp_jefe ON je.EmployeeID = pp_jefe.EmployeeID AND je.EmployeeType = 'PROJECT'
        WHERE pp.EmployeeID = ?
        ORDER BY pc.ContractID DESC
        LIMIT 1`,
        [empleadoId]
      );

      if (!rows.length) {
        return NextResponse.json({ error: "Información de proyecto no encontrada" }, { status: 404 });
      }

      const r = rows[0];
      fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
      tipo = "PROYECTO";
      area = r.NameProject || "PROYECTO NO ESPECIFICADO";
      position = r.Position || "NO ESPECIFICADO";
      
      // Determinar el nombre del jefe (priorizar BASE, luego PROJECT)
      jefeDirectoNombre = r.JefeDirectoNombreBase || r.JefeDirectoNombreProject || "NO ESPECIFICADO";
      
    } else {
      // Personal Base - Incluir jefe directo (puede ser BASE o PROJECT)
      const [rows] = await connection.execute<any[]>(
        `SELECT 
          bp.FirstName,
          bp.LastName,
          bp.MiddleName,
          bp.BasePersonnelID,
          bp.Position,
          bp.Area,
          'BASE' as tipo,
          -- Intentar obtener nombre del jefe desde basepersonnel primero
          CONCAT(bp_jefe.FirstName, ' ', bp_jefe.LastName, ' ', IFNULL(bp_jefe.MiddleName, '')) as JefeDirectoNombreBase,
          -- Si no, obtener desde projectpersonnel
          CONCAT(pp_jefe.FirstName, ' ', pp_jefe.LastName, ' ', IFNULL(pp_jefe.MiddleName, '')) as JefeDirectoNombreProject
        FROM basepersonnel bp
        LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID
        LEFT JOIN employees je ON bc.jefeDirectoId = je.EmployeeID
        -- LEFT JOIN para jefe BASE
        LEFT JOIN basepersonnel bp_jefe ON je.EmployeeID = bp_jefe.EmployeeID AND je.EmployeeType = 'BASE'
        -- LEFT JOIN para jefe PROJECT
        LEFT JOIN projectpersonnel pp_jefe ON je.EmployeeID = pp_jefe.EmployeeID AND je.EmployeeType = 'PROJECT'
        WHERE bp.EmployeeID = ?
        ORDER BY bc.ContractID DESC
        LIMIT 1`,
        [empleadoId]
      );

      if (!rows.length) {
        return NextResponse.json({ error: "Información de personal base no encontrada" }, { status: 404 });
      }

      const r = rows[0];
      fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
      tipo = "BASE";
      area = r.Area || "ÁREA NO ESPECIFICADA";
      position = r.Position || "NO ESPECIFICADO";
      
      // Determinar el nombre del jefe (priorizar BASE, luego PROJECT)
      jefeDirectoNombre = r.JefeDirectoNombreBase || r.JefeDirectoNombreProject || "NO ESPECIFICADO";
    }

    // Cargar plantilla Excel
    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "personnel-management",
      "FT-RH-21.xlsx"
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet(1)!;

    // Llenar datos en la plantilla
    // Nombre del empleado en celda G8
    ws.getCell("G8").value = fullName || "NO ESPECIFICADO";

    // ÁREA/PROYECTO del empleado en celda C14
    ws.getCell("B16").value = area || "NO ESPECIFICADO";

    // MONTO DEL PRÉSTAMO en celda C12 con formato "$300.00 (TRESCIENTOS)"
    if (amount > 0) {
      try {
        // Formatear el monto como moneda
        const montoFormateado = new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(amount);
        
        // Obtener el monto en letras
        const montoLetras = salarioIMSSALetras(amount);
        
        // Extraer solo la parte del texto sin "PESOS CON XX/100 M.N." o similar
        const partesLetras = montoLetras.split(' PESOS ');
        const letrasSimples = partesLetras[0];
        
        // Combinar el monto formateado con las letras entre paréntesis
        ws.getCell("B13").value = `${montoFormateado} (${letrasSimples})`;
      } catch (error) {
        console.error("Error al convertir el monto a letras:", error);
        // Fallback en caso de error
        ws.getCell("B13").value = new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN'
        }).format(amount);
      }
    } else {
      ws.getCell("B13").value = "NO ESPECIFICADO";
    }

    ws.getCell("J5").value = applicationDate ? new Date(applicationDate).toLocaleDateString('es-MX') : "";
    ws.getCell("F27").value = numberOfPayments || "";
    ws.getCell("I27").value = discountAmount || "";
    ws.getCell("B28").value = firstDiscountDate ? new Date(firstDiscountDate).toLocaleDateString('es-MX') : "";
    
    // **CORRECCIÓN IMPORTANTE**: Usar observations en lugar de fullName
    ws.getCell("B38").value = observations || "SIN OBSERVACIONES";
    
    ws.getCell("I16").value = position || "NO ESPECIFICADO";
    
    // **CORRECCIÓN**: Asegurar que el nombre del jefe directo se asigna correctamente
    ws.getCell("B45").value = jefeDirectoNombre || "NO ESPECIFICADO";
    
    ws.getCell("E49").value = fullName || "NO ESPECIFICADO";
    
    const buffer = await workbook.xlsx.writeBuffer();

    const fileName = employee.EmployeeType === 'PROJECT' 
      ? `FT-RH-21-PROYECTO-${empleadoId}.xlsx`
      : `FT-RH-21-BASE-${empleadoId}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Error al generar FT-RH-21:", error);
    return NextResponse.json({ 
      error: error.sqlMessage || error.message || "Error al generar el documento" 
    }, { status: 500 });
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (error) {
        console.error('Error al cerrar la conexión:', error);
      }
    }
  }
}
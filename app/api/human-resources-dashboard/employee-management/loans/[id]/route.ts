// app/api/administrative-personnel-dashboard/employee-management/loans/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import { UTApi } from 'uploadthing/server';
import os from "os";
import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";
import ConvertAPI from "convertapi";

const convertapi = new ConvertAPI(process.env.CONVERTAPI_SECRET!);
const utapi = new UTApi();

/* ================================
   FUNCIÓN SALARIO A LETRA (0–50000)
================================== */

function salarioIMSSALetras(num: number): string {
  if (num < 0 || num > 50000) {
    throw new Error("El salario debe estar entre 0 y 50,000");
  }

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

  let textoEntero = parteEntera === 0 ? "CERO" : convertir(parteEntera);
  
  if (parteDecimal === 0) {
    return `${textoEntero} PESOS CON 00/100 M.N.`;
  }

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

// Función para formatear fecha correctamente para MySQL (YYYY-MM-DD)
const formatearFechaMySQL = (fecha: string): string | null => {
  if (!fecha) return null;
  
  try {
    if (fecha.includes('T')) {
      return fecha.split('T')[0];
    }
    return fecha;
  } catch {
    return null;
  }
};

// Función para extraer el fileKey de una URL de UploadThing
function extractFileKeyFromUrl(url: string): string | null {
  try {
    const matches = url.match(/\/f\/([a-zA-Z0-9-_]+)/);
    return matches ? matches[1] : null;
  } catch {
    return null;
  }
};

// Función para eliminar archivo de UploadThing
async function deleteFileFromUploadThing(fileUrl: string): Promise<void> {
  try {
    const fileKey = extractFileKeyFromUrl(fileUrl);
    if (!fileKey) {
      console.warn('No se pudo extraer el fileKey de la URL:', fileUrl);
      return;
    }
    
    await utapi.deleteFiles([fileKey]);
    console.log(`Archivo eliminado de UploadThing: ${fileKey}`);
  } catch (error) {
    console.error('Error al eliminar archivo de UploadThing:', error);
  }
}

// Función para generar el PDF FT-RH-21 actualizado
async function generateUpdatedFT_RH_21_PDF(
  empleadoId: number, 
  tipo: 'BASE' | 'PROJECT',
  loanData: {
    Amount: number;
    ApplicationDate: string;
    NumberOfPayments: number;
    DiscountAmount: number;
    FirstDiscountDate: string;
    Observations: string;
  }
): Promise<ArrayBuffer> {
  const tempExcelPath = path.join(
    os.tmpdir(),
    `FT-RH-21-EDIT-${Date.now()}-${empleadoId}.xlsx`
  );

  let connection;

  try {
    connection = await getConnection();

    let fullName = "";
    let area = "";
    let position = "";
    let jefeDirectoNombre = "NO ESPECIFICADO";

    if (tipo === 'PROJECT') {
      const [rows] = await connection.execute<any[]>(
        `SELECT
          pp.FirstName,
          pp.LastName,
          pp.MiddleName,
          pc.Position,
          p.NameProject,
          p.AdminProjectID,
          CONCAT(bp.FirstName, ' ', bp.LastName, ' ', IFNULL(bp.MiddleName, '')) as JefeDirecto
        FROM projectpersonnel pp
        LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
        LEFT JOIN projects p ON pc.ProjectID = p.ProjectID
        LEFT JOIN employees e ON p.AdminProjectID = e.EmployeeID 
        LEFT JOIN basepersonnel bp ON e.EmployeeID = bp.EmployeeID
        WHERE pp.EmployeeID = ? AND e.Status = 1 AND pc.Status = 1`,
        [empleadoId]
      );

      if (rows.length > 0) {
        const r = rows[0];
        fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
        area = r.NameProject || "PROYECTO NO ESPECIFICADO";
        position = r.Position || "NO ESPECIFICADO";
        jefeDirectoNombre = r.JefeDirecto || "NO ESPECIFICADO";
      }
    } else {
      const [rows] = await connection.execute<any[]>(
        `SELECT 
          bp.FirstName,
          bp.LastName,
          bp.MiddleName,
          bp.Position,
          bp.Area,
          CONCAT(bp_jefe.FirstName, ' ', bp_jefe.LastName, ' ', IFNULL(bp_jefe.MiddleName, '')) as JefeDirecto
        FROM basepersonnel bp
        LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID
        LEFT JOIN employees je ON bc.jefeDirectoId = je.EmployeeID
        LEFT JOIN basepersonnel bp_jefe ON je.EmployeeID = bp_jefe.EmployeeID AND je.EmployeeType = 'BASE'
        WHERE bp.EmployeeID = ?`,
        [empleadoId]
      );

      if (rows.length > 0) {
        const r = rows[0];
        fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
        area = r.Area || "ÁREA NO ESPECIFICADA";
        position = r.Position || "NO ESPECIFICADO";
        jefeDirectoNombre = r.JefeDirecto || "NO ESPECIFICADO";
      }
    }

    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "personnel-management",
      "FT-RH-21.xlsx"
    );

    if (!fs.existsSync(templatePath)) {
      throw new Error('Plantilla FT-RH-21 no encontrada');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet(1)!;

    // Llenar datos en la plantilla - CELDAS CORRECTAS
    ws.getCell("G8").value = fullName || "NO ESPECIFICADO";
    ws.getCell("C16").value = area || "NO ESPECIFICADO";

    if (loanData.Amount > 0) {
      try {
        const montoFormateado = new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN',
          minimumFractionDigits: 2
        }).format(loanData.Amount);
        
        const montoLetras = salarioIMSSALetras(loanData.Amount);
        const partesLetras = montoLetras.split(' PESOS ');
        const letrasSimples = partesLetras[0];
        
        ws.getCell("B13").value = `${montoFormateado} (${letrasSimples})`;
      } catch {
        ws.getCell("B13").value = new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN'
        }).format(loanData.Amount);
      }
    }

    ws.getCell("J5").value = loanData.ApplicationDate ? new Date(loanData.ApplicationDate).toLocaleDateString('es-MX') : "";
    ws.getCell("F27").value = loanData.NumberOfPayments || "";
    ws.getCell("I27").value = loanData.DiscountAmount || "";
    ws.getCell("B28").value = loanData.FirstDiscountDate ? new Date(loanData.FirstDiscountDate).toLocaleDateString('es-MX') : "";
    ws.getCell("C38").value = loanData.Observations || "SIN OBSERVACIONES";
    ws.getCell("I16").value = position || "NO ESPECIFICADO";
    ws.getCell("B45").value = jefeDirectoNombre || "NO ESPECIFICADO";
    ws.getCell("E49").value = fullName || "NO ESPECIFICADO";

    await workbook.xlsx.writeFile(tempExcelPath);

    const result = await convertapi.convert("pdf", {
      File: tempExcelPath,
    });

    const pdfResponse = await fetch(result.file.url);
    const pdfBuffer = await pdfResponse.arrayBuffer();
    
    return pdfBuffer;

  } catch (error) {
    console.error('Error al generar PDF actualizado:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (error) {
        console.error('Error al cerrar la conexión:', error);
      }
    }
    try {
      if (fs.existsSync(tempExcelPath)) {
        fs.unlinkSync(tempExcelPath);
      }
    } catch (cleanupError) {
      console.warn("Error al limpiar archivos temporales:", cleanupError);
    }
  }
}

// PUT: Actualizar préstamo existente
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let connection;
  
  try {
    const { id } = await params;
    
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

    if (user.UserTypeID !== 2) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const loanId = id;
    const body = await request.json();
    const { 
      EmployeeID,
      ApplicationDate, 
      Amount, 
      NumberOfPayments, 
      DiscountAmount, 
      FirstDiscountDate, 
      Observations 
    } = body;

    if (!EmployeeID) {
      return NextResponse.json(
        { success: false, message: 'El ID del empleado es requerido' },
        { status: 400 }
      );
    }

    if (!ApplicationDate) {
      return NextResponse.json(
        { success: false, message: 'La fecha de solicitud es requerida' },
        { status: 400 }
      );
    }

    if (!Amount || Amount <= 0) {
      return NextResponse.json(
        { success: false, message: 'El monto debe ser mayor a 0' },
        { status: 400 }
      );
    }

    if (!NumberOfPayments || NumberOfPayments <= 0) {
      return NextResponse.json(
        { success: false, message: 'El número de pagos debe ser mayor a 0' },
        { status: 400 }
      );
    }

    if (!DiscountAmount || DiscountAmount <= 0) {
      return NextResponse.json(
        { success: false, message: 'El monto de descuento debe ser mayor a 0' },
        { status: 400 }
      );
    }

    if (!FirstDiscountDate) {
      return NextResponse.json(
        { success: false, message: 'La fecha del primer descuento es requerida' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    await connection.beginTransaction();

    try {
      const [loanCheck] = await connection.execute<any[]>(
        'SELECT LoanID, EmployeeID, FileURL FROM employeeloans WHERE LoanID = ?',
        [loanId]
      );

      if ((loanCheck as any[]).length === 0) {
        throw new Error('El préstamo no existe');
      }

      const currentLoan = loanCheck[0];
      const oldFileUrl = currentLoan.FileURL;

      const [baseCheck] = await connection.execute(
        'SELECT EmployeeID FROM basepersonnel WHERE EmployeeID = ?',
        [EmployeeID]
      );

      const [projectCheck] = await connection.execute(
        'SELECT EmployeeID FROM projectpersonnel WHERE EmployeeID = ?',
        [EmployeeID]
      );

      if ((baseCheck as any[]).length === 0 && (projectCheck as any[]).length === 0) {
        throw new Error('El empleado no existe');
      }

      let tipo: 'BASE' | 'PROJECT' = 'BASE';
      if ((projectCheck as any[]).length > 0) {
        tipo = 'PROJECT';
      }

      const applicationDateFormatted = formatearFechaMySQL(ApplicationDate);
      const firstDiscountDateFormatted = formatearFechaMySQL(FirstDiscountDate);

      let newFileUrl: string | null = null;
      
      try {
        const pdfBuffer = await generateUpdatedFT_RH_21_PDF(
          EmployeeID,
          tipo,
          {
            Amount,
            ApplicationDate,
            NumberOfPayments,
            DiscountAmount,
            FirstDiscountDate,
            Observations: Observations || ''
          }
        );

        const fileName = `FT-RH-21-${tipo}-${EmployeeID}-${Date.now()}.pdf`;
        const file = new File([Buffer.from(pdfBuffer)], fileName, { type: 'application/pdf' });
        
        const uploadResponse = await utapi.uploadFiles([file]);
        
        if (uploadResponse && uploadResponse[0] && uploadResponse[0].data && uploadResponse[0].data.url) {
          newFileUrl = uploadResponse[0].data.url;
          
          if (oldFileUrl) {
            await deleteFileFromUploadThing(oldFileUrl);
          }
        } else {
          console.error('Error al subir el PDF');
          newFileUrl = oldFileUrl;
        }
      } catch (pdfError) {
        console.error('Error al generar/subir PDF:', pdfError);
        newFileUrl = oldFileUrl;
      }

      await connection.execute(
        `UPDATE employeeloans 
         SET EmployeeID = ?, ApplicationDate = ?, Amount = ?, 
             NumberOfPayments = ?, DiscountAmount = ?, 
             FirstDiscountDate = ?, Observations = ?, FileURL = ?
         WHERE LoanID = ?`,
        [
          EmployeeID,
          applicationDateFormatted,
          Amount,
          NumberOfPayments,
          DiscountAmount,
          firstDiscountDateFormatted,
          Observations || null,
          newFileUrl,
          loanId
        ]
      );

      await connection.commit();

      return NextResponse.json({
        success: true,
        message: 'Préstamo actualizado exitosamente',
        fileUrl: newFileUrl
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al actualizar préstamo:', error);
    
    let errorMessage = 'ERROR AL ACTUALIZAR EL PRÉSTAMO';
    
    if (error instanceof Error) {
      if (error.message.includes('foreign key constraint')) {
        errorMessage = 'ERROR: El empleado seleccionado no existe';
      } else if (error.message.includes('date value')) {
        errorMessage = 'ERROR: Formato de fecha incorrecto';
      } else if (error.message.includes('Data too long')) {
        errorMessage = 'ERROR: Las observaciones son demasiado largas (máximo 500 caracteres)';
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      },
      { status: 500 }
    );
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

// DELETE: Eliminar préstamo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let connection;
  
  try {
    const { id } = await params;
    
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

    if (user.UserTypeID !== 2) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const loanId = id;

    connection = await getConnection();
    await connection.beginTransaction();

    try {
      const [loanCheck] = await connection.execute<any[]>(
        'SELECT LoanID, FileURL FROM employeeloans WHERE LoanID = ?',
        [loanId]
      );

      if ((loanCheck as any[]).length === 0) {
        throw new Error('El préstamo no existe');
      }

      const fileUrl = loanCheck[0].FileURL;

      if (fileUrl) {
        await deleteFileFromUploadThing(fileUrl);
      }

      await connection.execute(
        'DELETE FROM employeeloans WHERE LoanID = ?',
        [loanId]
      );

      await connection.commit();

      return NextResponse.json({
        success: true,
        message: 'Préstamo eliminado exitosamente'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al eliminar préstamo:', error);
    
    let errorMessage = 'ERROR AL ELIMINAR EL PRÉSTAMO';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      },
      { status: 500 }
    );
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
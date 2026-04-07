// app/api/administrative-personnel-dashboard/employee-management/loans/route.ts

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

// Función para subir archivo a UploadThing
async function uploadFileToUploadThing(fileBuffer: ArrayBuffer, fileName: string, fileType: string): Promise<string> {
  try {
    const blob = new Blob([fileBuffer], { type: fileType });
    const file = new File([blob], fileName, { type: fileType });
    
    const uploadResponse = await utapi.uploadFiles([file]);
    
    if (!uploadResponse || !uploadResponse[0]) {
      throw new Error('No se recibió respuesta de UploadThing');
    }
    
    const uploadedFile = uploadResponse[0];
    
    if (uploadedFile.error) {
      throw new Error(uploadedFile.error.message || 'Error al subir el archivo');
    }
    
    let fileUrl: string | undefined;
    
    if ('ufsUrl' in uploadedFile) {
      fileUrl = (uploadedFile as any).ufsUrl;
    } else if (uploadedFile.data?.url) {
      fileUrl = uploadedFile.data.url;
    } else if ('serverData' in uploadedFile) {
      fileUrl = (uploadedFile as any).serverData?.url;
    }
    
    if (!fileUrl) {
      throw new Error('No se pudo obtener la URL del archivo subido');
    }
    
    return fileUrl;
    
  } catch (error) {
    console.error('Error al subir archivo a UploadThing:', error);
    throw new Error('Error al subir el documento PDF');
  }
}

// GET: Obtener todos los préstamos
export async function GET(request: NextRequest) {
  let connection;
  
  try {
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

    connection = await getConnection();

    const [rows] = await connection.execute(`
      SELECT 
        el.LoanID,
        el.EmployeeID,
        el.ApplicationDate,
        el.Amount,
        el.NumberOfPayments,
        el.DiscountAmount,
        el.FirstDiscountDate,
        el.Observations,
        el.FileURL,
        e.Status,
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          ELSE 'PROJECT'
        END as tipo
      FROM employeeloans el
      INNER JOIN employees e ON e.EmployeeID = el.EmployeeID
      LEFT JOIN basepersonnel bp ON el.EmployeeID = bp.EmployeeID
      LEFT JOIN projectpersonnel pp ON el.EmployeeID = pp.EmployeeID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      WHERE e.Status = 1
      ORDER BY el.ApplicationDate DESC, el.LoanID DESC
    `);

    const loans = rows as any[];

    return NextResponse.json({
      success: true,
      loans
    });

  } catch (error) {
    console.error('Error al obtener préstamos:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL OBTENER PRÉSTAMOS',
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

// POST: Crear nuevo préstamo
export async function POST(request: NextRequest) {
  let connection;
  const tempExcelPath = path.join(
    os.tmpdir(),
    `FT-RH-21-${Date.now()}.xlsx`
  );
  const tempPdfPath = path.join(
    os.tmpdir(),
    `FT-RH-21-${Date.now()}.pdf`
  );
  
  try {
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

    // Validaciones
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
      // Verificar que el empleado existe
      const [baseCheck] = await connection.execute(
        'SELECT EmployeeID, FirstName, LastName, MiddleName FROM basepersonnel WHERE EmployeeID = ?',
        [EmployeeID]
      );

      const [projectCheck] = await connection.execute(
        'SELECT EmployeeID, FirstName, LastName, MiddleName FROM projectpersonnel WHERE EmployeeID = ?',
        [EmployeeID]
      );

      let employeeData: any = null;
      let tipo: 'BASE' | 'PROJECT' = 'BASE';

      if ((baseCheck as any[]).length > 0) {
        employeeData = (baseCheck as any[])[0];
        tipo = 'BASE';
      } else if ((projectCheck as any[]).length > 0) {
        employeeData = (projectCheck as any[])[0];
        tipo = 'PROJECT';
      } else {
        throw new Error('El empleado no existe');
      }

      // Formatear fechas
      const applicationDateFormatted = formatearFechaMySQL(ApplicationDate);
      const firstDiscountDateFormatted = formatearFechaMySQL(FirstDiscountDate);

      // Insertar préstamo (sin FileURL por ahora)
      const [result] = await connection.execute(
        `INSERT INTO employeeloans 
         (EmployeeID, ApplicationDate, Amount, NumberOfPayments, DiscountAmount, FirstDiscountDate, Observations, FileURL) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          EmployeeID,
          applicationDateFormatted,
          Amount,
          NumberOfPayments,
          DiscountAmount,
          firstDiscountDateFormatted,
          Observations || null,
          null
        ]
      );

      const loanId = (result as any).insertId;

      // **GENERAR PDF FT-RH-21 Y SUBIRLO A UPLOADTHING**
      try {
        // Generar el PDF usando la plantilla
        const templatePath = path.join(
          process.cwd(),
          "public",
          "administrative-personnel-dashboard",
          "personnel-management",
          "FT-RH-21.xlsx"
        );

        if (fs.existsSync(templatePath)) {
          // Obtener información adicional del empleado para el PDF
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
                -- Intentar obtener nombre del jefe
                CONCAT(bp_jefe.FirstName, ' ', bp_jefe.LastName, ' ', IFNULL(bp_jefe.MiddleName, '')) as JefeDirectoNombreBase,
                CONCAT(pp_jefe.FirstName, ' ', pp_jefe.LastName, ' ', IFNULL(pp_jefe.MiddleName, '')) as JefeDirectoNombreProject
              FROM projectpersonnel pp
              LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
              LEFT JOIN projects p ON pc.ProjectID = p.ProjectID
              LEFT JOIN employees je ON pc.jefeDirectoId = je.EmployeeID
              LEFT JOIN basepersonnel bp_jefe ON je.EmployeeID = bp_jefe.EmployeeID AND je.EmployeeType = 'BASE'
              LEFT JOIN projectpersonnel pp_jefe ON je.EmployeeID = pp_jefe.EmployeeID AND je.EmployeeType = 'PROJECT'
              WHERE pp.EmployeeID = ?
              ORDER BY pc.ContractID DESC
              LIMIT 1`,
              [EmployeeID]
            );

            if (rows.length > 0) {
              const r = rows[0];
              fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
              area = r.NameProject || "PROYECTO NO ESPECIFICADO";
              position = r.Position || "NO ESPECIFICADO";
              jefeDirectoNombre = r.JefeDirectoNombreBase || r.JefeDirectoNombreProject || "NO ESPECIFICADO";
            }
          } else {
            const [rows] = await connection.execute<any[]>(
              `SELECT 
                bp.FirstName,
                bp.LastName,
                bp.MiddleName,
                bp.Position,
                bp.Area,
                -- Intentar obtener nombre del jefe
                CONCAT(bp_jefe.FirstName, ' ', bp_jefe.LastName, ' ', IFNULL(bp_jefe.MiddleName, '')) as JefeDirectoNombreBase,
                CONCAT(pp_jefe.FirstName, ' ', pp_jefe.LastName, ' ', IFNULL(pp_jefe.MiddleName, '')) as JefeDirectoNombreProject
              FROM basepersonnel bp
              LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID
              LEFT JOIN employees je ON bc.jefeDirectoId = je.EmployeeID
              LEFT JOIN basepersonnel bp_jefe ON je.EmployeeID = bp_jefe.EmployeeID AND je.EmployeeType = 'BASE'
              LEFT JOIN projectpersonnel pp_jefe ON je.EmployeeID = pp_jefe.EmployeeID AND je.EmployeeType = 'PROJECT'
              WHERE bp.EmployeeID = ?
              ORDER BY bc.ContractID DESC
              LIMIT 1`,
              [EmployeeID]
            );

            if (rows.length > 0) {
              const r = rows[0];
              fullName = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
              area = r.Area || "ÁREA NO ESPECIFICADA";
              position = r.Position || "NO ESPECIFICADO";
              jefeDirectoNombre = r.JefeDirectoNombreBase || r.JefeDirectoNombreProject || "NO ESPECIFICADO";
            }
          }

          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.readFile(templatePath);
          const ws = workbook.getWorksheet(1)!;

          ws.getCell("G8").value = fullName || "NO ESPECIFICADO";
          ws.getCell("C16").value = area || "NO ESPECIFICADO";

          if (Amount > 0) {
            try {
              const montoFormateado = new Intl.NumberFormat('es-MX', {
                style: 'currency',
                currency: 'MXN',
                minimumFractionDigits: 2
              }).format(Amount);
              
              const montoLetras = salarioIMSSALetras(Amount);
              const partesLetras = montoLetras.split(' PESOS ');
              const letrasSimples = partesLetras[0];
              
              ws.getCell("B13").value = `${montoFormateado} (${letrasSimples})`;
            } catch {
              ws.getCell("B13").value = new Intl.NumberFormat('es-MX', {
                style: 'currency',
                currency: 'MXN'
              }).format(Amount);
            }
          }

          ws.getCell("J5").value = ApplicationDate ? new Date(ApplicationDate).toLocaleDateString('es-MX') : "";
          ws.getCell("F27").value = NumberOfPayments || "";
          ws.getCell("I27").value = DiscountAmount || "";
          ws.getCell("B28").value = FirstDiscountDate ? new Date(FirstDiscountDate).toLocaleDateString('es-MX') : "";
          
          // **CORREGIDO**: Usar Observations, NO fullName
          ws.getCell("C38").value = Observations || "SIN OBSERVACIONES";
          
          ws.getCell("I16").value = position || "NO ESPECIFICADO";
          
          // **NUEVO**: Agregar nombre del jefe directo
          ws.getCell("B45").value = jefeDirectoNombre || "NO ESPECIFICADO";
          
          ws.getCell("E49").value = fullName || "NO ESPECIFICADO";

          await workbook.xlsx.writeFile(tempExcelPath);

          // Convertir a PDF
          const result = await convertapi.convert("pdf", {
            File: tempExcelPath,
          });

          const pdfResponse = await fetch(result.file.url);
          const pdfBuffer = await pdfResponse.arrayBuffer();
          
          fs.writeFileSync(tempPdfPath, Buffer.from(pdfBuffer));

          // Subir a UploadThing
          const fileName = `FT-RH-21-${tipo}-${EmployeeID}-${Date.now()}.pdf`;
          const file = new File([Buffer.from(pdfBuffer)], fileName, { type: 'application/pdf' });
          
          const uploadResponse = await utapi.uploadFiles([file]);
          
          if (uploadResponse && uploadResponse[0] && uploadResponse[0].data && uploadResponse[0].data.url) {
            const fileUrl = uploadResponse[0].data.url;
            
            // Actualizar el campo FileURL en la base de datos
            await connection.execute(
              `UPDATE employeeloans SET FileURL = ? WHERE LoanID = ?`,
              [fileUrl, loanId]
            );
            
            console.log(`PDF subido a UploadThing: ${fileUrl}`);
            
            // Confirmar transacción
            await connection.commit();

            return NextResponse.json({
              success: true,
              message: 'Préstamo creado exitosamente',
              loanId: loanId,
              fileUrl: fileUrl
            });
          } else {
            throw new Error('Error al subir el PDF a UploadThing');
          }
        } else {
          throw new Error('Plantilla FT-RH-21 no encontrada');
        }
      } catch (pdfError) {
        console.error('Error al generar/subir PDF:', pdfError);
        // Si falla la generación del PDF, aún así guardar el préstamo sin FileURL
        await connection.commit();
        
        return NextResponse.json({
          success: true,
          message: 'Préstamo creado exitosamente (sin PDF)',
          loanId: loanId,
          fileUrl: null,
          warning: 'Error al generar el documento PDF'
        });
      }

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al crear préstamo:', error);
    
    let errorMessage = 'ERROR AL CREAR EL PRÉSTAMO';
    
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
    // Limpiar archivos temporales
    try {
      if (fs.existsSync(tempExcelPath)) {
        fs.unlinkSync(tempExcelPath);
      }
      if (fs.existsSync(tempPdfPath)) {
        fs.unlinkSync(tempPdfPath);
      }
    } catch (cleanupError) {
      console.warn("Error al limpiar archivos temporales:", cleanupError);
    }
  }
}
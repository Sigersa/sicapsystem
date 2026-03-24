// app/api/administrative-personnel-dashboard/employee-management/employeeimssinfonavit/route.ts
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

// Función para generar el PDF FT-RH-09
async function generatePermissionPDF(
  batchId: number
): Promise<{ pdfBuffer: ArrayBuffer; fileUrl: string }> {
  const tempExcelPath = path.join(
    os.tmpdir(),
    `FT-RH-05-${Date.now()}-${batchId}.xlsx`
  );
  const tempPdfPath = path.join(
    os.tmpdir(),
    `FT-RH-05-${Date.now()}-${batchId}.pdf`
  );

    let connection;

    try {
        connection = await getConnection();

        const [rows] = await connection.execute<any[]>(
      `SELECT 
        emb.BatchID,
        emb.MovementType,
        emb.DateMovement,
        emb.ReasonForWithdrawal,
        em.MovementID,
        em.BatchID,
        em.EmployeeID,
        em.ProjectContractID,
        bp.Area,
        pj.NameProject,
        pj.AdminProjectID,
        -- Datos del empleado
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        COALESCE(bc.SalaryIMSS, pc.SalaryIMSS) as SalaryIMSS,
        COALESCE(bpi.CURP, ppi.CURP) as CURP,
        COALESCE(bpi.NSS, ppi.NSS) as NSS,
        COALESCE(bpi.NCI, ppi.NCI) as NCI,
        COALESCE(bpi.UMF, ppi.UMF) as UMF,    
        COALESCE(admin_bp.FirstName) as AdminNombre,
        COALESCE(admin_bp.LastName) as AdminApellido,
        COALESCE(admin_bp.MiddleName) as AdminApellido2,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          ELSE 'PROYECTO'
        END as tipo
      FROM employee_movement_batches emb
      INNER JOIN employeeimssinfonavitmovements em ON em.BatchID = emb.BatchID 
      -- Datos del empleado (BASE)
      LEFT JOIN basepersonnel bp ON em.EmployeeID = bp.EmployeeID
      LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      -- Datos del empleado (PROJECT)
      LEFT JOIN projectpersonnel pp ON em.EmployeeID = pp.EmployeeID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      LEFT JOIN projects pj ON pc.ProjectID = pj.ProjectID
      LEFT JOIN employees e ON e.EmployeeID = pj.AdminProjectID
      LEFT JOIN basepersonnel admin_bp ON admin_bp.EmployeeID = e.EmployeeID
      WHERE em.BatchID = ?
      ORDER BY em.MovementID`,
      [batchId]
    );

   if (!rows || rows.length === 0) {
      throw new Error( 'Movimiento no encontrado' );
    }

    if (rows.length > 10) {
      throw new Error( 'El lote tiene más de 10 movimientos' );
    }

    const firstMov = rows[0];

    const adminName = [
      firstMov.AdminNombre || '',
      firstMov.AdminApellido || '',
      firstMov.AdminApellido2 || ''
    ].filter(part => part && part.trim() !== '').join(' ').trim() || 'NO ESPECIFICADO';

     const formatDate = (dateValue: any): string => {
          if (!dateValue) return 'NO ESPECIFICADO';
          
          try {
            const date = new Date(dateValue);
            // Verificar si es una fecha válida
            if (isNaN(date.getTime())) {
              return 'NO ESPECIFICADO';
            }
            return date.toLocaleDateString('es-MX');
          } catch (error) {
            console.error('Error al formatear fecha:', error);
            return 'NO ESPECIFICADO';
          }
        };

      // Cargar plantilla Excel
                 const templatePath = path.join(
                   process.cwd(),
                   "public",
                   "administrative-personnel-dashboard",
                   "personnel-management",
                   "FT-RH-05.xlsx"
                 );
     
             if (!fs.existsSync(templatePath)) {
               throw new Error('Plantilla FT-RH-05 no encontrada en: ' + templatePath);
             }
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templatePath);
        const ws = workbook.getWorksheet(1)!;
        
       ws.getCell('D5').value = firstMov.NameProject || 'NO ESPECIFICADO';
       ws.getCell('D7').value = adminName || 'NO ESPECIFICADO';

      rows.forEach((mov, index) => {

      const rowNumber = 10 + index; 
      
      const employeeName = [
        mov.FirstName || '',
        mov.LastName || '',
        mov.MiddleName || ''
      ].filter(part => part && part.trim() !== '').join(' ').trim() || 'NO ESPECIFICADO';

       ws.getCell(`A${rowNumber}`).value = employeeName || 'NO ESPECIFICADO';
       ws.getCell(`C${rowNumber}`).value = mov.Position || 'NO ESPECIFICADO';
       ws.getCell(`E${rowNumber}`).value = mov.NSS || 'NO ESPECIFICADO';
       ws.getCell(`F${rowNumber}`).value = mov.SalaryIMSS || 'NO ESPECIFICADO';
       ws.getCell(`G${rowNumber}`).value = mov.CURP || 'NO ESPECIFICADO';
       ws.getCell(`H${rowNumber}`).value = mov.MovementType || 'NO ESPECIFICADO';
       ws.getCell(`I${rowNumber}`).value = formatDate(mov.DateMovement) || 'NO ESPECIFICADO';
       ws.getCell(`J${rowNumber}`).value = mov.NCI || 'NO ESPECIFICADO';
       ws.getCell(`K${rowNumber}`).value = mov.UMF || 'NO ESPECIFICADO';
       ws.getCell(`L${rowNumber}`).value = mov.tipo || 'NO ESPECIFICADO';
       ws.getCell(`M${rowNumber}`).value = mov.ReasonForWithdrawal|| 'N/A';          
      });

      // Guardar Excel temporal
          await workbook.xlsx.writeFile(tempExcelPath);
      
          // Convertir a PDF usando ConvertAPI
          const result = await convertapi.convert("pdf", {
            File: tempExcelPath,
          });
      
          // Descargar el PDF
          const pdfResponse = await fetch(result.file.url);
          const pdfBuffer = await pdfResponse.arrayBuffer();
      
          // Subir a UploadThing
          const fileName = `FT-RH-05-${firstMov.BatchID}-${Date.now()}.pdf`;
          
          const file = new File([Buffer.from(pdfBuffer)], fileName, { type: 'application/pdf' });
          
          const uploadResponse = await utapi.uploadFiles([file]);
          
          if (!uploadResponse || !uploadResponse[0] || !uploadResponse[0].data || !uploadResponse[0].data.url) {
            throw new Error('Error al subir el PDF a UploadThing');
          }
          
          const fileUrl = uploadResponse[0].data.url;
      
          return { pdfBuffer, fileUrl };
      
        } catch (error) {
          console.error('Error al generar PDF FT-RH-05:', error);
          throw error;
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
        emb.BatchID,
        emb.MovementType,
        emb.DateMovement,
        emb.ReasonForWithdrawal,
        em.MovementID,
        em.BatchID,
        em.EmployeeID,
        em.ProjectContractID,
        bp.Area,
        pj.NameProject,
        pj.AdminProjectID,
        -- Datos del empleado
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        COALESCE(bc.SalaryIMSS, pc.SalaryIMSS) as SalaryIMSS,
        COALESCE(bpi.CURP, ppi.CURP) as CURP,
        COALESCE(bpi.NSS, ppi.NSS) as NSS,
        COALESCE(bpi.NCI, ppi.NCI) as NCI,
        COALESCE(bpi.UMF, ppi.UMF) as UMF,    
        COALESCE(admin_bp.FirstName) as AdminNombre,
        COALESCE(admin_bp.LastName) as AdminApellido,
        COALESCE(admin_bp.MiddleName) as AdminApellido2,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          ELSE 'PROYECTO'
        END as tipo
      FROM employee_movement_batches emb
      INNER JOIN employeeimssinfonavitmovements em ON em.BatchID = emb.BatchID 
      -- Datos del empleado (BASE)
      LEFT JOIN basepersonnel bp ON em.EmployeeID = bp.EmployeeID
      LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      -- Datos del empleado (PROJECT)
      LEFT JOIN projectpersonnel pp ON em.EmployeeID = pp.EmployeeID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      LEFT JOIN projects pj ON pc.ProjectID = pj.ProjectID
      LEFT JOIN employees e ON e.EmployeeID = pj.AdminProjectID
      LEFT JOIN basepersonnel admin_bp ON admin_bp.EmployeeID = e.EmployeeID
      ORDER BY em.MovementID`
        );
    const movementsRecords = rows as any[];

    return NextResponse.json({
      success: true,
      records: movementsRecords
    });

  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL OBTENER MOVIMIENTOS',
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

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { 
      EmployeeID, 
      ProjectContractID,
      MovementType,
      DateMovement,
      ReasonForWithdrawal,
    } = body;

    // Validaciones básicas
    if (!EmployeeID) {
      return NextResponse.json(
        { success: false, message: 'El ID del empleado es requerido' },
        { status: 400 }
      );
    }

    if (!ProjectContractID ) {
      return NextResponse.json(
        { success: false, message: 'El ID del proyecto es requerido' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    await connection.beginTransaction();

    try {
      // Verificar que el empleado existe
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

      // Formatear fechas
      const dateMovementFormatted = formatearFechaMySQL(DateMovement);

      const [batchresult] = await connection.execute(
        'INSERT INTO employee_movement_batches (MovementType, DateMovement, ReasonForWithdrawal) VALUES (?, ?, ?)',
        [
            MovementType,
            DateMovement,
            ReasonForWithdrawal
        ]
    );

    const BatchID = (batchresult as any).insertId;

    await connection.execute(
        'INSERT INTO employeeimssinfonavitmovement (BatchID, EmployeeID, ProjectContractID) VALUES (?, ?, ?)',
    [
        BatchID,
        EmployeeID,
        ProjectContractID
    ]
    );

    // CONFIRMAR LA TRANSACCIÓN PRIMERO
      await connection.commit();

      // AHORA generar el PDF con una nueva conexión (los datos ya están en la BD)
      let fileUrl = null;

      try {
        // Pequeña pausa para asegurar que la base de datos tenga el registro
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const { fileUrl: pdfUrl } = await generatePermissionPDF(BatchID);
        fileUrl = pdfUrl;
        
        // Actualizar el campo DocumentURL en la base de datos (usando nueva conexión)
        const updateConnection = await getConnection();
        try {
            await updateConnection.execute(
            `UPDATE employee_movement_batches SET FileURL = ? WHERE BatchID = ?`,
            [pdfUrl, BatchID]
          );
          console.log(`PDF subido a UploadThing y URL actualizada: ${pdfUrl}`);
        } finally {
          await updateConnection.release();
        }
      } catch (pdfError) {
        console.error('Error al generar/subir PDF:', pdfError);
        // No revertimos la transacción principal, solo registramos el error
      }
      return NextResponse.json({
        success: true,
        message: fileUrl ? 'Solicitud creada exitosamente' : 'Solicitud creada exitosamente (sin PDF)',
        BatchID: BatchID,
        fileUrl: fileUrl
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al crear permiso:', error);
    
    let errorMessage = 'ERROR AL CREAR EL PERMISO';
    
    if (error instanceof Error) {
      if (error.message.includes('foreign key constraint')) {
        errorMessage = 'ERROR: El empleado seleccionado no existe';
      } else if (error.message.includes('date value')) {
        errorMessage = 'ERROR: Formato de fecha incorrecto';
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
// app/api/administrative-personnel-dashboard/employee-management/employeeimminfonavit/[id]/route.ts
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

// Función para extraer el fileKey de una URL de UploadThing
function extractFileKeyFromUrl(url: string): string | null {
  try {
    const matches = url.match(/\/f\/([a-zA-Z0-9-_]+)/);
    return matches ? matches[1] : null;
  } catch {
    return null;
  }
}

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
    // No lanzamos el error para no interrumpir el flujo principal
  }
}

// Función para generar el PDF FT-RH-09 actualizado
async function generateUpdatedPermissionPDF(
  batchId: number
): Promise<ArrayBuffer> {
  const tempExcelPath = path.join(
    os.tmpdir(),
    `FT-RH-05-EDIT-${Date.now()}-${batchId}.xlsx`
  );
  const tempPdfPath = path.join(
    os.tmpdir(),
    `FT-RH-05-EDIT-${Date.now()}-${batchId}.pdf`
  );

  let connection;

    try {
    connection = await getConnection();

    // Obtener información del permiso y del empleado
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
      throw new Error(`Registro de solicitud con ID ${batchId} no encontrado`);
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
              
                 return pdfBuffer;
                 
                   } catch (error) {
                     console.error('Error al generar PDF FT-RH-09 actualizado:', error);
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
    
    // GET: Obtener un permiso específico
export async function GET(
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

    const batchId = id;

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

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      record: rows[0]
    });

  } catch (error) {
    console.error('Error al obtener solicitud:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL OBTENER SOLICITUD',
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

// PUT: Actualizar permiso existente
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

    const BatchID = parseInt(id);
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

    connection = await getConnection();
    await connection.beginTransaction();

    try {
      // Verificar que el registro existe y obtener el DocumentURL actual
      const [permissionCheck] = await connection.execute<any[]>(
        'SELECT BatchID, FileURL FROM employee_movement_batches WHERE BatchID = ?',
        [BatchID]
      );

      if (permissionCheck.length === 0) {
        throw new Error('La solicitud no existe');
      }

      const currentPermission = permissionCheck[0];
      const oldFileUrl = currentPermission.DocumentURL;

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

            try {

            // Actualizar primera tabla
            const [batchResult] = await connection.execute(
                `UPDATE employee_movement_batches 
                SET MovementType = ?, DateMovement = ?, ReasonForWithdrawal = ?
                WHERE BatchID = ?`,
                [
                MovementType,
                DateMovement,
                ReasonForWithdrawal,
                BatchID
                ]
            );

            // Actualizar segunda tabla
            const [movementResult] = await connection.execute(
                `UPDATE employeeimssinfonavitmovement 
                SET EmployeeID = ?, ProjectContractID = ?
                WHERE BatchID = ?`,
                [
                EmployeeID,
                ProjectContractID,
                BatchID
                ]
            );
            
            // Si todo está bien, confirmar la transacción
            await connection.commit();
            console.log('Transacción completada exitosamente');
            
            } catch (error) {
            console.error('Error en la transacción, cambios revertidos:', error);
            throw error;
            } finally {
            }

      // TERCERO: Generar nuevo PDF con los datos actualizados
      let newFileUrl: string | null = null;
      let pdfGenerationSuccess = false;

      try {
        // Generar el PDF actualizado
        const pdfBuffer = await generateUpdatedPermissionPDF(BatchID);

        // Subir a UploadThing
        const tipoEmpleado = (baseCheck as any[]).length > 0 ? 'BASE' : 'PROJECT';
        const fileName = `FT-RH-05-${tipoEmpleado}-${EmployeeID}-${Date.now()}.pdf`;
        const file = new File([Buffer.from(pdfBuffer)], fileName, { type: 'application/pdf' });
        
        const uploadResponse = await utapi.uploadFiles([file]);
        
        if (uploadResponse && uploadResponse[0] && uploadResponse[0].data && uploadResponse[0].data.url) {
          newFileUrl = uploadResponse[0].data.url;
          pdfGenerationSuccess = true;
          
          // CUARTO: Actualizar el campo DocumentURL con la nueva URL (usando nueva conexión)
          const updateConnection = await getConnection();
          try {
            await updateConnection.execute(
              `UPDATE employee_movement_batches SET FileURL = ? WHERE BatchID = ?`,
              [newFileUrl, BatchID]
            );
            console.log(`PDF actualizado subido a UploadThing: ${newFileUrl}`);
            
            // Eliminar el archivo anterior si existe y la generación fue exitosa
            if (oldFileUrl && pdfGenerationSuccess) {
              await deleteFileFromUploadThing(oldFileUrl);
            }
          } finally {
            await updateConnection.release();
          }
        } else {
          throw new Error('Error al subir el PDF a UploadThing');
        }
      } catch (pdfError) {
        console.error('Error al generar/subir PDF durante actualización:', pdfError);
        // Si falla la generación del PDF, mantenemos el archivo anterior
        newFileUrl = oldFileUrl;
        
        // Restaurar el archivo anterior en la base de datos
        if (oldFileUrl) {
          const restoreConnection = await getConnection();
          try {
            await restoreConnection.execute(
              `UPDATE employee_movement_batches SET FileURL = ? WHERE BatchID = ?`,
              [oldFileUrl, BatchID]
            );
          } finally {
            await restoreConnection.release();
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: pdfGenerationSuccess ? 'Solicitud actualizada exitosamente con nuevo documento' : 'Permiso actualizado exitosamente (sin cambios en el documento)',
        fileUrl: newFileUrl
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al actualizar permiso:', error);
    
    let errorMessage = 'ERROR AL ACTUALIZAR EL PERMISO';
    
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

// DELETE: Eliminar incidencia
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

    const BatchID = id;

    connection = await getConnection();
    await connection.beginTransaction();

    try {
      // Verificar que la incidencia existe y obtener el FileURL
      const [incidenceCheck] = await connection.execute<any[]>(
        'SELECT BatchID, FileURL FROM employee_movement_batches WHERE BatchID = ?',
        [BatchID]
      );

      if (incidenceCheck.length === 0) {
          throw new Error('La solicitud no existe');
      }

      const fileUrl = incidenceCheck[0].FileURL;

      // Eliminar el archivo de UploadThing si existe
      if (fileUrl) {
        await deleteFileFromUploadThing(fileUrl);
      }

      // Eliminar incidencia
      await connection.execute(
        'DELETE FROM employee_movement_batches WHERE BatchID = ?',
        [BatchID]
      );

      await connection.commit();

      return NextResponse.json({
        success: true,
        message: 'Solicitud eliminada exitosamente'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al eliminar solicitud:', error);
    
    let errorMessage = 'ERROR AL ELIMINAR EL SOLICITUD';
    
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
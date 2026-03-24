//app/api/administrative-personnel-dashboard/employee-management/employeeincidence/[id]/route.ts
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
  }
}

// Función para generar el PDF FT-RH-09 actualizado
async function generateUpdatedPermissionPDF(
  incidenceId: number
): Promise<ArrayBuffer> {
  const tempExcelPath = path.join(
    os.tmpdir(),
    `FT-RH-09-EDIT-${Date.now()}-${incidenceId}.xlsx`
  );
  const tempPdfPath = path.join(
    os.tmpdir(),
    `FT-RH-09-EDIT-${Date.now()}-${incidenceId}.pdf`
  );

  let connection;

  try {
    connection = await getConnection();

     // Obtener información de la incidencia y del empleado
        const [rows] = await connection.execute<any[]>(
          `SELECT 
            ei.IncidenceID,
            ei.EmployeeID,
            ei.InicidenceNumber,
            ei.Description,
            ei.Rule,
            ei.FileURL,
            ei.IncidenceDate,
            bp.Area,
            pj.NameProject,
            -- Datos del empleado
            COALESCE(bp.FirstName, pp.FirstName) as FirstName,
            COALESCE(bp.LastName, pp.LastName) as LastName,
            COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
            COALESCE(bp.Position, pc.Position) as Position,
            COALESCE(bc.StartDate, pc.StartDate) as StartDatee,
            CASE 
              WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
              ELSE 'PROJECT'
            END as tipo
          FROM employeeincidence ei
          -- Datos del empleado (BASE)
          LEFT JOIN basepersonnel bp ON ei.EmployeeID = bp.EmployeeID
          LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID
          -- Datos del empleado (PROJECT)
          LEFT JOIN projectpersonnel pp ON ei.EmployeeID = pp.EmployeeID
          LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
          LEFT JOIN projects pj ON pc.ProjectID = pj.ProjectID
          WHERE ei.IncidenceID = ?`,
          [incidenceId]
        );
    
        if (!rows || rows.length === 0) {
          throw new Error(`Registro de permiso con ID ${incidenceId} no encontrado`);
         }
    
        const inc = rows[0];
    
        // Función para formatear fecha como en el ejemplo de FT-RH-21
        const formatDate = (dateValue: any): string => {
          if (!dateValue) return 'NO ESPECIFICADO';
          
          try {
            const date = new Date(dateValue);
            // Verificar si es una fecha válida
            if (isNaN(date.getTime())) {
              return 'NO ESPECIFICADO';
            }
            // Usar el mismo formato que en FT-RH-21: toLocaleDateString('es-MX')
            return date.toLocaleDateString('es-MX');
          } catch (error) {
            console.error('Error al formatear fecha:', error);
            return 'NO ESPECIFICADO';
          }
        };
    
        // Construir nombre completo del empleado
        const employeeName = [
          inc.FirstName || '',
          inc.LastName || '',
          inc.MiddleName || ''
        ].filter(part => part && part.trim() !== '').join(' ').trim() || 'NO ESPECIFICADO';
    
        // Cargar plantilla Excel
        const templatePath = path.join(
          process.cwd(),
          "public",
          "administrative-personnel-dashboard",
          "personnel-management",
          "FT-RH-27.xlsx"
        );
    
        if (!fs.existsSync(templatePath)) {
          throw new Error('Plantilla FT-RH-27 no encontrada en: ' + templatePath);
         }
    
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templatePath);
        const ws = workbook.getWorksheet(1)!;
    
        ws.getCell('A6').value = inc.LastName || 'NO ESPECIFICADO';
        ws.getCell('E6').value = inc.MiddleName || 'NO ESPECIFICADO';
        ws.getCell('H6').value = inc.FirstName || 'NO ESPECIFICADO';
        ws.getCell('A9').value = formatDate(inc.StartDatee);
        ws.getCell('C9').value = inc.Position || 'NO ESPECIFICADO';
        ws.getCell('A12').value = inc.InicidenceNumber || 'NO ESPECIFICADO';
        ws.getCell('B12').value = formatDate(inc.IncidenceDate);
        ws.getCell('D12').value = inc.Description || 'NO ESPECIFICADO';
        ws.getCell('H12').value = inc.Rule || 'NO ESPECIFICADO';
        ws.getCell('E17').value = employeeName || 'NO ESPECIFICADO';
        ws.getCell('G9').value = inc.NameProject || 'N/A';
        ws.getCell('I9').value = inc.Area || 'N/A';
    
    
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
    

// GET: Obtener una incidencia específica
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

    const incidenceId = id;

    connection = await getConnection();

    const [rows] = await connection.execute<any[]>(
      `SELECT 
        ei.IncidenceID,
        ei.EmployeeID,
        ei.InicidenceNumber,
        ei.IncidenceDate,
        ei.Description,
        ei.Rule,
        ei.FileURL,
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName
      FROM employeeincidence ei
      LEFT JOIN basepersonnel bp ON ei.EmployeeID = bp.EmployeeID
      LEFT JOIN projectpersonnel pp ON ei.EmployeeID = pp.EmployeeID
      WHERE ei.IncidenceID = ?`,
      [incidenceId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Incidencia no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      record: rows[0]
    });

  } catch (error) {
    console.error('Error al obtener incidencia:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL OBTENER INCIDENCIA',
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

// PUT: Actualizar incidencia existente
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

    const incidenceId = parseInt(id);
    const body = await request.json();
    const { 
      EmployeeID,
      Description,
      Rule
    } = body;

    // Validaciones
    if (!EmployeeID) {
      return NextResponse.json(
        { success: false, message: 'El ID del empleado es requerido' },
        { status: 400 }
      );
    }

    if (!Description) {
      return NextResponse.json(
        { success: false, message: 'La descripción es requerida' },
        { status: 400 }
      );
    }

    if (!Rule) {
      return NextResponse.json(
        { success: false, message: 'La regla es requerida' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    await connection.beginTransaction();

    try {
      // Verificar que la incidencia existe y obtener el FileURL actual
      const [incidenceCheck] = await connection.execute<any[]>(
        'SELECT IncidenceID, FileURL FROM employeeincidence WHERE IncidenceID = ?',
        [incidenceId]
      );

      if (incidenceCheck.length === 0) {
        return NextResponse.json(
          { success: false, message: 'La incidencia no existe' },
          { status: 404 }
        );
      }

      const currentIncidence = incidenceCheck[0];
      const oldFileUrl = currentIncidence.FileURL;

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

      // PRIMERO: Actualizar incidencia (sin FileURL por ahora)
      await connection.execute(
        `UPDATE employeeincidence 
         SET EmployeeID = ?, Description = ?, Rule = ?, FileURL = ?
         WHERE IncidenceID = ?`,
        [
          EmployeeID,
          Description,
          Rule,
          null,
          incidenceId
        ]
      );

      // CONFIRMAR LA TRANSACCIÓN PRIMERO
      await connection.commit();

      // AHORA generar el Excel actualizado con una nueva conexión
      let newFileUrl = null;
      let pdfGenerationSuccess = false;

       try {
              // Generar el PDF actualizado
              const pdfBuffer = await generateUpdatedPermissionPDF(incidenceId);
      
              // Subir a UploadThing
              const tipoEmpleado = (baseCheck as any[]).length > 0 ? 'BASE' : 'PROJECT';
              const fileName = `FT-RH-27-${tipoEmpleado}-${EmployeeID}-${Date.now()}.pdf`;
              const file = new File([Buffer.from(pdfBuffer)], fileName, { type: 'application/pdf' });
              
              const uploadResponse = await utapi.uploadFiles([file]);
              
              if (uploadResponse && uploadResponse[0] && uploadResponse[0].data && uploadResponse[0].data.url) {
                newFileUrl = uploadResponse[0].data.url;
                pdfGenerationSuccess = true;
                
                // CUARTO: Actualizar el campo DocumentURL con la nueva URL (usando nueva conexión)
                const updateConnection = await getConnection();
                try {
                  await updateConnection.execute(
                    `UPDATE employeeincidence SET FileURL = ? WHERE IncidenceID = ?`,
                    [newFileUrl, incidenceId]
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
                    `UPDATE employeeincidence SET FileURL = ? WHERE IncidenceID = ?`,
                    [oldFileUrl, incidenceId]
                  );
                } finally {
                  await restoreConnection.release();
                }
              }
            }
      
            return NextResponse.json({
              success: true,
              message: pdfGenerationSuccess ? 'Incidencia actualizada exitosamente con nuevo documento' : 'Permiso actualizado exitosamente (sin cambios en el documento)',
              fileUrl: newFileUrl
            });
      
          } catch (error) {
            await connection.rollback();
            throw error;
          }
      
        } catch (error) {
          console.error('Error al actualizar incidencia:', error);
          
          let errorMessage = 'ERROR AL ACTUALIZAR LA INCIDENCIA';
          
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

    const incidenceId = id;

    connection = await getConnection();
    await connection.beginTransaction();

    try {
      // Verificar que la incidencia existe y obtener el FileURL
      const [incidenceCheck] = await connection.execute<any[]>(
        'SELECT IncidenceID, FileURL FROM employeeincidence WHERE IncidenceID = ?',
        [incidenceId]
      );

      if (incidenceCheck.length === 0) {
          throw new Error('El permiso no existe');
      }

      const fileUrl = incidenceCheck[0].FileURL;

      // Eliminar el archivo de UploadThing si existe
      if (fileUrl) {
        await deleteFileFromUploadThing(fileUrl);
      }

      // Eliminar incidencia
      await connection.execute(
        'DELETE FROM employeeincidence WHERE IncidenceID = ?',
        [incidenceId]
      );

      await connection.commit();

      return NextResponse.json({
        success: true,
        message: 'Incidencia eliminada exitosamente'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al eliminar incidencia:', error);
    
    let errorMessage = 'ERROR AL ELIMINAR EL PERMISO';
    
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
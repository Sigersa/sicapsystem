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

// Función para verificar si un TrainerID existe en la base de datos
async function verifyTrainerExists(connection: any, trainerId: number): Promise<boolean> {
  try {
    const [trainerCheck] = await connection.execute(
      `SELECT e.EmployeeID 
       FROM employees e 
       WHERE e.EmployeeID = ? AND e.EmployeeType IN ('BASE', 'PROJECT')`,
      [trainerId]
    );
    
    return (trainerCheck as any[]).length > 0;
  } catch (error) {
    console.error('Error al verificar instructor:', error);
    return false;
  }
}

// Función para generar el PDF DC-3 actualizado
async function generateUpdatedDC3PDF(
  dc3Id: number
): Promise<ArrayBuffer> {
  const tempExcelPath = path.join(
    os.tmpdir(),
    `DC-3-EDIT-${Date.now()}-${dc3Id}.xlsx`
  );
  const tempPdfPath = path.join(
    os.tmpdir(),
    `DC-3-EDIT-${Date.now()}-${dc3Id}.pdf`
  );

  let connection;

  try {
    connection = await getConnection();

    // Obtener información del registro DC3, del empleado y del instructor
    const [rows] = await connection.execute<any[]>(
      `SELECT 
        dc.DC3ID,
        dc.EmployeeID,
        dc.SpecificOccupation,
        dc.CourseName,
        dc.StartDate,
        dc.EndDate,
        dc.Area,
        dc.Duration,
        dc.TrainerID,
        -- Datos del empleado que recibe el curso
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          ELSE 'PROJECT'
        END as tipo,
        COALESCE(bp.Area, p.NameProject) as AreaOrProject,
        -- CURP del empleado que recibe el curso
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN bpi.CURP
          ELSE ppi.CURP
        END as CURP,
        -- Datos del instructor (Trainer)
        COALESCE(trainer_bp.FirstName, trainer_pp.FirstName) as TrainerFirstName,
        COALESCE(trainer_bp.LastName, trainer_pp.LastName) as TrainerLastName,
        COALESCE(trainer_bp.MiddleName, trainer_pp.MiddleName) as TrainerMiddleName
      FROM employeedc3 dc
      -- Datos del empleado que recibe el curso (BASE)
      LEFT JOIN basepersonnel bp ON dc.EmployeeID = bp.EmployeeID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      -- Datos del empleado que recibe el curso (PROJECT)
      LEFT JOIN projectpersonnel pp ON dc.EmployeeID = pp.EmployeeID
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN projects p ON pc.ProjectID = p.ProjectID
      -- Datos del instructor (Trainer)
      LEFT JOIN basepersonnel trainer_bp ON dc.TrainerID = trainer_bp.EmployeeID
      LEFT JOIN projectpersonnel trainer_pp ON dc.TrainerID = trainer_pp.EmployeeID
      WHERE dc.DC3ID = ?`,
      [dc3Id]
    );

    if (!rows.length) {
      throw new Error('Registro DC3 no encontrado');
    }

    const dc3Record = rows[0];

    // Construir nombre completo del empleado en el orden: Apellido Paterno, Apellido Materno, Nombre(s)
    const employeeName = [
      dc3Record.LastName || '',
      dc3Record.MiddleName || '',
      dc3Record.FirstName || ''
    ].filter(part => part.trim() !== '').join(' ');

    // Construir nombre completo del instructor
    const trainerName = [
      dc3Record.TrainerFirstName || '',
      dc3Record.TrainerLastName || '',
      dc3Record.TrainerMiddleName || ''
    ].filter(part => part.trim() !== '').join(' ') || "INSTRUCTOR NO ESPECIFICADO";

    const startYear = dc3Record.StartDate 
      ? new Date(dc3Record.StartDate).getFullYear().toString()
      : '';

    const startMonth = dc3Record.StartDate 
      ? (new Date(dc3Record.StartDate).getMonth() + 1).toString().padStart(2, '0')
      : '';

    const startDay = dc3Record.StartDate 
      ? new Date(dc3Record.StartDate).getDate().toString().padStart(2, '0')
      : '';

    const endYear = dc3Record.EndDate 
      ? new Date(dc3Record.EndDate).getFullYear().toString()
      : '';

    const endMonth = dc3Record.EndDate 
      ? (new Date(dc3Record.EndDate).getMonth() + 1).toString().padStart(2, '0')
      : '';

    const endDay = dc3Record.EndDate 
      ? new Date(dc3Record.EndDate).getDate().toString().padStart(2, '0')
      : '';

    // Cargar plantilla Excel
    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "personnel-management",
      "DC-3.xlsx"
    );

    if (!fs.existsSync(templatePath)) {
      throw new Error('Plantilla DC-3 no encontrada');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet(1)!;

    // Llenar datos en la plantilla
    ws.getCell("A7").value = dc3Record.CURP || "CURP NO ESPECIFICADO";
    ws.getCell("A5").value = employeeName || "NOMBRE NO ESPECIFICADO";
    ws.getCell("A9").value = dc3Record.Position || "NO ESPECIFICADO";
    ws.getCell("A19").value = dc3Record.CourseName || "NO ESPECIFICADO";
    ws.getCell("A23").value = dc3Record.Area || "NO ESPECIFICADO";
    ws.getCell("B32").value = trainerName;
    ws.getCell("H7").value = dc3Record.SpecificOccupation || "NO ESPECIFICADO";
    ws.getCell("A21").value = dc3Record.Duration || "NO ESPECIFICADO";
    ws.getCell("I21").value = startYear || "";
    ws.getCell("J21").value = startMonth || "";
    ws.getCell("K21").value = startDay || "";
    ws.getCell("M21").value = endYear || "";
    ws.getCell("N21").value = endMonth || "";
    ws.getCell("O21").value = endDay || "";
    
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
    console.error('Error al generar PDF DC3 actualizado:', error);
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

// GET: Obtener un registro DC3 específico
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

    const dc3Id = id;

    connection = await getConnection();

    const [rows] = await connection.execute<any[]>(
      `SELECT 
        dc.DC3ID,
        dc.EmployeeID,
        dc.SpecificOccupation,
        dc.CourseName,
        dc.StartDate,
        dc.EndDate,
        dc.Area,
        dc.TrainerID,
        dc.Duration,
        dc.DocumentURL,
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName
      FROM employeedc3 dc
      LEFT JOIN basepersonnel bp ON dc.EmployeeID = bp.EmployeeID
      LEFT JOIN projectpersonnel pp ON dc.EmployeeID = pp.EmployeeID
      WHERE dc.DC3ID = ?`,
      [dc3Id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Registro no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      record: rows[0]
    });

  } catch (error) {
    console.error('Error al obtener registro DC3:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL OBTENER REGISTRO DC3',
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

// PUT: Actualizar registro DC3 existente
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

    const dc3Id = parseInt(id);
    const body = await request.json();
    const { 
      EmployeeID,
      SpecificOccupation,
      CourseName,
      StartDate,
      EndDate,
      Area,
      TrainerID,
      Duration
    } = body;

    // Validaciones
    if (!EmployeeID) {
      return NextResponse.json(
        { success: false, message: 'El ID del empleado es requerido' },
        { status: 400 }
      );
    }

    if (!CourseName) {
      return NextResponse.json(
        { success: false, message: 'El nombre del curso es requerido' },
        { status: 400 }
      );
    }

    if (!StartDate) {
      return NextResponse.json(
        { success: false, message: 'La fecha de inicio es requerida' },
        { status: 400 }
      );
    }

    if (!EndDate) {
      return NextResponse.json(
        { success: false, message: 'La fecha de fin es requerida' },
        { status: 400 }
      );
    }

    // Validar que la fecha de fin sea posterior a la fecha de inicio
    if (new Date(StartDate) > new Date(EndDate)) {
      return NextResponse.json(
        { success: false, message: 'LA FECHA DE FIN DEBE SER POSTERIOR A LA FECHA DE INICIO' },
        { status: 400 }
      );
    }

    // Validar que Duration sea un número positivo si se proporciona
    if (Duration && (typeof Duration !== 'number' || Duration <= 0 || !Number.isInteger(Duration))) {
      return NextResponse.json(
        { success: false, message: 'La duración debe ser un número entero positivo' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    await connection.beginTransaction();

    try {
      // Verificar que el registro existe y obtener el DocumentURL actual
      const [dcCheck] = await connection.execute<any[]>(
        'SELECT DC3ID, DocumentURL FROM employeedc3 WHERE DC3ID = ?',
        [dc3Id]
      );

      if (dcCheck.length === 0) {
        throw new Error('El registro DC3 no existe');
      }

      const currentDC3 = dcCheck[0];
      const oldFileUrl = currentDC3.DocumentURL;

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

      // Verificar que el TrainerID existe si se proporciona
      if (TrainerID) {
        const trainerExists = await verifyTrainerExists(connection, TrainerID);
        if (!trainerExists) {
          throw new Error('El instructor seleccionado no existe');
        }
      }

      // Formatear fechas
      const startDateFormatted = formatearFechaMySQL(StartDate);
      const endDateFormatted = formatearFechaMySQL(EndDate);

      // PRIMERO: Actualizar registro DC3
      await connection.execute(
        `UPDATE employeedc3 
         SET EmployeeID = ?, SpecificOccupation = ?, CourseName = ?, 
             StartDate = ?, EndDate = ?, Area = ?, TrainerID = ?, Duration = ?, DocumentURL = ?
         WHERE DC3ID = ?`,
        [
          EmployeeID,
          SpecificOccupation || null,
          CourseName,
          startDateFormatted,
          endDateFormatted,
          Area || null,
          TrainerID || null,
          Duration || null,
          null, // Temporalmente null
          dc3Id
        ]
      );

      // SEGUNDO: Confirmar la transacción para que los cambios estén disponibles
      await connection.commit();

      // TERCERO: Generar nuevo PDF con los datos actualizados
      let newFileUrl: string | null = null;
      let pdfGenerationSuccess = false;

      try {
        // Generar el PDF actualizado
        const pdfBuffer = await generateUpdatedDC3PDF(dc3Id);

        // Subir a UploadThing
        const tipoEmpleado = (baseCheck as any[]).length > 0 ? 'BASE' : 'PROJECT';
        const fileName = `DC-3-${tipoEmpleado}-${EmployeeID}-${Date.now()}.pdf`;
        const file = new File([Buffer.from(pdfBuffer)], fileName, { type: 'application/pdf' });
        
        const uploadResponse = await utapi.uploadFiles([file]);
        
        if (uploadResponse && uploadResponse[0] && uploadResponse[0].data && uploadResponse[0].data.url) {
          newFileUrl = uploadResponse[0].data.url;
          pdfGenerationSuccess = true;
          
          // CUARTO: Actualizar el campo DocumentURL con la nueva URL (usando nueva conexión)
          const updateConnection = await getConnection();
          try {
            await updateConnection.execute(
              `UPDATE employeedc3 SET DocumentURL = ? WHERE DC3ID = ?`,
              [newFileUrl, dc3Id]
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
              `UPDATE employeedc3 SET DocumentURL = ? WHERE DC3ID = ?`,
              [oldFileUrl, dc3Id]
            );
          } finally {
            await restoreConnection.release();
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: pdfGenerationSuccess ? 'Registro DC3 actualizado exitosamente con nuevo documento' : 'Registro DC3 actualizado exitosamente (sin cambios en el documento)',
        fileUrl: newFileUrl
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al actualizar registro DC3:', error);
    
    let errorMessage = 'ERROR AL ACTUALIZAR EL REGISTRO DC3';
    
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

// DELETE: Eliminar registro DC3
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

    const dc3Id = id;

    connection = await getConnection();
    await connection.beginTransaction();

    try {
      // Verificar que el registro existe y obtener el DocumentURL
      const [dcCheck] = await connection.execute<any[]>(
        'SELECT DC3ID, DocumentURL FROM employeedc3 WHERE DC3ID = ?',
        [dc3Id]
      );

      if (dcCheck.length === 0) {
        throw new Error('El registro DC3 no existe');
      }

      const fileUrl = dcCheck[0].DocumentURL;

      // Eliminar el archivo de UploadThing si existe
      if (fileUrl) {
        await deleteFileFromUploadThing(fileUrl);
      }

      // Eliminar registro
      await connection.execute(
        'DELETE FROM employeedc3 WHERE DC3ID = ?',
        [dc3Id]
      );

      await connection.commit();

      return NextResponse.json({
        success: true,
        message: 'Registro DC3 eliminado exitosamente'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al eliminar registro DC3:', error);
    
    let errorMessage = 'ERROR AL ELIMINAR EL REGISTRO DC3';
    
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
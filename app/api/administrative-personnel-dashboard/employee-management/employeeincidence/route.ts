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

// Función para generar el PDF FT-RH-09
async function generateIncidencePDF(
  incidenceId: number
): Promise<{ pdfBuffer: ArrayBuffer; fileUrl: string }> {
  const tempExcelPath = path.join(
    os.tmpdir(),
    `FT-RH-27-${Date.now()}-${incidenceId}.xlsx`
  );
  const tempPdfPath = path.join(
    os.tmpdir(),
    `FT-RH-27-${Date.now()}-${incidenceId}.pdf`
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
      throw new Error(`Registro de incidencia con ID ${incidenceId} no encontrado`);
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
    const tipoEmpleado = inc.tipo || 'DESCONOCIDO';
    const fileName = `FT-RH-27-${tipoEmpleado}-${inc.EmployeeID}-${Date.now()}.pdf`;
    
    const file = new File([Buffer.from(pdfBuffer)], fileName, { type: 'application/pdf' });
    
    const uploadResponse = await utapi.uploadFiles([file]);
    
    if (!uploadResponse || !uploadResponse[0] || !uploadResponse[0].data || !uploadResponse[0].data.url) {
      throw new Error('Error al subir el PDF a UploadThing');
    }
    
    const fileUrl = uploadResponse[0].data.url;

    return { pdfBuffer, fileUrl };

  } catch (error) {
    console.error('Error al generar PDF FT-RH-27:', error);
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

// GET: Obtener todos los registros de employeeincidence
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
        ei.IncidenceID,
        ei.EmployeeID,
        ei.IncidenceDate,
        ei.Description,
        ei.Rule,
        ei.FileURL,
        e.Status,
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          ELSE 'PROJECT'
        END as tipo
      FROM employeeincidence ei
      INNER JOIN employees e ON e.EmployeeID = ei.EmployeeID
      LEFT JOIN basepersonnel bp ON ei.EmployeeID = bp.EmployeeID
      LEFT JOIN projectpersonnel pp ON ei.EmployeeID = pp.EmployeeID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      WHERE e.Status = 1
      ORDER BY ei.IncidenceID DESC
    `);

    const incidenceRecords = rows as any[];

    return NextResponse.json({
      success: true,
      records: incidenceRecords
    });

  } catch (error) {
    console.error('Error al obtener incidencias:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL OBTENER INCIDENCIAS',
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

// POST: Crear nueva incidencia
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

      // Verificar que el número de incidencia no esté duplicado
      const [nextNumberResult] = await connection.execute <any[]>(
        `SELECT COALESCE(MAX(InicidenceNumber),0) + 1 AS nextNumber
          FROM employeeincidence
          WHERE EmployeeID = ?`,
          [EmployeeID]
      );

      const nextNumber = nextNumberResult[0].nextNumber;

      // Insertar registro de incidencia 
      const [result] = await connection.execute(
        `INSERT INTO employeeincidence 
         (EmployeeID, InicidenceNumber, IncidenceDate, Description, Rule, FileURL) 
         VALUES (?, ?, NOW(), ?, ?, ?)`,
        [
          EmployeeID,
          nextNumber,
          Description,
          Rule,
          null
        ]
      );

      const incidenceId = (result as any).insertId;

      // CONFIRMAR LA TRANSACCIÓN PRIMERO
      await connection.commit();

      // AHORA generar el PDF con una nueva conexión (los datos ya están en la BD)
      let fileUrl = null;

      try {
        // Pequeña pausa para asegurar que la base de datos tenga el registro
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const { fileUrl: pdfUrl } = await generateIncidencePDF(incidenceId);
        fileUrl = pdfUrl;
        
        // Actualizar el campo FileURL en la base de datos (usando nueva conexión)
        const updateConnection = await getConnection();
        try {
          await updateConnection.execute(
            `UPDATE employeeincidence SET FileURL = ? WHERE IncidenceID = ?`,
            [pdfUrl, incidenceId]
          );
          console.log(`Excel subido a UploadThing y URL actualizada: ${pdfUrl}`);
        } finally {
          await updateConnection.release();
        }
      } catch (pdfError) {
        console.error('Error al generar/subir Excel:', pdfError);
        // No revertimos la transacción principal, solo registramos el error
      }

      return NextResponse.json({
        success: true,
        message: fileUrl ? 'Incidencia creada exitosamente' : 'Incidencia creada exitosamente (sin archivo Excel)',
        incidenceId: incidenceId,
        fileUrl: fileUrl
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al crear incidencia:', error);
    
    let errorMessage = 'ERROR AL CREAR LA INCIDENCIA';
    
    if (error instanceof Error) {
      if (error.message.includes('foreign key constraint')) {
        errorMessage = 'ERROR: El empleado seleccionado no existe';
      } else if (error.message.includes('Ya existe una incidencia')) {
        errorMessage = error.message;
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
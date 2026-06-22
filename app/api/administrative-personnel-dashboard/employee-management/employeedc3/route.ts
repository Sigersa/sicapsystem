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

// Función para extraer el nombre del instructor externo de DocumentURL
function extractExternalTrainerName(documentURL: string | null): string | null {
  if (!documentURL) return null;
  
  // Buscar el patrón EXT:Nombre
  const extMatch = documentURL.match(/EXT:([^|]*)/);
  if (extMatch) {
    return extMatch[1].trim();
  }
  
  // Si el documentURL comienza con EXT: sin PDF
  if (documentURL.startsWith('EXT:')) {
    return documentURL.substring(4).trim();
  }
  
  return null;
}

// Función para extraer la URL del PDF de DocumentURL
function getPDFUrlFromDocumentURL(documentURL: string | null): string | null {
  if (!documentURL) return null;
  
  const pdfMatch = documentURL.match(/PDF:([^|]*)/);
  if (pdfMatch) {
    return pdfMatch[1];
  }
  
  // Si solo es una URL (sin PDF:)
  if (documentURL.startsWith('http://') || documentURL.startsWith('https://')) {
    return documentURL;
  }
  
  return null;
}

// Función para generar el PDF DC-3
async function generateDC3PDF(dc3Id: number): Promise<{ pdfBuffer: ArrayBuffer; fileUrl: string }> {
  const tempExcelPath = path.join(os.tmpdir(), `DC-3-${Date.now()}-${dc3Id}.xlsx`);
  let connection;

  try {
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
        dc.Duration,
        dc.TrainerID,
        dc.DocumentURL,
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          ELSE 'PROJECT'
        END as tipo,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN bpi.CURP
          ELSE ppi.CURP
        END as CURP,
        trainer_bp.FirstName as TrainerFirstName,
        trainer_bp.LastName as TrainerLastName,
        trainer_bp.MiddleName as TrainerMiddleName
      FROM employeedc3 dc
      INNER JOIN employees e ON e.EmployeeID = dc.EmployeeID
      LEFT JOIN basepersonnel bp ON dc.EmployeeID = bp.EmployeeID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      LEFT JOIN projectpersonnel pp ON dc.EmployeeID = pp.EmployeeID
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN projects p ON pc.ProjectID = p.ProjectID
      LEFT JOIN employees trainer_emp ON dc.TrainerID = trainer_emp.EmployeeID
      LEFT JOIN basepersonnel trainer_bp ON dc.TrainerID = trainer_bp.EmployeeID
      LEFT JOIN projectpersonnel trainer_pp ON dc.TrainerID = trainer_pp.EmployeeID
      WHERE dc.DC3ID = ? AND e.Status = 1 AND (
          bp.EmployeeID IS NOT NULL
          OR pc.Status = 1
      )`,
      [dc3Id]
    );

    if (!rows || rows.length === 0) {
      throw new Error(`Registro DC3 con ID ${dc3Id} no encontrado`);
    }

    const dc3Record = rows[0];

    const employeeName = [
      dc3Record.LastName || '',
      dc3Record.MiddleName || '',
      dc3Record.FirstName || ''
    ].filter(part => part.trim() !== '').join(' ');

    let trainerName = '';
    
    // Verificar si el instructor es externo (TrainerID = null)
    if (dc3Record.TrainerID === null) {
      // Instructor externo - extraer nombre del DocumentURL
      const extName = extractExternalTrainerName(dc3Record.DocumentURL);
      trainerName = extName || "INSTRUCTOR EXTERNO";
    } else if (dc3Record.TrainerFirstName) {
      // Instructor interno
      trainerName = [
        dc3Record.TrainerFirstName || '',
        dc3Record.TrainerLastName || '',
        dc3Record.TrainerMiddleName || ''
      ].filter(part => part.trim() !== '').join(' ');
    }
    
    if (!trainerName || trainerName.trim() === '') {
      trainerName = "INSTRUCTOR NO ESPECIFICADO";
    }

    const startYear = dc3Record.StartDate ? new Date(dc3Record.StartDate).getFullYear().toString() : '';
    const startMonth = dc3Record.StartDate ? (new Date(dc3Record.StartDate).getMonth() + 1).toString().padStart(2, '0') : '';
    const startDay = dc3Record.StartDate ? new Date(dc3Record.StartDate).getDate().toString().padStart(2, '0') : '';
    const endYear = dc3Record.EndDate ? new Date(dc3Record.EndDate).getFullYear().toString() : '';
    const endMonth = dc3Record.EndDate ? (new Date(dc3Record.EndDate).getMonth() + 1).toString().padStart(2, '0') : '';
    const endDay = dc3Record.EndDate ? new Date(dc3Record.EndDate).getDate().toString().padStart(2, '0') : '';

    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "personnel-management",
      "DC-3.xlsx"
    );

    if (!fs.existsSync(templatePath)) {
      throw new Error('Plantilla DC-3 no encontrada en: ' + templatePath);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet(1)!;

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
    
    await workbook.xlsx.writeFile(tempExcelPath);

    const result = await convertapi.convert("pdf", {
      File: tempExcelPath,
    });

    const pdfResponse = await fetch(result.file.url);
    const pdfBuffer = await pdfResponse.arrayBuffer();
    
    const tipoEmpleado = dc3Record.tipo || 'DESCONOCIDO';
    const fileName = `DC-3-${tipoEmpleado}-${dc3Record.EmployeeID}-${Date.now()}.pdf`;
    
    const file = new File([Buffer.from(pdfBuffer)], fileName, { type: 'application/pdf' });
    const uploadResponse = await utapi.uploadFiles([file]);
    
    if (!uploadResponse || !uploadResponse[0] || !uploadResponse[0].data || !uploadResponse[0].data.url) {
      throw new Error('Error al subir el PDF a UploadThing');
    }
    
    const fileUrl = uploadResponse[0].data.url;
    
    return { pdfBuffer, fileUrl };

  } catch (error) {
    console.error('Error al generar PDF DC3:', error);
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

// GET: Obtener todos los registros
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
        e.Status,
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          ELSE 'PROJECT'
        END as tipo,
        trainer_bp.FirstName as TrainerFirstName,
        trainer_bp.LastName as TrainerLastName,
        trainer_bp.MiddleName as TrainerMiddleName
      FROM employeedc3 dc
      INNER JOIN employees e ON e.EmployeeID = dc.EmployeeID
      LEFT JOIN basepersonnel bp ON dc.EmployeeID = bp.EmployeeID
      LEFT JOIN projectpersonnel pp ON dc.EmployeeID = pp.EmployeeID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN employees trainer_emp ON dc.TrainerID = trainer_emp.EmployeeID AND dc.TrainerID IS NOT NULL
      LEFT JOIN basepersonnel trainer_bp ON dc.TrainerID = trainer_bp.EmployeeID AND dc.TrainerID IS NOT NULL
      LEFT JOIN projectpersonnel trainer_pp ON dc.TrainerID = trainer_pp.EmployeeID AND dc.TrainerID IS NOT NULL
      WHERE e.Status = 1 AND (
          bp.EmployeeID IS NOT NULL
          OR pc.Status = 1
      )
      ORDER BY dc.StartDate DESC, dc.DC3ID DESC
    `);

    const dc3Records = rows as any[];

    const processedRecords = dc3Records.map((record: any) => {
      let trainerName = null;
      let isExternalTrainer = false;
      
      // Verificar si es instructor externo
      if (record.TrainerID === null && record.DocumentURL) {
        const extName = extractExternalTrainerName(record.DocumentURL);
        if (extName) {
          trainerName = extName;
          isExternalTrainer = true;
        }
      } else if (record.TrainerID !== null && record.TrainerFirstName) {
        trainerName = [
          record.TrainerFirstName || '',
          record.TrainerLastName || '',
          record.TrainerMiddleName || ''
        ].filter(part => part.trim() !== '').join(' ');
      }
      
      return {
        ...record,
        TrainerName: trainerName,
        isExternalTrainer: isExternalTrainer
      };
    });

    return NextResponse.json({
      success: true,
      records: processedRecords
    });

  } catch (error) {
    console.error('Error al obtener registros DC3:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL OBTENER REGISTROS DC3',
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

// POST: Crear nuevo registro DC3
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
      SpecificOccupation,
      CourseName,
      StartDate,
      EndDate,
      Area,
      TrainerID,
      TrainerName,
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

    if (new Date(StartDate) > new Date(EndDate)) {
      return NextResponse.json(
        { success: false, message: 'LA FECHA DE FIN DEBE SER POSTERIOR A LA FECHA DE INICIO' },
        { status: 400 }
      );
    }

    if (Duration && (typeof Duration !== 'number' || Duration <= 0 || !Number.isInteger(Duration))) {
      return NextResponse.json(
        { success: false, message: 'La duración debe ser un número entero positivo' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    await connection.beginTransaction();

    try {
      // Verificar empleado
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

      // Determinar el instructor
      let finalTrainerId = null;
      let isExternalTrainer = false;
      let externalTrainerName = null;

      // Si TrainerName tiene valor → instructor externo
      if (TrainerName && TrainerName.trim() !== '') {
        finalTrainerId = null;
        isExternalTrainer = true;
        externalTrainerName = TrainerName.trim();
      } 
      // Si TrainerID es número > 0 → instructor interno
      else if (TrainerID !== undefined && TrainerID !== null && TrainerID !== '' && Number(TrainerID) > 0) {
        const trainerIdNum = Number(TrainerID);
        const trainerExists = await verifyTrainerExists(connection, trainerIdNum);
        if (!trainerExists) {
          throw new Error(`El instructor con ID ${trainerIdNum} no existe`);
        }
        finalTrainerId = trainerIdNum;
        isExternalTrainer = false;
      } else {
        throw new Error('Debe seleccionar un instructor interno o especificar un instructor externo');
      }

      const startDateFormatted = formatearFechaMySQL(StartDate);
      const endDateFormatted = formatearFechaMySQL(EndDate);

      // Insertar el registro
      let initialDocumentURL = null;
      if (isExternalTrainer && externalTrainerName) {
        initialDocumentURL = `EXT:${externalTrainerName}`;
      }

      const [result] = await connection.execute(
        `INSERT INTO employeedc3 
         (EmployeeID, SpecificOccupation, CourseName, StartDate, EndDate, Area, TrainerID, Duration, DocumentURL) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          EmployeeID,
          SpecificOccupation || null,
          CourseName,
          startDateFormatted,
          endDateFormatted,
          Area || null,
          finalTrainerId,
          Duration || null,
          initialDocumentURL
        ]
      );

      const dc3Id = (result as any).insertId;
      await connection.commit();

      // Generar PDF
      let fileUrl = null;
      try {
        await new Promise(resolve => setTimeout(resolve, 200));
        const { fileUrl: pdfUrl } = await generateDC3PDF(dc3Id);
        fileUrl = pdfUrl;
        
        const updateConnection = await getConnection();
        try {
          let finalDocUrl = pdfUrl;
          
          // Si es instructor externo, guardar el nombre en DocumentURL
          if (isExternalTrainer && externalTrainerName) {
            finalDocUrl = `PDF:${pdfUrl}|EXT:${externalTrainerName}`;
          }
          
          await updateConnection.execute(
            `UPDATE employeedc3 SET DocumentURL = ? WHERE DC3ID = ?`,
            [finalDocUrl, dc3Id]
          );
        } finally {
          await updateConnection.release();
        }
      } catch (pdfError) {
        console.error('Error al generar/subir PDF:', pdfError);
      }

      return NextResponse.json({
        success: true,
        message: fileUrl ? 'Registro DC3 creado exitosamente' : 'Registro DC3 creado exitosamente (sin PDF)',
        dc3Id: dc3Id,
        fileUrl: fileUrl
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al crear registro DC3:', error);
    
    let errorMessage = 'ERROR AL CREAR EL REGISTRO DC3';
    
    if (error instanceof Error) {
      if (error.message.includes('foreign key constraint')) {
        errorMessage = 'ERROR: El empleado o instructor seleccionado no existe';
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
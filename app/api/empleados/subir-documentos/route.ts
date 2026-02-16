import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import { UTApi } from 'uploadthing/server';

// Función para subir archivo a UploadThing
async function uploadFileToUploadThing(fileBuffer: ArrayBuffer, fileName: string, fileType: string): Promise<string> {
  try {
    const utapi = new UTApi();
    
    // Crear un Blob desde el ArrayBuffer
    const blob = new Blob([fileBuffer], { type: fileType });
    
    // Convertir Blob a File
    const file = new File([blob], fileName, { type: fileType });
    
    // Subir el archivo a UploadThing
    const uploadResponse = await utapi.uploadFiles([file]);
    
    if (!uploadResponse || !uploadResponse[0]) {
      throw new Error('No se recibió respuesta de UploadThing');
    }
    
    const uploadedFile = uploadResponse[0];
    
    // Verificar si hay error
    if (uploadedFile.error) {
      throw new Error(uploadedFile.error.message || 'Error al subir el archivo');
    }
    
    // Obtener la URL según la estructura de UploadThing (usar ufsUrl para v9+)
    let fileUrl: string | undefined;
    
    // Para UploadThing v9+ (recomendado)
    if ('ufsUrl' in uploadedFile) {
      fileUrl = (uploadedFile as any).ufsUrl;
    } 
    // Para versiones anteriores (deprecated pero funciona)
    else if (uploadedFile.data?.url) {
      fileUrl = uploadedFile.data.url;
    } else if ('serverData' in uploadedFile) {
      fileUrl = (uploadedFile as any).serverData?.url;
    }
    
    if (!fileUrl) {
      console.warn('Estructura de UploadThing recibida:', JSON.stringify(uploadedFile, null, 2));
      throw new Error('No se pudo obtener la URL del archivo subido');
    }
    
    return fileUrl;
    
  } catch (error) {
    console.error('Error al subir archivo a UploadThing:', error);
    throw new Error(`Error al subir archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

// Función para generar el PDF FT-RH-02
async function generateFT_RH_02_PDF(empleadoId: string): Promise<ArrayBuffer> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const pdfUrl = `${baseUrl}/api/download/pdf/FT-RH-02?empleadoId=${empleadoId}&preview=1`;
    
    console.log(`Generando FT-RH-02 desde: ${pdfUrl}`);
    
    const response = await fetch(pdfUrl);
    
    if (!response.ok) {
      throw new Error(`Error al generar PDF FT-RH-02: ${response.status} ${response.statusText}`);
    }
    
    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error al generar PDF FT-RH-02:', error);
    throw error;
  }
}

// Función para generar el PDF FT-RH-04
async function generateFT_RH_04_PDF(empleadoId: string): Promise<ArrayBuffer> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const pdfUrl = `${baseUrl}/api/download/pdf/FT-RH-04?empleadoId=${empleadoId}&preview=1`;
    
    console.log(`Generando FT-RH-04 desde: ${pdfUrl}`);
    
    const response = await fetch(pdfUrl);
    
    if (!response.ok) {
      throw new Error(`Error al generar PDF FT-RH-04: ${response.status} ${response.statusText}`);
    }
    
    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error al generar PDF FT-RH-04:', error);
    throw error;
  }
}

// Función para generar el PDF FT-RH-07
async function generateFT_RH_07_PDF(empleadoId: string): Promise<ArrayBuffer> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const pdfUrl = `${baseUrl}/api/download/pdf/FT-RH-07?empleadoId=${empleadoId}&preview=1`;
    
    console.log(`Generando FT-RH-07 desde: ${pdfUrl}`);
    
    const response = await fetch(pdfUrl);
    
    if (!response.ok) {
      throw new Error(`Error al generar PDF FT-RH-07: ${response.status} ${response.statusText}`);
    }
    
    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error al generar PDF FT-RH-07:', error);
    throw error;
  }
}

// Función para generar el PDF FT-RH-29
async function generateFT_RH_29_PDF(empleadoId: string): Promise<ArrayBuffer> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const pdfUrl = `${baseUrl}/api/download/pdf/FT-RH-29?empleadoId=${empleadoId}&preview=1`;
    
    console.log(`Generando FT-RH-29 desde: ${pdfUrl}`);
    
    const response = await fetch(pdfUrl);
    
    if (!response.ok) {
      throw new Error(`Error al generar PDF FT-RH-29: ${response.status} ${response.statusText}`);
    }
    
    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error al generar PDF FT-RH-29:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  let connection;
  
  try {
    // Validar sesión
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    // Validar y renovar la sesión
    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

    // Verificar permisos
    if (user.UserTypeID !== 2) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    // Obtener formData
    const formData = await request.formData();
    
    const empleadoId = formData.get('empleadoId') as string;
    const tipoPersonal = formData.get('tipoPersonal') as string;
    
    if (!empleadoId || !tipoPersonal) {
      return NextResponse.json(
        { success: false, message: 'ID de empleado y tipo de personal requeridos' },
        { status: 400 }
      );
    }

    console.log(`Procesando documentos para empleado ID: ${empleadoId}, tipo: ${tipoPersonal}`);

    // Obtener conexión a la base de datos
    connection = await getConnection();

    // **PASO 1: Obtener el ID específico según el tipo de personal**
    let specificPersonnelId: number | null = null;
    
    if (tipoPersonal === 'base') {
      // Obtener BasePersonnelID a partir del EmployeeID
      const [baseRows] = await connection.execute(
        `SELECT BasePersonnelID FROM basepersonnel WHERE EmployeeID = ?`,
        [empleadoId]
      );
      
      if (Array.isArray(baseRows) && baseRows.length > 0) {
        specificPersonnelId = (baseRows as any[])[0].BasePersonnelID;
      }
    } else {
      // Obtener ProjectPersonnelID a partir del EmployeeID
      const [projectRows] = await connection.execute(
        `SELECT ProjectPersonnelID FROM projectpersonnel WHERE EmployeeID = ?`,
        [empleadoId]
      );
      
      if (Array.isArray(projectRows) && projectRows.length > 0) {
        specificPersonnelId = (projectRows as any[])[0].ProjectPersonnelID;
      }
    }

    if (!specificPersonnelId) {
      return NextResponse.json(
        { success: false, message: 'No se encontró el registro del empleado' },
        { status: 404 }
      );
    }

    console.log(`ID específico encontrado: ${specificPersonnelId} para tipo: ${tipoPersonal}`);

    // **PASO 2: Generar PDFs**
    let contractFileURL: string | null = null;
    let warningFileURL: string | null = null;
    let letterFileURL: string | null = null;
    let agreementFileURL: string | null = null;

    try {
      // Generar el PDF FT-RH-02
      try {
        const ftRh02PdfBuffer = await generateFT_RH_02_PDF(empleadoId);
        const ftRh02FileName = `FT-RH-02_${tipoPersonal}_${empleadoId}_${Date.now()}.pdf`;
        contractFileURL = await uploadFileToUploadThing(ftRh02PdfBuffer, ftRh02FileName, 'application/pdf');
        console.log('FT-RH-02 generado:', contractFileURL);
      } catch (error) {
        console.error('Error generando FT-RH-02:', error);
      }
      
      // Generar el PDF FT-RH-04
      try {
        const ftRh04PdfBuffer = await generateFT_RH_04_PDF(empleadoId);
        const ftRh04FileName = `FT-RH-04_${tipoPersonal}_${empleadoId}_${Date.now()}.pdf`;
        warningFileURL = await uploadFileToUploadThing(ftRh04PdfBuffer, ftRh04FileName, 'application/pdf');
        console.log('FT-RH-04 generado:', warningFileURL);
      } catch (error) {
        console.error('Error generando FT-RH-04:', error);
      }
      
      // Generar el PDF FT-RH-07
      try {
        const ftRh07PdfBuffer = await generateFT_RH_07_PDF(empleadoId);
        const ftRh07FileName = `FT-RH-07_${tipoPersonal}_${empleadoId}_${Date.now()}.pdf`;
        letterFileURL = await uploadFileToUploadThing(ftRh07PdfBuffer, ftRh07FileName, 'application/pdf');
        console.log('FT-RH-07 generado:', letterFileURL);
      } catch (error) {
        console.error('Error generando FT-RH-07:', error);
      }
      
      // Generar el PDF FT-RH-29
      try {
        const ftRh29PdfBuffer = await generateFT_RH_29_PDF(empleadoId);
        const ftRh29FileName = `FT-RH-29_${tipoPersonal}_${empleadoId}_${Date.now()}.pdf`;
        agreementFileURL = await uploadFileToUploadThing(ftRh29PdfBuffer, ftRh29FileName, 'application/pdf');
        console.log('FT-RH-29 generado:', agreementFileURL);
      } catch (error) {
        console.error('Error generando FT-RH-29:', error);
      }
      
    } catch (pdfError) {
      console.error('Error general al generar PDFs:', pdfError);
      // Continuar con el proceso aunque fallen los PDFs
    }

    // **PASO 3: Actualizar la base de datos con las URLs de los PDFs**
    try {
      await connection.beginTransaction();
      
      if (tipoPersonal === 'base') {
        // Verificar si existe el registro en basecontracts
        const [contractExists] = await connection.execute(
          `SELECT ContractID FROM basecontracts WHERE BasePersonnelID = ?`,
          [specificPersonnelId]
        );
        
        if (Array.isArray(contractExists) && contractExists.length > 0) {
          // Actualizar registro existente
          await connection.execute(
            `UPDATE basecontracts 
             SET ContractFileURL = ?, WarningFileURL = ?, LetterFileURL = ?, AgreementFileURL = ?
             WHERE BasePersonnelID = ?`,
            [contractFileURL, warningFileURL, letterFileURL, agreementFileURL, specificPersonnelId]
          );
        } else {
          // Insertar nuevo registro si no existe
          await connection.execute(
            `INSERT INTO basecontracts 
             (BasePersonnelID, ContractFileURL, WarningFileURL, LetterFileURL, AgreementFileURL) 
             VALUES (?, ?, ?, ?, ?)`,
            [specificPersonnelId, contractFileURL, warningFileURL, letterFileURL, agreementFileURL]
          );
        }
        
        console.log(`Base de datos actualizada para BasePersonnelID: ${specificPersonnelId}`);
      } else {
        // Verificar si existe el registro en projectcontracts
        const [contractExists] = await connection.execute(
          `SELECT ContractID FROM projectcontracts WHERE ProjectPersonnelID = ?`,
          [specificPersonnelId]
        );
        
        if (Array.isArray(contractExists) && contractExists.length > 0) {
          // Actualizar registro existente
          await connection.execute(
            `UPDATE projectcontracts 
             SET ContractFileURL = ?, WarningFileURL = ?, LetterFileURL = ?, AgreementFileURL = ?
             WHERE ProjectPersonnelID = ?`,
            [contractFileURL, warningFileURL, letterFileURL, agreementFileURL, specificPersonnelId]
          );
        } else {
          // Insertar nuevo registro si no existe
          await connection.execute(
            `INSERT INTO projectcontracts 
             (ProjectPersonnelID, ContractFileURL, WarningFileURL, LetterFileURL, AgreementFileURL) 
             VALUES (?, ?, ?, ?, ?)`,
            [specificPersonnelId, contractFileURL, warningFileURL, letterFileURL, agreementFileURL]
          );
        }
        
        console.log(`Base de datos actualizada para ProjectPersonnelID: ${specificPersonnelId}`);
      }
      
      await connection.commit();
      console.log('Base de datos actualizada con URLs de PDFs');
    } catch (dbError) {
      if (connection) {
        await connection.rollback();
      }
      console.error('Error al actualizar base de datos:', dbError);
      // No lanzamos el error para que la respuesta sea exitosa pero con advertencia
    }

    return NextResponse.json({
      success: true,
      message: 'Documentos procesados exitosamente',
      empleadoId,
      specificPersonnelId,
      contractFileURL,
      warningFileURL,
      letterFileURL,
      agreementFileURL
    });

  } catch (error) {
    console.error('Error al procesar documentos:', error);
    
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error al hacer rollback:', rollbackError);
      }
    }
    
    let errorMessage = 'Error al procesar los documentos';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { success: false, message: errorMessage },
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

export async function GET() {
  return NextResponse.json(
    { message: 'MÉTODO NO PERMITIDO' },
    { status: 405 }
  );
}
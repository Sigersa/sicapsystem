// app/api/administrative-personnel-dashboard/employee-management/query-update/update/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import { UTApi } from 'uploadthing/server';

// Función para normalizar texto a mayúsculas manteniendo acentos
const normalizarMayusculas = (texto: string): string => {
  if (!texto) return '';
  return texto.toUpperCase();
};

// Función para formatear fecha correctamente para MySQL (YYYY-MM-DD)
const formatearFechaMySQL = (fecha: string): string | null => {
  if (!fecha) return null;
  
  try {
    if (fecha.includes('T')) {
      return fecha.split('T')[0];
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return fecha;
    }
    return fecha;
  } catch {
    return null;
  }
};

// Función para subir archivo a UploadThing
async function uploadFileToUploadThing(fileBuffer: ArrayBuffer, fileName: string, fileType: string): Promise<string> {
  try {
    const utapi = new UTApi();
    
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
    throw new Error(`Error al subir archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

// Función para generar el PDF FT-RH-02 (espera a que los datos estén guardados)
async function generateFT_RH_02_PDF(empleadoId: string, tipo: string, baseUrl: string): Promise<ArrayBuffer> {
  const pdfUrl = `${baseUrl}/api/download/pdf/FT-RH-02?empleadoId=${empleadoId}&tipo=${tipo}&_t=${Date.now()}`;
  
  const response = await fetch(pdfUrl);
  
  if (!response.ok) {
    throw new Error(`Error al generar PDF FT-RH-02: ${response.statusText}`);
  }
  
  return await response.arrayBuffer();
}

// Función para generar el PDF FT-RH-04
async function generateFT_RH_04_PDF(empleadoId: string, tipo: string, baseUrl: string): Promise<ArrayBuffer> {
  const pdfUrl = `${baseUrl}/api/download/pdf/FT-RH-04?empleadoId=${empleadoId}&tipo=${tipo}&_t=${Date.now()}`;
  
  const response = await fetch(pdfUrl);
  
  if (!response.ok) {
    throw new Error(`Error al generar PDF FT-RH-04: ${response.statusText}`);
  }
  
  return await response.arrayBuffer();
}

// Función para generar el PDF FT-RH-07
async function generateFT_RH_07_PDF(empleadoId: string, tipo: string, baseUrl: string): Promise<ArrayBuffer> {
  const pdfUrl = `${baseUrl}/api/download/pdf/FT-RH-07?empleadoId=${empleadoId}&tipo=${tipo}&_t=${Date.now()}`;
  
  const response = await fetch(pdfUrl);
  
  if (!response.ok) {
    throw new Error(`Error al generar PDF FT-RH-07: ${response.statusText}`);
  }
  
  return await response.arrayBuffer();
}

// Función para generar el PDF FT-RH-29
async function generateFT_RH_29_PDF(empleadoId: string, tipo: string, baseUrl: string): Promise<ArrayBuffer> {
  const pdfUrl = `${baseUrl}/api/download/pdf/FT-RH-29?empleadoId=${empleadoId}&tipo=${tipo}&_t=${Date.now()}`;
  
  const response = await fetch(pdfUrl);
  
  if (!response.ok) {
    throw new Error(`Error al generar PDF FT-RH-29: ${response.statusText}`);
  }
  
  return await response.arrayBuffer();
}

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

    if (user.UserTypeID !== 2 && user.UserTypeID !== 1) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const employeeId = id;
    const formData = await request.json();
    const { tipo, personalInfo, personalInfoExtra, contractInfo, documentacion, beneficiario } = formData;

    if (!employeeId || !tipo) {
      return NextResponse.json(
        { success: false, message: 'ID de empleado y tipo son requeridos' },
        { status: 400 }
      );
    }

    console.log('=== DATOS RECIBIDOS ===');
    console.log('employeeId:', employeeId);
    console.log('tipo:', tipo);
    console.log('=======================');

    connection = await getConnection();
    await connection.beginTransaction();

    try {
      // Verificar el estado del empleado
      const [employeeStatusRows] = await connection.execute(
        'SELECT Status FROM employees WHERE EmployeeID = ?',
        [employeeId]
      ) as any;

      if (!employeeStatusRows || employeeStatusRows.length === 0) {
        throw new Error('Empleado no encontrado');
      }

      const currentStatus = employeeStatusRows[0].Status;
      console.log('currentStatus:', currentStatus);

      // Si el empleado está activo, NO permitir actualización de información laboral
      if (currentStatus === 1 && contractInfo && Object.keys(contractInfo).length > 0) {
        if (tipo === 'PROJECT') {
          await connection.rollback();
          return NextResponse.json(
            { 
              success: false, 
              message: 'NO SE PUEDE ACTUALIZAR INFORMACIÓN LABORAL. EL EMPLEADO DE PROYECTO ESTÁ ACTIVO. PRIMERO DEBE REALIZAR LA BAJA.' 
            },
            { status: 403 }
          );
        }
        if (tipo === 'BASE') {
          const hasLaboralChanges = 
            contractInfo.salaryIMSS !== undefined ||
            contractInfo.startDate !== undefined ||
            contractInfo.jefeDirectoId !== undefined;
          
          if (hasLaboralChanges) {
            await connection.rollback();
            return NextResponse.json(
              { 
                success: false, 
                message: 'NO SE PUEDE ACTUALIZAR INFORMACIÓN LABORAL. EL EMPLEADO ESTÁ ACTIVO. PRIMERO DEBE REALIZAR LA BAJA.' 
              },
              { status: 403 }
            );
          }
        }
      }

      let basePersonnelId: number | null = null;
      let projectPersonnelId: number | null = null;
      let shouldGenerateDocuments = false;
      let contractId: number | null = null;
      let documentGenerationReason = '';

      if (tipo === 'BASE') {
        const [baseRows] = await connection.execute(
          'SELECT BasePersonnelID FROM basepersonnel WHERE EmployeeID = ?',
          [employeeId]
        ) as any;

        if (!baseRows || baseRows.length === 0) {
          throw new Error('Empleado base no encontrado');
        }

        basePersonnelId = baseRows[0].BasePersonnelID;

        // Actualizar información personal básica
        if (personalInfo) {
          const { firstName, lastName, middleName, position, area, salary, workSchedule } = personalInfo;

          await connection.execute(
            `UPDATE basepersonnel 
             SET FirstName = ?, LastName = ?, MiddleName = ?, 
                 Position = ?, Area = ?, Salary = ?, WorkSchedule = ?
             WHERE BasePersonnelID = ?`,
            [
              normalizarMayusculas(firstName || ''),
              normalizarMayusculas(lastName || ''),
              normalizarMayusculas(middleName || ''),
              normalizarMayusculas(position || ''),
              normalizarMayusculas(area || ''),
              salary || 0,
              normalizarMayusculas(workSchedule || ''),
              basePersonnelId
            ]
          );
        }

        // Actualizar información personal adicional
        if (personalInfoExtra) {
          const {
            calle, numeroExterior, numeroInterior, colonia,
            municipio, estado, codigoPostal,
            municipality, nationality, gender, birthdate,
            maritalStatus, rfc, curp, nss, nci, umf, phone, email
          } = personalInfoExtra;

          const fechaNacimientoFormateada = formatearFechaMySQL(birthdate);

          const [infoRows] = await connection.execute(
            'SELECT * FROM basepersonnelpersonalinfo WHERE BasePersonnelID = ?',
            [basePersonnelId]
          ) as any;

          if (infoRows && infoRows.length > 0) {
            await connection.execute(
              `UPDATE basepersonnelpersonalinfo 
               SET Municipality = ?, Nationality = ?, Gender = ?, 
                   Birthdate = ?, MaritalStatus = ?, RFC = ?, CURP = ?, NSS = ?,
                   NCI = ?, UMF = ?, Phone = ?, Email = ?,
                   Street = ?, ExteriorNumber = ?, InteriorNumber = ?, 
                   Suburb = ?, State = ?, ZipCode = ?
               WHERE BasePersonnelID = ?`,
              [
                normalizarMayusculas(municipio || municipality || ''),
                normalizarMayusculas(nationality || ''),
                normalizarMayusculas(gender || ''),
                fechaNacimientoFormateada,
                normalizarMayusculas(maritalStatus || ''),
                normalizarMayusculas(rfc || ''),
                normalizarMayusculas(curp || ''),
                nss || '',
                normalizarMayusculas(nci || ''),
                umf || null,
                phone || '',
                email ? email.toLowerCase().trim() : '',
                normalizarMayusculas(calle || ''),
                numeroExterior || null,
                numeroInterior || null,
                normalizarMayusculas(colonia || ''),
                normalizarMayusculas(estado || ''),
                codigoPostal || null,
                basePersonnelId
              ]
            );
          } else {
            await connection.execute(
              `INSERT INTO basepersonnelpersonalinfo 
               (BasePersonnelID, Municipality, Nationality, Gender, Birthdate, 
                MaritalStatus, RFC, CURP, NSS, NCI, UMF, Phone, Email,
                Street, ExteriorNumber, InteriorNumber, Suburb, State, ZipCode) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                basePersonnelId,
                normalizarMayusculas(municipio || municipality || ''),
                normalizarMayusculas(nationality || ''),
                normalizarMayusculas(gender || ''),
                fechaNacimientoFormateada,
                normalizarMayusculas(maritalStatus || ''),
                normalizarMayusculas(rfc || ''),
                normalizarMayusculas(curp || ''),
                nss || '',
                normalizarMayusculas(nci || ''),
                umf || null,
                phone || '',
                email ? email.toLowerCase().trim() : '',
                normalizarMayusculas(calle || ''),
                numeroExterior || null,
                numeroInterior || null,
                normalizarMayusculas(colonia || ''),
                normalizarMayusculas(estado || ''),
                codigoPostal || null
              ]
            );
          }
        }

        // Actualizar contractInfo para BASE
        if (contractInfo && currentStatus === 0) {
          const { startDate, salaryIMSS, jefeDirectoId } = contractInfo;
          const fechaInicioFormateada = formatearFechaMySQL(startDate);

          const [contractRows] = await connection.execute(
            'SELECT ContractID FROM basecontracts WHERE BasePersonnelID = ?',
            [basePersonnelId]
          ) as any;

          if (contractRows && contractRows.length > 0) {
            contractId = contractRows[0].ContractID;
            await connection.execute(
              `UPDATE basecontracts 
               SET StartDate = ?, SalaryIMSS = ?, jefeDirectoId = ?
               WHERE BasePersonnelID = ?`,
              [
                fechaInicioFormateada,
                salaryIMSS || null,
                jefeDirectoId || null,
                basePersonnelId
              ]
            );
            shouldGenerateDocuments = true;
            documentGenerationReason = 'Actualización de contrato existente para empleado BASE inactivo';
            console.log(`Contrato existente actualizado para empleado BASE ${employeeId}, se generarán documentos`);
          } else {
            const [insertResult] = await connection.execute(
              `INSERT INTO basecontracts 
               (BasePersonnelID, StartDate, SalaryIMSS, jefeDirectoId) 
               VALUES (?, ?, ?, ?)`,
              [
                basePersonnelId,
                fechaInicioFormateada,
                salaryIMSS || null,
                jefeDirectoId || null
              ]
            ) as any;
            contractId = insertResult.insertId;
            shouldGenerateDocuments = true;
            documentGenerationReason = 'Nuevo contrato para empleado BASE (activación)';
            
            await connection.execute(
              'UPDATE employees SET Status = 1 WHERE EmployeeID = ?',
              [employeeId]
            );
            console.log(`Nuevo contrato creado para empleado BASE ${employeeId}, se generarán documentos`);
          }
        } else if (personalInfo && currentStatus === 1) {
          // Si solo se actualizó información personal (no laboral) y el empleado está activo
          // No regeneramos documentos automáticamente a menos que se soliciten cambios en documentación
          console.log(`Solo actualización de información personal para empleado BASE activo ${employeeId}`);
        }

        // Actualizar documentación
        if (documentacion) {
          const [docRows] = await connection.execute(
            'SELECT * FROM basepersonneldocumentation WHERE BasePersonnelID = ?',
            [basePersonnelId]
          ) as any;

          if (docRows && docRows.length > 0) {
            await connection.execute(
              `UPDATE basepersonneldocumentation 
               SET CVFileURL = ?, ANFileURL = ?, CURPFileURL = ?, RFCFileURL = ?,
                   IMSSFileURL = ?, INEFileURL = ?, CDFileURL = ?, CEFileURL = ?,
                   CPFileURL = ?, LMFileURL = ?, ANPFileURL = ?, CRFileURL = ?,
                   RIFileURL = ?, EMFileURL = ?, FotoFileURL = ?, FolletoFileURL = ?
               WHERE BasePersonnelID = ?`,
              [
                documentacion.CVFileURL || null,
                documentacion.ANFileURL || null,
                documentacion.CURPFileURL || null,
                documentacion.RFCFileURL || null,
                documentacion.IMSSFileURL || null,
                documentacion.INEFileURL || null,
                documentacion.CDFileURL || null,
                documentacion.CEFileURL || null,
                documentacion.CPFileURL || null,
                documentacion.LMFileURL || null,
                documentacion.ANPFileURL || null,
                documentacion.CRFileURL || null,
                documentacion.RIFileURL || null,
                documentacion.EMFileURL || null,
                documentacion.FotoFileURL || null,
                documentacion.FolletoFileURL || null,
                basePersonnelId
              ]
            );
          } else {
            await connection.execute(
              `INSERT INTO basepersonneldocumentation 
               (BasePersonnelID, CVFileURL, ANFileURL, CURPFileURL, RFCFileURL,
                IMSSFileURL, INEFileURL, CDFileURL, CEFileURL, CPFileURL,
                LMFileURL, ANPFileURL, CRFileURL, RIFileURL, EMFileURL,
                FotoFileURL, FolletoFileURL) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                basePersonnelId,
                documentacion.CVFileURL || null,
                documentacion.ANFileURL || null,
                documentacion.CURPFileURL || null,
                documentacion.RFCFileURL || null,
                documentacion.IMSSFileURL || null,
                documentacion.INEFileURL || null,
                documentacion.CDFileURL || null,
                documentacion.CEFileURL || null,
                documentacion.CPFileURL || null,
                documentacion.LMFileURL || null,
                documentacion.ANPFileURL || null,
                documentacion.CRFileURL || null,
                documentacion.RIFileURL || null,
                documentacion.EMFileURL || null,
                documentacion.FotoFileURL || null,
                documentacion.FolletoFileURL || null
              ]
            );
          }
        }

        // Actualizar beneficiario
        if (beneficiario) {
          const { 
            beneficiaryFirstName, beneficiaryLastName, beneficiaryMiddleName, 
            relationship, percentage 
          } = beneficiario;

          if (beneficiaryFirstName || beneficiaryLastName || relationship) {
            const [beneficiarioRows] = await connection.execute(
              'SELECT * FROM basepersonnelbeneficiaries WHERE BasePersonnelID = ?',
              [basePersonnelId]
            ) as any;

            if (beneficiarioRows && beneficiarioRows.length > 0) {
              await connection.execute(
                `UPDATE basepersonnelbeneficiaries 
                 SET BeneficiaryFirstName = ?, BeneficiaryLastName = ?, 
                     BeneficiaryMiddleName = ?, Relationship = ?, Percentage = ?
                 WHERE BasePersonnelID = ?`,
                [
                  normalizarMayusculas(beneficiaryFirstName || ''),
                  normalizarMayusculas(beneficiaryLastName || ''),
                  normalizarMayusculas(beneficiaryMiddleName || ''),
                  normalizarMayusculas(relationship || ''),
                  percentage || 0,
                  basePersonnelId
                ]
              );
            } else {
              await connection.execute(
                `INSERT INTO basepersonnelbeneficiaries 
                 (BasePersonnelID, BeneficiaryFirstName, BeneficiaryLastName, 
                  BeneficiaryMiddleName, Relationship, Percentage) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  basePersonnelId,
                  normalizarMayusculas(beneficiaryFirstName || ''),
                  normalizarMayusculas(beneficiaryLastName || ''),
                  normalizarMayusculas(beneficiaryMiddleName || ''),
                  normalizarMayusculas(relationship || ''),
                  percentage || 0
                ]
              );
            }
          }
        }

      } else {
        // ============================================
        // PERSONAL DE PROYECTO
        // ============================================
        const [projectRows] = await connection.execute(
          'SELECT ProjectPersonnelID FROM projectpersonnel WHERE EmployeeID = ?',
          [employeeId]
        ) as any;

        if (!projectRows || projectRows.length === 0) {
          throw new Error('Empleado de proyecto no encontrado');
        }

        projectPersonnelId = projectRows[0].ProjectPersonnelID;

        // Actualizar información personal básica
        if (personalInfo) {
          const { firstName, lastName, middleName } = personalInfo;

          await connection.execute(
            `UPDATE projectpersonnel 
             SET FirstName = ?, LastName = ?, MiddleName = ?
             WHERE ProjectPersonnelID = ?`,
            [
              normalizarMayusculas(firstName || ''),
              normalizarMayusculas(lastName || ''),
              normalizarMayusculas(middleName || ''),
              projectPersonnelId
            ]
          );
        }

        // Actualizar información personal adicional
        if (personalInfoExtra) {
          const {
            calle, numeroExterior, numeroInterior, colonia,
            municipio, estado, codigoPostal,
            municipality, nationality, gender, birthdate,
            maritalStatus, rfc, curp, nss, nci, umf, phone, email
          } = personalInfoExtra;

          const fechaNacimientoFormateada = formatearFechaMySQL(birthdate);

          const [infoRows] = await connection.execute(
            'SELECT * FROM projectpersonnelpersonalinfo WHERE ProjectPersonnelID = ?',
            [projectPersonnelId]
          ) as any;

          if (infoRows && infoRows.length > 0) {
            await connection.execute(
              `UPDATE projectpersonnelpersonalinfo 
               SET Municipality = ?, Nationality = ?, Gender = ?, 
                   Birthdate = ?, MaritalStatus = ?, RFC = ?, CURP = ?, NSS = ?,
                   NCI = ?, UMF = ?, Phone = ?, Email = ?,
                   Street = ?, ExteriorNumber = ?, InteriorNumber = ?, 
                   Suburb = ?, State = ?, ZipCode = ?
               WHERE ProjectPersonnelID = ?`,
              [
                normalizarMayusculas(municipio || municipality || ''),
                normalizarMayusculas(nationality || ''),
                normalizarMayusculas(gender || ''),
                fechaNacimientoFormateada,
                normalizarMayusculas(maritalStatus || ''),
                normalizarMayusculas(rfc || ''),
                normalizarMayusculas(curp || ''),
                nss || '',
                normalizarMayusculas(nci || ''),
                umf || null,
                phone || '',
                email ? email.toLowerCase().trim() : '',
                normalizarMayusculas(calle || ''),
                numeroExterior || null,
                numeroInterior || null,
                normalizarMayusculas(colonia || ''),
                normalizarMayusculas(estado || ''),
                codigoPostal || null,
                projectPersonnelId
              ]
            );
          } else {
            await connection.execute(
              `INSERT INTO projectpersonnelpersonalinfo 
               (ProjectPersonnelID, Municipality, Nationality, Gender, Birthdate, 
                MaritalStatus, RFC, CURP, NSS, NCI, UMF, Phone, Email,
                Street, ExteriorNumber, InteriorNumber, Suburb, State, ZipCode) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                projectPersonnelId,
                normalizarMayusculas(municipio || municipality || ''),
                normalizarMayusculas(nationality || ''),
                normalizarMayusculas(gender || ''),
                fechaNacimientoFormateada,
                normalizarMayusculas(maritalStatus || ''),
                normalizarMayusculas(rfc || ''),
                normalizarMayusculas(curp || ''),
                nss || '',
                normalizarMayusculas(nci || ''),
                umf || null,
                phone || '',
                email ? email.toLowerCase().trim() : '',
                normalizarMayusculas(calle || ''),
                numeroExterior || null,
                numeroInterior || null,
                normalizarMayusculas(colonia || ''),
                normalizarMayusculas(estado || ''),
                codigoPostal || null
              ]
            );
          }
        }

        // Actualizar contractInfo para PROJECT
        if (contractInfo && currentStatus === 0) {
          const { salaryIMSS, position, salary, workSchedule, projectId } = contractInfo;
          
          const [insertResult] = await connection.execute(
            `INSERT INTO projectcontracts 
             (ProjectPersonnelID, SalaryIMSS, Position, Salary, WorkSchedule, ProjectID, Status) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              projectPersonnelId,
              salaryIMSS || null,
              normalizarMayusculas(position || ''),
              salary || 1,
              normalizarMayusculas(workSchedule || ''),
              projectId || null,
              1
            ]
          ) as any;
          
          contractId = insertResult.insertId;
          shouldGenerateDocuments = true;
          documentGenerationReason = 'Nuevo contrato para empleado PROJECT (activación/recontratación)';
          
          await connection.execute(
            'UPDATE employees SET Status = 1 WHERE EmployeeID = ?',
            [employeeId]
          );
          
          console.log(`Nuevo contrato creado para empleado de proyecto ${employeeId} con ID: ${contractId}`);
        } else if (personalInfo && currentStatus === 1) {
          // Si solo se actualizó información personal (no laboral) y el empleado está activo
          // Forzamos regeneración de documentos para que reflejen los datos actualizados
          console.log(`Actualización de información personal para empleado PROJECT activo ${employeeId}, se regenerarán documentos`);
          shouldGenerateDocuments = true;
          documentGenerationReason = 'Actualización de información personal para empleado PROJECT activo';
          
          // Obtener el contrato más reciente para actualizar sus documentos
          const [lastContractRows] = await connection.execute(
            `SELECT ContractID FROM projectcontracts 
             WHERE ProjectPersonnelID = ? 
             ORDER BY ContractID DESC LIMIT 1`,
            [projectPersonnelId]
          ) as any;
          
          if (lastContractRows && lastContractRows.length > 0) {
            contractId = lastContractRows[0].ContractID;
          }
        }

        // Actualizar documentación
        if (documentacion) {
          const [docRows] = await connection.execute(
            'SELECT * FROM projectpersonneldocumentation WHERE ProjectPersonnelID = ?',
            [projectPersonnelId]
          ) as any;

          if (docRows && docRows.length > 0) {
            await connection.execute(
              `UPDATE projectpersonneldocumentation 
               SET CVFileURL = ?, ANFileURL = ?, CURPFileURL = ?, RFCFileURL = ?,
                   IMSSFileURL = ?, INEFileURL = ?, CDFileURL = ?, CEFileURL = ?,
                   CPFileURL = ?, LMFileURL = ?, ANPFileURL = ?, CRFileURL = ?,
                   RIFileURL = ?, EMFileURL = ?, FotoFileURL = ?, FolletoFileURL = ?
               WHERE ProjectPersonnelID = ?`,
              [
                documentacion.CVFileURL || null,
                documentacion.ANFileURL || null,
                documentacion.CURPFileURL || null,
                documentacion.RFCFileURL || null,
                documentacion.IMSSFileURL || null,
                documentacion.INEFileURL || null,
                documentacion.CDFileURL || null,
                documentacion.CEFileURL || null,
                documentacion.CPFileURL || null,
                documentacion.LMFileURL || null,
                documentacion.ANPFileURL || null,
                documentacion.CRFileURL || null,
                documentacion.RIFileURL || null,
                documentacion.EMFileURL || null,
                documentacion.FotoFileURL || null,
                documentacion.FolletoFileURL || null,
                projectPersonnelId
              ]
            );
          } else {
            await connection.execute(
              `INSERT INTO projectpersonneldocumentation 
               (ProjectPersonnelID, CVFileURL, ANFileURL, CURPFileURL, RFCFileURL,
                IMSSFileURL, INEFileURL, CDFileURL, CEFileURL, CPFileURL,
                LMFileURL, ANPFileURL, CRFileURL, RIFileURL, EMFileURL,
                FotoFileURL, FolletoFileURL) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                projectPersonnelId,
                documentacion.CVFileURL || null,
                documentacion.ANFileURL || null,
                documentacion.CURPFileURL || null,
                documentacion.RFCFileURL || null,
                documentacion.IMSSFileURL || null,
                documentacion.INEFileURL || null,
                documentacion.CDFileURL || null,
                documentacion.CEFileURL || null,
                documentacion.CPFileURL || null,
                documentacion.LMFileURL || null,
                documentacion.ANPFileURL || null,
                documentacion.CRFileURL || null,
                documentacion.RIFileURL || null,
                documentacion.EMFileURL || null,
                documentacion.FotoFileURL || null,
                documentacion.FolletoFileURL || null
              ]
            );
          }
        }

        // Actualizar beneficiario
        if (beneficiario) {
          const { 
            beneficiaryFirstName, beneficiaryLastName, beneficiaryMiddleName, 
            relationship, percentage 
          } = beneficiario;

          if (beneficiaryFirstName || beneficiaryLastName || relationship) {
            const [beneficiarioRows] = await connection.execute(
              'SELECT * FROM projectpersonnelbeneficiaries WHERE ProjectPersonnelID = ?',
              [projectPersonnelId]
            ) as any;

            if (beneficiarioRows && beneficiarioRows.length > 0) {
              await connection.execute(
                `UPDATE projectpersonnelbeneficiaries 
                 SET BeneficiaryFirstName = ?, BeneficiaryLastName = ?, 
                     BeneficiaryMiddleName = ?, Relationship = ?, Percentage = ?
                 WHERE ProjectPersonnelID = ?`,
                [
                  normalizarMayusculas(beneficiaryFirstName || ''),
                  normalizarMayusculas(beneficiaryLastName || ''),
                  normalizarMayusculas(beneficiaryMiddleName || ''),
                  normalizarMayusculas(relationship || ''),
                  percentage || 0,
                  projectPersonnelId
                ]
              );
            } else {
              await connection.execute(
                `INSERT INTO projectpersonnelbeneficiaries 
                 (ProjectPersonnelID, BeneficiaryFirstName, BeneficiaryLastName, 
                  BeneficiaryMiddleName, Relationship, Percentage) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  projectPersonnelId,
                  normalizarMayusculas(beneficiaryFirstName || ''),
                  normalizarMayusculas(beneficiaryLastName || ''),
                  normalizarMayusculas(beneficiaryMiddleName || ''),
                  normalizarMayusculas(relationship || ''),
                  percentage || 0
                ]
              );
            }
          }
        }
      }

      // IMPORTANTE: Confirmar la transacción ANTES de generar los PDFs
      await connection.commit();

      // Obtener información actualizada del empleado para la respuesta
      let employeeName = '';
      let employeePosition = '';
      let contractFileURL: string | null = null;
      let warningFileURL: string | null = null;
      let letterFileURL: string | null = null;
      let agreementFileURL: string | null = null;

      let newContractFileURL: string | null = null;
      let newWarningFileURL: string | null = null;
      let newLetterFileURL: string | null = null;
      let newAgreementFileURL: string | null = null;

      // Obtener datos actualizados después del commit
      if (tipo === 'BASE') {
        const [empRows] = await connection.execute(
          `SELECT bp.FirstName, bp.LastName, bp.MiddleName, bp.Position,
                  bc.ContractFileURL, bc.WarningFileURL, bc.LetterFileURL, bc.AgreementFileURL
           FROM basepersonnel bp
           LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID
           WHERE bp.EmployeeID = ?`,
          [employeeId]
        ) as any;
        
        if (empRows && empRows.length > 0) {
          const emp = empRows[0];
          employeeName = `${emp.FirstName || ''} ${emp.LastName || ''} ${emp.MiddleName || ''}`.trim();
          employeePosition = emp.Position || '';
          contractFileURL = emp.ContractFileURL;
          warningFileURL = emp.WarningFileURL;
          letterFileURL = emp.LetterFileURL;
          agreementFileURL = emp.AgreementFileURL;
        }
      } else if (tipo === 'PROJECT') {
        const [empRows] = await connection.execute(
          `SELECT pp.FirstName, pp.LastName, pp.MiddleName, pc.Position,
                  pc.ContractFileURL, pc.WarningFileURL, pc.LetterFileURL, pc.AgreementFileURL
           FROM projectpersonnel pp
           LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
           WHERE pp.EmployeeID = ?
           ORDER BY pc.ContractID DESC
           LIMIT 1`,
          [employeeId]
        ) as any;
        
        if (empRows && empRows.length > 0) {
          const emp = empRows[0];
          employeeName = `${emp.FirstName || ''} ${emp.LastName || ''} ${emp.MiddleName || ''}`.trim();
          employeePosition = emp.Position || '';
          contractFileURL = emp.ContractFileURL;
          warningFileURL = emp.WarningFileURL;
          letterFileURL = emp.LetterFileURL;
          agreementFileURL = emp.AgreementFileURL;
        }
      }

      console.log(`shouldGenerateDocuments: ${shouldGenerateDocuments}, contractId: ${contractId}`);
      
      // AHORA generar los PDFs DESPUÉS de que los datos están guardados en la BD
      if (shouldGenerateDocuments && contractId) {
        try {
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
          
          console.log(`Generando formatos FT-RH para empleado ${employeeId} (tipo: ${tipo}) con datos actualizados...`);
          
          // Esperar un breve momento para asegurar que la BD esté completamente actualizada
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const ftRh02PdfBuffer = await generateFT_RH_02_PDF(employeeId, tipo, baseUrl);
          const ftRh02FileName = `FT-RH-02_${tipo}_${employeeId}_${Date.now()}.pdf`;
          newContractFileURL = await uploadFileToUploadThing(ftRh02PdfBuffer, ftRh02FileName, 'application/pdf');
          
          const ftRh04PdfBuffer = await generateFT_RH_04_PDF(employeeId, tipo, baseUrl);
          const ftRh04FileName = `FT-RH-04_${tipo}_${employeeId}_${Date.now()}.pdf`;
          newWarningFileURL = await uploadFileToUploadThing(ftRh04PdfBuffer, ftRh04FileName, 'application/pdf');
          
          const ftRh07PdfBuffer = await generateFT_RH_07_PDF(employeeId, tipo, baseUrl);
          const ftRh07FileName = `FT-RH-07_${tipo}_${employeeId}_${Date.now()}.pdf`;
          newLetterFileURL = await uploadFileToUploadThing(ftRh07PdfBuffer, ftRh07FileName, 'application/pdf');
          
          const ftRh29PdfBuffer = await generateFT_RH_29_PDF(employeeId, tipo, baseUrl);
          const ftRh29FileName = `FT-RH-29_${tipo}_${employeeId}_${Date.now()}.pdf`;
          newAgreementFileURL = await uploadFileToUploadThing(ftRh29PdfBuffer, ftRh29FileName, 'application/pdf');
          
          console.log('=== URLs generadas con datos actualizados ===');
          console.log('FT-RH-02:', newContractFileURL);
          console.log('FT-RH-04:', newWarningFileURL);
          console.log('FT-RH-07:', newLetterFileURL);
          console.log('FT-RH-29:', newAgreementFileURL);
          
          // Actualizar las URLs en la base de datos
          const updateConnection = await getConnection();
          
          try {
            if (tipo === 'PROJECT') {
              await updateConnection.execute(
                `UPDATE projectcontracts 
                 SET ContractFileURL = ?,
                     WarningFileURL = ?,
                     LetterFileURL = ?,
                     AgreementFileURL = ?
                 WHERE ContractID = ?`,
                [newContractFileURL, newWarningFileURL, newLetterFileURL, newAgreementFileURL, contractId]
              );
              console.log(`Formatos FT-RH actualizados para contrato ${contractId} (PROJECT)`);
            } else if (tipo === 'BASE') {
              await updateConnection.execute(
                `UPDATE basecontracts 
                 SET ContractFileURL = ?,
                     WarningFileURL = ?,
                     LetterFileURL = ?,
                     AgreementFileURL = ?
                 WHERE ContractID = ?`,
                [newContractFileURL, newWarningFileURL, newLetterFileURL, newAgreementFileURL, contractId]
              );
              console.log(`Formatos FT-RH actualizados para contrato ${contractId} (BASE)`);
            }
          } finally {
            await updateConnection.release();
          }
          
          console.log('Formatos FT-RH generados con datos actualizados y guardados exitosamente');
          
          return NextResponse.json({
            success: true,
            message: currentStatus === 0 ? 'EMPLEADO ACTIVADO Y DOCUMENTOS GENERADOS CON DATOS ACTUALIZADOS' : 'EMPLEADO ACTUALIZADO Y DOCUMENTOS REGENERADOS CON DATOS ACTUALIZADOS',
            employeeId: employeeId,
            employeeName: employeeName,
            employeePosition: employeePosition,
            employeeType: tipo,
            contractFileURL: newContractFileURL,
            warningFileURL: newWarningFileURL,
            letterFileURL: newLetterFileURL,
            agreementFileURL: newAgreementFileURL
          });
          
        } catch (pdfError) {
          console.error('Error al generar PDFs con datos actualizados:', pdfError);
          return NextResponse.json({
            success: true,
            message: 'EMPLEADO ACTUALIZADO EXITOSAMENTE (PERO HUBO ERROR AL GENERAR LOS DOCUMENTOS PDF)',
            employeeId: employeeId,
            employeeName: employeeName,
            employeePosition: employeePosition,
            employeeType: tipo,
            contractFileURL: contractFileURL,
            warningFileURL: warningFileURL,
            letterFileURL: letterFileURL,
            agreementFileURL: agreementFileURL
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: 'EMPLEADO ACTUALIZADO EXITOSAMENTE',
        employeeId: employeeId,
        employeeName: employeeName,
        employeePosition: employeePosition,
        employeeType: tipo,
        contractFileURL: contractFileURL,
        warningFileURL: warningFileURL,
        letterFileURL: letterFileURL,
        agreementFileURL: agreementFileURL
      });

    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      throw error;
    }

  } catch (error) {
    console.error('Error al actualizar empleado:', error);
    
    let errorMessage = 'ERROR AL ACTUALIZAR EL EMPLEADO';
    
    if (error instanceof Error) {
      if (error.message.includes('foreign key constraint')) {
        errorMessage = 'ERROR: El proyecto seleccionado no existe';
      } else if (error.message.includes('date value')) {
        errorMessage = 'ERROR: Formato de fecha incorrecto';
      } else if (error.message.includes('EMPLEADO ESTÁ ACTIVO')) {
        errorMessage = 'NO SE PUEDE ACTUALIZAR INFORMACIÓN LABORAL. EL EMPLEADO ESTÁ ACTIVO. PRIMERO DEBE REALIZAR LA BAJA.';
      } else if (error.message.includes('Empleado no encontrado')) {
        errorMessage = 'ERROR: Empleado no encontrado';
      } else if (error.message.includes('EMPLEADO DE PROYECTO ESTÁ ACTIVO')) {
        errorMessage = 'NO SE PUEDE ACTUALIZAR INFORMACIÓN LABORAL. EL EMPLEADO DE PROYECTO ESTÁ ACTIVO. PRIMERO DEBE REALIZAR LA BAJA.';
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
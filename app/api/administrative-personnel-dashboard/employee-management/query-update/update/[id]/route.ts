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
    // Si es una fecha ISO con formato YYYY-MM-DDTHH:MM:SS.sssZ
    if (fecha.includes('T')) {
      return fecha.split('T')[0];
    }
    // Si ya está en formato YYYY-MM-DD
    return fecha;
  } catch {
    return null;
  }
};

// Función para eliminar archivo de UploadThing
async function deleteFileFromUploadThing(fileUrl: string): Promise<void> {
  try {
    if (!fileUrl) return;
    
    // Extraer el fileKey de la URL
    const urlParts = fileUrl.split('/');
    const fileKey = urlParts[urlParts.length - 1];
    
    if (!fileKey) return;
    
    const utapi = new UTApi();
    await utapi.deleteFiles([fileKey]);
    
    console.log('Archivo eliminado de UploadThing:', fileKey);
  } catch (error) {
    console.error('Error al eliminar archivo de UploadThing:', error);
    // No lanzamos error para no interrumpir el flujo principal
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let connection;
  
  try {
    // Desenvolver params con await
    const { id } = await params;
    
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

    // Verificar permisos (solo administradores)
    if (user.UserTypeID !== 2) {
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

    // Obtener conexión a la base de datos
    connection = await getConnection();
    
    // Iniciar transacción
    await connection.beginTransaction();

    try {
      if (tipo === 'BASE') {
        // Obtener BasePersonnelID desde EmployeeID
        const [baseRows] = await connection.execute(
          'SELECT BasePersonnelID FROM basepersonnel WHERE EmployeeID = ?',
          [employeeId]
        );

        if (!Array.isArray(baseRows) || baseRows.length === 0) {
          throw new Error('Empleado base no encontrado');
        }

        const basePersonnelId = (baseRows as any[])[0].BasePersonnelID;

        // Actualizar información personal base
        if (personalInfo) {
          const { 
            firstName, lastName, middleName, position, area, salary, workSchedule 
          } = personalInfo;

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

        // Actualizar información personal adicional - NUEVA ESTRUCTURA
        if (personalInfoExtra) {
          const {
            // Campos de dirección separados
            calle, numeroExterior, numeroInterior, colonia,
            municipio, estado, codigoPostal,
            // Campos existentes
            municipality, nationality, gender, birthdate,
            maritalStatus, rfc, curp, nss, nci, umf, phone, email
          } = personalInfoExtra;

          const fechaNacimientoFormateada = formatearFechaMySQL(birthdate);

          const [infoRows] = await connection.execute(
            'SELECT * FROM basepersonnelpersonalinfo WHERE BasePersonnelID = ?',
            [basePersonnelId]
          );

          if (Array.isArray(infoRows) && infoRows.length > 0) {
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

        // Actualizar información de contrato
        if (contractInfo) {
          const { 
            startDate, salaryIMSS, 
            contractFileURL, warningFileURL, letterFileURL, agreementFileURL 
          } = contractInfo;
          
          const fechaInicioFormateada = formatearFechaMySQL(startDate);

          // Obtener URLs actuales para eliminar archivos viejos si se reemplazan
          const [currentContractRows] = await connection.execute(
            'SELECT ContractFileURL, WarningFileURL, LetterFileURL, AgreementFileURL FROM basecontracts WHERE BasePersonnelID = ?',
            [basePersonnelId]
          );

          if (Array.isArray(currentContractRows) && currentContractRows.length > 0) {
            const current = currentContractRows[0] as any;
            
            if (contractFileURL && current.ContractFileURL && contractFileURL !== current.ContractFileURL) {
              await deleteFileFromUploadThing(current.ContractFileURL);
            }
            if (warningFileURL && current.WarningFileURL && warningFileURL !== current.WarningFileURL) {
              await deleteFileFromUploadThing(current.WarningFileURL);
            }
            if (letterFileURL && current.LetterFileURL && letterFileURL !== current.LetterFileURL) {
              await deleteFileFromUploadThing(current.LetterFileURL);
            }
            if (agreementFileURL && current.AgreementFileURL && agreementFileURL !== current.AgreementFileURL) {
              await deleteFileFromUploadThing(current.AgreementFileURL);
            }
          }

          const [contractRows] = await connection.execute(
            'SELECT * FROM basecontracts WHERE BasePersonnelID = ?',
            [basePersonnelId]
          );

          if (Array.isArray(contractRows) && contractRows.length > 0) {
            await connection.execute(
              `UPDATE basecontracts 
               SET StartDate = ?, SalaryIMSS = ?, 
                   ContractFileURL = ?, WarningFileURL = ?, 
                   LetterFileURL = ?, AgreementFileURL = ?
               WHERE BasePersonnelID = ?`,
              [
                fechaInicioFormateada,
                salaryIMSS || null,
                contractFileURL || null,
                warningFileURL || null,
                letterFileURL || null,
                agreementFileURL || null,
                basePersonnelId
              ]
            );
          } else {
            await connection.execute(
              `INSERT INTO basecontracts 
               (BasePersonnelID, StartDate, SalaryIMSS, 
                ContractFileURL, WarningFileURL, LetterFileURL, AgreementFileURL) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                basePersonnelId,
                fechaInicioFormateada,
                salaryIMSS || null,
                contractFileURL || null,
                warningFileURL || null,
                letterFileURL || null,
                agreementFileURL || null
              ]
            );
          }
        }

        // Actualizar documentación del empleado
        if (documentacion) {
          // Obtener URLs actuales para eliminar archivos viejos
          const [currentDocRows] = await connection.execute(
            `SELECT CVFileURL, ANFileURL, CURPFileURL, RFCFileURL, IMSSFileURL, INEFileURL,
                    CDFileURL, CEFileURL, CPFileURL, LMFileURL, ANPFileURL, CRFileURL,
                    RIFileURL, EMFileURL, FotoFileURL, FolletoFileURL
             FROM basepersonneldocumentation WHERE BasePersonnelID = ?`,
            [basePersonnelId]
          );

          if (Array.isArray(currentDocRows) && currentDocRows.length > 0) {
            const current = currentDocRows[0] as any;
            
            // Eliminar archivos viejos si se reemplazan
            const docFields = [
              { new: documentacion.CVFileURL, old: current.CVFileURL },
              { new: documentacion.ANFileURL, old: current.ANFileURL },
              { new: documentacion.CURPFileURL, old: current.CURPFileURL },
              { new: documentacion.RFCFileURL, old: current.RFCFileURL },
              { new: documentacion.IMSSFileURL, old: current.IMSSFileURL },
              { new: documentacion.INEFileURL, old: current.INEFileURL },
              { new: documentacion.CDFileURL, old: current.CDFileURL },
              { new: documentacion.CEFileURL, old: current.CEFileURL },
              { new: documentacion.CPFileURL, old: current.CPFileURL },
              { new: documentacion.LMFileURL, old: current.LMFileURL },
              { new: documentacion.ANPFileURL, old: current.ANPFileURL },
              { new: documentacion.CRFileURL, old: current.CRFileURL },
              { new: documentacion.RIFileURL, old: current.RIFileURL },
              { new: documentacion.EMFileURL, old: current.EMFileURL },
              { new: documentacion.FotoFileURL, old: current.FotoFileURL },
              { new: documentacion.FolletoFileURL, old: current.FolletoFileURL }
            ];

            for (const field of docFields) {
              if (field.new && field.old && field.new !== field.old) {
                await deleteFileFromUploadThing(field.old);
              }
            }
          }

          const [docRows] = await connection.execute(
            'SELECT * FROM basepersonneldocumentation WHERE BasePersonnelID = ?',
            [basePersonnelId]
          );

          if (Array.isArray(docRows) && docRows.length > 0) {
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
            );

            if (Array.isArray(beneficiarioRows) && beneficiarioRows.length > 0) {
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
        // PERSONAL DE PROYECTO
        // Obtener ProjectPersonnelID desde EmployeeID
        const [projectRows] = await connection.execute(
          'SELECT ProjectPersonnelID FROM projectpersonnel WHERE EmployeeID = ?',
          [employeeId]
        );

        if (!Array.isArray(projectRows) || projectRows.length === 0) {
          throw new Error('Empleado de proyecto no encontrado');
        }

        const projectPersonnelId = (projectRows as any[])[0].ProjectPersonnelID;

        // Actualizar información personal base
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

        // Actualizar información personal adicional - NUEVA ESTRUCTURA
        if (personalInfoExtra) {
          const {
            // Campos de dirección separados
            calle, numeroExterior, numeroInterior, colonia,
            municipio, estado, codigoPostal,
            // Campos existentes
            municipality, nationality, gender, birthdate,
            maritalStatus, rfc, curp, nss, nci, umf, phone, email
          } = personalInfoExtra;

          const fechaNacimientoFormateada = formatearFechaMySQL(birthdate);

          const [infoRows] = await connection.execute(
            'SELECT * FROM projectpersonnelpersonalinfo WHERE ProjectPersonnelID = ?',
            [projectPersonnelId]
          );

          if (Array.isArray(infoRows) && infoRows.length > 0) {
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

        // Actualizar información de contrato
        if (contractInfo) {
          const { 
            startDate, endDate, salaryIMSS, position, salary, workSchedule, projectId,
            contractFileURL, warningFileURL, letterFileURL, agreementFileURL 
          } = contractInfo;

          const fechaInicioFormateada = formatearFechaMySQL(startDate);
          const fechaFinFormateada = formatearFechaMySQL(endDate);

          const [currentContractRows] = await connection.execute(
            'SELECT ContractFileURL, WarningFileURL, LetterFileURL, AgreementFileURL FROM projectcontracts WHERE ProjectPersonnelID = ?',
            [projectPersonnelId]
          );

          if (Array.isArray(currentContractRows) && currentContractRows.length > 0) {
            const current = currentContractRows[0] as any;
            
            if (contractFileURL && current.ContractFileURL && contractFileURL !== current.ContractFileURL) {
              await deleteFileFromUploadThing(current.ContractFileURL);
            }
            if (warningFileURL && current.WarningFileURL && warningFileURL !== current.WarningFileURL) {
              await deleteFileFromUploadThing(current.WarningFileURL);
            }
            if (letterFileURL && current.LetterFileURL && letterFileURL !== current.LetterFileURL) {
              await deleteFileFromUploadThing(current.LetterFileURL);
            }
            if (agreementFileURL && current.AgreementFileURL && agreementFileURL !== current.AgreementFileURL) {
              await deleteFileFromUploadThing(current.AgreementFileURL);
            }
          }

          const [contractRows] = await connection.execute(
            'SELECT * FROM projectcontracts WHERE ProjectPersonnelID = ?',
            [projectPersonnelId]
          );

          if (Array.isArray(contractRows) && contractRows.length > 0) {
            await connection.execute(
              `UPDATE projectcontracts 
               SET StartDate = ?, EndDate = ?, SalaryIMSS = ?, 
                   Position = ?, Salary = ?, WorkSchedule = ?, ProjectID = ?,
                   ContractFileURL = ?, WarningFileURL = ?, 
                   LetterFileURL = ?, AgreementFileURL = ?
               WHERE ProjectPersonnelID = ?`,
              [
                fechaInicioFormateada,
                fechaFinFormateada,
                salaryIMSS || null,
                normalizarMayusculas(position || ''),
                salary || 0,
                normalizarMayusculas(workSchedule || ''),
                projectId || null,
                contractFileURL || null,
                warningFileURL || null,
                letterFileURL || null,
                agreementFileURL || null,
                projectPersonnelId
              ]
            );
          } else {
            await connection.execute(
              `INSERT INTO projectcontracts 
               (ProjectPersonnelID, StartDate, EndDate, SalaryIMSS, Position, Salary, WorkSchedule, ProjectID,
                ContractFileURL, WarningFileURL, LetterFileURL, AgreementFileURL) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                projectPersonnelId,
                fechaInicioFormateada,
                fechaFinFormateada,
                salaryIMSS || null,
                normalizarMayusculas(position || ''),
                salary || 0,
                normalizarMayusculas(workSchedule || ''),
                projectId || null,
                contractFileURL || null,
                warningFileURL || null,
                letterFileURL || null,
                agreementFileURL || null
              ]
            );
          }
        }

        // Actualizar documentación del empleado
        if (documentacion) {
          const [currentDocRows] = await connection.execute(
            `SELECT CVFileURL, ANFileURL, CURPFileURL, RFCFileURL, IMSSFileURL, INEFileURL,
                    CDFileURL, CEFileURL, CPFileURL, LMFileURL, ANPFileURL, CRFileURL,
                    RIFileURL, EMFileURL, FotoFileURL, FolletoFileURL
             FROM projectpersonneldocumentation WHERE ProjectPersonnelID = ?`,
            [projectPersonnelId]
          );

          if (Array.isArray(currentDocRows) && currentDocRows.length > 0) {
            const current = currentDocRows[0] as any;
            
            const docFields = [
              { new: documentacion.CVFileURL, old: current.CVFileURL },
              { new: documentacion.ANFileURL, old: current.ANFileURL },
              { new: documentacion.CURPFileURL, old: current.CURPFileURL },
              { new: documentacion.RFCFileURL, old: current.RFCFileURL },
              { new: documentacion.IMSSFileURL, old: current.IMSSFileURL },
              { new: documentacion.INEFileURL, old: current.INEFileURL },
              { new: documentacion.CDFileURL, old: current.CDFileURL },
              { new: documentacion.CEFileURL, old: current.CEFileURL },
              { new: documentacion.CPFileURL, old: current.CPFileURL },
              { new: documentacion.LMFileURL, old: current.LMFileURL },
              { new: documentacion.ANPFileURL, old: current.ANPFileURL },
              { new: documentacion.CRFileURL, old: current.CRFileURL },
              { new: documentacion.RIFileURL, old: current.RIFileURL },
              { new: documentacion.EMFileURL, old: current.EMFileURL },
              { new: documentacion.FotoFileURL, old: current.FotoFileURL },
              { new: documentacion.FolletoFileURL, old: current.FolletoFileURL }
            ];

            for (const field of docFields) {
              if (field.new && field.old && field.new !== field.old) {
                await deleteFileFromUploadThing(field.old);
              }
            }
          }

          const [docRows] = await connection.execute(
            'SELECT * FROM projectpersonneldocumentation WHERE ProjectPersonnelID = ?',
            [projectPersonnelId]
          );

          if (Array.isArray(docRows) && docRows.length > 0) {
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
            );

            if (Array.isArray(beneficiarioRows) && beneficiarioRows.length > 0) {
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

      // Confirmar transacción
      await connection.commit();

      return NextResponse.json({
        success: true,
        message: 'EMPLEADO ACTUALIZADO EXITOSAMENTE'
      });

    } catch (error) {
      // Rollback en caso de error
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
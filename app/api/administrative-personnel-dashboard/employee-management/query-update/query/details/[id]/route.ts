// app/api/administrative-personnel-dashboard/employee-management/query-update/query/details/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

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

    if (user.UserTypeID !== 2 && user.UserTypeID !== 1) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const employeeId = id;
    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo') as 'BASE' | 'PROJECT';

    if (!employeeId || !tipo) {
      return NextResponse.json(
        { success: false, message: 'ID de empleado y tipo son requeridos' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    let personalInfo: any = null;
    let contractInfo: any = null;
    let beneficiario: any = null;
    let documentacion: any = null;
    let projectInfo: any = null;
    let uniqueKey = `${employeeId}_${tipo}`;

    if (tipo === 'BASE') {
      const [personalRows] = await connection.execute(`
        SELECT 
          bp.BasePersonnelID,
          bp.FirstName,
          bp.LastName,
          bp.MiddleName,
          bp.Position,
          bp.Area,
          bp.Salary,
          bp.WorkSchedule,
          bpi.Municipality,
          bpi.Nationality,
          bpi.Gender,
          bpi.Birthdate,
          bpi.MaritalStatus,
          bpi.RFC,
          bpi.CURP,
          bpi.NSS,
          bpi.NCI,
          bpi.UMF,
          bpi.Phone,
          bpi.Email,
          bpi.Street,
          bpi.ExteriorNumber,
          bpi.InteriorNumber,
          bpi.Suburb,
          bpi.State,
          bpi.ZipCode
        FROM basepersonnel bp
        LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
        WHERE bp.EmployeeID = ?
      `, [employeeId]);

      if (Array.isArray(personalRows) && personalRows.length > 0) {
        const row = (personalRows as any[])[0];
        
        uniqueKey = `BASE_${employeeId}_${row.BasePersonnelID}`;
        
        personalInfo = {
          basePersonnelId: row.BasePersonnelID,
          nombreCompleto: `${row.FirstName} ${row.LastName} ${row.MiddleName || ''}`.trim(),
          fechaNacimiento: row.Birthdate,
          genero: row.Gender,
          estadoCivil: row.MaritalStatus,
          nacionalidad: row.Nationality,
          nci: row.NCI,
          umf: row.UMF?.toString(),
          calle: row.Street,
          numeroExterior: row.ExteriorNumber?.toString(),
          numeroInterior: row.InteriorNumber?.toString(),
          colonia: row.Suburb,
          municipio: row.Municipality,
          estado: row.State,
          codigoPostal: row.ZipCode?.toString(),
          rfc: row.RFC,
          curp: row.CURP,
          nss: row.NSS,
          telefono: row.Phone,
          email: row.Email,
          puesto: row.Position,
          area: row.Area,
          salario: row.Salary,
          horario: row.WorkSchedule
        };

        const [contractRows] = await connection.execute(`
          SELECT StartDate, SalaryIMSS, ContractFileURL, WarningFileURL, LetterFileURL, AgreementFileURL
          FROM basecontracts
          WHERE BasePersonnelID = ?
          ORDER BY StartDate DESC
          LIMIT 1
        `, [row.BasePersonnelID]);

        if (Array.isArray(contractRows) && contractRows.length > 0) {
          const contractRow = (contractRows as any[])[0];
          contractInfo = {
            fechaInicio: contractRow.StartDate,
            salaryIMSS: contractRow.SalaryIMSS,
            contractFileURL: contractRow.ContractFileURL,
            warningFileURL: contractRow.WarningFileURL,
            letterFileURL: contractRow.LetterFileURL,
            agreementFileURL: contractRow.AgreementFileURL
          };
        }

        const [beneficiarioRows] = await connection.execute(`
          SELECT BeneficiaryFirstName, BeneficiaryLastName, BeneficiaryMiddleName, Relationship, Percentage
          FROM basepersonnelbeneficiaries
          WHERE BasePersonnelID = ?
          LIMIT 1
        `, [row.BasePersonnelID]);

        if (Array.isArray(beneficiarioRows) && beneficiarioRows.length > 0) {
          const benRow = (beneficiarioRows as any[])[0];
          beneficiario = {
            nombreCompleto: `${benRow.BeneficiaryFirstName} ${benRow.BeneficiaryLastName} ${benRow.BeneficiaryMiddleName || ''}`.trim(),
            parentesco: benRow.Relationship,
            porcentaje: benRow.Percentage
          };
        }

        const [docRows] = await connection.execute(`
          SELECT 
            CVFileURL, ANFileURL, CURPFileURL, RFCFileURL, IMSSFileURL, INEFileURL,
            CDFileURL, CEFileURL, CPFileURL, LMFileURL, ANPFileURL, CRFileURL,
            RIFileURL, EMFileURL, FotoFileURL, FolletoFileURL
          FROM basepersonneldocumentation
          WHERE BasePersonnelID = ?
          LIMIT 1
        `, [row.BasePersonnelID]);

        if (Array.isArray(docRows) && docRows.length > 0) {
          documentacion = (docRows as any[])[0];
        }
      }

    } else {
      // PERSONAL DE PROYECTO
      const [personnelIdRows] = await connection.execute(`
        SELECT ProjectPersonnelID
        FROM projectpersonnel
        WHERE EmployeeID = ?
        LIMIT 1
      `, [employeeId]);

      if (Array.isArray(personnelIdRows) && personnelIdRows.length > 0) {
        const projectPersonnelId = (personnelIdRows as any[])[0].ProjectPersonnelID;
        
        // Obtener el contrato activo más reciente
        const [activeContractRows] = await connection.execute(`
          SELECT 
            ContractID, SalaryIMSS, ContractFileURL, WarningFileURL, LetterFileURL, AgreementFileURL,
            Position, Salary, WorkSchedule, ProjectID, Status
          FROM projectcontracts
          WHERE ProjectPersonnelID = ? AND Status = 1
          LIMIT 1
        `, [projectPersonnelId]);
        
        const activeContract = Array.isArray(activeContractRows) && activeContractRows.length > 0 
          ? (activeContractRows as any[])[0] 
          : null;
        
        const contractId = activeContract?.ContractID || '0';
        uniqueKey = `PROJECT_${employeeId}_${projectPersonnelId}_${contractId}`;
        
        // Obtener información personal
        const [personalRows] = await connection.execute(`
          SELECT 
            pp.ProjectPersonnelID,
            pp.FirstName,
            pp.LastName,
            pp.MiddleName,
            ppi.Municipality,
            ppi.Nationality,
            ppi.Gender,
            ppi.Birthdate,
            ppi.MaritalStatus,
            ppi.RFC,
            ppi.CURP,
            ppi.NSS,
            ppi.NCI,
            ppi.UMF,
            ppi.Phone,
            ppi.Email,
            ppi.Street,
            ppi.ExteriorNumber,
            ppi.InteriorNumber,
            ppi.Suburb,
            ppi.State,
            ppi.ZipCode
          FROM projectpersonnel pp
          LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
          WHERE pp.ProjectPersonnelID = ?
        `, [projectPersonnelId]);

        if (Array.isArray(personalRows) && personalRows.length > 0) {
          const row = (personalRows as any[])[0];
          
          // Construir personalInfo con todas las propiedades
          personalInfo = {
            projectPersonnelId: row.ProjectPersonnelID,
            nombreCompleto: `${row.FirstName} ${row.LastName} ${row.MiddleName || ''}`.trim(),
            fechaNacimiento: row.Birthdate,
            genero: row.Gender,
            estadoCivil: row.MaritalStatus,
            nacionalidad: row.Nationality,
            nci: row.NCI,
            umf: row.UMF?.toString(),
            calle: row.Street,
            numeroExterior: row.ExteriorNumber?.toString(),
            numeroInterior: row.InteriorNumber?.toString(),
            colonia: row.Suburb,
            municipio: row.Municipality,
            estado: row.State,
            codigoPostal: row.ZipCode?.toString(),
            rfc: row.RFC,
            curp: row.CURP,
            nss: row.NSS,
            telefono: row.Phone,
            email: row.Email,
            // Inicializar con valores por defecto
            puesto: null,
            salario: null,
            horario: null,
            proyecto: null,
            proyectoId: null
          };
        }

        // Información de contrato (usando el contrato activo)
        if (activeContract) {
          contractInfo = {
            contractId: activeContract.ContractID,
            salaryIMSS: activeContract.SalaryIMSS,
            contractFileURL: activeContract.ContractFileURL,
            warningFileURL: activeContract.WarningFileURL,
            letterFileURL: activeContract.LetterFileURL,
            agreementFileURL: activeContract.AgreementFileURL,
            position: activeContract.Position,
            salary: activeContract.Salary,
            workSchedule: activeContract.WorkSchedule,
            projectId: activeContract.ProjectID,
            status: activeContract.Status,
            fechaInicio: activeContract.StartDate
          };
          
          // Actualizar personalInfo con los datos del contrato
          if (personalInfo) {
            personalInfo.puesto = activeContract.Position;
            personalInfo.salario = activeContract.Salary;
            personalInfo.horario = activeContract.WorkSchedule;
          }

          // Información del proyecto
          if (activeContract.ProjectID) {
            const [projectRows] = await connection.execute(`
              SELECT NameProject, StartDate, EndDate, Status
              FROM projects
              WHERE ProjectID = ?
            `, [activeContract.ProjectID]);
            
            if (Array.isArray(projectRows) && projectRows.length > 0) {
              const projRow = (projectRows as any[])[0];
              projectInfo = {
                projectId: activeContract.ProjectID,
                projectName: projRow.NameProject,
                startDate: projRow.StartDate,
                endDate: projRow.EndDate,
                status: projRow.Status
              };
              
              // Actualizar personalInfo con los datos del proyecto
              if (personalInfo) {
                personalInfo.proyecto = projRow.NameProject;
                personalInfo.proyectoId = activeContract.ProjectID;
                personalInfo.fechaInicioProyecto = projRow.StartDate;
                personalInfo.fechaFinProyecto = projRow.EndDate;
              }
            }
          }
        }

        // Beneficiario
        const [beneficiarioRows] = await connection.execute(`
          SELECT BeneficiaryFirstName, BeneficiaryLastName, BeneficiaryMiddleName, Relationship, Percentage
          FROM projectpersonnelbeneficiaries
          WHERE ProjectPersonnelID = ?
          LIMIT 1
        `, [projectPersonnelId]);

        if (Array.isArray(beneficiarioRows) && beneficiarioRows.length > 0) {
          const benRow = (beneficiarioRows as any[])[0];
          beneficiario = {
            nombreCompleto: `${benRow.BeneficiaryFirstName} ${benRow.BeneficiaryLastName} ${benRow.BeneficiaryMiddleName || ''}`.trim(),
            parentesco: benRow.Relationship,
            porcentaje: benRow.Percentage
          };
        }

        // Documentación
        const [docRows] = await connection.execute(`
          SELECT 
            CVFileURL, ANFileURL, CURPFileURL, RFCFileURL, IMSSFileURL, INEFileURL,
            CDFileURL, CEFileURL, CPFileURL, LMFileURL, ANPFileURL, CRFileURL,
            RIFileURL, EMFileURL, FotoFileURL, FolletoFileURL
          FROM projectpersonneldocumentation
          WHERE ProjectPersonnelID = ?
          LIMIT 1
        `, [projectPersonnelId]);

        if (Array.isArray(docRows) && docRows.length > 0) {
          documentacion = (docRows as any[])[0];
        }
      }
    }

    return NextResponse.json({
      success: true,
      uniqueKey,
      employeeId: parseInt(employeeId),
      tipo,
      personalInfo,
      contractInfo,
      beneficiario,
      documentacion,
      projectInfo
    });

  } catch (error) {
    console.error('Error al obtener detalles del empleado:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL OBTENER DETALLES DEL EMPLEADO',
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
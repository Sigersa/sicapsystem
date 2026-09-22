// app/api/administrative-personnel-dashboard/employee-management/employeeincidence/[id]/route.ts
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

// Función para generar el PDF FT-RH-27 actualizado
async function generateUpdatedIncidencePDF(batchId: number): Promise<ArrayBuffer> {
    const tempExcelPath = path.join(
        os.tmpdir(),
        `FT-RH-27-EDIT-${Date.now()}-${batchId}.xlsx`
    );

    let connection;

    try {
        connection = await getConnection();

        // Obtener información del batch y del empleado
        const [batchRows] = await connection.execute<any[]>(
            `SELECT 
                eib.BatchID,
                eib.BatchDate,
                eib.EmployeeID,
                COALESCE(bp.FirstName, pp.FirstName) as FirstName,
                COALESCE(bp.LastName, pp.LastName) as LastName,
                COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
                COALESCE(bp.Position, pc.Position) as Position,
                COALESCE(bc.StartDate, pj.StartDate) as StartDate,
                bp.Area,
                pj.NameProject,
                CASE 
                    WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
                    ELSE 'PROJECT'
                END as tipo
            FROM employee_incidence_batches eib
            LEFT JOIN basepersonnel bp ON eib.EmployeeID = bp.EmployeeID
            LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID
            LEFT JOIN projectpersonnel pp ON eib.EmployeeID = pp.EmployeeID
            LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
            LEFT JOIN projects pj ON pc.ProjectID = pj.ProjectID
            WHERE eib.BatchID = ?`,
            [batchId]
        );

        if (!batchRows || batchRows.length === 0) {
            throw new Error(`Batch con ID ${batchId} no encontrado`);
        }

        const batch = batchRows[0];

        // Obtener todas las incidencias del lote
        const [incidenceRows] = await connection.execute<any[]>(
            `SELECT 
                IncidenceNumber,
                IncidenceDate,
                Description,
                Rule
            FROM employee_incidence_details 
            WHERE BatchID = ?
            ORDER BY IncidenceNumber`,
            [batchId]
        );

        if (incidenceRows.length === 0) {
            throw new Error('No se encontraron incidencias para este lote');
        }

        const formatDate = (dateValue: any): string => {
            if (!dateValue) return 'NO ESPECIFICADO';
            try {
                const date = new Date(dateValue);
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
            "FT-RH-27.xlsx"
        );

        if (!fs.existsSync(templatePath)) {
            throw new Error('Plantilla FT-RH-27 no encontrada en: ' + templatePath);
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templatePath);
        const ws = workbook.getWorksheet(1)!;

        const employeeName = [
            batch.FirstName || '',
            batch.LastName || '',
            batch.MiddleName || ''
        ].filter(part => part && part.trim() !== '').join(' ').trim() || 'NO ESPECIFICADO';

          ws.getCell('A6').value = batch.LastName || 'NO ESPECIFICADO';
        ws.getCell('E6').value = batch.MiddleName || 'NO ESPECIFICADO';
        ws.getCell('H6').value = batch.FirstName || 'NO ESPECIFICADO';
        ws.getCell('H6').value = batch.FirstName || 'NO ESPECIFICADO';
        ws.getCell('A9').value = formatDate(batch.StartDate);
        ws.getCell('C9').value = batch.Position || 'NO ESPECIFICADO';
        ws.getCell('G9').value = batch.NameProject || 'N/A';
        ws.getCell('I9').value = batch.Area || 'N/A';
        ws.getCell('E20').value = employeeName || 'NO ESPECIFICADO';

        // Llenar cada incidencia en filas consecutivas (12, 13, 14, 15)
        incidenceRows.forEach((inc, index) => {
            const rowNumber = 12 + index; // Fila 12, 13, 14, 15
            ws.getCell(`A${rowNumber}`).value = inc.IncidenceNumber || 'NO ESPECIFICADO';
            ws.getCell(`B${rowNumber}`).value = formatDate(inc.IncidenceDate);
            ws.getCell(`D${rowNumber}`).value = inc.Description || 'NO ESPECIFICADO';
            ws.getCell(`H${rowNumber}`).value = inc.Rule || 'NO ESPECIFICADO';
        });
        
        await workbook.xlsx.writeFile(tempExcelPath);

        const result = await convertapi.convert("pdf", {
            File: tempExcelPath,
        });

        const pdfResponse = await fetch(result.file.url);
        const pdfBuffer = await pdfResponse.arrayBuffer();

        return pdfBuffer;

    } catch (error) {
        console.error('Error al generar PDF FT-RH-27 actualizado:', error);
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

// GET: Obtener un lote de incidencias específico
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

        const batchId = parseInt(id);

        connection = await getConnection();

        // Obtener datos del batch con información del empleado
        const [batchRows] = await connection.execute<any[]>(
            `SELECT 
                eib.BatchID,
                eib.EmployeeID,
                eib.BatchDate,
                eib.FileURL,
                COALESCE(bp.FirstName, pp.FirstName) as FirstName,
                COALESCE(bp.LastName, pp.LastName) as LastName,
                COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
                COALESCE(bp.Position, pc.Position) as Position,
                CASE 
                    WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
                    ELSE 'PROJECT'
                END as tipo
            FROM employee_incidence_batches eib
            LEFT JOIN basepersonnel bp ON eib.EmployeeID = bp.EmployeeID
            LEFT JOIN projectpersonnel pp ON eib.EmployeeID = pp.EmployeeID
            LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
            WHERE eib.BatchID = ?`,
            [batchId]
        );

        if (batchRows.length === 0) {
            return NextResponse.json(
                { success: false, message: 'Lote no encontrado' },
                { status: 404 }
            );
        }

        // Obtener incidencias del lote
        const [incidenceRows] = await connection.execute<any[]>(
            `SELECT 
                IncidenceDetailID,
                IncidenceNumber,
                IncidenceDate,
                Description,
                Rule
            FROM employee_incidence_details 
            WHERE BatchID = ?
            ORDER BY IncidenceNumber`,
            [batchId]
        );

        return NextResponse.json({
            success: true,
            batch: batchRows[0],
            incidences: incidenceRows,
            incidenceCount: incidenceRows.length
        });

    } catch (error) {
        console.error('Error al obtener lote:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'ERROR AL OBTENER DATOS DEL LOTE',
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

// PUT: Actualizar lote completo
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
            Incidences
        } = body;

        // Validaciones
        if (!EmployeeID) {
            return NextResponse.json(
                { success: false, message: 'El ID del empleado es requerido' },
                { status: 400 }
            );
        }

        if (!Incidences || !Array.isArray(Incidences) || Incidences.length === 0) {
            return NextResponse.json(
                { success: false, message: 'Debe incluir al menos una incidencia' },
                { status: 400 }
            );
        }

        if (Incidences.length > 4) {
            return NextResponse.json(
                { success: false, message: 'Máximo 4 incidencias por lote' },
                { status: 400 }
            );
        }

        for (const inc of Incidences) {
            if (!inc.IncidenceDate) {
                return NextResponse.json(
                    { success: false, message: 'La fecha de incidencia es requerida para todas las incidencias' },
                    { status: 400 }
                );
            }
        }

        connection = await getConnection();
        await connection.beginTransaction();

        try {
            // Verificar que el lote existe
            const [batchCheck] = await connection.execute<any[]>(
                'SELECT BatchID, FileURL FROM employee_incidence_batches WHERE BatchID = ?',
                [BatchID]
            );

            if (batchCheck.length === 0) {
                throw new Error('El lote no existe');
            }

            const oldFileUrl = batchCheck[0].FileURL;

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
                throw new Error(`El empleado ${EmployeeID} no existe`);
            }

            // 1. Actualizar el batch
            await connection.execute(
                `UPDATE employee_incidence_batches 
                 SET EmployeeID = ?
                 WHERE BatchID = ?`,
                [
                    EmployeeID,
                    BatchID
                ]
            );

            // 2. Eliminar incidencias existentes
            await connection.execute(
                'DELETE FROM employee_incidence_details WHERE BatchID = ?',
                [BatchID]
            );

            // 3. Insertar nuevas incidencias
            for (let i = 0; i < Incidences.length; i++) {
                const inc = Incidences[i];
                const incidenceNumber = i + 1;

                await connection.execute(
                    `INSERT INTO employee_incidence_details 
                     (BatchID, IncidenceNumber, IncidenceDate, Description, Rule) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        BatchID,
                        incidenceNumber,
                        inc.IncidenceDate,
                        inc.Description || 'SIN DESCRIPCIÓN',
                        inc.Rule || 'SIN REGLA'
                    ]
                );
            }

            await connection.commit();

            // 4. Generar nuevo PDF
            let newFileUrl: string | null = null;
            let pdfGenerationSuccess = false;

            try {
                await new Promise(resolve => setTimeout(resolve, 200));

                const pdfBuffer = await generateUpdatedIncidencePDF(BatchID);

                const fileName = `FT-RH-27-EMP-${EmployeeID}-BATCH-${BatchID}-${Date.now()}.pdf`;
                const file = new File([Buffer.from(pdfBuffer)], fileName, { type: 'application/pdf' });

                const uploadResponse = await utapi.uploadFiles([file]);

                if (uploadResponse && uploadResponse[0] && uploadResponse[0].data && uploadResponse[0].data.url) {
                    newFileUrl = uploadResponse[0].data.url;
                    pdfGenerationSuccess = true;

                    const updateConnection = await getConnection();
                    try {
                        await updateConnection.execute(
                            `UPDATE employee_incidence_batches SET FileURL = ? WHERE BatchID = ?`,
                            [newFileUrl, BatchID]
                        );
                        console.log(`PDF actualizado subido a UploadThing: ${newFileUrl}`);

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
                newFileUrl = oldFileUrl;

                if (oldFileUrl) {
                    const restoreConnection = await getConnection();
                    try {
                        await restoreConnection.execute(
                            `UPDATE employee_incidence_batches SET FileURL = ? WHERE BatchID = ?`,
                            [oldFileUrl, BatchID]
                        );
                    } finally {
                        await restoreConnection.release();
                    }
                }
            }

            return NextResponse.json({
                success: true,
                message: pdfGenerationSuccess
                    ? `Lote actualizado exitosamente para ${Incidences.length} incidencia(s) con nuevo documento`
                    : `Lote actualizado exitosamente para ${Incidences.length} incidencia(s) (sin cambios en el documento)`,
                fileUrl: newFileUrl,
                batchId: BatchID,
                incidenceCount: Incidences.length
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Error al actualizar lote:', error);

        let errorMessage = 'ERROR AL ACTUALIZAR EL LOTE';

        if (error instanceof Error) {
            if (error.message.includes('foreign key constraint')) {
                errorMessage = 'ERROR: El empleado no existe';
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

// DELETE: Eliminar lote
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

        const BatchID = parseInt(id);

        connection = await getConnection();
        await connection.beginTransaction();

        try {
            const [batchCheck] = await connection.execute<any[]>(
                'SELECT BatchID, FileURL FROM employee_incidence_batches WHERE BatchID = ?',
                [BatchID]
            );

            if (batchCheck.length === 0) {
                throw new Error('El lote no existe');
            }

            const fileUrl = batchCheck[0].FileURL;

            if (fileUrl) {
                await deleteFileFromUploadThing(fileUrl);
            }

            await connection.execute(
                'DELETE FROM employee_incidence_details WHERE BatchID = ?',
                [BatchID]
            );

            await connection.execute(
                'DELETE FROM employee_incidence_batches WHERE BatchID = ?',
                [BatchID]
            );

            await connection.commit();

            return NextResponse.json({
                success: true,
                message: 'Lote eliminado exitosamente'
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Error al eliminar lote:', error);

        let errorMessage = 'ERROR AL ELIMINAR EL LOTE';

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
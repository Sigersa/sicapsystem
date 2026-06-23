// app/administrative-personnel-dashboard/employee-management/incidents/page.tsx
'use client';

import AppHeader from '@/components/header/2/2.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/2';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { useState, useEffect, ChangeEvent, useRef, KeyboardEvent } from 'react';
import { Search, ChevronLeft, ChevronRight, Edit, Trash2, X, RefreshCw, CheckCircle, AlertCircle, Download, Eye, FileText, Plus } from 'lucide-react';

// Interface para lote de incidencias
interface IncidenceBatch {
    BatchID: number;
    EmployeeID: number;
    BatchDate: string | null;
    FileURL: string | null;
    IncidenceCount: number;
    IncidenceDescriptions: string;
    FirstName: string;
    LastName: string;
    MiddleName: string | null;
    Position: string;
    tipo: 'BASE' | 'PROJECT';
}

// Interface para búsqueda de empleado
interface EmployeeSearchResult {
    EmployeeID: number;
    FirstName: string;
    LastName: string;
    MiddleName: string | null;
    Position: string;
    tipo: 'BASE' | 'PROJECT';
    Area?: string;
    NameProject?: string;
}

// Interface para incidencia individual
interface IncidenceItem {
    id: string;
    IncidenceNumber: number;
    IncidenceDate: string;
    Description: string;
    Rule: string;
}

// Interface para formulario
interface IncidenceFormData {
    EmployeeID: string;
}

// Interface para detalles del éxito
interface SuccessDetails {
    BatchID: number;
    EmployeeID: number;
    EmployeeName: string;
    tipo: 'BASE' | 'PROJECT';
    pdfUrl: string;
    excelUrl: string;
    incidenceCount: number;
}

// Interface para filtros
interface Filters {
    search: string;
}

// Función para normalizar texto a mayúsculas
const normalizarMayusculas = (texto: string): string => {
    return texto.toUpperCase();
};

// Función para formatear fecha para input type="date"
const formatDateForInput = (dateString: string | null): string => {
    if (!dateString) return '';
    try {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            return dateString;
        }
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return '';
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch {
        return '';
    }
};

// Función para formatear fecha para mostrar
const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleDateString('es-MX', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch {
        return dateString;
    }
};

export default function EmployeeIncidencePage() {
    const { user, loading: sessionLoading } = useSessionManager();
    useInactivityManager();

    // Estados
    const [records, setRecords] = useState<IncidenceBatch[]>([]);
    const [filteredRecords, setFilteredRecords] = useState<IncidenceBatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(1);

    // Filtros
    const [filters, setFilters] = useState<Filters>({ search: '' });

    // Estados para el empleado
    const [employeeIdInput, setEmployeeIdInput] = useState('');
    const [searchingEmployee, setSearchingEmployee] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSearchResult | null>(null);
    const [employeeNotFound, setEmployeeNotFound] = useState(false);
    const [incidences, setIncidences] = useState<IncidenceItem[]>([]);

    // Modales
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [saving, setSaving] = useState(false);
    const [recordToEdit, setRecordToEdit] = useState<IncidenceBatch | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; id: number | null }>({ show: false, id: null });

    // Modal de éxito
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successDetails, setSuccessDetails] = useState<SuccessDetails | null>(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);

    // Formulario
    const [formData, setFormData] = useState<IncidenceFormData>({
        EmployeeID: '',
    });

    // Referencias
    const employeeIdInputRef = useRef<HTMLInputElement>(null);

    // Cargar registros
    useEffect(() => {
        if (user) {
            fetchRecords();
        }
    }, [user]);

    // Aplicar filtros
    useEffect(() => {
        applyFilters();
    }, [records, filters]);

    useEffect(() => {
        setTotalPages(Math.ceil(filteredRecords.length / itemsPerPage));
        setCurrentPage(1);
    }, [filteredRecords, itemsPerPage]);

    const currentRecords = filteredRecords.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const fetchRecords = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch('/api/administrative-personnel-dashboard/employee-management/employeeincidence');

            if (!response.ok) {
                throw new Error('Error al cargar incidencias');
            }

            const data = await response.json();

            if (data.success) {
                setRecords(data.records || []);
            } else {
                setError(data.message || 'Error al cargar incidencias');
            }
        } catch (error) {
            console.error('Error:', error);
            setError('ERROR DE CONEXIÓN AL CARGAR INCIDENCIAS');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...records];

        if (filters.search.trim()) {
            const searchLower = filters.search.toLowerCase().trim();
            filtered = filtered.filter(record => {
                const employeeName = `${record.FirstName || ''} ${record.LastName || ''} ${record.MiddleName || ''}`.toLowerCase();
                return record.BatchID.toString().includes(searchLower) ||
                    employeeName.includes(searchLower);
            });
        }

        setFilteredRecords(filtered);
    };

    const clearFilters = () => {
        setFilters({ search: '' });
    };

    const handleEmployeeIdKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const id = employeeIdInput.trim();

            if (!id) {
                setError('POR FAVOR INGRESE UN ID DE EMPLEADO');
                return;
            }

            await searchEmployeeById(id);
        }
    };

    const searchEmployeeById = async (id: string) => {
        try {
            setSearchingEmployee(true);
            setEmployeeNotFound(false);
            setError('');

            const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeeincidence/search?term=${encodeURIComponent(id)}`);

            if (response.ok) {
                const data = await response.json();
                const employee = data.employees?.find((emp: EmployeeSearchResult) =>
                    emp.EmployeeID.toString() === id
                );

                if (employee) {
                    setSelectedEmployee(employee);
                    setFormData(prev => ({
                        ...prev,
                        EmployeeID: employee.EmployeeID.toString()
                    }));
                    setEmployeeNotFound(false);
                } else {
                    setSelectedEmployee(null);
                    setFormData(prev => ({
                        ...prev,
                        EmployeeID: ''
                    }));
                    setEmployeeNotFound(true);
                    setError('NO SE ENCONTRÓ UN EMPLEADO CON ESE ID');
                }
            } else {
                setError('ERROR AL BUSCAR EL EMPLEADO');
            }
        } catch (error) {
            console.error('Error al buscar empleado:', error);
            setError('ERROR DE CONEXIÓN AL BUSCAR EMPLEADO');
        } finally {
            setSearchingEmployee(false);
        }
    };

    const addIncidence = () => {
        if (incidences.length >= 4) {
            setError('MÁXIMO 4 INCIDENCIAS POR LOTE');
            return;
        }

        const newIncidence: IncidenceItem = {
            id: `inc-${Date.now()}-${incidences.length + 1}`,
            IncidenceNumber: incidences.length + 1,
            IncidenceDate: '',
            Description: '',
            Rule: ''
        };

        setIncidences([...incidences, newIncidence]);
    };

    const removeIncidence = (id: string) => {
        if (incidences.length <= 1) {
            setError('DEBE TENER AL MENOS UNA INCIDENCIA');
            return;
        }
        const filtered = incidences.filter(inc => inc.id !== id);
        // Re-numerar
        const renumbered = filtered.map((inc, index) => ({
            ...inc,
            IncidenceNumber: index + 1
        }));
        setIncidences(renumbered);
    };

    const updateIncidence = (id: string, field: keyof IncidenceItem, value: string) => {
        setIncidences(prev =>
            prev.map(inc =>
                inc.id === id ? { ...inc, [field]: value } : inc
            )
        );
    };

    const clearEmployeeSearch = () => {
        setEmployeeIdInput('');
        setSelectedEmployee(null);
        setFormData(prev => ({
            ...prev,
            EmployeeID: ''
        }));
        setEmployeeNotFound(false);
        setError('');
        if (employeeIdInputRef.current) {
            employeeIdInputRef.current.focus();
        }
    };

    const handleCreateRecord = () => {
        setModalMode('create');
        setFormData({
            EmployeeID: '',
        });
        setSelectedEmployee(null);
        setEmployeeIdInput('');
        setEmployeeNotFound(false);
        setIncidences([
            {
                id: 'inc-1',
                IncidenceNumber: 1,
                IncidenceDate: '',
                Description: '',
                Rule: ''
            }
        ]);
        setError('');
        setShowModal(true);

        setTimeout(() => {
            if (employeeIdInputRef.current) {
                employeeIdInputRef.current.focus();
            }
        }, 100);
    };

    const loadBatchForEdit = async (batchId: number) => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeeincidence/${batchId}`);

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const batch = data.batch;
                    setFormData({
                        EmployeeID: batch.EmployeeID.toString(),
                    });

                    setSelectedEmployee({
                        EmployeeID: batch.EmployeeID,
                        FirstName: batch.FirstName || '',
                        LastName: batch.LastName || '',
                        MiddleName: batch.MiddleName || '',
                        Position: batch.Position || '',
                        tipo: batch.tipo || 'BASE'
                    });

                    const incidencesData = data.incidences.map((inc: any) => ({
                        id: `edit-${inc.IncidenceDetailID}`,
                        IncidenceNumber: inc.IncidenceNumber,
                        IncidenceDate: formatDateForInput(inc.IncidenceDate) || '',
                        Description: inc.Description || '',
                        Rule: inc.Rule || ''
                    }));
                    setIncidences(incidencesData);
                } else {
                    setError(data.message || 'Error al cargar los datos del lote');
                }
            } else {
                setError('Error al cargar los datos del lote');
            }
        } catch (error) {
            console.error('Error al cargar lote:', error);
            setError('ERROR DE CONEXIÓN AL CARGAR DATOS DEL LOTE');
        } finally {
            setLoading(false);
        }
    };

    const handleEditRecord = async (record: IncidenceBatch) => {
        setModalMode('edit');
        setRecordToEdit(record);
        setShowModal(true);
        await loadBatchForEdit(record.BatchID);

        setTimeout(() => {
            if (employeeIdInputRef.current) {
                employeeIdInputRef.current.focus();
            }
        }, 100);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setIncidences([]);
        setSelectedEmployee(null);
        setEmployeeIdInput('');
        setEmployeeNotFound(false);
        setError('');
    };

    const handleDeleteRecord = async (id: number) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeeincidence/${id}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setSuccessMessage('LOTE DE INCIDENCIAS ELIMINADO EXITOSAMENTE!');
                await fetchRecords();
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                throw new Error(data.message || 'ERROR AL ELIMINAR EL LOTE');
            }
        } catch (error) {
            console.error('Error:', error);
            setError('ERROR AL ELIMINAR EL LOTE. POR FAVOR, INTENTE NUEVAMENTE.');
        } finally {
            setLoading(false);
            setConfirmDelete({ show: false, id: null });
        }
    };

    const handleSaveRecord = async () => {
        try {
            setSaving(true);
            setError('');

            if (!selectedEmployee) {
                setError('DEBE SELECCIONAR UN EMPLEADO VÁLIDO');
                setSaving(false);
                return;
            }

            if (incidences.length === 0) {
                setError('DEBE AGREGAR AL MENOS UNA INCIDENCIA');
                setSaving(false);
                return;
            }

            // Validar que cada incidencia tenga fecha
            for (const inc of incidences) {
                if (!inc.IncidenceDate) {
                    setError('LA FECHA DE INCIDENCIA ES REQUERIDA PARA TODAS LAS INCIDENCIAS');
                    setSaving(false);
                    return;
                }
            }

            const recordData = {
                EmployeeID: parseInt(formData.EmployeeID),
                Incidences: incidences.map(inc => ({
                    IncidenceDate: inc.IncidenceDate,
                    Description: inc.Description || 'SIN DESCRIPCIÓN',
                    Rule: inc.Rule || 'SIN REGLA'
                }))
            };

            let response;

            if (modalMode === 'create') {
                response = await fetch('/api/administrative-personnel-dashboard/employee-management/employeeincidence', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(recordData)
                });
            } else {
                response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeeincidence/${recordToEdit?.BatchID}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(recordData)
                });
            }

            const data = await response.json();

            if (response.ok && data.success) {
                handleCloseModal();
                await fetchRecords();

                if (modalMode === 'create' && data.fileUrl) {
                    const baseUrl = window.location.origin;
                    const pdfUrl = data.fileUrl;
                    const excelUrl = `${baseUrl}/api/download/edit/FT-RH-27?batchId=${data.batchId}`;

                    setSuccessDetails({
                        BatchID: data.BatchID,
                        EmployeeID: parseInt(formData.EmployeeID),
                        EmployeeName: `${selectedEmployee.FirstName} ${selectedEmployee.LastName} ${selectedEmployee.MiddleName || ''}`.trim(),
                        tipo: selectedEmployee.tipo,
                        pdfUrl: pdfUrl,
                        excelUrl: excelUrl,
                        incidenceCount: incidences.length
                    });
                    setShowSuccessModal(true);
                } else if (modalMode === 'edit') {
                    setSuccessMessage('LOTE ACTUALIZADO EXITOSAMENTE!');
                    setTimeout(() => setSuccessMessage(''), 3000);
                } else {
                    setSuccessMessage('LOTE CREADO EXITOSAMENTE!');
                    setTimeout(() => setSuccessMessage(''), 3000);
                }
            } else {
                setError(data.message || 'ERROR AL GUARDAR INCIDENCIA');
            }
        } catch (error) {
            console.error('Error:', error);
            setError('ERROR DE CONEXIÓN AL REGISTRAR INCIDENCIA');
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadPDF = async (url: string, filename: string) => {
        try {
            setDownloading(true);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Error al descargar el archivo');
            }
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);
            setDownloading(false);
        } catch (error) {
            console.error('Error al descargar archivo:', error);
            setError('Error al descargar el archivo. Intente nuevamente.');
            setDownloading(false);
        }
    };

    const handleDownloadExcel = (url: string, filename: string) => {
        try {
            setDownloading(true);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setDownloading(false);
        } catch (error) {
            console.error('Error al descargar archivo Excel:', error);
            setError('Error al descargar el archivo Excel. Intente nuevamente.');
            setDownloading(false);
        }
    };

    const closeSuccessModal = () => {
        setShowSuccessModal(false);
        setSuccessDetails(null);
        setPdfLoading(false);
    };

    const getPreviewUrl = (documentUrl: string | null | undefined): string | null => {
        if (!documentUrl) return null;
        return documentUrl;
    };

    if (sessionLoading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3a6ea5] mx-auto"></div>
                    <p className="mt-4 text-gray-700 font-medium">VERIFICANDO SESIÓN...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <AppHeader title="PANEL ADMINISTRATIVO" />

            {/* Modal de confirmación para eliminar */}
            {confirmDelete.show && (
                <div
                    className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70"
                    style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
                >
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-in relative z-[10000]">
                        <div className="p-6 pb-4 border-b border-gray-300">
                            <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                                CONFIRMAR ELIMINACIÓN
                            </h2>
                            <p className="text-sm text-gray-600 mt-2 leading-5">
                                ¿Está seguro que desea eliminar este lote de incidencias? Esta acción no se puede deshacer.
                            </p>
                        </div>
                        <div className="p-6 pt-4 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmDelete({ show: false, id: null })}
                                className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap"
                            >
                                CANCELAR
                            </button>
                            <button
                                type="button"
                                onClick={() => confirmDelete.id && handleDeleteRecord(confirmDelete.id)}
                                disabled={loading}
                                className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center whitespace-nowrap"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        ELIMINANDO...
                                    </>
                                ) : (
                                    'ELIMINAR'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de éxito */}
            {showSuccessModal && successDetails && (
                <div
                    className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70"
                    style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
                >
                    <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full h-[90vh] flex flex-col animate-fade-in relative z-[10000]">
                        <div className="p-6 pb-4 border-b flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                                    ¡REGISTRO EXITOSO!
                                </h2>
                                <p className="text-gray-600 mt-1 text-sm">
                                    Lote de {successDetails.incidenceCount} incidencia(s) registrado correctamente para el empleado.
                                </p>
                            </div>
                            <button
                                onClick={closeSuccessModal}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                aria-label="Cerrar modal"
                            >
                                <X className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                            <div className="w-full md:w-1/3 p-6 border-r border-gray-200 overflow-y-auto">
                                <div className="space-y-4">
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">DETALLES DEL LOTE</h3>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="block text-xs font-bold text-gray-700 uppercase">ID LOTE:</span>
                                                <span className="text-gray-600 mt-1 text-sm">{successDetails.BatchID}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="block text-xs font-bold text-gray-700 uppercase">EMPLEADO:</span>
                                                <span className="text-gray-600 mt-1 text-sm">{successDetails.EmployeeName}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="block text-xs font-bold text-gray-700 uppercase">TIPO:</span>
                                                <span className="text-gray-600 mt-1 text-sm">{successDetails.tipo}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="block text-xs font-bold text-gray-700 uppercase"># INCIDENCIAS:</span>
                                                <span className="text-gray-600 mt-1 text-sm">{successDetails.incidenceCount}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">DOCUMENTOS GENERADOS</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center">
                                                    <FileText className="h-5 w-5 text-gray-600 mr-2" />
                                                    <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-27 (PDF)</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <a
                                                        href={successDetails.pdfUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                                        title="Vista previa"
                                                    >
                                                        <Eye className="h-4 w-4 text-gray-700" />
                                                    </a>
                                                    <button
                                                        onClick={() => handleDownloadPDF(successDetails.pdfUrl, `FT-RH-27-${successDetails.BatchID}.pdf`)}
                                                        disabled={downloading}
                                                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title="Descargar PDF"
                                                    >
                                                        {downloading ? (
                                                            <div className="h-4 w-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin"></div>
                                                        ) : (
                                                            <Download className="h-4 w-4 text-gray-700" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center">
                                                    <FileText className="h-5 w-5 text-gray-600 mr-2" />
                                                    <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-27 (EDITABLE)</span>
                                                </div>
                                                <button
                                                    onClick={() => handleDownloadExcel(successDetails.excelUrl, `FT-RH-27-${successDetails.BatchID}.xlsx`)}
                                                    disabled={downloading}
                                                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Descargar Excel editable"
                                                >
                                                    {downloading ? (
                                                        <div className="h-4 w-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin"></div>
                                                    ) : (
                                                        <Download className="h-4 w-4 text-gray-700" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-gray-800 text-sm uppercase">
                                        VISTA PREVIA - FORMATO FT-RH-27
                                    </h3>
                                </div>
                                <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden relative bg-gray-50">
                                    {pdfLoading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                                            <div className="flex flex-col items-center">
                                                <div className="w-12 h-12 border-4 border-gray-300 border-t-[#3a6ea5] animate-spin rounded-full mb-3"></div>
                                                <p className="text-sm text-gray-600">Cargando vista previa...</p>
                                            </div>
                                        </div>
                                    )}
                                    <iframe
                                        src={successDetails.pdfUrl}
                                        className="w-full h-full border-0"
                                        onLoad={() => setPdfLoading(false)}
                                        title="Vista previa de incidencias"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de registro de incidencias */}
            {showModal && (
                <div
                    className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70"
                    style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
                >
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-fade-in relative z-[10000]">
                        <div className="p-6 pb-4 border-b border-gray-300 flex items-center justify-between sticky top-0 bg-white z-10">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                                    {modalMode === 'create' ? 'NUEVA INCIDENCIA' : 'EDITAR INCIDENCIA'}
                                </h2>
                                <p className="text-gray-600 mt-1 text-sm">
                                    {modalMode === 'create'
                                        ? 'Registre una nueva incidencia para un empleado.'
                                        : 'Modifique la información de la incidencia seleccionada.'
                                    }
                                </p>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="space-y-6">
                                {/* Selección del empleado */}
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                                        ID DEL EMPLEADO
                                    </h3>

                                    <div className="mb-4">
                                        <div className="relative">
                                            <input
                                                ref={employeeIdInputRef}
                                                type="text"
                                                value={employeeIdInput}
                                                onChange={(e) => {
                                                    setEmployeeIdInput(normalizarMayusculas(e.target.value));
                                                    if (employeeNotFound) setEmployeeNotFound(false);
                                                    if (selectedEmployee) setSelectedEmployee(null);
                                                }}
                                                onKeyDown={handleEmployeeIdKeyDown}
                                                placeholder="Ingrese el ID del empleado"
                                                className={`w-full px-3 py-2.5 text-sm bg-white border rounded focus:outline-none focus:border-[#3a6ea5] font-medium ${
                                                    employeeNotFound ? 'border-red-500' : 'border-gray-400'
                                                }`}
                                                disabled={selectedEmployee !== null}
                                            />
                                            {!selectedEmployee && employeeIdInput && !employeeNotFound && (
                                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                                                    ENTER PARA BUSCAR
                                                </div>
                                            )}
                                            {selectedEmployee && (
                                                <button
                                                    onClick={clearEmployeeSearch}
                                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                    title="Limpiar búsqueda"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                        {searchingEmployee && (
                                            <div className="mt-2 text-sm text-gray-600 flex items-center">
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#3a6ea5] mr-2"></div>
                                                BUSCANDO EMPLEADO...
                                            </div>
                                        )}
                                        {employeeNotFound && (
                                            <p className="mt-2 text-sm text-red-600">
                                                No se encontró un empleado con ese ID
                                            </p>
                                        )}
                                    </div>

                                    {selectedEmployee && (
                                        <div className="p-4 bg-white border border-gray-200 rounded-lg">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <span className="block text-xs font-bold text-gray-500 uppercase">Nombre completo</span>
                                                    <span className="text-sm text-gray-900">
                                                        {`${selectedEmployee.FirstName} ${selectedEmployee.LastName} ${selectedEmployee.MiddleName || ''}`.trim()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-xs font-bold text-gray-500 uppercase">ID</span>
                                                    <span className="text-sm text-gray-900">{selectedEmployee.EmployeeID}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-xs font-bold text-gray-500 uppercase">Tipo</span>
                                                    <span className="text-sm text-gray-900">{selectedEmployee.tipo}</span>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <span className="block text-xs font-bold text-gray-500 uppercase">Puesto</span>
                                                    <span className="text-sm text-gray-900">{selectedEmployee.Position}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Incidencias */}
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-2">
                                        <h3 className="font-bold text-gray-800 text-sm uppercase">
                                            DATOS DE LA INCIDENCIA
                                        </h3>
                                        <button
                                            onClick={addIncidence}
                                            disabled={incidences.length >= 4}
                                            className="px-5 py-2.5 bg-[#3a6ea5] text-white font-semibold rounded-lg hover:bg-[#2d5592] transition-all duration-200 flex items-center justify-center whitespace-nowrap shadow-sm hover:shadow-md self-center"
                                        >
                                            AGREGAR
                                        </button>
                                    </div>

                                    <div className="space-y-3 max-h-80 overflow-y-auto">
                                        {incidences.map((inc) => (
                                            <div key={inc.id} className="p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
                                                <div className="flex justify-between items-start gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <span className="font-bold text-gray-800 text-sm uppercase">
                                                                INCIDENCIA #{inc.IncidenceNumber}
                                                            </span>
                                                            {incidences.length > 1 && (
                                                                <button
                                                                    onClick={() => removeIncidence(inc.id)}
                                                                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-all duration-200 ml-2"
                                                                    title='Eliminar incidencia'
                                                                >
                                                                   <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                                                                    FECHA *
                                                                </label>
                                                                <input
                                                                    type="date"
                                                                    value={inc.IncidenceDate}
                                                                    onChange={(e) => updateIncidence(inc.id, 'IncidenceDate', e.target.value)}
                                                                    className="w-full px-2 py-1.5 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]"
                                                                    required
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                                                                    DESCRIPCIÓN *
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={inc.Description}
                                                                    onChange={(e) => updateIncidence(inc.id, 'Description', normalizarMayusculas(e.target.value))}
                                                                    placeholder="Descripción de los hechos"
                                                                    className="w-full px-2 py-1.5 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]"
                                                                    required
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                                                                    REGLA *
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={inc.Rule}
                                                                    onChange={(e) => updateIncidence(inc.id, 'Rule', normalizarMayusculas(e.target.value))}
                                                                    placeholder="Lo que el reglamento indica"
                                                                    className="w-full px-2 py-1.5 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]"
                                                                    required
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {incidences.length === 4 && (
                                            <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                                                <span className="inline-block w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                                                Límite máximo de 4 incidencias alcanzado
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 pt-4 border-t border-gray-300 bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={handleCloseModal}
                                disabled={saving}
                                className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap disabled:opacity-50"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={handleSaveRecord}
                                disabled={saving || !selectedEmployee || incidences.some(inc => !inc.IncidenceDate)}
                                className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        GUARDANDO...
                                    </>
                                ) : (
                                    modalMode === 'create' ? 'CREAR LOTE' : 'ACTUALIZAR LOTE'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
                <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
                    <div className="mb-6">
                        <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5]">
                            <h1 className="text-xl font-bold text-white tracking-tight">
                                INCIDENCIAS
                            </h1>
                            <p className="text-sm text-gray-200 mt-1">
                                Administre las incidencias de los empleados.
                            </p>
                        </div>
                    </div>

                    {successMessage && (
                        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 animate-fade-in">
                            <div className="flex items-center">
                                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                                <p className="text-sm font-medium text-gray-600 leading-5">{successMessage}</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 animate-fade-in">
                            <div className="flex items-center">
                                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                                <p className="text-sm font-medium text-gray-600 leading-5">{error}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="flex-1">
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                                    <Search className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar por ID o nombre del empleado..."
                                    value={filters.search}
                                    onChange={(e) => setFilters(prev => ({ ...prev, search: normalizarMayusculas(e.target.value) }))}
                                    className="w-full pl-10 px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                                />
                                {filters.search && (
                                    <button
                                        onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={clearFilters}
                            className="px-4 py-2.5 bg-gray-200 text-black font-bold rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap"
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            LIMPIAR
                        </button>

                        <button
                            onClick={handleCreateRecord}
                            className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap"
                        >
                            NUEVA INCIDENCIA
                        </button>
                    </div>

                    <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">ID LOTE</th>
                                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">EMPLEADO</th>
                                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">PUESTO</th>
                                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">TIPO</th>
                                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300"># INC</th>
                                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">FECHA</th>
                                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">DOC</th>
                                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300 text-center">ACCIONES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center">
                                                <div className="flex flex-col items-center justify-center">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a6ea5] mb-2"></div>
                                                    <p className="text-gray-600">Cargando lotes...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center">
                                                <div className="flex flex-col items-center justify-center">
                                                    <AlertCircle className="h-8 w-8 text-gray-400 mb-3" />
                                                    <p className="text-sm font-medium text-gray-600 mt-2 leading-5">
                                                        {filters.search
                                                            ? 'No se encontraron incidencias que coincidan con la búsqueda'
                                                            : 'No hay incidencias registradas'}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        currentRecords.map((record) => {
                                            const previewUrl = getPreviewUrl(record.FileURL);
                                            const employeeName = `${record.FirstName || ''} ${record.LastName || ''} ${record.MiddleName || ''}`.trim() || 'N/A';
                                            return (
                                                <tr key={record.BatchID} className="hover:bg-gray-50 transition-colors border-b border-gray-300">
                                                    <td className="py-3 px-4 text-sm text-gray-800 font-medium">{record.BatchID}</td>
                                                    <td className="py-3 px-4">
                                                        <div className="text-sm text-gray-800 uppercase">
                                                            {employeeName}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="text-sm text-gray-800 uppercase">{record.Position || 'N/A'}</div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="text-sm text-gray-800 uppercase">{record.tipo || 'N/A'}</div>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-800 text-center font-medium">
                                                        {record.IncidenceCount}
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-800">
                                                        {formatDate(record.BatchDate)}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center justify-center">
                                                            {previewUrl ? (
                                                                <a
                                                                    href={previewUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center text-xs text-gray-700 hover:underline"
                                                                    title="Ver PDF"
                                                                >
                                                                    Ver
                                                                </a>
                                                            ) : (
                                                                <span className="text-xs text-gray-400">Sin documento</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => handleEditRecord(record)}
                                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                                title="Editar lote"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmDelete({ show: true, id: record.BatchID })}
                                                                className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                                title="Eliminar lote"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {filteredRecords.length > 0 && totalPages > 1 && (
                            <div className="px-4 py-3 bg-gray-50 border-t border-gray-300 flex items-center justify-between">
                                <div className="text-sm text-gray-700">
                                    MOSTRANDO {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredRecords.length)} DE {filteredRecords.length} REGISTROS
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <span className="px-4 py-2 bg-[#3a6ea5] text-white rounded-md">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <Footer />

            <style jsx global>{`
                @keyframes fade-in {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out;
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                body {
                    padding-top: 0;
                    padding-bottom: 0;
                    margin: 0;
                    overflow-x: hidden;
                }
                .fixed.inset-0.z-\\[9999\\] {
                    z-index: 9999 !important;
                }
                header, footer {
                    z-index: 50 !important;
                }
                body.modal-open {
                    overflow: hidden;
                }
                textarea {
                    resize: none;
                }
            `}</style>
        </div>
    );
}
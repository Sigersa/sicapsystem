// app/administrative-personnel-dashboard/personnel-management/personnel-movements/page.tsx
'use client';

import AppHeader from '@/components/header/2/2.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/2';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { useState, useEffect, ChangeEvent, useRef, KeyboardEvent } from 'react';
import { Search, ChevronLeft, ChevronRight, Edit, Trash2, X, RefreshCw, CheckCircle, AlertCircle, FileText, Download, Eye, Plus, UserMinus } from 'lucide-react';

// Interface para movimientos de empleados
interface EmployeeMovement {
  BatchID: number;
  ProjectContractID: number;
  MovementType: string | null;
  DateMovement: string | null;
  ReasonForWithdrawal: string | null;
  FileURL?: string | null; 
  FirstName?: string;
  LastName?: string;
  MiddleName?: string;
  Position?: string;
  tipo?: 'BASE' | 'PROJECT';
}

// Interface para búsqueda de empleado con datos laborales
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

// Interface para empleado en el lote
interface EmployeeInBatch {
  id: string; // clave temporal para el frontend
  EmployeeID: number;
  EmployeeData: EmployeeSearchResult;
}

// Interface para formulario de movimientos
interface MovementFormData {
  MovementType: string;
  DateMovement: string;
  ReasonForWithdrawal: string;
}

// Interface para detalles del éxito
interface SuccessDetails {
  BatchID: number;
  Employees: Array<{
    EmployeeID: number;
    EmployeeName: string;
    tipo: 'BASE' | 'PROJECT';
  }>;
  MovementType: string;
  DateMovement: string | null;
  pdfUrl: string;
  excelUrl: string;
}

// Interface para filtros
interface Filters {
  search: string;
}

const TYPE_OF_MOVEMENT_OPTIONS = [
  { value: "ALTA", label: "ALTA" },
  { value: "BAJA", label: "BAJA" }
];

// Función para normalizar texto a mayúsculas
const normalizarMayusculas = (texto: string): string => {
  return texto.toUpperCase();
};

// Función para formatear fecha para input type="date" (YYYY-MM-DD)
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

// Función para descargar documento
const downloadDocument = (url: string, fileName: string) => {
  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error('Error al descargar el documento');
      }
      return response.blob();
    })
    .then(blob => {
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    })
    .catch(error => {
      console.error('Error:', error);
      alert('Error al descargar el documento. Por favor, intente nuevamente.');
    });
};

export default function EmployeeMovementsPage() {
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();

  // Estados
  const [records, setRecords] = useState<EmployeeMovement[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<EmployeeMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Estados para filtros
  const [filters, setFilters] = useState<Filters>({
    search: ''
  });

  // Estados para búsqueda de empleados por ID (para agregar al lote)
  const [employeeIdInput, setEmployeeIdInput] = useState('');
  const [searchingEmployee, setSearchingEmployee] = useState(false);
  const [employeeToAdd, setEmployeeToAdd] = useState<EmployeeSearchResult | null>(null);
  const [employeeNotFound, setEmployeeNotFound] = useState(false);
  const [employeesInBatch, setEmployeesInBatch] = useState<EmployeeInBatch[]>([]);

  // Estados para modales
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [saving, setSaving] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<EmployeeMovement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; id: number | null }>({ show: false, id: null });

  // Estado para el modal de éxito con vista previa del PDF
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successDetails, setSuccessDetails] = useState<SuccessDetails | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Estado para formulario
  const [formData, setFormData] = useState<MovementFormData>({
    MovementType: '',
    DateMovement: '',
    ReasonForWithdrawal: '',
  });

  // Referencias
  const employeeIdInputRef = useRef<HTMLInputElement>(null);

  // Cargar registros al montar
  useEffect(() => {
    if (user) {
      fetchRecords();
    }
  }, [user]);

  // Aplicar filtros cuando cambien
  useEffect(() => {
    applyFilters();
  }, [records, filters]);

  // Actualizar páginas cuando cambien los registros filtrados
  useEffect(() => {
    setTotalPages(Math.ceil(filteredRecords.length / itemsPerPage));
    setCurrentPage(1);
  }, [filteredRecords, itemsPerPage]);

  // Obtener registros actuales de la página
  const currentRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Función para obtener registros de movimientos
  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/administrative-personnel-dashboard/employee-management/employeeimssinfonavit');
      
      if (!response.ok) {
        throw new Error('Error al cargar movimientos de empleados');
      }

      const data = await response.json();
      
      if (data.success) {
        setRecords(data.records || []);
      } else {
        setError(data.message || 'Error al cargar movimientos');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('ERROR DE CONEXIÓN AL CARGAR MOVIMIENTOS');
    } finally {
      setLoading(false);
    }
  };

  // Función para aplicar filtros
  const applyFilters = () => {
    let filtered = [...records];

    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase().trim();
      filtered = filtered.filter(record => {
        const employeeName = `${record.FirstName || ''} ${record.LastName || ''} ${record.MiddleName || ''}`.toLowerCase();
        return employeeName.includes(searchLower) || 
               record.BatchID.toString().includes(searchLower) ||
               (record.MovementType && record.MovementType.toLowerCase().includes(searchLower));
      });
    }

    setFilteredRecords(filtered);
  };

  // Función para limpiar filtros
  const clearFilters = () => {
    setFilters({
      search: ''
    });
  };

  // Función para buscar empleado por ID al presionar Enter
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

  // Función para buscar empleado por ID
  const searchEmployeeById = async (id: string) => {
    try {
      setSearchingEmployee(true);
      setEmployeeNotFound(false);
      setError('');

      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeeimssinfonavit/search?term=${encodeURIComponent(id)}`);
      
      if (response.ok) {
        const data = await response.json();
        const employee = data.employees?.find((emp: EmployeeSearchResult) => 
          emp.EmployeeID.toString() === id
        );
        
        if (employee) {
          // Verificar si el empleado ya está en el lote
          const alreadyInBatch = employeesInBatch.some(e => e.EmployeeID === employee.EmployeeID);
          if (alreadyInBatch) {
            setError('ESTE EMPLEADO YA HA SIDO AGREGADO AL LOTE');
            setEmployeeToAdd(null);
          } else if (employeesInBatch.length >= 10) {
            setError('MÁXIMO 10 EMPLEADOS POR LOTE');
            setEmployeeToAdd(null);
          } else {
            setEmployeeToAdd(employee);
            setEmployeeNotFound(false);
          }
        } else {
          setEmployeeToAdd(null);
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

  // Función para agregar empleado al lote
  const addEmployeeToBatch = () => {
    if (!employeeToAdd) return;
    
    const newEmployee: EmployeeInBatch = {
      id: `${Date.now()}-${employeeToAdd.EmployeeID}`,
      EmployeeID: employeeToAdd.EmployeeID,
      EmployeeData: employeeToAdd
    };
    
    setEmployeesInBatch([...employeesInBatch, newEmployee]);
    setEmployeeToAdd(null);
    setEmployeeIdInput('');
    setError('');
    
    if (employeeIdInputRef.current) {
      employeeIdInputRef.current.focus();
    }
  };

  // Función para eliminar empleado del lote
  const removeEmployeeFromBatch = (id: string) => {
    setEmployeesInBatch(employeesInBatch.filter(emp => emp.id !== id));
  };

  // Función para limpiar la búsqueda de empleado
  const clearEmployeeSearch = () => {
    setEmployeeIdInput('');
    setEmployeeToAdd(null);
    setEmployeeNotFound(false);
    setError('');
    if (employeeIdInputRef.current) {
      employeeIdInputRef.current.focus();
    }
  };

  // Función para limpiar todo el lote
  const clearBatch = () => {
    setEmployeesInBatch([]);
    setEmployeeToAdd(null);
    setEmployeeIdInput('');
    setEmployeeNotFound(false);
  };

  // Función para abrir modal de creación
  const handleCreateRecord = () => {
    setModalMode('create');
    setFormData({
      MovementType: '',
      DateMovement: '',
      ReasonForWithdrawal: '',
    });
    setEmployeesInBatch([]);
    setEmployeeToAdd(null);
    setEmployeeIdInput('');
    setEmployeeNotFound(false);
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

      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeeimssinfonavit/batch/${batchId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Cargar los datos del movimiento
          setFormData({
            MovementType: data.batch.MovementType || '',
            DateMovement: formatDateForInput(data.batch.DateMovement),
            ReasonForWithdrawal: data.batch.ReasonForWithdrawal || '',
          });
          
          // Cargar los empleados del lote
          const employees = data.employees.map((emp: any, index: number) => ({
            id: `edit-${index}-${emp.EmployeeID}`,
            EmployeeID: emp.EmployeeID,
            EmployeeData: emp
          }));
          setEmployeesInBatch(employees);
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

  // Función para abrir modal de edición
  const handleEditRecord = async (record: EmployeeMovement) => {
    setModalMode('edit');
    setRecordToEdit(record);
    setShowModal(true);
    
    // Cargar los datos completos del lote
    await loadBatchForEdit(record.BatchID);
    
    setTimeout(() => {
      if (employeeIdInputRef.current) {
        employeeIdInputRef.current.focus();
      }
    }, 100);
  };

  // Función para cerrar modal
  const handleCloseModal = () => {
    setShowModal(false);
    setEmployeesInBatch([]);
    setEmployeeToAdd(null);
    setEmployeeIdInput('');
    setEmployeeNotFound(false);
    setError('');
  };

  // Función para eliminar registro
  const handleDeleteRecord = async (id: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeeimssinfonavit/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessMessage('MOVIMIENTO ELIMINADO EXITOSAMENTE!');
        await fetchRecords();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        throw new Error(data.message || 'ERROR AL ELIMINAR EL MOVIMIENTO');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('ERROR AL ELIMINAR EL MOVIMIENTO. POR FAVOR, INTENTE NUEVAMENTE.');
    } finally {
      setLoading(false);
      setConfirmDelete({ show: false, id: null });
    }
  };

  // Función para manejar cambios en el formulario
  const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    let newValue = value;
    
    if (name !== 'DateMovement') {
      newValue = normalizarMayusculas(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
  };

  // Función para guardar registro de movimientos (múltiples empleados)
  const handleSaveRecord = async () => {
    try {
      setSaving(true);
      setError('');

      if (employeesInBatch.length === 0) {
        setError('DEBE AGREGAR AL MENOS UN EMPLEADO AL LOTE');
        setSaving(false);
        return;
      }

      if (!formData.MovementType) {
        setError('DEBE SELECCIONAR UN TIPO DE MOVIMIENTO');
        setSaving(false);
        return;
      }

      if (!formData.DateMovement) {
        setError('DEBE SELECCIONAR UNA FECHA DE MOVIMIENTO');
        setSaving(false);
        return;
      }

      // Validar motivo de baja solo cuando el tipo de movimiento es BAJA
      if (formData.MovementType === 'BAJA' && !formData.ReasonForWithdrawal) {
        setError('DEBE INGRESAR UN MOTIVO DE BAJA');
        setSaving(false);
        return;
      }

      const recordData = {
        Employees: employeesInBatch.map(emp => emp.EmployeeID),
        MovementType: formData.MovementType,
        DateMovement: formData.DateMovement,
        ReasonForWithdrawal: formData.MovementType === 'BAJA' ? formData.ReasonForWithdrawal : null,
      };

      let response;
      
      if (modalMode === 'create') {
        response = await fetch('/api/administrative-personnel-dashboard/employee-management/employeeimssinfonavit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(recordData)
        });
      } else {
        response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeeimssinfonavit/${recordToEdit?.BatchID}`, {
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
          // Mostrar modal de éxito con vista previa (para creación)
          const baseUrl = window.location.origin;
          const pdfUrl = data.fileUrl;
          const excelUrl = `${baseUrl}/api/download/edit/FT-RH-05?batchId=${data.batchId}`;
          
          setSuccessDetails({
            BatchID: data.BatchID,
            Employees: employeesInBatch.map(emp => ({
              EmployeeID: emp.EmployeeID,
              EmployeeName: `${emp.EmployeeData.FirstName} ${emp.EmployeeData.LastName} ${emp.EmployeeData.MiddleName || ''}`.trim(),
              tipo: emp.EmployeeData.tipo
            })),
            MovementType: formData.MovementType,
            DateMovement: formData.DateMovement,
            pdfUrl: pdfUrl,
            excelUrl: excelUrl
          });
          setShowSuccessModal(true);
        } else if (modalMode === 'edit') {
          setSuccessMessage('MOVIMIENTO ACTUALIZADO EXITOSAMENTE!');
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          setSuccessMessage('MOVIMIENTO CREADO EXITOSAMENTE!');
          setTimeout(() => setSuccessMessage(''), 3000);
        }
      } else {
        setError(data.message || 'ERROR AL GUARDAR MOVIMIENTO');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('ERROR DE CONEXIÓN AL REGISTRAR MOVIMIENTO');
    } finally {
      setSaving(false);
    }
  };

  // Función para descargar el archivo PDF
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

  // Función para descargar el archivo Excel editable
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

  // Función para cerrar modal de éxito
  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    setSuccessDetails(null);
    setPdfLoading(false);
  };

  // Función para obtener la URL de vista previa del PDF
  const getPreviewUrl = (documentUrl: string | null | undefined): string | null => {
    if (!documentUrl) return null;
    return documentUrl;
  };

  // Mostrar loading de sesión
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

  // Si no hay usuario
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <AppHeader title="PANEL ADMINISTRATIVO" />

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR */}
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
                ¿Está seguro que desea eliminar esta solicitud? Esta acción no se puede deshacer.
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

      {/* MODAL DE ÉXITO CON VISTA PREVIA DEL PDF */}
      {showSuccessModal && successDetails && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70"
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full h-[90vh] flex flex-col animate-fade-in relative z-[10000]">
            {/* Encabezado del modal */}
            <div className="p-6 pb-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  ¡REGISTRO EXITOSO!
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  La solicitud se ha registrado correctamente para {successDetails.Employees.length} empleado(s).
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
            
            {/* Contenido del modal - dos columnas */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Columna izquierda - Detalles del Movimiento */}
              <div className="w-full md:w-1/3 p-6 border-r border-gray-200 overflow-y-auto">
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">DETALLES DEL REGISTRO</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">ID SOLICITUD:</span>
                        <span className="text-gray-600 mt-1 text-sm">{successDetails.BatchID}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">TIPO DE MOVIMIENTO:</span>
                        <span className="text-gray-600 mt-1 text-sm">{successDetails.MovementType}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">FECHA DEL MOVIMIENTO:</span>
                        <span className="text-gray-600 mt-1 text-sm">{successDetails.DateMovement}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">EMPLEADOS REGISTRADOS</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {successDetails.Employees.map((emp, idx) => (
                        <div key={idx} className="text-sm text-gray-700 py-1 border-b border-gray-200">
                          {emp.EmployeeName}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">DOCUMENTOS GENERADOS</h3>
                    <div className="space-y-3">
                      {/* PDF */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-gray-600 mr-2" />
                          <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-05 (PDF)</span>
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
                            onClick={() => handleDownloadPDF(successDetails.pdfUrl, `FT-RH-05-${successDetails.BatchID}.pdf`)}
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
                      
                      {/* Excel Editable */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-gray-600 mr-2" />
                          <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-05 (EDITABLE)</span>
                        </div>
                        <button
                          onClick={() => handleDownloadExcel(successDetails.excelUrl, `FT-RH-05-${successDetails.BatchID}.xlsx`)}
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
              
              {/* Columna derecha - Vista previa del PDF */}
              <div className="flex-1 flex flex-col p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800 text-sm uppercase">
                    VISTA PREVIA - FORMATO FT-RH-05
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
                    title="Vista previa del movimiento de empleado"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE REGISTRO DE MOVIMIENTO (MÚLTIPLES EMPLEADOS) */}
      {showModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70"
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-fade-in relative z-[10000]">
            {/* Encabezado */}
            <div className="p-6 pb-4 border-b border-gray-300 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                  {modalMode === 'create' ? 'NUEVA SOLICITUD' : 'EDITAR SOLICITUD'}
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  {modalMode === 'create' 
                    ? 'Registre una nueva solucitud de movimientos IMSS e INFONAVIT del personal.'
                    : 'Modifique la información de la solicitud seleccionada.'
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

            {/* Contenido */}
            <div className="p-6">
              <div className="space-y-6">
                {/* Búsqueda por ID del empleado para agregar al lote */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                    AGREGAR EMPLEADOS A LA SOLICITUD {employeesInBatch.length > 0 && `(${employeesInBatch.length}/10)`}
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
                          if (employeeToAdd) setEmployeeToAdd(null);
                        }}
                        onKeyDown={handleEmployeeIdKeyDown}
                        placeholder="Ingrese el ID del empleado"
                        className={`w-full px-3 py-2.5 text-sm bg-white border rounded focus:outline-none focus:border-[#3a6ea5] font-medium ${
                          employeeNotFound ? 'border-red-500' : 'border-gray-400'
                        }`}
                        disabled={employeesInBatch.length >= 10}
                      />
                      {!employeeToAdd && employeeIdInput && !employeeNotFound && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                          ENTER PARA BUSCAR
                        </div>
                      )}
                      {employeeToAdd && (
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

                  {/* Empleado encontrado para agregar */}
                  {employeeToAdd && (
                    <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          {/* Nombre del empleado */}
                          <h3 className="font-semibold text-gray-800 mb-3 text-base border-b border-gray-200 pb-2">
                            {`${employeeToAdd.FirstName} ${employeeToAdd.LastName} ${employeeToAdd.MiddleName || ''}`.trim()}
                          </h3>
                          
                          {/* Información del empleado en grid */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            <div>
                              <span className="text-xs font-semibold text-gray-600 uppercase">ID:</span>
                              <p className="text-sm text-gray-700 mt-0.5">{employeeToAdd.EmployeeID}</p>
                            </div>
                            
                            <div>
                              <span className="text-xs font-semibold text-gray-600 uppercase">Tipo:</span>
                              <p className="text-sm text-gray-700 mt-0.5">{employeeToAdd.tipo}</p>
                            </div>
                            
                            <div className="col-span-2">
                              <span className="text-xs font-semibold text-gray-600 uppercase">Puesto:</span>
                              <p className="text-sm text-gray-700 mt-0.5">{employeeToAdd.Position}</p>
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={addEmployeeToBatch}
                          className="px-5 py-2.5 bg-[#3a6ea5] text-white font-semibold rounded-lg hover:bg-[#2d5592] transition-all duration-200 flex items-center justify-center whitespace-nowrap shadow-sm hover:shadow-md self-center"
                        >
                          AGREGAR
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Lista de empleados en el lote */}
                  {employeesInBatch.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">EMPLEADOS EN LA SOLICITUD:</h4>
                      
                      <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                        {employeesInBatch.map((emp) => (
                          <div key={emp.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800 text-sm mb-1">
                                {`${emp.EmployeeData.FirstName} ${emp.EmployeeData.LastName} ${emp.EmployeeData.MiddleName || ''}`.trim()}
                              </p>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <span className="font-semibold text-gray-600">ID:</span>
                                  <span className="text-gray-700 ml-1">{emp.EmployeeID}</span>
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-600">TIPO:</span>
                                  <span className="text-gray-700 ml-1">{emp.EmployeeData.tipo}</span>
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-600">PUESTO:</span>
                                  <span className="text-gray-700 ml-1">{emp.EmployeeData.Position}</span>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => removeEmployeeFromBatch(emp.id)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-all duration-200 ml-2"
                              title="Eliminar del lote"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        
                        {employeesInBatch.length === 0 && (
                          <div className="text-center py-6 text-gray-400 text-sm">
                            No hay empleados agregados
                          </div>
                        )}
                      </div>
                      
                      {employeesInBatch.length === 10 && (
                        <p className="mt-2 text-xs text-amber-600 font-medium flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                          Límite máximo de 10 empleados alcanzado
                        </p>
                      )}
                      
                      {employeesInBatch.length > 0 && (
                        <button
                          onClick={clearBatch}
                          className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium flex items-center gap-1.5 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          LIMPIAR TODOS
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Datos de la solicitud */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                    DATOS DE LA SOLICITUD
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* TIPO DE MOVIMIENTO */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        TIPO DE MOVIMIENTO *
                      </label>
                      <div className="relative">
                        <select
                          name="MovementType"
                          value={formData.MovementType}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          required
                        >
                          <option value="">Seleccione un tipo</option>
                          {TYPE_OF_MOVEMENT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* FECHA DEL MOVIMIENTO */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        FECHA DEL MOVIMIENTO *
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          name="DateMovement"
                          value={formData.DateMovement}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          required
                        />
                      </div>
                    </div>

                    {/* MOTIVO DE BAJA - Solo visible cuando el tipo de movimiento es BAJA */}
                    {formData.MovementType === 'BAJA' && (
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          MOTIVO DE BAJA *
                        </label>
                        <div className="relative">
                          <textarea
                            name="ReasonForWithdrawal"
                            value={formData.ReasonForWithdrawal}
                            onChange={handleFormChange}
                            rows={3}
                            className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
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
                disabled={saving || employeesInBatch.length === 0 || !formData.MovementType || !formData.DateMovement || (formData.MovementType === 'BAJA' && !formData.ReasonForWithdrawal)}
                className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    GUARDANDO...
                  </>
                ) : (
                  modalMode === 'create' ? `CREAR` : 'ACTUALIZAR'
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
                MOVIMIENTOS IMSS E INFONAVIT
              </h1>
              <p className="text-sm text-gray-200 mt-1">
                Administre las solicitudes de movimientos de IMSS e INFONAVIT de los empleados.
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

          {/* Barra de herramientas */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar por ID, nombre, tipo de movimiento..."
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
              NUEVA SOLICITUD
            </button>
          </div>

          {/* Tabla de movimientos */}
          <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">ID SOLICITUD</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">TIPO DE MOVIMIENTO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">FECHA DEL MOVIMIENTO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">MOTIVO DE BAJA</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">DOCUMENTOS</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a6ea5] mb-2"></div>
                          <p className="text-gray-600">Cargando solicitudes...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <AlertCircle className="h-8 w-8 text-gray-400 mb-3" />
                          <p className="text-sm font-medium text-gray-600 mt-2 leading-5">
                            {filters.search
                              ? 'No se encontraron registros que coincidan con la búsqueda'
                              : 'No hay solicitudes registradas'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentRecords.map((record, index) => {
                      const previewUrl = getPreviewUrl(record.FileURL);
                      
                      return (
                        <tr key={`${record.BatchID}-${index}-${record.MovementType || ''}`} className="hover:bg-gray-50 transition-colors border-b border-gray-300">
                          <td className="py-3 px-4 text-sm text-gray-800 font-medium">{record.BatchID}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">
                            <div className="text-sm text-gray-800 uppercase">{record.MovementType}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm text-gray-800 uppercase">{formatDate(record.DateMovement)}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm text-gray-800 uppercase max-w-xs truncate">{record.ReasonForWithdrawal || "N/A"}</div>
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
                                title="Editar registro"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setConfirmDelete({ show: true, id: record.BatchID })}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Eliminar registro"
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

      {/* Estilos para animaciones */}
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
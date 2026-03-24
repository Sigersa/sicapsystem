'use client';

import AppHeader from '@/components/header/2/2.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/2';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { useState, useEffect, ChangeEvent, useRef, KeyboardEvent } from 'react';
import { Search, ChevronLeft, ChevronRight, Edit, Trash2, X, RefreshCw, CheckCircle, AlertCircle, Download, Eye, FileText } from 'lucide-react';

// Interface para préstamo
interface EmployeeLoan {
  LoanID: number;
  EmployeeID: number;
  ApplicationDate: string;
  Amount: number;
  NumberOfPayments: number;
  DiscountAmount: number;
  FirstDiscountDate: string;
  Observations: string;
  FileURL: string | null;
  // Información del empleado (join)
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
  Salary: number;
  WorkSchedule: string;
  SalaryIMSS: number;
  ContractStartDate: string;
  ContractEndDate?: string;
  Area?: string;
  NameProject?: string;
  ProjectID?: number;
  tipo: 'BASE' | 'PROJECT';
}

// Interface para formulario de préstamo
interface LoanFormData {
  EmployeeID: string;
  ApplicationDate: string;
  Amount: string;
  NumberOfPayments: string;
  DiscountAmount: string;
  FirstDiscountDate: string;
  Observations: string;
}

// Interface para filtros
interface Filters {
  search: string;
}

// Interface para detalles del éxito
interface SuccessDetails {
  LoanID: number;
  EmployeeID: number;
  EmployeeName: string;
  tipo: 'BASE' | 'PROJECT';
  ApplicationDate: string;
  Amount: number;
  NumberOfPayments: number;
  DiscountAmount: number;
  FirstDiscountDate: string;
  fileUrl: string;
  // URLs para descarga
  pdfUrl: string;
  excelUrl: string;
}

// Función para normalizar texto a mayúsculas
const normalizarMayusculas = (texto: string): string => {
  return texto.toUpperCase();
};

// Función para formatear fecha
const formatDate = (dateString: string): string => {
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

// Función para formatear moneda
const formatCurrency = (amount: number): string => {
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
};

export default function EmployeeLoansPage() {
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();

  // Estados
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [filteredLoans, setFilteredLoans] = useState<EmployeeLoan[]>([]);
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

  // Estados para búsqueda de empleados por ID
  const [employeeIdInput, setEmployeeIdInput] = useState('');
  const [searchingEmployee, setSearchingEmployee] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSearchResult | null>(null);
  const [selectedEmployeeData, setSelectedEmployeeData] = useState<EmployeeSearchResult | null>(null);
  const [employeeNotFound, setEmployeeNotFound] = useState(false);

  // Estados para modales
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [saving, setSaving] = useState(false);
  const [loanToEdit, setLoanToEdit] = useState<EmployeeLoan | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; id: number | null }>({ show: false, id: null });
  
  // Estado para el modal de éxito con vista previa del PDF
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successDetails, setSuccessDetails] = useState<SuccessDetails | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Estado para formulario
  const [formData, setFormData] = useState<LoanFormData>({
    EmployeeID: '',
    ApplicationDate: new Date().toISOString().split('T')[0],
    Amount: '',
    NumberOfPayments: '',
    DiscountAmount: '',
    FirstDiscountDate: '',
    Observations: ''
  });

  // Referencias
  const employeeIdInputRef = useRef<HTMLInputElement>(null);

  // Cargar préstamos al montar
  useEffect(() => {
    if (user) {
      fetchLoans();
    }
  }, [user]);

  // Aplicar filtros cuando cambien
  useEffect(() => {
    applyFilters();
  }, [loans, filters]);

  // Actualizar páginas cuando cambien los préstamos filtrados
  useEffect(() => {
    setTotalPages(Math.ceil(filteredLoans.length / itemsPerPage));
    setCurrentPage(1);
  }, [filteredLoans, itemsPerPage]);

  // Obtener préstamos actuales de la página
  const currentLoans = filteredLoans.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Función para obtener préstamos
  const fetchLoans = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/administrative-personnel-dashboard/employee-management/loans');
      
      if (!response.ok) {
        throw new Error('Error al cargar préstamos');
      }

      const data = await response.json();
      
      if (data.success) {
        setLoans(data.loans || []);
      } else {
        setError(data.message || 'Error al cargar préstamos');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('ERROR DE CONEXIÓN AL CARGAR PRÉSTAMOS');
    } finally {
      setLoading(false);
    }
  };

  // Función para aplicar filtros
  const applyFilters = () => {
    let filtered = [...loans];

    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase().trim();
      filtered = filtered.filter(loan => {
        const employeeName = `${loan.FirstName || ''} ${loan.LastName || ''} ${loan.MiddleName || ''}`.toLowerCase();
        return employeeName.includes(searchLower) || 
               loan.EmployeeID.toString().includes(searchLower);
      });
    }

    setFilteredLoans(filtered);
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

      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/loans/search?term=${encodeURIComponent(id)}`);
      
      if (response.ok) {
        const data = await response.json();
        const employee = data.employees?.find((emp: EmployeeSearchResult) => 
          emp.EmployeeID.toString() === id
        );
        
        if (employee) {
          setSelectedEmployee(employee);
          setSelectedEmployeeData(employee);
          setFormData(prev => ({
            ...prev,
            EmployeeID: employee.EmployeeID.toString()
          }));
          setEmployeeNotFound(false);
        } else {
          setSelectedEmployee(null);
          setSelectedEmployeeData(null);
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

  // Función para limpiar la búsqueda de empleado
  const clearEmployeeSearch = () => {
    setEmployeeIdInput('');
    setSelectedEmployee(null);
    setSelectedEmployeeData(null);
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

  // Función para abrir modal de creación
  const handleCreateLoan = () => {
    setModalMode('create');
    setFormData({
      EmployeeID: '',
      ApplicationDate: new Date().toISOString().split('T')[0],
      Amount: '',
      NumberOfPayments: '',
      DiscountAmount: '',
      FirstDiscountDate: '',
      Observations: ''
    });
    setSelectedEmployee(null);
    setSelectedEmployeeData(null);
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

  // Función para abrir modal de edición
  const handleEditLoan = async (loan: EmployeeLoan) => {
    setModalMode('edit');
    setLoanToEdit(loan);
    
    try {
      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/loans/search?term=${loan.EmployeeID}`);
      if (response.ok) {
        const data = await response.json();
        const employeeData = data.employees.find((emp: EmployeeSearchResult) => emp.EmployeeID === loan.EmployeeID);
        if (employeeData) {
          setSelectedEmployeeData(employeeData);
          setSelectedEmployee(employeeData);
          setEmployeeIdInput(loan.EmployeeID.toString());
        }
      }
    } catch (error) {
      console.error('Error al cargar datos del empleado:', error);
    }
    
    setFormData({
      EmployeeID: loan.EmployeeID.toString(),
      ApplicationDate: loan.ApplicationDate,
      Amount: loan.Amount.toString(),
      NumberOfPayments: loan.NumberOfPayments.toString(),
      DiscountAmount: loan.DiscountAmount.toString(),
      FirstDiscountDate: loan.FirstDiscountDate,
      Observations: loan.Observations || ''
    });
    
    setShowModal(true);
  };

  // Función para cerrar modal
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedEmployeeData(null);
    setSelectedEmployee(null);
    setEmployeeIdInput('');
    setEmployeeNotFound(false);
    setError('');
  };

  // Función para eliminar préstamo
  const handleDeleteLoan = async (id: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/loans/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessMessage('¡PRÉSTAMO ELIMINADO EXITOSAMENTE!');
        await fetchLoans();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        throw new Error(data.message || 'ERROR AL ELIMINAR EL PRÉSTAMO');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('ERROR AL ELIMINAR EL PRÉSTAMO. POR FAVOR, INTENTE NUEVAMENTE.');
    } finally {
      setLoading(false);
      setConfirmDelete({ show: false, id: null });
    }
  };

  // Función para manejar cambios en el formulario
  const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    let newValue = value;
    
    if (!['Amount', 'NumberOfPayments', 'DiscountAmount', 'ApplicationDate', 'FirstDiscountDate'].includes(name)) {
      newValue = normalizarMayusculas(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    if (name === 'Amount' || name === 'NumberOfPayments') {
      const amount = parseFloat(name === 'Amount' ? newValue : formData.Amount) || 0;
      const payments = parseInt(name === 'NumberOfPayments' ? newValue : formData.NumberOfPayments) || 1;
      
      if (amount > 0 && payments > 0) {
        const discountAmount = amount / payments;
        setFormData(prev => ({
          ...prev,
          DiscountAmount: discountAmount.toFixed(2)
        }));
      }
    }
  };

  // En tu componente (app/administrative-personnel-dashboard/employee-management/loans/page.tsx)
// Agrega esta función para manejar la edición con actualización de documento

// Función para guardar préstamo (edición)
const handleSaveLoan = async () => {
  try {
    setSaving(true);
    setError('');

    if (!formData.EmployeeID) {
      setError('DEBE SELECCIONAR UN EMPLEADO VÁLIDO');
      setSaving(false);
      return;
    }

    if (!formData.ApplicationDate) {
      setError('LA FECHA DE SOLICITUD ES REQUERIDA');
      setSaving(false);
      return;
    }

    const amount = parseFloat(formData.Amount);
    if (isNaN(amount) || amount <= 0) {
      setError('EL MONTO DEBE SER UN NÚMERO MAYOR A 0');
      setSaving(false);
      return;
    }

    const payments = parseInt(formData.NumberOfPayments);
    if (isNaN(payments) || payments <= 0) {
      setError('EL NÚMERO DE PAGOS DEBE SER UN NÚMERO MAYOR A 0');
      setSaving(false);
      return;
    }

    const discountAmount = parseFloat(formData.DiscountAmount);
    if (isNaN(discountAmount) || discountAmount <= 0) {
      setError('EL MONTO DE DESCUENTO DEBE SER UN NÚMERO MAYOR A 0');
      setSaving(false);
      return;
    }

    if (!formData.FirstDiscountDate) {
      setError('LA FECHA DEL PRIMER DESCUENTO ES REQUERIDA');
      setSaving(false);
      return;
    }

    const loanData = {
      EmployeeID: parseInt(formData.EmployeeID),
      ApplicationDate: formData.ApplicationDate,
      Amount: amount,
      NumberOfPayments: payments,
      DiscountAmount: discountAmount,
      FirstDiscountDate: formData.FirstDiscountDate,
      Observations: formData.Observations || null
    };

    let response;
    
    if (modalMode === 'create') {
      response = await fetch('/api/administrative-personnel-dashboard/employee-management/loans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loanData)
      });
    } else {
      response = await fetch(`/api/administrative-personnel-dashboard/employee-management/loans/${loanToEdit?.LoanID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loanData)
      });
    }

    const data = await response.json();

    if (response.ok && data.success) {
      handleCloseModal();
      await fetchLoans();
      
      // Mostrar mensaje según el caso
      if (modalMode === 'edit') {
        if (data.fileUrl && data.fileUrl !== loanToEdit?.FileURL) {
          setSuccessMessage('¡PRÉSTAMO ACTUALIZADO EXITOSAMENTE!');
        } else {
          setSuccessMessage('¡PRÉSTAMO ACTUALIZADO EXITOSAMENTE!');
        }
      } else if (modalMode === 'create' && selectedEmployeeData && data.fileUrl) {
        // Mostrar modal de éxito con vista previa (para creación)
        const baseUrl = window.location.origin;
        const pdfUrl = data.fileUrl;
        const excelUrl = `${baseUrl}/api/download/edit/FT-RH-21?empleadoId=${parseInt(formData.EmployeeID)}`;
        
        setSuccessDetails({
          LoanID: data.loanId || loanToEdit?.LoanID,
          EmployeeID: parseInt(formData.EmployeeID),
          EmployeeName: `${selectedEmployeeData.FirstName} ${selectedEmployeeData.LastName} ${selectedEmployeeData.MiddleName || ''}`.trim(),
          tipo: selectedEmployeeData.tipo,
          ApplicationDate: formData.ApplicationDate,
          Amount: amount,
          NumberOfPayments: payments,
          DiscountAmount: discountAmount,
          FirstDiscountDate: formData.FirstDiscountDate,
          fileUrl: pdfUrl,
          pdfUrl: pdfUrl,
          excelUrl: excelUrl
        });
        setShowSuccessModal(true);
      } else {
        setSuccessMessage(modalMode === 'create' ? '¡PRÉSTAMO CREADO EXITOSAMENTE!' : '¡PRÉSTAMO ACTUALIZADO EXITOSAMENTE!');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } else {
      setError(data.message || 'ERROR AL GUARDAR PRÉSTAMO');
    }
  } catch (error) {
    console.error('Error:', error);
    setError('ERROR DE CONEXIÓN AL GUARDAR PRÉSTAMO');
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
      
      // Crear un enlace para descargar directamente
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
                ¿Está seguro que desea eliminar este préstamo? Esta acción no se puede deshacer.
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
                onClick={() => confirmDelete.id && handleDeleteLoan(confirmDelete.id)}
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
                  El préstamo ha sido registrado correctamente en el sistema.
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
              {/* Columna izquierda - Detalles del préstamo */}
              <div className="w-full md:w-1/3 p-6 border-r border-gray-200 overflow-y-auto">
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">DETALLES DEL REGISTRO</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">ID PRÉSTAMO:</span>
                        <span className="text-gray-600 mt-1 text-sm">{successDetails.LoanID}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">ID EMPLEADO:</span>
                        <span className="text-gray-600 mt-1 text-sm">{successDetails.EmployeeID}</span>
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
                        <span className="block text-xs font-bold text-gray-700 uppercase">FECHA SOLICITUD:</span>
                        <span className="text-gray-600 mt-1 text-sm">{formatDate(successDetails.ApplicationDate)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">DOCUMENTOS GENERADOS</h3>
                    <div className="space-y-3">
                      {/* PDF */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-gray-600 mr-2" />
                          <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-21 (PDF)</span>
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
                            onClick={() => handleDownloadPDF(successDetails.pdfUrl, `FT-RH-21-${successDetails.tipo}-${successDetails.EmployeeID}.pdf`)}
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
                          <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-21 (EDITABLE)</span>
                        </div>
                        <button
                          onClick={() => handleDownloadExcel(successDetails.excelUrl, `FT-RH-21-${successDetails.tipo}-${successDetails.EmployeeID}.xlsx`)}
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
                    VISTA PREVIA - FORMATO FT-RH-21
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
                    title="Vista previa del formato FT-RH-21"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PRÉSTAMO */}
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
                  {modalMode === 'create' ? 'NUEVO PRÉSTAMO' : 'EDITAR PRÉSTAMO'}
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  {modalMode === 'create' 
                    ? 'Registre un nuevo préstamo para un empleado.'
                    : 'Modifique la información del préstamo seleccionado.'
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
                {/* Búsqueda por ID del empleado */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                    ID DEL EMPLEADO 
                  </h3>
                  
                  {/* Input para ID del empleado */}
                  <div className="mb-4">
                    <div className="relative">
                      <input
                        ref={employeeIdInputRef}
                        type="text"
                        value={employeeIdInput}
                        onChange={(e) => {
                          setEmployeeIdInput(normalizarMayusculas(e.target.value));
                          if (employeeNotFound) setEmployeeNotFound(false);
                        }}
                        onKeyDown={handleEmployeeIdKeyDown}
                        placeholder="Ingrese el ID del empleado"
                        className={`w-full px-3 py-2.5 text-sm bg-white border rounded focus:outline-none focus:border-[#3a6ea5] font-medium ${
                          employeeNotFound ? 'border-red-500' : 'border-gray-400'
                        }`}
                        disabled={modalMode === 'edit' || selectedEmployee !== null}
                      />
                      {!selectedEmployee && (
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

                  {/* Datos del empleado seleccionado */}
                  {selectedEmployeeData && (
                    <div className="space-y-6">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                          INFORMACIÓN DEL EMPLEADO
                        </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <span className="block text-xs font-bold text-gray-500 uppercase">Nombre completo</span>
                            <span className="text-sm text-gray-900">
                              {`${selectedEmployeeData.FirstName} ${selectedEmployeeData.LastName} ${selectedEmployeeData.MiddleName || ''}`.trim()}
                            </span>
                          </div>

                          <div>
                            <span className="block text-xs font-bold text-gray-500 uppercase">ID del empleado</span>
                            <span className="text-sm text-gray-900">{selectedEmployeeData.EmployeeID}</span>
                          </div>

                          <div>
                            <span className="block text-xs font-bold text-gray-500 uppercase">Tipo</span>
                            <span className="text-sm text-gray-900">{selectedEmployeeData.tipo}</span>
                          </div>

                          <div>
                            <span className="block text-xs font-bold text-gray-500 uppercase">Puesto</span>
                            <span className="text-sm text-gray-900">{selectedEmployeeData.Position || 'N/A'}</span>
                          </div>

                          <div>
                            <span className="block text-xs font-bold text-gray-500 uppercase">Horario</span>
                            <span className="text-sm text-gray-900">{selectedEmployeeData.WorkSchedule || 'N/A'}</span>
                          </div>

                          <div>
                            <span className="block text-xs font-bold text-gray-500 uppercase">Salario base</span>
                            <span className="text-sm text-gray-900">{selectedEmployeeData.Salary ? formatCurrency(selectedEmployeeData.Salary) : 'N/A'}</span>
                          </div>

                          <div>
                            <span className="block text-xs font-bold text-gray-500 uppercase">Salario IMSS</span>
                            <span className="text-sm text-gray-900">{selectedEmployeeData.SalaryIMSS ? formatCurrency(selectedEmployeeData.SalaryIMSS) : 'N/A'}</span>
                          </div>

                          <div>
                            <span className="block text-xs font-bold text-gray-500 uppercase">Inicio de contrato</span>
                            <span className="text-sm text-gray-900">{selectedEmployeeData.ContractStartDate ? formatDate(selectedEmployeeData.ContractStartDate) : 'N/A'}</span>
                          </div>

                          {selectedEmployeeData.tipo === 'BASE' ? (
                            <div>
                              <span className="block text-xs font-bold text-gray-500 uppercase">Área</span>
                              <span className="text-sm text-gray-900">{selectedEmployeeData.Area || 'N/A'}</span>
                            </div>
                          ) : (
                            <>
                              <div>
                                <span className="block text-xs font-bold text-gray-500 uppercase">Proyecto</span>
                                <span className="text-sm text-gray-900">{selectedEmployeeData.NameProject || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="block text-xs font-bold text-gray-500 uppercase">Fin de contrato</span>
                                <span className="text-sm text-gray-900">{selectedEmployeeData.ContractEndDate ? formatDate(selectedEmployeeData.ContractEndDate) : 'N/A'}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Datos del préstamo */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                    DATOS DEL PRÉSTAMO
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        FECHA DE SOLICITUD *
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          name="ApplicationDate"
                          value={formData.ApplicationDate}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        MONTO DEL PRÉSTAMO *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          name="Amount"
                          value={formData.Amount}
                          onChange={handleFormChange}
                          step="0.01"
                          min="0"
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese el monto del préstamo"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        NÚMERO DE PAGOS *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          name="NumberOfPayments"
                          value={formData.NumberOfPayments}
                          onChange={handleFormChange}
                          min="1"
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese el número de pagos"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        MONTO DE DESCUENTO *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          name="DiscountAmount"
                          value={formData.DiscountAmount}
                          onChange={handleFormChange}
                          step="0.01"
                          min="0"
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Se calcula automáticamente"
                          readOnly
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        FECHA PRIMER DESCUENTO *
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          name="FirstDiscountDate"
                          value={formData.FirstDiscountDate}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          required
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        OBSERVACIONES *
                      </label>
                      <div className="relative">
                        <textarea
                          name="Observations"
                          value={formData.Observations}
                          onChange={handleFormChange}
                          rows={3}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium resize-none"
                          placeholder="Ingrese las observaciones"
                          required
                        />
                      </div>
                    </div>
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
                onClick={handleSaveLoan}
                disabled={saving || !selectedEmployee}
                className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    GUARDANDO...
                  </>
                ) : (
                  modalMode === 'create' ? 'CREAR' : 'ACTUALIZAR'
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
                PRÉSTAMOS
              </h1>
              <p className="text-sm text-gray-200 mt-1">
                Administre los préstamos solicitados por los empleados.
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
                  placeholder="Buscar por ID o nombre de empleado..."
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
              onClick={handleCreateLoan}
              className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap"
            >
              NUEVO PRÉSTAMO
            </button>
          </div>

          {/* Tabla de préstamos */}
          <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">ID PRÉSTAMO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">ID EMPLEADO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">EMPLEADO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">PUESTO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">TIPO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">FECHA SOLICITUD</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">MONTO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">PAGOS</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">DESCUENTO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">1ER DESCUENTO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">DOCUMENTOS</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a6ea5] mb-2"></div>
                          <p className="text-gray-600">Cargando préstamos...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <AlertCircle className="h-8 w-8 text-gray-400 mb-3" />
                          <p className="text-sm font-medium text-gray-600 mt-2 leading-5">
                            {filters.search
                              ? 'No se encontraron préstamos que coincidan con la búsqueda'
                              : 'No hay préstamos registrados'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentLoans.map((loan) => (
                      <tr key={loan.LoanID} className="hover:bg-gray-50 transition-colors border-b border-gray-300">
                        <td className="py-3 px-4 text-sm text-gray-800 font-medium">{loan.LoanID}</td>
                        <td className="py-3 px-4 text-sm text-gray-800 font-medium">{loan.EmployeeID}</td>
                        <td className="py-3 px-4">
                          <div className="text-sm font-medium text-gray-800 uppercase">
                            {loan.FirstName} {loan.LastName} {loan.MiddleName}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-800 uppercase">{loan.Position || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-800 uppercase">{loan.tipo || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800">{formatDate(loan.ApplicationDate)}</td>
                        <td className="py-3 px-4 text-sm text-gray-800 font-medium">{formatCurrency(loan.Amount)}</td>
                        <td className="py-3 px-4 text-sm text-gray-800">{loan.NumberOfPayments}</td>
                        <td className="py-3 px-4 text-sm text-gray-800">{formatCurrency(loan.DiscountAmount)}</td>
                        <td className="py-3 px-4 text-sm text-gray-800">{formatDate(loan.FirstDiscountDate)}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col space-y-1">
                            {loan.FileURL ? (
                              <>
                                <a
                                  href={loan.FileURL}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center text-xs text-gray-700 hover:underline"
                                  title="Ver PDF"
                                >
                                  Ver
                                </a>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">Sin documentos</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditLoan(loan)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Editar préstamo"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete({ show: true, id: loan.LoanID })}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Eliminar préstamo"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredLoans.length > 0 && totalPages > 1 && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-300 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  MOSTRANDO {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredLoans.length)} DE {filteredLoans.length} REGISTROS
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
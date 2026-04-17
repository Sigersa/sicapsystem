// app/administrative-personnel-dashboard/job-termination/page.tsx
'use client';

import AppHeader from '@/components/header/2/2.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/2';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, UserX, UserMinus, X, RefreshCw, Trash2, CheckCircle, AlertCircle, Eye, Download, FileText } from 'lucide-react';
import JSZip from 'jszip';

type EmployeeType = 'BASE' | 'PROJECT';

interface BaseEmployee {
  EmployeeID: number;
  BasePersonnelID: number;
  FirstName: string;
  LastName: string;
  MiddleName: string | null;
  Position: string;
  Area: string;
  Salary: number;
  WorkSchedule: string;
  RFC: string;
  CURP: string;
  NSS: string;
  Email: string;
  Phone: string;
  tipo: 'BASE';
  Status?: number;
}

interface ProjectEmployee {
  EmployeeID: number;
  ProjectPersonnelID: number;
  FirstName: string;
  LastName: string;
  MiddleName: string | null;
  ProjectName: string;
  ProjectID: number;
  Position: string;
  Salary: number;
  WorkSchedule: string;
  StartDate: string;
  EndDate: string | null;
  RFC: string;
  CURP: string;
  NSS: string;
  Email: string;
  Phone: string;
  tipo: 'PROJECT';
  Status?: number;
}

type Employee = BaseEmployee | ProjectEmployee;

interface Filters {
  search: string;
  tipo: 'TODOS' | EmployeeType;
  projectId?: string;
}

interface Proyecto {
  ProjectID: number;
  NameProject: string;
}

type FormatoActivo = 'FT-RH-12' | 'FT-RH-13' | 'FT-RH-14';

interface TerminationDetails {
  empleadoId: string;
  nombre: string;
  puesto: string;
  tipoPersonal: string;
  fechaTerminacion: string;
  ftRh12PdfUrl?: string;
  ftRh12PdfDownloadUrl?: string;
  ftRh13PdfUrl?: string;
  ftRh13PdfDownloadUrl?: string;
  ftRh14PdfUrl?: string;
  ftRh14PdfDownloadUrl?: string;
  ftRh12WordUrl?: string;
  ftRh13WordUrl?: string;
  ftRh14WordUrl?: string;
}

interface ConfirmTermination {
  show: boolean;
  employee: Employee | null;
}

interface ReactivationModal {
  show: boolean;
  employee: Employee | null;
}

export default function EmployeesListPage() {
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [filters, setFilters] = useState<Filters>({
    search: '',
    tipo: 'TODOS'
  });

  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [terminationDetails, setTerminationDetails] = useState<TerminationDetails | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [formatoActivo, setFormatoActivo] = useState<FormatoActivo>('FT-RH-12');

  const [confirmTermination, setConfirmTermination] = useState<ConfirmTermination>({
    show: false,
    employee: null
  });

  // Nuevo estado para el modal de reactivación
  const [reactivationModal, setReactivationModal] = useState<ReactivationModal>({
    show: false,
    employee: null
  });

  useEffect(() => {
    fetchEmployees();
    fetchProjects();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [employees, filters]);

  useEffect(() => {
    setTotalPages(Math.ceil(filteredEmployees.length / itemsPerPage));
    setCurrentPage(1);
  }, [filteredEmployees, itemsPerPage]);

  const currentEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/administrative-personnel-dashboard/job-termination');
      
      if (!response.ok) {
        throw new Error('Error al cargar empleados');
      }

      const data = await response.json();
      
      if (data.success) {
        setEmployees(data.employees || []);
      } else {
        setError(data.message || 'Error al cargar empleados');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Error de conexión al cargar empleados');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await fetch('/api/catalogs/projects');
      if (response.ok) {
        const data = await response.json();
        setProyectos(data);
      }
    } catch (error) {
      console.error('Error al cargar proyectos:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const getSavedDocumentUrls = async (empleadoId: string): Promise<any> => {
    try {
      const response = await fetch(`/api/administrative-personnel-dashboard/job-termination?action=getDocumentUrls&employeeId=${empleadoId}`);
      const data = await response.json();
      
      if (data.success && data.urls) {
        return data.urls;
      }
      return null;
    } catch (error) {
      console.error('Error al obtener URLs guardadas:', error);
      return null;
    }
  };

  const generateDownloadUrls = async (empleadoId: string, tipoPersonal: string, nombre: string, puesto: string): Promise<TerminationDetails> => {
    const savedUrls = await getSavedDocumentUrls(empleadoId);
    
    return {
      empleadoId,
      nombre,
      puesto,
      tipoPersonal,
      fechaTerminacion: new Date().toLocaleDateString('es-MX'),
      ftRh12PdfUrl: savedUrls?.ftRh12PdfUrl || `/api/download/pdf/FT-RH-12?empleadoId=${empleadoId}&preview=1`,
      ftRh12PdfDownloadUrl: savedUrls?.ftRh12PdfUrl || `/api/download/pdf/FT-RH-12?empleadoId=${empleadoId}`,
      ftRh13PdfUrl: savedUrls?.ftRh13PdfUrl || `/api/download/pdf/FT-RH-13?empleadoId=${empleadoId}&preview=1`,
      ftRh13PdfDownloadUrl: savedUrls?.ftRh13PdfUrl || `/api/download/pdf/FT-RH-13?empleadoId=${empleadoId}`,
      ftRh14PdfUrl: savedUrls?.ftRh14PdfUrl || `/api/download/pdf/FT-RH-14?empleadoId=${empleadoId}&preview=1`,
      ftRh14PdfDownloadUrl: savedUrls?.ftRh14PdfUrl || `/api/download/pdf/FT-RH-14?empleadoId=${empleadoId}`,
      ftRh12WordUrl: `/api/download/edit/FT-RH-12?empleadoId=${empleadoId}`,
      ftRh13WordUrl: `/api/download/edit/FT-RH-13?empleadoId=${empleadoId}`,
      ftRh14WordUrl: `/api/download/edit/FT-RH-14?empleadoId=${empleadoId}`
    };
  };

  const fetchEmployeeInfo = async (employeeId: number): Promise<any> => {
    try {
      const response = await fetch(`/api/administrative-personnel-dashboard/job-termination?employeeId=${employeeId}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        return {
          nombre: data.nombre,
          puesto: data.puesto,
          tipoPersonal: data.tipoPersonal,
          mesesTrabajados: data.mesesTrabajados,
          fechaInicio: data.fechaInicio,
          fechaTermino: data.fechaTermino,
          direccion: data.direccion
        };
      }
      return {
        nombre: 'Empleado',
        puesto: 'No especificado',
        tipoPersonal: 'BASE',
        mesesTrabajados: 0,
        fechaInicio: '',
        fechaTermino: '',
        direccion: ''
      };
    } catch (error) {
      console.error('Error al obtener información del empleado:', error);
      return {
        nombre: 'Empleado',
        puesto: 'No especificado',
        tipoPersonal: 'BASE',
        mesesTrabajados: 0,
        fechaInicio: '',
        fechaTermino: '',
        direccion: ''
      };
    }
  };

  const confirmToggleStatus = (employee: Employee) => {
    const currentStatus = employee.Status ?? 1;
    if (currentStatus === 1) {
      setConfirmTermination({
        show: true,
        employee: employee
      });
    } else {
      // Para empleados inactivos, mostrar modal de reactivación
      if (employee.tipo === 'PROJECT') {
        setReactivationModal({
          show: true,
          employee: employee
        });
      } else {
        // Para empleados BASE, se puede reactivar directamente
        toggleEmployeeStatus(employee);
      }
    }
  };

  const toggleEmployeeStatus = async (employee: Employee) => {
    const currentStatus = employee.Status ?? 1;
    const newStatus = currentStatus === 1 ? 0 : 1;
    const actionText = newStatus === 0 ? 'dar de baja' : 'reactivar';

    try {
      setActionLoading(employee.EmployeeID);
      setError('');
      setSuccessMessage('');

      const response = await fetch('/api/administrative-personnel-dashboard/job-termination', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          EmployeeID: employee.EmployeeID,
          Status: newStatus
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (newStatus === 0) {
          const employeeInfo = await fetchEmployeeInfo(employee.EmployeeID);
          
          const details = await generateDownloadUrls(
            employee.EmployeeID.toString(), 
            employeeInfo.tipoPersonal,
            employeeInfo.nombre,
            employeeInfo.puesto
          );
          
          setTerminationDetails(details);
          setShowSuccessModal(true);
        }
        
        setSuccessMessage(data.message || `Empleado ${actionText} exitosamente`);
        await fetchEmployees();
      } else {
        setError(data.message || `Error al ${actionText} al empleado`);
      }
    } catch (error) {
      console.error('Error:', error);
      setError(`Error de conexión al ${actionText} al empleado`);
    } finally {
      setActionLoading(null);
      setConfirmTermination({ show: false, employee: null });
    }
  };

  const deleteEmployee = async (employee: Employee) => {
    if (employee.Status !== 0) {
      setError('Solo se pueden eliminar empleados que están dados de baja');
      return;
    }

    if (!confirm(`¿Está seguro de que desea ELIMINAR PERMANENTEMENTE a ${employee.FirstName} ${employee.LastName}? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      setActionLoading(employee.EmployeeID);
      setError('');
      setSuccessMessage('');

      const response = await fetch('/api/administrative-personnel-dashboard/job-termination', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          EmployeeID: employee.EmployeeID
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessMessage(data.message || 'Empleado eliminado permanentemente');
        await fetchEmployees();
      } else {
        setError(data.message || 'Error al eliminar al empleado');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Error de conexión al eliminar al empleado');
    } finally {
      setActionLoading(null);
    }
  };

  const closeReactivationModal = () => {
    setReactivationModal({ show: false, employee: null });
  };

  const handleDownloadFile = async (url: string, filename: string) => {
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

  const handleDownloadAllPDFs = async () => {
    if (!terminationDetails) return;
    
    try {
      setDownloadingZip(true);
      
      const zip = new JSZip();
      
      if (terminationDetails.ftRh12PdfDownloadUrl) {
        const response = await fetch(terminationDetails.ftRh12PdfDownloadUrl);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(`FT-RH-12_${terminationDetails.empleadoId}.pdf`, blob);
        }
      }
      
      if (terminationDetails.ftRh13PdfDownloadUrl) {
        const response = await fetch(terminationDetails.ftRh13PdfDownloadUrl);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(`FT-RH-13_${terminationDetails.empleadoId}.pdf`, blob);
        }
      }
      
      if (terminationDetails.ftRh14PdfDownloadUrl) {
        const response = await fetch(terminationDetails.ftRh14PdfDownloadUrl);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(`FT-RH-14_${terminationDetails.empleadoId}.pdf`, blob);
        }
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      const downloadUrl = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `documentos_baja_${terminationDetails.empleadoId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      
      setDownloadingZip(false);
    } catch (error) {
      console.error('Error al crear ZIP:', error);
      setError('Error al crear archivo ZIP. Intente nuevamente.');
      setDownloadingZip(false);
    }
  };

  const handleDownloadAllEditables = async () => {
    if (!terminationDetails) return;
    
    try {
      setDownloadingZip(true);
      
      const zip = new JSZip();
      
      if (terminationDetails.ftRh12WordUrl) {
        const response = await fetch(terminationDetails.ftRh12WordUrl);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(`FT-RH-12_${terminationDetails.empleadoId}.docx`, blob);
        }
      }
      
      if (terminationDetails.ftRh13WordUrl) {
        const response = await fetch(terminationDetails.ftRh13WordUrl);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(`FT-RH-13_${terminationDetails.empleadoId}.docx`, blob);
        }
      }
      
      if (terminationDetails.ftRh14WordUrl) {
        const response = await fetch(terminationDetails.ftRh14WordUrl);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(`FT-RH-14_${terminationDetails.empleadoId}.docx`, blob);
        }
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      const downloadUrl = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `editables_baja_${terminationDetails.empleadoId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      
      setDownloadingZip(false);
    } catch (error) {
      console.error('Error al crear ZIP de editables:', error);
      setError('Error al crear archivo ZIP. Intente nuevamente.');
      setDownloadingZip(false);
    }
  };

  const closeModal = () => {
    setShowSuccessModal(false);
    setPdfLoading(false);
    setTerminationDetails(null);
    setFormatoActivo('FT-RH-12');
  };

  const closeConfirmModal = () => {
    setConfirmTermination({ show: false, employee: null });
  };

  const siguienteFormato = () => {
    if (formatoActivo === 'FT-RH-12') {
      setFormatoActivo('FT-RH-13');
    } else if (formatoActivo === 'FT-RH-13') {
      setFormatoActivo('FT-RH-14');
    }
  };

  const anteriorFormato = () => {
    if (formatoActivo === 'FT-RH-14') {
      setFormatoActivo('FT-RH-13');
    } else if (formatoActivo === 'FT-RH-13') {
      setFormatoActivo('FT-RH-12');
    }
  };

  const applyFilters = () => {
    let filtered = [...employees];

    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase().trim();
      const isNumber = /^\d+$/.test(searchLower);
      
      filtered = filtered.filter(emp => {
        if (isNumber && emp.EmployeeID.toString().includes(searchLower)) {
          return true;
        }
        
        const fullName = `${emp.FirstName} ${emp.LastName} ${emp.MiddleName || ''}`.toLowerCase();
        const firstNameMatch = emp.FirstName.toLowerCase().includes(searchLower);
        const lastNameMatch = emp.LastName.toLowerCase().includes(searchLower);
        const middleNameMatch = emp.MiddleName?.toLowerCase().includes(searchLower) || false;
        const fullNameMatch = fullName.includes(searchLower);
        
        return firstNameMatch || lastNameMatch || middleNameMatch || fullNameMatch;
      });
    }

    if (filters.tipo !== 'TODOS') {
      filtered = filtered.filter(emp => emp.tipo === filters.tipo);
    }

    if (filters.projectId && filters.tipo === 'PROJECT') {
      filtered = filtered.filter(emp => 
        emp.tipo === 'PROJECT' && (emp as ProjectEmployee).ProjectID === parseInt(filters.projectId!)
      );
    }

    setFilteredEmployees(filtered);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      tipo: 'TODOS',
      projectId: undefined
    });
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3a6ea5] mx-auto"></div>
          <p className="mt-4 text-gray-700 font-medium">Verificando sesión...</p>
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

      {/* Modal de confirmación de baja */}
      {confirmTermination.show && confirmTermination.employee && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70"
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-in relative z-[10000]">
            <div className="p-6 pb-4 border-b border-gray-300">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                CONFIRMAR BAJA
              </h2>
              <p className="text-sm text-gray-600 mt-2 leading-5">
                ¿Está seguro que desea dar de baja a <span className="font-bold text-gray-800">{confirmTermination.employee.FirstName} {confirmTermination.employee.LastName}</span>?
                <br /><br />
                Esta acción generará los documentos de terminación laboral y el empleado ya no podrá acceder al sistema.
              </p>
            </div>
            
            <div className="p-6 pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeConfirmModal}
                className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={() => toggleEmployeeStatus(confirmTermination.employee!)}
                disabled={actionLoading === confirmTermination.employee.EmployeeID}
                className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === confirmTermination.employee.EmployeeID ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    PROCESANDO...
                  </>
                ) : (
                  'DAR DE BAJA'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de reactivación para personal de proyecto */}
      {reactivationModal.show && reactivationModal.employee && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70"
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-in relative z-[10000]">
            <div className="p-6 pb-4 border-b border-gray-300">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                REACTIVACIÓN DE USUARIO
              </h2>
              <p className="text-sm text-gray-600 mt-2 leading-5">
                Para reactivar al empleado <span className="font-bold text-gray-800">{reactivationModal.employee.FirstName} {reactivationModal.employee.LastName}</span> del tipo <span className="font-bold">PERSONAL DE PROYECTO</span>:
              </p>
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-medium">
                  ⚠️ Debe dirigirse al módulo de <span className="font-bold">EDICIÓN DE USUARIO</span> para reactivar su contrato y asignar un nuevo proyecto.
                </p>
              </div>
              <p className="text-sm text-gray-600 mt-4">
                La reactivación desde este módulo no está disponible para personal de proyecto debido a que requieren un nuevo contrato y asignación de proyecto.
              </p>
            </div>
            
            <div className="p-6 pt-4 flex justify-end">
              <button
                type="button"
                onClick={closeReactivationModal}
                className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5582] transition-colors flex items-center justify-center whitespace-nowrap"
              >
                ENTENDIDO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de éxito con documentos */}
      {showSuccessModal && terminationDetails && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70" style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full h-[90vh] flex flex-col animate-fade-in relative z-[10000]">
            <div className="p-6 pb-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  ¡REGISTRO EXITOSO!
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  El movimiento ha sido registrado correctamente en el sistema.
                </p>
              </div>
              <button
                onClick={closeModal}
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
                    <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">DETALLES DEL REGISTRO</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">ID EMPLEADO:</span>
                        <span className="text-gray-600 mt-1 text-sm">{terminationDetails.empleadoId}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">NOMBRE:</span>
                        <span className="text-gray-600 mt-1 text-sm">{terminationDetails.nombre}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">PUESTO:</span>
                        <span className="text-gray-600 mt-1 text-sm">{terminationDetails.puesto}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">TIPO:</span>
                        <span className="text-gray-600 mt-1 text-sm">{terminationDetails.tipoPersonal}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">FECHA DE BAJA:</span>
                        <span className="text-gray-600 mt-1 text-sm">{terminationDetails.fechaTerminacion}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">DOCUMENTOS GENERADOS</h3>
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={anteriorFormato}
                        disabled={formatoActivo === 'FT-RH-12'}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Formato anterior"
                      >
                        <ChevronLeft className="h-4 w-4 text-gray-700" />
                      </button>
                      <span className="font-bold text-gray-800 text-sm">
                        {formatoActivo === 'FT-RH-12' ? 'FORMATO FT-RH-12' : 
                         formatoActivo === 'FT-RH-13' ? 'FORMATO FT-RH-13' : 
                         'FORMATO FT-RH-14'}
                      </span>
                      <button
                        onClick={siguienteFormato}
                        disabled={formatoActivo === 'FT-RH-14'}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Siguiente formato"
                      >
                        <ChevronRight className="h-4 w-4 text-gray-700" />
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {formatoActivo === 'FT-RH-12' ? (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <FileText className="h-5 w-5 text-gray-600 mr-2" />
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-12 (PDF)</span>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={terminationDetails.ftRh12PdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                title="Vista previa"
                              >
                                <Eye className="h-4 w-4 text-gray-700" />
                              </a>
                              <button
                                onClick={() => handleDownloadFile(terminationDetails.ftRh12PdfDownloadUrl || '', `FT-RH-12_${terminationDetails.empleadoId}.pdf`)}
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
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-12 (EDITABLE)</span>
                            </div>
                            <a
                              href={terminationDetails.ftRh12WordUrl}
                              download={`FT-RH-12_${terminationDetails.empleadoId}.docx`}
                              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                              <Download className="h-4 w-4 text-gray-700" />
                            </a>
                          </div>
                        </>
                      ) : formatoActivo === 'FT-RH-13' ? (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <FileText className="h-5 w-5 text-gray-600 mr-2" />
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-13 (PDF)</span>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={terminationDetails.ftRh13PdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                title="Vista previa"
                              >
                                <Eye className="h-4 w-4 text-gray-700" />
                              </a>
                              <button
                                onClick={() => handleDownloadFile(terminationDetails.ftRh13PdfDownloadUrl || '', `FT-RH-13_${terminationDetails.empleadoId}.pdf`)}
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
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-13 (EDITABLE)</span>
                            </div>
                            <a
                              href={terminationDetails.ftRh13WordUrl}
                              download={`FT-RH-13_${terminationDetails.empleadoId}.docx`}
                              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                              <Download className="h-4 w-4 text-gray-700" />
                            </a>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <FileText className="h-5 w-5 text-gray-600 mr-2" />
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-14 (PDF)</span>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={terminationDetails.ftRh14PdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                title="Vista previa"
                              >
                                <Eye className="h-4 w-4 text-gray-700" />
                              </a>
                              <button
                                onClick={() => handleDownloadFile(terminationDetails.ftRh14PdfDownloadUrl || '', `FT-RH-14_${terminationDetails.empleadoId}.pdf`)}
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
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-14 (EDITABLE)</span>
                            </div>
                            <a
                              href={terminationDetails.ftRh14WordUrl}
                              download={`FT-RH-14_${terminationDetails.empleadoId}.docx`}
                              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                              <Download className="h-4 w-4 text-gray-700" />
                            </a>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">DESCARGAS MASIVAS</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="block text-xs font-bold text-gray-700 uppercase">
                          DESCARGAR TODOS LOS PDF
                        </span>
                        <button
                          onClick={handleDownloadAllPDFs}
                          disabled={downloadingZip}
                          className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
                        >
                          {downloadingZip ? (
                            <div className="h-4 w-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Download className="h-4 w-4 text-gray-700" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="block text-xs font-bold text-gray-700 uppercase">
                          DESCARGAR TODOS LOS EDITABLES
                        </span>
                        <button
                          onClick={handleDownloadAllEditables}
                          disabled={downloadingZip}
                          className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
                        >
                          {downloadingZip ? (
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
                    VISTA PREVIA - {
                      formatoActivo === 'FT-RH-12' ? 'FORMATO FT-RH-12' : 
                      formatoActivo === 'FT-RH-13' ? 'FORMATO FT-RH-13' : 
                      'FORMATO FT-RH-14'
                    }
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      {formatoActivo === 'FT-RH-12' ? '1 de 3' : 
                       formatoActivo === 'FT-RH-13' ? '2 de 3' : 
                       '3 de 3'}
                    </span>
                  </div>
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
                    src={
                      formatoActivo === 'FT-RH-12' ? terminationDetails.ftRh12PdfUrl :
                      formatoActivo === 'FT-RH-13' ? terminationDetails.ftRh13PdfUrl : 
                      terminationDetails.ftRh14PdfUrl
                    }
                    className="w-full h-full border-0"
                    onLoad={() => setPdfLoading(false)}
                    title={`Vista previa del ${formatoActivo}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
        <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
          
          <div className="mb-6">
            <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5]">
              <h1 className="text-xl font-bold text-white tracking-tight">
                BAJA / TERMINACIÓN LABORAL
              </h1>
              <p className="text-sm text-gray-200 mt-1">
                Registre bajas y generación de documentación para la terminación laboral de empleados en el sistema.              
              </p>
            </div>
          </div>

          {successMessage && !showSuccessModal && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 animate-fade-in">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                <p className="text-sm font-medium text-gray-600">{successMessage}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 animate-fade-in">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <p className="text-sm font-medium text-gray-600">{error}</p>
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
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
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
            
            <select
              value={filters.tipo}
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                tipo: e.target.value as 'TODOS' | EmployeeType,
                projectId: e.target.value !== 'PROJECT' ? undefined : prev.projectId
              }))}
              className="w-full md:w-48 px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
            >
              <option value="TODOS">TODOS LOS TIPOS</option>
              <option value="BASE">PERSONAL BASE</option>
              <option value="PROJECT">PERSONAL DE PROYECTO</option>
            </select>

            {filters.tipo === 'PROJECT' && (
              <select
                value={filters.projectId || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, projectId: e.target.value }))}
                className="w-full md:w-64 px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                disabled={loadingProjects}
              >
                <option value="">TODOS LOS PROYECTOS</option>
                {proyectos.map((proyecto) => (
                  <option key={proyecto.ProjectID} value={proyecto.ProjectID}>
                    {proyecto.NameProject}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={clearFilters}
              className="px-4 py-2.5 bg-gray-200 text-gray-800 font-bold rounded-md hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              LIMPIAR
            </button>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">ID</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">EMPLEADO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">TIPO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">PUESTO / PROYECTO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">CONTACTO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">ESTADO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a6ea5] mb-2"></div>
                          <p className="text-gray-600">Cargando empleados...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <AlertCircle className="h-8 w-8 text-gray-400 mb-3" />
                          <p className="text-sm font-medium text-gray-600 mt-2 leading-5">
                            {filters.search || filters.tipo !== 'TODOS' || filters.projectId
                              ? 'No se encontraron empleados que coincidan con la búsqueda'
                              : 'No hay empleados registrados en el sistema'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentEmployees.map((employee) => (
                      <tr key={employee.EmployeeID} className="hover:bg-gray-50 transition-colors border-b border-gray-300">
                        <td className="py-3 px-4 text-sm text-gray-800 font-medium">{employee.EmployeeID}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-800">
                                {employee.FirstName} {employee.LastName} {employee.MiddleName}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-800">
                                {employee.tipo === 'BASE' ? 'BASE' : 'PROYECTO'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-800">{employee.Position || 'N/A'}</div>
                          {employee.tipo === 'PROJECT' && (
                            <div className="text-xs text-gray-500 uppercase">
                              {(employee as ProjectEmployee).ProjectName || 'Sin proyecto'}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-800">{employee.Email}</div>
                          <div className="text-xs text-gray-500">{employee.Phone}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            (employee.Status ?? 1) === 1 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {(employee.Status ?? 1) === 1 ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => confirmToggleStatus(employee)}
                              disabled={actionLoading === employee.EmployeeID}
                              className={`p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                (employee.Status ?? 1) === 1
                                  ? 'text-red-600 hover:bg-red-50'
                                  : 'text-green-600 hover:bg-green-50'
                              }`}
                              title={(employee.Status ?? 1) === 1 ? "Dar de baja usuario" : "Reactivar usuario"}
                            >
                              {(employee.Status ?? 1) === 1 ? (
                                <UserMinus className="h-4 w-4" />
                              ) : (
                                <UserX className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => deleteEmployee(employee)}
                              disabled={actionLoading === employee.EmployeeID || (employee.Status ?? 1) === 1}
                              className={`p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                (employee.Status ?? 1) === 0
                                  ? 'text-red-600 hover:bg-red-50'
                                  : 'text-gray-400 cursor-not-allowed'
                              }`}
                              title={(employee.Status ?? 1) === 0 ? "Eliminar usuario permanentemente" : "Solo disponible para usuarios inactivos"}
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

            {filteredEmployees.length > 0 && totalPages > 1 && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-300 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredEmployees.length)} de {filteredEmployees.length} registros
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
// app/administrative-personnel-dashboard/employee-management/vacations/page.tsx
'use client';
import AppHeader from '@/components/header/2/2.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/2';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { useState, useEffect, ChangeEvent, FormEvent, useRef, KeyboardEvent } from 'react';
import { Edit, Trash2, Search, X, CheckCircle, AlertCircle, Eye, ChevronLeft, ChevronRight, RefreshCw, Download, FileText, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

// Interface de empleados
type Employee = {
  EmployeeID: number;
  BasePersonnelID: number;
  FirstName: string;
  LastName: string;
  MiddleName: string;
  Position: string;
  ContractStartDate: string;
  YearsOfSeniority: number;
  DaysOfVacations: number;
};

// Interface para vacaciones
type VacationRecord = {
  VacationID: number;
  EmployeeID: number;
  Days: number;
  StampedDays: number;
  StartDate: string;
  EndDate: string;
  Observations: string;
  FileURL?: string | null;
};

// Interface para búsqueda de empleados
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

// Interface para detalles del éxito
interface SuccessDetails {
  VacationID: number;
  EmployeeID: number;
  EmployeeName: string;
  tipo: 'BASE' | 'PROJECT';
  Days: number;
  StartDate: string;
  EndDate: string;
  fileUrl: string | null;
}

// Función para normalizar texto a mayúsculas
const normalizarMayusculas = (texto: string): string => {
  return texto.toUpperCase();
};

// Función para formatear fecha
const formatDate = (dateString: string): string => {
  try {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch {
    return dateString;
  }
};

// Función para formatear fecha para input date
const formatDateForInput = (dateString: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

// Función para descargar el documento PDF desde la URL almacenada
const downloadVacationPDF = async (fileUrl: string, fileName: string) => {
  try {
    if (!fileUrl) {
      throw new Error('No hay URL de PDF disponible');
    }
    
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error('Error al descargar el PDF');
    }
    
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw error;
  }
};

// Función para descargar el documento Word FT-RH-08
const downloadVacationWord = async (employeeId: number, vacationId?: number) => {
  try {
    let url = `/api/download/edit/FT-RH-08?empleadoId=${employeeId}`;
    if (vacationId) {
      url += `&vacationId=${vacationId}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al descargar el documento Word');
    }
    
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `FT-RH-08-${employeeId}${vacationId ? `-${vacationId}` : ''}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('Error downloading Word:', error);
    throw error;
  }
};

export default function SystemAdminDashboard() {
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();
  
  // Referencias
  const employeeIdInputRef = useRef<HTMLInputElement>(null);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para el formulario
  const [formData, setFormData] = useState({
    EmployeeID: '',
    Days: '',
    StartDate: '',
    EndDate: '',
    Observations: ''
  });

  // Estados para fecha de término calculada
  const [calculatedEndDate, setCalculatedEndDate] = useState<string>('');
  const [calculatedEndDateValue, setCalculatedEndDateValue] = useState<string>('');
  const [selectedEmployeeSeniority, setSelectedEmployeeSeniority] = useState<{
    years: number;
    days: number;
  } | null>(null);

  // Estados para operaciones
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; id: number | null }>({ show: false, id: null });
  
  // Estados para búsqueda de empleados por ID
  const [employeeIdInput, setEmployeeIdInput] = useState('');
  const [searchingEmployee, setSearchingEmployee] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSearchResult | null>(null);
  const [selectedEmployeeData, setSelectedEmployeeData] = useState<EmployeeSearchResult | null>(null);
  const [employeeNotFound, setEmployeeNotFound] = useState(false);

  // Estados para vacaciones
  const [showVacationsModal, setShowVacationsModal] = useState(false);
  const [selectedVacationsEmployee, setSelectedVacationsEmployee] = useState<Employee | null>(null);
  const [vacationRecords, setVacationRecords] = useState<VacationRecord[]>([]);
  const [loadingVacations, setLoadingVacations] = useState(false);
  const [editingObservation, setEditingObservation] = useState<number | null>(null);
  const [editObservationValue, setEditObservationValue] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Estados
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [saving, setSaving] = useState(false);
  const [currentEditRecord, setCurrentEditRecord] = useState<VacationRecord | null>(null);

  // Estado para días totales usados
  const [totalUsedDays, setTotalUsedDays] = useState<number>(0);
  
  // Estado para el modal de éxito con vista previa del PDF
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successDetails, setSuccessDetails] = useState<SuccessDetails | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  
  // Estado para mostrar opciones de descarga
  const [showDownloadOptions, setShowDownloadOptions] = useState<{ show: boolean; fileUrl: string; vacationId: number; employeeId: number }>({
    show: false,
    fileUrl: '',
    vacationId: 0,
    employeeId: 0
  });

  // Calcular fecha de término cuando cambian los días o la fecha de inicio
  useEffect(() => {
    if (formData.Days && parseFloat(formData.Days) > 0 && formData.StartDate) {
      const startDate = new Date(formData.StartDate);
      if (!isNaN(startDate.getTime())) {
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + parseFloat(formData.Days));
        const formattedEndDate = endDate.toISOString().split('T')[0];
        setCalculatedEndDateValue(formattedEndDate);
        setCalculatedEndDate(formatDate(endDate.toISOString()));
        
        setFormData(prev => ({
          ...prev,
          EndDate: formattedEndDate
        }));
      } else {
        setCalculatedEndDateValue('');
        setCalculatedEndDate('');
      }
    } else {
      setCalculatedEndDateValue('');
      setCalculatedEndDate('');
    }
  }, [formData.Days, formData.StartDate]);

  // Cargar empleados al montar el componente
  useEffect(() => {
    if (user) {
      fetchEmployees();
    }
  }, [user]);

  // Filtrar empleados cuando cambia el término de búsqueda
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredEmployees(employees);
    } else {
      const filtered = employees.filter(employee =>
        employee.FirstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.LastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.MiddleName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.Position?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredEmployees(filtered);
    }
  }, [searchTerm, employees]);

  // Actualizar páginas cuando cambien los registros filtrados
  useEffect(() => {
    setTotalPages(Math.ceil(filteredEmployees.length / itemsPerPage));
    setCurrentPage(1);
  }, [filteredEmployees, itemsPerPage]);

  // Obtener registros actuales de la página
  const currentEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Mostrar loading mientras se verifica la sesión
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

  // Función para exportar empleados y sus períodos de vacaciones a Excel
  const exportEmployeesWithVacationsToExcel = async () => {
    try {
      setLoading(true);
      const excelData = [];
      
      for (const employee of filteredEmployees) {
        // Obtener períodos de vacaciones para este empleado
        const vacationsResponse = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeevacations?action=get&employeeId=${employee.EmployeeID}`, {
          method: 'PUT'
        });
        
        let vacationPeriods: VacationRecord[] = [];
        if (vacationsResponse.ok) {
          vacationPeriods = await vacationsResponse.json();
        }
        
        if (vacationPeriods.length === 0) {
          // Si no tiene períodos, agregar una fila con los datos del empleado y campos de vacaciones vacíos
          excelData.push({
            'ID EMPLEADO': employee.EmployeeID,
            'NOMBRE COMPLETO': `${employee.FirstName} ${employee.LastName} ${employee.MiddleName || ''}`.trim(),
            'PUESTO': employee.Position,
            'FECHA DE INGRESO': formatDate(employee.ContractStartDate),
            'AÑOS DE ANTIGÜEDAD': employee.YearsOfSeniority,
            'DÍAS DE VACACIONES DISPONIBLES': employee.DaysOfVacations,
            'ID PERÍODO VACACIONES': '',
            'FECHA INICIO VACACIONES': '',
            'FECHA FIN VACACIONES': '',
            'DÍAS TOMADOS': '',
            'DÍAS COMPUTADOS': '',
            'OBSERVACIONES VACACIONES': ''
          });
        } else {
          // Agregar una fila por cada período de vacaciones
          vacationPeriods.forEach(period => {
            excelData.push({
              'ID EMPLEADO': employee.EmployeeID,
              'NOMBRE COMPLETO': `${employee.FirstName} ${employee.LastName} ${employee.MiddleName || ''}`.trim(),
              'PUESTO': employee.Position,
              'FECHA DE INGRESO': formatDate(employee.ContractStartDate),
              'AÑOS DE ANTIGÜEDAD': employee.YearsOfSeniority,
              'DÍAS DE VACACIONES DISPONIBLES': employee.DaysOfVacations,
              'ID PERÍODO VACACIONES': period.VacationID,
              'FECHA INICIO VACACIONES': formatDate(period.StartDate),
              'FECHA FIN VACACIONES': formatDate(period.EndDate),
              'DÍAS TOMADOS': period.Days,
              'DÍAS COMPUTADOS': period.StampedDays,
              'OBSERVACIONES VACACIONES': period.Observations || ''
            });
          });
        }
      }

      // Crear hoja de trabajo
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Ajustar anchos de columnas
      const colWidths = [
        { wch: 12 }, // ID EMPLEADO
        { wch: 35 }, // NOMBRE COMPLETO
        { wch: 30 }, // PUESTO
        { wch: 15 }, // FECHA DE INGRESO
        { wch: 18 }, // AÑOS DE ANTIGÜEDAD
        { wch: 25 }, // DÍAS DE VACACIONES DISPONIBLES
        { wch: 18 }, // ID PERÍODO VACACIONES
        { wch: 18 }, // FECHA INICIO VACACIONES
        { wch: 18 }, // FECHA FIN VACACIONES
        { wch: 12 }, // DÍAS TOMADOS
        { wch: 15 }, // DÍAS COMPUTADOS
        { wch: 40 }  // OBSERVACIONES VACACIONES
      ];
      ws['!cols'] = colWidths;

      // Crear libro de trabajo
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'EMPLEADOS_Y_VACACIONES');

      // Generar y descargar archivo
      const fileName = `EMPLEADOS_VACACIONES_COMPLETO_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      setSuccessMessage('EXCEL EXPORTADO EXITOSAMENTE');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error exporting employees with vacations:', error);
      setErrorMessage('ERROR AL EXPORTAR EMPLEADOS Y PERÍODOS DE VACACIONES A EXCEL');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Función para exportar períodos de vacaciones a Excel (mantener la original)
  const exportVacationsToExcel = () => {
    try {
      if (!selectedVacationsEmployee) return;

      // Preparar datos para Excel
      const excelData = vacationRecords.map(record => ({
        'ID PERÍODO': record.VacationID,
        'ID EMPLEADO': record.EmployeeID,
        'EMPLEADO': `${selectedVacationsEmployee.FirstName} ${selectedVacationsEmployee.LastName} ${selectedVacationsEmployee.MiddleName || ''}`.trim(),
        'FECHA INICIO': formatDate(record.StartDate),
        'FECHA FIN': formatDate(record.EndDate),
        'DÍAS': record.Days,
        'DÍAS COMPUTADOS': record.StampedDays,
        'OBSERVACIONES': record.Observations || 'N/A'
      }));

      // Crear hoja de trabajo
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Ajustar anchos de columnas
      const colWidths = [
        { wch: 12 }, // ID PERÍODO
        { wch: 12 }, // ID EMPLEADO
        { wch: 35 }, // EMPLEADO
        { wch: 15 }, // FECHA INICIO
        { wch: 15 }, // FECHA FIN
        { wch: 10 }, // DÍAS
        { wch: 15 }, // DÍAS COMPUTADOS
        { wch: 40 }  // OBSERVACIONES
      ];
      ws['!cols'] = colWidths;

      // Crear libro de trabajo
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `VACACIONES_${selectedVacationsEmployee.EmployeeID}`);

      // Generar y descargar archivo
      const fileName = `VACACIONES_EMP_${selectedVacationsEmployee.EmployeeID}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      setSuccessMessage('EXCEL DE PERÍODOS EXPORTADO EXITOSAMENTE');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error exporting vacations:', error);
      setErrorMessage('ERROR AL EXPORTAR PERÍODOS DE VACACIONES A EXCEL');
      setTimeout(() => setErrorMessage(''), 3000);
    }
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

      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeemovements/search?term=${encodeURIComponent(id)}`);
      
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
          
          await fetchEmployeeSeniority(employee.EmployeeID);
          await fetchTotalUsedDays(employee.EmployeeID);
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

  // Función para obtener la antigüedad del empleado
  const fetchEmployeeSeniority = async (employeeId: number) => {
    try {
      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeevacations?action=get&employeeId=${employeeId}`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        const employeeData = employees.find(emp => emp.EmployeeID === employeeId);
        if (employeeData) {
          setSelectedEmployeeSeniority({
            years: employeeData.YearsOfSeniority,
            days: employeeData.DaysOfVacations
          });
        }
      }
    } catch (error) {
      console.error('Error fetching employee seniority:', error);
    }
  };

  // Función para obtener los días totales usados en vacaciones
  const fetchTotalUsedDays = async (employeeId: number) => {
    try {
      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeevacations?action=get&employeeId=${employeeId}`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        const vacations = await response.json();
        const totalUsed = vacations.reduce((sum: number, record: VacationRecord) => sum + record.Days, 0);
        setTotalUsedDays(totalUsed);
      }
    } catch (error) {
      console.error('Error fetching total used days:', error);
    }
  };

  // Función para limpiar la búsqueda de empleados
  const clearEmployeeSearch = () => {
    setEmployeeIdInput('');
    setSelectedEmployee(null);
    setSelectedEmployeeData(null);
    setSelectedEmployeeSeniority(null);
    setTotalUsedDays(0);
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

  // Función para cargar empleados
  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/administrative-personnel-dashboard/employee-management/employeevacations');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
        setFilteredEmployees(data);
      } else {
        throw new Error('ERROR AL CARGAR EMPLEADOS');
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      setErrorMessage('ERROR AL CARGAR LOS EMPLEADOS. POR FAVOR, INTENTE NUEVAMENTE.');
    } finally {
      setLoading(false);
    }
  };

  // Función para obtener vacaciones de un empleado
  const fetchVacationRecords = async (employeeId: number) => {
    setLoadingVacations(true);
    try {
      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeevacations?action=get&employeeId=${employeeId}`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        const data = await response.json();
        setVacationRecords(data);
        const totalUsed = data.reduce((sum: number, record: VacationRecord) => sum + record.Days, 0);
        setTotalUsedDays(totalUsed);
      } else {
        throw new Error('ERROR AL CARGAR PERÍODOS DE VACACIONES');
      }
    } catch (error) {
      console.error('Error fetching vacation records:', error);
      setErrorMessage('ERROR AL CARGAR LOS PERÍODOS DE VACACIONES DEL EMPLEADO');
    } finally {
      setLoadingVacations(false);
    }
  };

  // Función para descargar documento PDF desde URL almacenada
  const handleDownloadPDF = async (fileUrl: string, employeeId: number, vacationId: number) => {
    setDownloading(true);
    try {
      await downloadVacationPDF(fileUrl, `FT-RH-08-${employeeId}-${vacationId}.pdf`);
      setSuccessMessage('PDF DESCARGADO EXITOSAMENTE');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      setErrorMessage('ERROR AL DESCARGAR EL PDF. ES POSIBLE QUE EL ARCHIVO NO EXISTA.');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setDownloading(false);
    }
  };

  // Función para descargar documento Word
  const handleDownloadWord = async (employeeId: number, vacationId: number) => {
    setDownloading(true);
    try {
      await downloadVacationWord(employeeId, vacationId);
      setSuccessMessage('DOCUMENTO WORD DESCARGADO EXITOSAMENTE');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error downloading Word:', error);
      setErrorMessage('ERROR AL DESCARGAR EL DOCUMENTO WORD');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setDownloading(false);
    }
  };

  // Función para manejar el clic en eliminar
  const handleDeleteClick = (vacationId: number) => {
    setShowVacationsModal(false);
    
    setTimeout(() => {
      setPendingDeleteId(vacationId);
      setConfirmDelete({ show: true, id: vacationId });
    }, 100);
  };

  // Función para editar registro completo
  const handleEditVacationRecord = async (record: VacationRecord) => {
    setShowVacationsModal(false);
    
    setTimeout(async () => {
      setModalMode('edit');
      setCurrentEditRecord(record);
      
      try {
        const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeemovements/search?term=${record.EmployeeID}`);
        if (response.ok) {
          const data = await response.json();
          const employee = data.employees?.find((emp: EmployeeSearchResult) => 
            emp.EmployeeID === record.EmployeeID
          );
          
          if (employee) {
            setSelectedEmployee(employee);
            setSelectedEmployeeData(employee);
            setEmployeeIdInput(employee.EmployeeID.toString());
            
            await fetchEmployeeSeniority(employee.EmployeeID);
            await fetchTotalUsedDays(employee.EmployeeID);
          }
        }
      } catch (error) {
        console.error('Error fetching employee data:', error);
      }
      
      setFormData({
        EmployeeID: record.EmployeeID.toString(),
        Days: record.Days.toString(),
        StartDate: formatDateForInput(record.StartDate),
        EndDate: formatDateForInput(record.EndDate),
        Observations: record.Observations || ''
      });
      
      setShowModal(true);
    }, 100);
  };

  // Manejar cambios en el formulario
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'Days') {
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        setFormData(prev => ({
          ...prev,
          [name]: value
        }));
      }
    } else if (name === 'Observations') {
      setFormData(prev => ({
        ...prev,
        [name]: normalizarMayusculas(value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: normalizarMayusculas(value)
      }));
    }
  };

  // Manejar cambios en la fecha de inicio
  const handleStartDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData(prev => ({
      ...prev,
      StartDate: value
    }));
  };

  // Función para validar días disponibles
  const validateAvailableDays = (daysToTake: number): boolean => {
    if (modalMode === 'create') {
      const totalAfterAddition = totalUsedDays + daysToTake;
      if (totalAfterAddition > (selectedEmployeeSeniority?.days || 0)) {
        setErrorMessage(`NO SE PUEDE AGREGAR EL PERÍODO. EL TOTAL DE DÍAS USADOS SERÍA ${totalAfterAddition} DE ${selectedEmployeeSeniority?.days} DÍAS DISPONIBLES. DÍAS RESTANTES: ${(selectedEmployeeSeniority?.days || 0) - totalUsedDays}`);
        return false;
      }
    } else if (modalMode === 'edit' && currentEditRecord) {
      const totalAfterUpdate = (totalUsedDays - currentEditRecord.Days) + daysToTake;
      if (totalAfterUpdate > (selectedEmployeeSeniority?.days || 0)) {
        setErrorMessage(`NO SE PUEDE ACTUALIZAR EL PERÍODO. EL TOTAL DE DÍAS USADOS SERÍA ${totalAfterUpdate} DE ${selectedEmployeeSeniority?.days} DÍAS DISPONIBLES. DÍAS RESTANTES: ${(selectedEmployeeSeniority?.days || 0) - (totalUsedDays - currentEditRecord.Days)}`);
        return false;
      }
    }
    return true;
  };

  // Manejar envío del formulario (crear o editar)
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');
    setSaving(true);
    
    if (!selectedEmployeeData) {
      setErrorMessage('POR FAVOR, BUSQUE Y SELECCIONE UN EMPLEADO');
      setSaving(false);
      return;
    }

    if (!formData.Days || !formData.StartDate) {
      setErrorMessage('POR FAVOR, COMPLETE TODOS LOS CAMPOS REQUERIDOS');
      setSaving(false);
      return;
    }

    const daysToTake = parseFloat(formData.Days);
    if (daysToTake <= 0) {
      setErrorMessage('LOS DÍAS A TOMAR DEBEN SER MAYORES A CERO');
      setSaving(false);
      return;
    }

    if (!validateAvailableDays(daysToTake)) {
      setSaving(false);
      return;
    }

    try {
      let url = '/api/administrative-personnel-dashboard/employee-management/employeevacations';
      let method = 'POST';
      let body: any = {
        EmployeeID: selectedEmployeeData.EmployeeID,
        Days: formData.Days.trim(),
        StartDate: formData.StartDate,
        Observations: formData.Observations.trim()
      };

      if (modalMode === 'edit' && currentEditRecord) {
        method = 'PUT';
        body = {
          vacationId: currentEditRecord.VacationID,
          EmployeeID: selectedEmployeeData.EmployeeID,
          Days: formData.Days.trim(),
          StartDate: formData.StartDate,
          Observations: formData.Observations.trim()
        };
        url = `/api/administrative-personnel-dashboard/employee-management/employeevacations?action=updatefull`;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const result = await response.json();
        
        if (modalMode === 'create') {
          setSuccessMessage('¡PERÍODO DE VACACIONES CREADO EXITOSAMENTE!');
          
          // Mostrar modal de éxito con vista previa usando las fechas del backend
          if (result.vacationId && selectedEmployeeData) {
            const employeeName = `${selectedEmployeeData.FirstName} ${selectedEmployeeData.LastName} ${selectedEmployeeData.MiddleName || ''}`.trim();
            setSuccessDetails({
              VacationID: result.vacationId,
              EmployeeID: selectedEmployeeData.EmployeeID,
              EmployeeName: employeeName,
              tipo: selectedEmployeeData.tipo,
              Days: daysToTake,
              StartDate: result.startDate,
              EndDate: result.endDate,
              fileUrl: result.fileUrl || null
            });
            setShowSuccessModal(true);
          }
        } else {
          setSuccessMessage('¡PERÍODO DE VACACIONES ACTUALIZADO EXITOSAMENTE!');
          
          // Para edición, mostrar modal con las fechas del backend
          if (selectedEmployeeData) {
            const employeeName = `${selectedEmployeeData.FirstName} ${selectedEmployeeData.LastName} ${selectedEmployeeData.MiddleName || ''}`.trim();
            setSuccessDetails({
              VacationID: parseInt(currentEditRecord?.VacationID?.toString() || '0'),
              EmployeeID: selectedEmployeeData.EmployeeID,
              EmployeeName: employeeName,
              tipo: selectedEmployeeData.tipo,
              Days: daysToTake,
              StartDate: result.startDate || formData.StartDate,
              EndDate: result.endDate || (() => {
                const startDateObj = new Date(formData.StartDate);
                const endDateObj = new Date(startDateObj);
                endDateObj.setDate(endDateObj.getDate() + daysToTake);
                return endDateObj.toISOString().split('T')[0];
              })(),
              fileUrl: result.fileUrl || null
            });
            setShowSuccessModal(true);
          }
        }
        
        fetchEmployees();
        if (showVacationsModal && selectedVacationsEmployee) {
          await fetchVacationRecords(selectedVacationsEmployee.EmployeeID);
        }
        
        resetForm();
        setShowModal(false);
        
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'ERROR AL PROCESAR LA SOLICITUD');
      }
    } catch (error: any) {
      console.error('Error:', error);
      setErrorMessage(error.message || 'ERROR AL PROCESAR LA SOLICITUD. POR FAVOR, INTENTE NUEVAMENTE.');
    } finally {
      setSaving(false);
    }
  };

  // Ver vacaciones del empleado
  const handleViewVacations = async (employee: Employee) => {
    setSelectedVacationsEmployee(employee);
    setShowVacationsModal(true);
    await fetchVacationRecords(employee.EmployeeID);
  };

  // Eliminar período de vacaciones
  const handleDeleteVacation = async (vacationId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeevacations?id=${vacationId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setSuccessMessage('PERÍODO DE VACACIONES ELIMINADO EXITOSAMENTE');
        setVacationRecords(prev => prev.filter(record => record.VacationID !== vacationId));
        if (selectedVacationsEmployee) {
          await fetchVacationRecords(selectedVacationsEmployee.EmployeeID);
        }
        fetchEmployees();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        throw new Error('ERROR AL ELIMINAR EL PERÍODO');
      }
    } catch (error) {
      console.error('Error deleting vacation:', error);
      setErrorMessage('ERROR AL ELIMINAR EL PERÍODO DE VACACIONES');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setLoading(false);
      setConfirmDelete({ show: false, id: null });
      setPendingDeleteId(null);
      
      if (selectedVacationsEmployee) {
        setTimeout(() => {
          setShowVacationsModal(true);
        }, 100);
      }
    }
  };

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      EmployeeID: '',
      Days: '',
      StartDate: '',
      EndDate: '',
      Observations: ''
    });
    setCalculatedEndDate('');
    setCalculatedEndDateValue('');
    setSelectedEmployeeSeniority(null);
    setTotalUsedDays(0);
    setIsEditing(false);
    setEditingId(null);
    setEmployeeIdInput('');
    setSelectedEmployee(null);
    setSelectedEmployeeData(null);
    setEmployeeNotFound(false);
    setCurrentEditRecord(null);

    setTimeout(() => {
      if (employeeIdInputRef.current) {
        employeeIdInputRef.current.focus();
      }
    }, 100);
  };

  // Limpiar filtros
  const clearFilters = () => {
    setSearchTerm('');
  };

  // Abrir modal para nuevo período
  const openCreateModal = () => {
    resetForm();
    setModalMode('create');
    setShowModal(true);
  };

  // Cerrar modal
  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  // Cerrar modal de vacaciones
  const closeVacationsModal = () => {
    setShowVacationsModal(false);
    setSelectedVacationsEmployee(null);
    setVacationRecords([]);
    setTotalUsedDays(0);
    setEditingObservation(null);
    setEditObservationValue('');
    setPendingDeleteId(null);
  };

  // Cerrar modal de confirmación
  const closeConfirmDelete = () => {
    setConfirmDelete({ show: false, id: null });
    setPendingDeleteId(null);
    
    if (selectedVacationsEmployee) {
      setTimeout(() => {
        setShowVacationsModal(true);
      }, 100);
    }
  };

  // Cerrar modal de opciones de descarga
  const closeDownloadOptions = () => {
    setShowDownloadOptions({ show: false, fileUrl: '', vacationId: 0, employeeId: 0 });
  };

  // Cerrar modal de éxito
  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    setSuccessDetails(null);
    setPdfLoading(false);
  };

  const getUniqueKey = (employee: Employee, index: number) => {
    return `${employee.EmployeeID}-${index}`;
  };

  // Calcular días restantes
  const remainingDays = selectedEmployeeSeniority 
    ? selectedEmployeeSeniority.days - totalUsedDays 
    : 0;

  return (
    <div className="min-h-screen bg-gray-100">
      <AppHeader title="PANEL ADMINISTRATIVO" />

      {/* MODAL DE ÉXITO CON VISTA PREVIA DEL PDF */}
      {showSuccessModal && successDetails && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[10000] p-4 bg-black/70"
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full h-[90vh] flex flex-col animate-fade-in relative z-[10001]">
            <div className="p-6 pb-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  ¡REGISTRO EXITOSO!
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  El período de vacaciones ha sido registrado correctamente en el sistema.
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
              {/* Columna izquierda - Detalles del Período */}
              <div className="w-full md:w-1/3 p-6 border-r border-gray-200 overflow-y-auto">
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">DETALLES DEL REGISTRO</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">ID PERÍODO:</span>
                        <span className="text-gray-600 mt-1 text-sm">{successDetails.VacationID}</span>
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
                        <span className="block text-xs font-bold text-gray-700 uppercase">DÍAS:</span>
                        <span className="text-gray-600 mt-1 text-sm">{successDetails.Days}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">FECHA DE INICIO:</span>
                        <span className="text-gray-600 mt-1 text-sm">
                          {successDetails.StartDate}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">FECHA DE TÉRMINO:</span>
                        <span className="text-gray-600 mt-1 text-sm">
                          {successDetails.EndDate}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">DOCUMENTO GENERADO</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-gray-600 mr-2" />
                          <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-08 (PDF)</span>
                        </div>
                        <div className="flex gap-2">
                          {successDetails.fileUrl && (
                            <a
                              href={successDetails.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                              title="Vista previa"
                              onClick={() => setPdfLoading(true)}
                            >
                              <Eye className="h-4 w-4 text-gray-700" />
                            </a>
                          )}
                          <button
                            onClick={() => successDetails.fileUrl && handleDownloadPDF(successDetails.fileUrl, successDetails.EmployeeID, successDetails.VacationID)}
                            disabled={downloading || !successDetails.fileUrl}
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
                          <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-08 (EDITABLE)</span>
                        </div>
                        <button
                          onClick={() => handleDownloadWord(successDetails.EmployeeID, successDetails.VacationID)}
                          disabled={downloading}
                          className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Descargar Word editable"
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
                    VISTA PREVIA - FORMATO FT-RH-08
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
                  
                  {successDetails.fileUrl ? (
                    <iframe
                      src={successDetails.fileUrl}
                      className="w-full h-full border-0"
                      onLoad={() => setPdfLoading(false)}
                      onError={() => {
                        setPdfLoading(false);
                        console.error('Error al cargar PDF:', successDetails.fileUrl);
                      }}
                      title="Vista previa del período de vacaciones"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600">No se pudo cargar la vista previa del PDF</p>
                        <p className="text-xs text-gray-500 mt-2">El PDF se generará automáticamente</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE OPCIONES DE DESCARGA */}
      {showDownloadOptions.show && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[10000] p-4 bg-black/70"
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-in relative z-[10001]">
            <div className="p-6 pb-4 border-b border-gray-300">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                <FileText className="h-5 w-5 text-[#3a6ea5] mr-2" />
                DESCARGA DE DOCUMENTO
              </h2>
              <p className="text-sm text-gray-600 mt-2 leading-5">
                ¿En qué formato desea descargar el documento FT-RH-08?
              </p>
            </div>
            
            <div className="p-6 pt-4 flex flex-col gap-3">
              <button
                onClick={() => {
                  if (showDownloadOptions.fileUrl) {
                    handleDownloadPDF(showDownloadOptions.fileUrl, showDownloadOptions.employeeId, showDownloadOptions.vacationId);
                  }
                  closeDownloadOptions();
                }}
                disabled={!showDownloadOptions.fileUrl}
                className="w-full px-6 py-3 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                DESCARGAR COMO PDF
              </button>
              <button
                onClick={() => {
                  handleDownloadWord(showDownloadOptions.employeeId, showDownloadOptions.vacationId);
                  closeDownloadOptions();
                }}
                className="w-full px-6 py-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                <FileText className="h-4 w-4" />
                DESCARGAR COMO WORD
              </button>
              <button
                onClick={closeDownloadOptions}
                className="w-full px-6 py-3 bg-gray-200 text-black font-bold rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA CREAR/EDITAR PERÍODO DE VACACIONES */}
      {showModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70"
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-fade-in relative z-[10000]">
            <div className="p-6 pb-4 border-b border-gray-300 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                  {modalMode === 'create' ? 'NUEVO PERÍODO DE VACACIONES' : 'EDITAR PERÍODO DE VACACIONES'}
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  {modalMode === 'create' 
                    ? 'Complete el formulario para registrar un nuevo período de vacaciones del empleado.'
                    : 'Modifique la información del período de vacaciones seleccionado.'}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <div className="space-y-6">
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
                          }}
                          onKeyDown={handleEmployeeIdKeyDown}
                          placeholder="Ingrese el ID del empleado"
                          className={`w-full px-3 py-2.5 text-sm bg-white border rounded focus:outline-none focus:border-[#3a6ea5] font-medium ${
                            employeeNotFound ? 'border-red-500' : 'border-gray-400'
                          }`}
                          disabled={modalMode === 'edit' || selectedEmployee !== null}
                        />
                        {!selectedEmployee && employeeIdInput && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                            ENTER PARA BUSCAR
                          </div>
                        )}
                        {selectedEmployee && (
                          <button
                            onClick={clearEmployeeSearch}
                            type="button"
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

                            {selectedEmployeeSeniority && (
                              <>
                                <div>
                                  <span className="block text-xs font-bold text-gray-500 uppercase">Años de antigüedad</span>
                                  <span className="text-sm text-gray-900">{selectedEmployeeSeniority.years} años</span>
                                </div>
                                <div>
                                  <span className="block text-xs font-bold text-gray-500 uppercase">Días de vacaciones disponibles</span>
                                  <span className="text-sm text-gray-900">{selectedEmployeeSeniority.days} días</span>
                                </div>
                                <div>
                                  <span className="block text-xs font-bold text-gray-500 uppercase">Días ya utilizados</span>
                                  <span className="text-sm text-gray-900">{totalUsedDays} días</span>
                                </div>
                                <div>
                                  <span className="block text-xs font-bold text-gray-500 uppercase">Días restantes</span>
                                  <span className={`text-sm font-bold ${remainingDays <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {remainingDays} días
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                      DATOS DEL PERÍODO DE VACACIONES
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          FECHA DE INICIO *
                        </label>
                        <input
                          type="date"
                          name="StartDate"
                          value={formData.StartDate}
                          onChange={handleStartDateChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          FECHA DE TÉRMINO (CALCULADA)
                        </label>
                        <input
                          type="date"
                          value={calculatedEndDateValue || formData.EndDate}
                          disabled
                          className="w-full px-3 py-2.5 text-sm bg-gray-100 border border-gray-300 rounded font-medium text-gray-600 cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Se calcula automáticamente sumando los días a la fecha de inicio
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          DÍAS A TOMAR *
                        </label>
                        <input
                          type="number"
                          name="Days"
                          value={formData.Days}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese los días a tomar"
                          required
                          step="0.5"
                          min="0.5"
                          max={remainingDays > 0 ? remainingDays : undefined}
                        />
                        {selectedEmployeeSeniority && parseFloat(formData.Days) > remainingDays && remainingDays > 0 && (
                          <p className="mt-1 text-xs text-red-600">
                            Los días solicitados ({formData.Days}) exceden los días restantes ({remainingDays} días)
                          </p>
                        )}
                        {remainingDays <= 0 && selectedEmployeeSeniority && (
                          <p className="mt-1 text-xs text-red-600 font-bold">
                            NO HAY DÍAS DISPONIBLES PARA ESTE EMPLEADO
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          Días restantes disponibles: {remainingDays}
                        </p>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          OBSERVACIONES
                        </label>
                        <textarea
                          name="Observations"
                          value={formData.Observations}
                          onChange={handleInputChange}
                          rows={3}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Observaciones (opcional)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-4 border-t border-gray-300 bg-gray-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap disabled:opacity-50"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
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
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA VER VACACIONES */}
      {showVacationsModal && selectedVacationsEmployee && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70"
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto animate-fade-in relative z-[10000]">
            <div className="p-6 pb-4 border-b border-gray-300 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                  PERÍODOS DE VACACIONES
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  {selectedVacationsEmployee.FirstName} {selectedVacationsEmployee.LastName} {selectedVacationsEmployee.MiddleName || ''}
                </p>
                <p className="text-gray-600 mt-1 text-sm">
                  Antigüedad: {selectedVacationsEmployee.YearsOfSeniority} años | Días disponibles: {selectedVacationsEmployee.DaysOfVacations} | Días usados: {totalUsedDays} | Días restantes: {selectedVacationsEmployee.DaysOfVacations - totalUsedDays}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportVacationsToExcel}
                  className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap disabled:opacity-50"
                  title="Exportar a Excel"
                >
                 EXPORTAR EXCEL
                </button>
                <button
                  onClick={closeVacationsModal}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {loadingVacations ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a6ea5]"></div>
                  <p className="ml-3 text-gray-600">Cargando registros...</p>
                </div>
              ) : vacationRecords.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No hay períodos de vacaciones registrados para este empleado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">ID</th>
                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">FECHA INICIO</th>
                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">FECHA FIN</th>
                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">DÍAS</th>
                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">DÍAS COMPUTADOS</th>
                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">OBSERVACIONES</th>
                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300 text-center">ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vacationRecords.map((record) => (
                        <tr key={record.VacationID} className="hover:bg-gray-50 transition-colors border-b border-gray-300">
                          <td className="py-3 px-4 text-sm text-gray-800">{record.VacationID}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{formatDate(record.StartDate)}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{formatDate(record.EndDate)}</td>
                          <td className="py-3 px-4 text-sm text-gray-800 font-medium">{record.Days}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{record.StampedDays}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{record.Observations}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditVacationRecord(record)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                title="Editar período completo"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(record.VacationID)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Eliminar registro"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="p-6 pt-4 border-t border-gray-300 bg-gray-50 flex justify-end">
              <button
                onClick={closeVacationsModal}
                className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR */}
      {confirmDelete.show && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[10000] p-4 bg-black/70"
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-in relative z-[10001]">
            <div className="p-6 pb-4 border-b border-gray-300">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                CONFIRMAR ELIMINACIÓN
              </h2>
              <p className="text-sm text-gray-600 mt-2 leading-5">
                ¿Está seguro que desea eliminar este período de vacaciones? Esta acción no se puede deshacer.
              </p>
            </div>
            
            <div className="p-6 pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeConfirmDelete}
                className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={() => confirmDelete.id && handleDeleteVacation(confirmDelete.id)}
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

      {/* CONTENT */}
      <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
        <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5]">
              <h1 className="text-xl font-bold text-white tracking-tight">VACACIONES</h1>
              <p className="text-sm text-gray-200 mt-1">
                Gestione las vacaciones de los empleados.
              </p>
            </div>
          </div>

          {successMessage && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 animate-fade-in">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                <p className="text-sm font-medium text-gray-600 leading-5">
                  {successMessage}
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 animate-fade-in">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <p className="text-sm font-medium text-gray-600 leading-5">
                  {errorMessage}
                </p>
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
                  placeholder="Buscar por nombre o puesto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
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
              onClick={exportEmployeesWithVacationsToExcel}
              disabled={loading}
              className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap"
            >
              EXPORTAR EXCEL COMPLETO
            </button>
            
            <button
              onClick={openCreateModal}
              className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap"
            >
              NUEVO PERÍODO
            </button>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">ID</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">NOMBRE DEL EMPLEADO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">PUESTO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">FECHA DE INGRESO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">AÑOS DE ANTIGÜEDAD</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">DÍAS DE VACACIONES</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a6ea5] mb-2"></div>
                          <p className="text-gray-600">Cargando períodos de vacaciones...</p>
                        </div>
                       </td>
                     </tr>
                  ) : currentEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <AlertCircle className="h-8 w-8 text-gray-400 mb-3" />
                          <p className="text-sm font-medium text-gray-600 mt-2 leading-5">
                            {searchTerm ? 'No se encontraron empleados que coincidan con la búsqueda' : 'No hay empleados registrados'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentEmployees.map((employee, index) => (
                      <tr key={getUniqueKey(employee, index)} className="hover:bg-gray-50 transition-colors border-b border-gray-300">
                        <td className="py-3 px-4 text-sm text-gray-800 font-medium">{employee.EmployeeID}</td>
                        <td className="py-3 px-4 text-sm text-gray-800 uppercase">{`${employee.FirstName} ${employee.LastName} ${employee.MiddleName || ''}`.trim()}</td>
                        <td className="py-3 px-4 text-sm text-gray-600 uppercase max-w-xs truncate">{employee.Position}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{formatDate(employee.ContractStartDate)}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{employee.YearsOfSeniority}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{employee.DaysOfVacations}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleViewVacations(employee)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Ver períodos de vacaciones"
                            >
                              <Eye className="h-4 w-4" />
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
                  MOSTRANDO {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredEmployees.length)} DE {filteredEmployees.length} REGISTROS
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
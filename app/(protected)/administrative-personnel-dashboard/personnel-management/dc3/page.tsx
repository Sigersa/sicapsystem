'use client';

import AppHeader from '@/components/header/2/2.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/2';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { useState, useEffect, ChangeEvent, useRef, KeyboardEvent } from 'react';
import { Search, ChevronLeft, ChevronRight, Edit, Trash2, X, RefreshCw, CheckCircle, AlertCircle, Download, Eye, FileText } from 'lucide-react';

// Interface para registro DC3
interface EmployeeDC3 {
  DC3ID: number;
  EmployeeID: number;
  SpecificOccupation: string | null;
  CourseName: string | null;
  StartDate: string | null;
  EndDate: string | null;
  Area: string | null;
  TrainerID: number | null;
  Duration: number | null;
  DocumentURL: string | null;
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

// Interface para formulario DC3
interface DC3FormData {
  EmployeeID: string;
  SpecificOccupation: string;
  CourseName: string;
  StartDate: string;
  EndDate: string;
  Area: string;
  TrainerID: string;
  Duration: string;
}

// Interface para filtros
interface Filters {
  search: string;
}

// Interface para jefe directo (instructor)
interface Trainer {
  id: number;
  FirstName: string;
  LastName: string;
  MiddleName: string;
  puesto: string;
  tipoPersonal: 'BASE' | 'PROJECT';
  nombreCompleto: string;
}

// Interface para detalles del éxito
interface SuccessDetails {
  DC3ID: number;
  EmployeeID: number;
  EmployeeName: string;
  tipo: 'BASE' | 'PROJECT';
  CourseName: string;
  StartDate: string;
  EndDate: string;
  Duration: number;
  Area: string;
  SpecificOccupation: string;
  fileUrl: string;
  pdfUrl: string;
  excelUrl: string;
}

// Opciones para el select de Ocupación Específica
const OCCUPATION_OPTIONS = [
  { value: "01.1 AGRICULTURA Y SILVICULTURA", label: "01.1 AGRICULTURA Y SILVICULTURA" },
  { value: "01.2 GANADERÍA", label: "01.2 GANADERÍA" },
  { value: "01.3 PESCA Y ACUACULTURA", label: "01.3 PESCA Y ACUACULTURA" },
  { value: "02.1 EXPLORACIÓN", label: "02.1 EXPLORACIÓN" },
  { value: "02.2 EXTRACCIÓN", label: "02.2 EXTRACCIÓN" },
  { value: "02.3 REFINACIÓN Y BENEFICIO", label: "02.3 REFINACIÓN Y BENEFICIO" },
  { value: "02.4 PROVISIÓN DE ENERGÍA", label: "02.4 PROVISIÓN DE ENERGÍA" },
  { value: "02.5 PROVISIÓN DE AGUA", label: "02.5 PROVISIÓN DE AGUA" },
  { value: "03.1 PLANEACIÓN Y DIRECCIÓN DE OBRAS", label: "03.1 PLANEACIÓN Y DIRECCIÓN DE OBRAS" },
  { value: "03.2 EDIFICACIÓN Y URBANIZACIÓN", label: "03.2 EDIFICACIÓN Y URBANIZACIÓN" },
  { value: "03.3 ACABADO", label: "03.3 ACABADO" },
  { value: "03.4 INSTALACIÓN Y MANTENIMIENTO", label: "03.4 INSTALACIÓN Y MANTENIMIENTO" },
  { value: "04.1 MECÁNICA", label: "04.1 MECÁNICA" },
  { value: "04.2 ELECTRICIDAD", label: "04.2 ELECTRICIDAD" },
  { value: "04.3 ELECTRÓNICA", label: "04.3 ELECTRÓNICA" },
  { value: "04.4 INFORMÁTICA", label: "04.4 INFORMÁTICA" },
  { value: "04.5 TELECOMUNICACIONES", label: "04.5 TELECOMUNICACIONES" },
  { value: "04.6 PROCESOS INDUSTRIALES", label: "04.6 PROCESOS INDUSTRIALES" },
  { value: "05.1 MINERALES NO METÁLICOS", label: "05.1 MINERALES NO METÁLICOS" },
  { value: "05.2 METALES", label: "05.2 METALES" },
  { value: "05.3 ALIMENTOS Y BEBIDAS", label: "05.3 ALIMENTOS Y BEBIDAS" },
  { value: "05.4 TEXTILES Y PRENDAS DE VESTIR", label: "05.4 TEXTILES Y PRENDAS DE VESTIR" },
  { value: "05.5 MATERIA ORGÁNICA", label: "05.5 MATERIA ORGÁNICA" },
  { value: "05.6 PRODUCTOS QUÍMICOS", label: "05.6 PRODUCTOS QUÍMICOS" },
  { value: "05.7 PRODUCTOS METÁLICOS Y DE HULE Y DE PLÁSTICO", label: "05.7 PRODUCTOS METÁLICOS Y DE HULE Y DE PLÁSTICO" },
  { value: "05.8 PRODUCTOS ELÉCTRICOS Y ELECTRÓNICOS", label: "05.8 PRODUCTOS ELÉCTRICOS Y ELECTRÓNICOS" },
  { value: "05.9 PRODUCTOS IMPRESOS", label: "05.9 PRODUCTOS IMPRESOS" },
  { value: "06.1 FERROVIARIO", label: "06.1 FERROVIARIO" },
  { value: "06.2 AUTOTRANSPORTE", label: "06.2 AUTOTRANSPORTE" },
  { value: "06.3 AÉREO", label: "06.3 AÉREO" },
  { value: "06.4 MARÍTIMO Y FLUVIAL", label: "06.4 MARÍTIMO Y FLUVIAL" },
  { value: "06.5 SERVICIOS DE APOYO", label: "06.5 SERVICIOS DE APOYO" },
  { value: "07.1 COMERCIO", label: "07.1 COMERCIO" },
  { value: "07.2 ALIMENTACIÓN Y HOSPEDAJE", label: "07.2 ALIMENTACIÓN Y HOSPEDAJE" },
  { value: "07.3 TURISMO", label: "07.3 TURISMO" },
  { value: "07.4 DEPORTE Y ESPARCIMIENTO", label: "07.4 DEPORTE Y ESPARCIMIENTO" },
  { value: "07.5 SERVICIOS PERSONALES", label: "07.5 SERVICIOS PERSONALES" },
  { value: "07.6 REPARACIÓN DE ARTÍCULOS DE USO DOMÉSTICO Y PERSONAL", label: "07.6 REPARACIÓN DE ARTÍCULOS DE USO DOMÉSTICO Y PERSONAL" },
  { value: "07.7 LIMPIEZA", label: "07.7 LIMPIEZA" },
  { value: "07.8 SERVICIO POSTAL Y MENSAJERÍA", label: "07.8 SERVICIO POSTAL Y MENSAJERÍA" },
  { value: "08.1 BOLSA, BANCA Y SEGUROS", label: "08.1 BOLSA, BANCA Y SEGUROS" },
  { value: "08.2 ADMINISTRACIÓN", label: "08.2 ADMINISTRACIÓN" },
  { value: "08.3 SERVICIOS LEGALES", label: "08.3 SERVICIOS LEGALES" },
  { value: "09.1 SERVICIOS MÉDICOS", label: "09.1 SERVICIOS MÉDICOS" },
  { value: "09.2 INSPECCIÓN SANITARIA Y DEL MEDIO AMBIENTE", label: "09.2 INSPECCIÓN SANITARIA Y DEL MEDIO AMBIENTE" },
  { value: "09.3 SEGURIDAD SOCIAL", label: "09.3 SEGURIDAD SOCIAL" },
  { value: "09.4 PROTECCIÓN DE BIENES Y/O PERSONAS", label: "09.4 PROTECCIÓN DE BIENES Y/O PERSONAS" },
  { value: "10.1 PUBLICACIÓN", label: "10.1 PUBLICACIÓN" },
  { value: "10.2 RADIO, CINE, TELEVISIÓN Y TEATRO", label: "10.2 RADIO, CINE, TELEVISIÓN Y TEATRO" },
  { value: "10.3 INTERPRETACIÓN ARTÍSTICA", label: "10.3 INTERPRETACIÓN ARTÍSTICA" },
  { value: "10.4 TRADUCCIÓN E INTERPRETACIÓN LINGÜÍSTICA", label: "10.4 TRADUCCIÓN E INTERPRETACIÓN LINGÜÍSTICA" },
  { value: "10.5 PUBLICIDAD, PROPAGANDA Y RELACIONES PÚBLICAS", label: "10.5 PUBLICIDAD, PROPAGANDA Y RELACIONES PÚBLICAS" },
  { value: "11.1 INVESTIGACIÓN", label: "11.1 INVESTIGACIÓN" },
  { value: "11.2 ENSEÑANZA", label: "11.2 ENSEÑANZA" },
  { value: "11.3 DIFUSIÓN CULTURAL", label: "11.3 DIFUSIÓN CULTURAL" }
];

// Opciones para el select de Área
const AREA_OPTIONS = [
  { value: "1000 PRODUCCIÓN", label: "1000 PRODUCCIÓN" },
  { value: "2000 SERVICIOS", label: "2000 SERVICIOS"},
  { value: "3000 ADMINISTRACIÓN, CONTABILIDAD Y ECONOMÍA", label: "3000 ADMINISTRACIÓN, CONTABILIDAD Y ECONOMÍA"},
  { value: "4000 COMERCIALIZACIÓN", label: "4000 COMERCIALIZACIÓN"},
  { value: "5000 MANTENIMIENTO Y REPARACIÓN", label: "5000 MANTENIMIENTO Y REPARACIÓN"},
  { value: "6000 SEGURIDAD", label: "6000 SEGURIDAD"},
  { value: "7000 DESARROLLO PERSONAL Y FAMILIAR", label: "7000 DESARROLLO PERSONAL Y FAMILIAR"},
  { value: "8000 USO DE TECNOLOGÍAS DE LA INFORMACIÓN Y COMUNICACIÓN", label: "8000 USO DE TECNOLOGÍAS DE LA INFORMACIÓN Y COMUNICACIÓN" },
  { value: "9000 PARTICIPACIÓN SOCIAL", label: "9000 PARTICIPACIÓN SOCIAL" }
];

// Función para normalizar texto a mayúsculas
const normalizarMayusculas = (texto: string): string => {
  return texto.toUpperCase();
};

// Función para formatear fecha para input type="date" (YYYY-MM-DD)
const formatDateForInput = (dateString: string | null): string => {
  if (!dateString) return '';
  
  try {
    // Si ya viene en formato YYYY-MM-DD, devolverlo directamente
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Intentar parsear la fecha
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }
    
    // Formatear a YYYY-MM-DD
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

export default function EmployeeDC3Page() {
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();

  // Estados
  const [records, setRecords] = useState<EmployeeDC3[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<EmployeeDC3[]>([]);
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

  // Estados para instructores
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loadingTrainers, setLoadingTrainers] = useState(false);

  // Estados para modales
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [saving, setSaving] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<EmployeeDC3 | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; id: number | null }>({ show: false, id: null });
  
  // Estado para el modal de éxito con vista previa del PDF
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successDetails, setSuccessDetails] = useState<SuccessDetails | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Estado para formulario
  const [formData, setFormData] = useState<DC3FormData>({
    EmployeeID: '',
    SpecificOccupation: '',
    CourseName: '',
    StartDate: '',
    EndDate: '',
    Area: '',
    TrainerID: '',
    Duration: ''
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

  // Cargar instructores cuando se abre el modal
  useEffect(() => {
    if (showModal) {
      fetchTrainers();
    }
  }, [showModal]);

  // Obtener registros actuales de la página
  const currentRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Función para obtener instructores
  const fetchTrainers = async () => {
    try {
      setLoadingTrainers(true);
      const response = await fetch('/api/catalogs/jefes-directos');
      
      if (!response.ok) {
        throw new Error('Error al cargar instructores');
      }

      const data = await response.json();
      setTrainers(data);
    } catch (error) {
      console.error('Error al cargar instructores:', error);
    } finally {
      setLoadingTrainers(false);
    }
  };

  // Función para obtener registros DC3
  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/administrative-personnel-dashboard/employee-management/employeedc3');
      
      if (!response.ok) {
        throw new Error('Error al cargar registros DC3');
      }

      const data = await response.json();
      
      if (data.success) {
        setRecords(data.records || []);
      } else {
        setError(data.message || 'Error al cargar registros DC3');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('ERROR DE CONEXIÓN AL CARGAR REGISTROS DC3');
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
               record.EmployeeID.toString().includes(searchLower) ||
               (record.CourseName && record.CourseName.toLowerCase().includes(searchLower));
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

      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeedc3/search?term=${encodeURIComponent(id)}`);
      
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
            EmployeeID: employee.EmployeeID.toString(),
            Area: employee.Area || employee.NameProject || ''
          }));
          setEmployeeNotFound(false);
        } else {
          setSelectedEmployee(null);
          setSelectedEmployeeData(null);
          setFormData(prev => ({
            ...prev,
            EmployeeID: '',
            Area: ''
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
      EmployeeID: '',
      Area: ''
    }));
    setEmployeeNotFound(false);
    setError('');
    if (employeeIdInputRef.current) {
      employeeIdInputRef.current.focus();
    }
  };

  // Función para abrir modal de creación
  const handleCreateRecord = () => {
    setModalMode('create');
    setFormData({
      EmployeeID: '',
      SpecificOccupation: '',
      CourseName: '',
      StartDate: '',
      EndDate: '',
      Area: '',
      TrainerID: '',
      Duration: ''
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

  // Función para abrir modal de edición - CORREGIDA (formatear fechas)
  const handleEditRecord = async (record: EmployeeDC3) => {
    setModalMode('edit');
    setRecordToEdit(record);
    
    try {
      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeedc3/search?term=${record.EmployeeID}`);
      if (response.ok) {
        const data = await response.json();
        const employeeData = data.employees.find((emp: EmployeeSearchResult) => emp.EmployeeID === record.EmployeeID);
        if (employeeData) {
          setSelectedEmployeeData(employeeData);
          setSelectedEmployee(employeeData);
          setEmployeeIdInput(record.EmployeeID.toString());
        }
      }
    } catch (error) {
      console.error('Error al cargar datos del empleado:', error);
    }
    
    // Formatear las fechas correctamente para input type="date"
    setFormData({
      EmployeeID: record.EmployeeID.toString(),
      SpecificOccupation: record.SpecificOccupation || '',
      CourseName: record.CourseName || '',
      StartDate: formatDateForInput(record.StartDate),
      EndDate: formatDateForInput(record.EndDate),
      Area: record.Area || '',
      TrainerID: record.TrainerID?.toString() || '',
      Duration: record.Duration?.toString() || ''
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

  // Función para eliminar registro
  const handleDeleteRecord = async (id: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeedc3/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessMessage('¡DC3 ELIMINADO EXITOSAMENTE!');
        await fetchRecords();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        throw new Error(data.message || 'ERROR AL ELIMINAR EL DC3');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('ERROR AL ELIMINAR EL DC3. POR FAVOR, INTENTE NUEVAMENTE.');
    } finally {
      setLoading(false);
      setConfirmDelete({ show: false, id: null });
    }
  };

  // Función para manejar cambios en el formulario - CORREGIDA
  const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    let newValue = value;
    
    // NO normalizar a mayúsculas para fechas, selects y campos numéricos
    if (!['StartDate', 'EndDate', 'SpecificOccupation', 'Area', 'Duration', 'TrainerID'].includes(name)) {
      newValue = normalizarMayusculas(value);
    }
    
    // Para el campo Duration, solo permitir números
    if (name === 'Duration') {
      // Permitir solo números y vacío
      if (value === '' || /^\d+$/.test(value)) {
        setFormData(prev => ({
          ...prev,
          [name]: value
        }));
      }
      return; // No actualizar si no es válido
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
  };

  // Función para guardar registro DC3 - CORREGIDA
  const handleSaveRecord = async () => {
    try {
      setSaving(true);
      setError('');

      if (!formData.EmployeeID) {
        setError('DEBE SELECCIONAR UN EMPLEADO VÁLIDO');
        setSaving(false);
        return;
      }

      if (!formData.CourseName) {
        setError('EL NOMBRE DEL CURSO ES REQUERIDO');
        setSaving(false);
        return;
      }

      if (!formData.StartDate) {
        setError('LA FECHA DE INICIO ES REQUERIDA');
        setSaving(false);
        return;
      }

      if (!formData.EndDate) {
        setError('LA FECHA DE FIN ES REQUERIDA');
        setSaving(false);
        return;
      }

      // Validar que las fechas sean válidas
      const startDate = new Date(formData.StartDate);
      const endDate = new Date(formData.EndDate);
      
      if (isNaN(startDate.getTime())) {
        setError('FORMATO DE FECHA DE INICIO INVÁLIDO');
        setSaving(false);
        return;
      }
      
      if (isNaN(endDate.getTime())) {
        setError('FORMATO DE FECHA DE FIN INVÁLIDO');
        setSaving(false);
        return;
      }

      // Validar que la fecha de fin sea posterior o igual a la fecha de inicio
      if (startDate > endDate) {
        setError('LA FECHA DE FIN DEBE SER POSTERIOR O IGUAL A LA FECHA DE INICIO');
        setSaving(false);
        return;
      }

      // Validar Duration si se proporciona
      if (formData.Duration) {
        const durationNum = parseInt(formData.Duration);
        if (isNaN(durationNum) || durationNum <= 0) {
          setError('LA DURACIÓN DEBE SER UN NÚMERO POSITIVO');
          setSaving(false);
          return;
        }
      }

      const recordData = {
        EmployeeID: parseInt(formData.EmployeeID),
        SpecificOccupation: formData.SpecificOccupation || null,
        CourseName: formData.CourseName,
        StartDate: formData.StartDate,
        EndDate: formData.EndDate,
        Area: formData.Area || null,
        TrainerID: formData.TrainerID ? parseInt(formData.TrainerID) : null,
        Duration: formData.Duration ? parseInt(formData.Duration) : null
      };

      let response;
      
      if (modalMode === 'create') {
        response = await fetch('/api/administrative-personnel-dashboard/employee-management/employeedc3', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(recordData)
        });
      } else {
        response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeedc3/${recordToEdit?.DC3ID}`, {
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
        
        // Mostrar mensaje según el caso
        if (modalMode === 'edit') {
          setSuccessMessage('¡DC3 ACTUALIZADO EXITOSAMENTE!');
          setTimeout(() => setSuccessMessage(''), 3000);
        } else if (modalMode === 'create' && selectedEmployeeData && data.fileUrl) {
          // Mostrar modal de éxito con vista previa (para creación)
          const baseUrl = window.location.origin;
          const pdfUrl = data.fileUrl;
          const excelUrl = `${baseUrl}/api/download/edit/DC-3?dc3Id=${data.dc3Id}`;
          
          setSuccessDetails({
            DC3ID: data.dc3Id || recordToEdit?.DC3ID,
            EmployeeID: parseInt(formData.EmployeeID),
            EmployeeName: `${selectedEmployeeData.FirstName} ${selectedEmployeeData.LastName} ${selectedEmployeeData.MiddleName || ''}`.trim(),
            tipo: selectedEmployeeData.tipo,
            CourseName: formData.CourseName,
            StartDate: formData.StartDate,
            EndDate: formData.EndDate,
            Duration: parseInt(formData.Duration) || 0,
            Area: formData.Area || 'N/A',
            SpecificOccupation: formData.SpecificOccupation || 'N/A',
            fileUrl: pdfUrl,
            pdfUrl: pdfUrl,
            excelUrl: excelUrl
          });
          setShowSuccessModal(true);
        } else {
          setSuccessMessage(modalMode === 'create' ? '¡DC3 CREADO EXITOSAMENTE!' : '¡DC3 ACTUALIZADO EXITOSAMENTE!');
          setTimeout(() => setSuccessMessage(''), 3000);
        }
      } else {
        setError(data.message || 'ERROR AL GUARDAR DC3');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('ERROR DE CONEXIÓN AL REGISTRO DC3');
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
                ¿Está seguro que desea eliminar este registro DC3? Esta acción no se puede deshacer.
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
                  El certificado DC3 ha sido registrado correctamente en el sistema.
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
              {/* Columna izquierda - Detalles del DC3 */}
              <div className="w-full md:w-1/3 p-6 border-r border-gray-200 overflow-y-auto">
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">DETALLES DEL REGISTRO</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">ID DC3:</span>
                        <span className="text-gray-600 mt-1 text-sm">{successDetails.DC3ID}</span>
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
                        <span className="block text-xs font-bold text-gray-700 uppercase">FECHA INICIO:</span>
                        <span className="text-gray-600 mt-1 text-sm">{formatDate(successDetails.StartDate)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">FECHA FIN:</span>
                        <span className="text-gray-600 mt-1 text-sm">{formatDate(successDetails.EndDate)}</span>
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
                          <span className="block text-xs font-bold text-gray-700 uppercase">DC-3 (PDF)</span>
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
                            onClick={() => handleDownloadPDF(successDetails.pdfUrl, `DC-3-${successDetails.tipo}-${successDetails.EmployeeID}.pdf`)}
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
                          <span className="block text-xs font-bold text-gray-700 uppercase">DC-3 (EDITABLE)</span>
                        </div>
                        <button
                          onClick={() => handleDownloadExcel(successDetails.excelUrl, `DC-3-${successDetails.tipo}-${successDetails.EmployeeID}.xlsx`)}
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
                    VISTA PREVIA - FORMATO DC3
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
                    title="Vista previa del certificado DC3"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE REGISTRO DC3 */}
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
                  {modalMode === 'create' ? 'NUEVO CERTIFICADO DC3' : 'EDITAR CERTIFICADO DC3'}
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  {modalMode === 'create' 
                    ? 'Registre un nuevo certificado DC3 para un empleado.'
                    : 'Modifique la información del certificado DC3 seleccionado.'
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

                          {selectedEmployeeData.tipo === 'BASE' ? (
                            <div>
                              <span className="block text-xs font-bold text-gray-500 uppercase">Área</span>
                              <span className="text-sm text-gray-900">{selectedEmployeeData.Area || 'N/A'}</span>
                            </div>
                          ) : (
                            <div>
                              <span className="block text-xs font-bold text-gray-500 uppercase">Proyecto</span>
                              <span className="text-sm text-gray-900">{selectedEmployeeData.NameProject || 'N/A'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Datos del DC3 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                    DATOS DEL CERTIFICADO DC3
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        NOMBRE DEL CURSO *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          name="CourseName"
                          value={formData.CourseName}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese el nombre del curso"
                          required
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        OCUPACIÓN ESPECÍFICA (CATÁLOGO NACIONAL DE OCUPACIONES)* 
                      </label>
                      <div className="relative">
                        <select
                          name="SpecificOccupation"
                          value={formData.SpecificOccupation}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                        >
                          <option value="">Seleccione una ocupación</option>
                          {OCCUPATION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        FECHA DE INICIO *
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          name="StartDate"
                          value={formData.StartDate}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        FECHA DE FIN *
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          name="EndDate"
                          value={formData.EndDate}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        DURACIÓN EN HORAS *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          name="Duration"
                          value={formData.Duration}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese la duración del curso en horas"
                          inputMode="numeric"
                          pattern="\d*"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        ÁREA TEMÁTICA DEL CURSO *
                      </label>
                      <div className="relative">
                        <select
                          name="Area"
                          value={formData.Area}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                        >
                          <option value="">Seleccione un área</option>
                          {AREA_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        INSTRUCTOR O TUTOR *
                      </label>
                      <div className="relative">
                        <select
                          name="TrainerID"
                          value={formData.TrainerID}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          disabled={loadingTrainers}
                        >
                          <option value="">Seleccione un instructor o tutor</option>
                          {loadingTrainers ? (
                            <option value="" disabled>CARGANDO INSTRUCTORES...</option>
                          ) : (
                            trainers.map((trainer) => (
                              <option key={trainer.id} value={trainer.id}>
                                {trainer.nombreCompleto} - {trainer.puesto} ({trainer.tipoPersonal})
                              </option>
                            ))
                          )}
                        </select>
                        {loadingTrainers && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#3a6ea5]"></div>
                          </div>
                        )}
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
                onClick={handleSaveRecord}
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
                CERTIFICADOS DC3
              </h1>
              <p className="text-sm text-gray-200 mt-1">
                Administre los certificados DC3 de los empleados.
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
                  placeholder="Buscar por ID, nombre de empleado o curso..."
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
              NUEVO DC3
            </button>
          </div>

          {/* Tabla de registros DC3 */}
          <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">ID DC3</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">ID EMPLEADO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">EMPLEADO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">PUESTO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">TIPO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">CURSO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">INICIO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">FIN</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">DURACIÓN (HRS)</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">DOCUMENTOS</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a6ea5] mb-2"></div>
                          <p className="text-gray-600">Cargando certificados DC3...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <AlertCircle className="h-8 w-8 text-gray-400 mb-3" />
                          <p className="text-sm font-medium text-gray-600 mt-2 leading-5">
                            {filters.search
                              ? 'No se encontraron registros que coincidan con la búsqueda'
                              : 'No hay certificados DC3 registrados'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentRecords.map((record) => (
                      <tr key={record.DC3ID} className="hover:bg-gray-50 transition-colors border-b border-gray-300">
                        <td className="py-3 px-4 text-sm text-gray-800 font-medium">{record.DC3ID}</td>
                        <td className="py-3 px-4 text-sm text-gray-800 font-medium">{record.EmployeeID}</td>
                        <td className="py-3 px-4">
                          <div className="text-sm font-medium text-gray-800 uppercase">
                            {record.FirstName} {record.LastName} {record.MiddleName}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-800 uppercase">{record.Position || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-800 uppercase">{record.tipo || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-800 uppercase">{record.CourseName || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800">{formatDate(record.StartDate)}</td>
                        <td className="py-3 px-4 text-sm text-gray-800">{formatDate(record.EndDate)}</td>
                        <td className="py-3 px-4 text-sm text-gray-800 font-medium">
                          {record.Duration ? `${record.Duration} hrs` : 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col space-y-1">
                            {record.DocumentURL ? (
                              <a
                                href={record.DocumentURL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center text-xs text-gray-700 hover:underline"
                                title="Ver PDF"
                              >
                                Ver
                              </a>
                            ) : (
                              <span className="text-xs text-gray-400">Sin documentos</span>
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
                              onClick={() => setConfirmDelete({ show: true, id: record.DC3ID })}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Eliminar registro"
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
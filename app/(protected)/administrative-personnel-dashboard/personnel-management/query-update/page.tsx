'use client';

import AppHeader from '@/components/header/2/2.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/2';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { useState, useEffect, ChangeEvent, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, Eye, X, RefreshCw, File, CheckCircle, AlertCircle, Upload, XCircle, Download, FileText } from 'lucide-react';
import { useUploadThing } from '@/lib/uploadthing';
import JSZip from 'jszip';

// Tipos de empleado
type EmployeeType = 'BASE' | 'PROJECT';

// Interface para empleado base (con documentos y status)
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
  Status: number;
  ContractFileURL: string | null;
  WarningFileURL: string | null;
  LetterFileURL: string | null;
  AgreementFileURL: string | null;
  uniqueKey: string;
}

// Interface para empleado de proyecto (con documentos y status)
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
  RFC: string;
  CURP: string;
  NSS: string;
  Email: string;
  Phone: string;
  tipo: 'PROJECT';
  Status: number;
  ContractFileURL: string | null;
  WarningFileURL: string | null;
  LetterFileURL: string | null;
  AgreementFileURL: string | null;
  uniqueKey: string;
}

// Tipo unificado
type Employee = BaseEmployee | ProjectEmployee;

// Interface para filtros
interface Filters {
  search: string;
  tipo: 'TODOS' | EmployeeType;
  projectId?: string;
}

// Interface para proyectos
interface Proyecto {
  ProjectID: number;
  NameProject: string;
  StartDate?: string;
  EndDate?: string;
  Status?: number;
}

// Interface para todos los documentos del empleado
interface EmployeeDocuments {
  CVFileURL?: string | null;
  ANFileURL?: string | null;
  CURPFileURL?: string | null;
  RFCFileURL?: string | null;
  IMSSFileURL?: string | null;
  INEFileURL?: string | null;
  CDFileURL?: string | null;
  CEFileURL?: string | null;
  CPFileURL?: string | null;
  LMFileURL?: string | null;
  ANPFileURL?: string | null;
  CRFileURL?: string | null;
  RIFileURL?: string | null;
  EMFileURL?: string | null;
  FotoFileURL?: string | null;
  FolletoFileURL?: string | null;
}

// Interface para los archivos a subir
interface UploadFiles {
  cvFile: File | null;
  actaNacimientoFile: File | null;
  curpFile: File | null;
  rfcFile: File | null;
  imssFile: File | null;
  ineFile: File | null;
  comprobanteDomicilioFile: File | null;
  comprobanteEstudiosFile: File | null;
  comprobanteCapacitacionFile: File | null;
  licenciaManejoFile: File | null;
  cartaAntecedentesFile: File | null;
  cartaRecomendacionFile: File | null;
  retencionInfonavitFile: File | null;
  examenMedicoFile: File | null;
  fotoFile: File | null;
  folletoFile: File | null;
}

// Interface para detalles de empleado
interface EmployeeDetails {
  success: boolean;
  uniqueKey?: string;
  personalInfo?: {
    nombreCompleto?: string;
    fechaNacimiento?: string;
    genero?: string;
    estadoCivil?: string;
    nacionalidad?: string;
    nci?: string;
    umf?: string;
    calle?: string;
    numeroExterior?: string;
    numeroInterior?: string;
    colonia?: string;
    municipio?: string;
    estado?: string;
    codigoPostal?: string;
    rfc?: string;
    curp?: string;
    nss?: string;
    telefono?: string;
    email?: string;
    puesto?: string;
    area?: string;
    salario?: number;
    horario?: string;
    proyecto?: string;
    proyectoId?: number;
    fechaInicioProyecto?: string;
    fechaFinProyecto?: string;
  };
  contractInfo?: {
    fechaInicio?: string;
    fechaFin?: string;
    salaryIMSS?: number;
    contractFileURL?: string | null;
    warningFileURL?: string | null;
    letterFileURL?: string | null;
    agreementFileURL?: string | null;
    position?: string;
    salary?: number;
    workSchedule?: string;
    projectId?: number;
    cDFileURL?: string | null;
    cRFileURL?: string | null;
    oFFileURL?: string | null;
    status?: number;
  };
  beneficiario?: {
    nombreCompleto: string;
    parentesco: string;
    porcentaje: number;
  };
  documentacion?: Record<string, string | null>;
  projectInfo?: {
    projectId: number;
    projectName: string;
    startDate: string;
    endDate: string;
    status: number;
  };
}

// Interface para el formulario de edición
interface EditFormData {
  firstName: string;
  lastName: string;
  middleName: string;
  fechaNacimiento: string;
  genero: string;
  estadoCivil: string;
  nacionalidad: string;
  nci: string;
  umf: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  colonia: string;
  municipio: string;
  estado: string;
  codigoPostal: string;
  rfc: string;
  curp: string;
  nss: string;
  telefono: string;
  email: string;
  puesto: string;
  area: string;
  salario: string;
  horario: string;
  fechaInicio: string;
  proyectoId: string;
  salaryIMSS: string;
  beneficiaryFirstName: string;
  beneficiaryLastName: string;
  beneficiaryMiddleName: string;
  beneficiaryRelationship: string;
  beneficiaryPercentage: string;
  jefeDirectoId: string;
}

const documentNames: Record<string, string> = {
  cvFile: 'CV / Solicitud',
  actaNacimientoFile: 'Acta de Nacimiento',
  curpFile: 'CURP',
  rfcFile: 'RFC',
  imssFile: 'IMSS',
  ineFile: 'INE',
  comprobanteDomicilioFile: 'Comprobante de Domicilio',
  comprobanteEstudiosFile: 'Comprobante de Estudios',
  comprobanteCapacitacionFile: 'Comprobante de Capacitación',
  licenciaManejoFile: 'Licencia de Manejo',
  cartaAntecedentesFile: 'Carta de Antecedentes No Penales',
  cartaRecomendacionFile: 'Carta de Recomendación',
  retencionInfonavitFile: 'Retención Infonavit',
  examenMedicoFile: 'Examen Médico',
  fotoFile: 'Fotografía',
  folletoFile: 'Folleto de Inducción'
};

const fileToUrlKeyMap: Record<string, string> = {
  cvFile: 'CVFileURL',
  actaNacimientoFile: 'ANFileURL',
  curpFile: 'CURPFileURL',
  rfcFile: 'RFCFileURL',
  imssFile: 'IMSSFileURL',
  ineFile: 'INEFileURL',
  comprobanteDomicilioFile: 'CDFileURL',
  comprobanteEstudiosFile: 'CEFileURL',
  comprobanteCapacitacionFile: 'CPFileURL',
  licenciaManejoFile: 'LMFileURL',
  cartaAntecedentesFile: 'ANPFileURL',
  cartaRecomendacionFile: 'CRFileURL',
  retencionInfonavitFile: 'RIFileURL',
  examenMedicoFile: 'EMFileURL',
  fotoFile: 'FotoFileURL',
  folletoFile: 'FolletoFileURL'
};

type UploadFileKey = keyof UploadFiles;

const toUpperCaseWithAccents = (text: string): string => {
  return text.toUpperCase();
};

const formatDateForInput = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
};

export default function EmployeesListPage() {
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [filters, setFilters] = useState<Filters>({
    search: '',
    tipo: 'TODOS'
  });

  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [jefesDirectos, setJefesDirectos] = useState<Array<{ id: number; nombreCompleto: string; puesto: string; tipoPersonal: string }>>([]);
  const [loadingJefes, setLoadingJefes] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeDetails | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  
  // Modal para cuando el empleado de PROYECTO está activo y se intenta editar
  const [showActiveEmployeeModal, setShowActiveEmployeeModal] = useState(false);
  const [activeEmployeeName, setActiveEmployeeName] = useState('');

  const [showUpdateSuccessModal, setShowUpdateSuccessModal] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [updateSuccessDetails, setUpdateSuccessDetails] = useState<{
    empleadoId: string;
    nombre: string;
    puesto: string;
    tipoPersonal: string;
    fechaRegistro: string;
    ftRh02PdfUrl: string;
    ftRh02PdfDownloadUrl: string;
    ftRh04PdfUrl: string;
    ftRh04PdfDownloadUrl: string;
    ftRh07PdfUrl: string;
    ftRh07PdfDownloadUrl: string;
    ftRh29PdfUrl: string;
    ftRh29PdfDownloadUrl: string;
    ftRh02WordUrl: string;
    ftRh04ExcelUrl: string;
    ftRh07WordUrl: string;
    ftRh29WordUrl: string;
  } | null>(null);
  const [updateFormatoActivo, setUpdateFormatoActivo] = useState<'FT-RH-02' | 'FT-RH-04' | 'FT-RH-07' | 'FT-RH-29'>('FT-RH-02');

  const [uploadFiles, setUploadFiles] = useState<UploadFiles>({
    cvFile: null,
    actaNacimientoFile: null,
    curpFile: null,
    rfcFile: null,
    imssFile: null,
    ineFile: null,
    comprobanteDomicilioFile: null,
    comprobanteEstudiosFile: null,
    comprobanteCapacitacionFile: null,
    licenciaManejoFile: null,
    cartaAntecedentesFile: null,
    cartaRecomendacionFile: null,
    retencionInfonavitFile: null,
    examenMedicoFile: null,
    fotoFile: null,
    folletoFile: null
  });

  const [existingUrls, setExistingUrls] = useState<EmployeeDocuments>({});

  const [editFormData, setEditFormData] = useState<EditFormData>({
    firstName: '',
    lastName: '',
    middleName: '',
    fechaNacimiento: '',
    genero: '',
    estadoCivil: '',
    nacionalidad: '',
    nci: '',
    umf: '',
    calle: '',
    numeroExterior: '',
    numeroInterior: '',
    colonia: '',
    municipio: '',
    estado: '',
    codigoPostal: '',
    rfc: '',
    curp: '',
    nss: '',
    telefono: '',
    email: '',
    puesto: '',
    area: '',
    salario: '',
    horario: '',
    fechaInicio: '',
    proyectoId: '',
    salaryIMSS: '',
    beneficiaryFirstName: '',
    beneficiaryLastName: '',
    beneficiaryMiddleName: '',
    beneficiaryRelationship: '',
    beneficiaryPercentage: '',
    jefeDirectoId: ''
  });

  const fileInputRefs = useRef<{
    [key in UploadFileKey]?: HTMLInputElement
  }>({});

  const { startUpload } = useUploadThing('hiringFiles', {
    onClientUploadComplete: () => {
      console.log("Documentos subidos exitosamente");
      setUploadProgress(100);
    },
    onUploadError: (error) => {
      console.error("Error al subir documentos:", error);
      setError('Error al subir documentos. Por favor, intente nuevamente.');
      setUploadProgress(0);
    },
  });

  useEffect(() => {
    fetchEmployees();
    fetchProjects();
    fetchJefesDirectos();
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
      const response = await fetch('/api/administrative-personnel-dashboard/employee-management/query-update/query');
      if (!response.ok) throw new Error('Error al cargar empleados');
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

  const fetchJefesDirectos = async () => {
    try {
      setLoadingJefes(true);
      const response = await fetch('/api/catalogs/jefes-directos');
      if (response.ok) {
        const data = await response.json();
        setJefesDirectos(data);
      }
    } catch (error) {
      console.error('Error al cargar jefes directos:', error);
    } finally {
      setLoadingJefes(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...employees];
    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase().trim();
      const isNumber = /^\d+$/.test(searchLower);
      filtered = filtered.filter(emp => {
        if (isNumber && emp.EmployeeID.toString().includes(searchLower)) return true;
        const fullName = `${emp.FirstName} ${emp.LastName} ${emp.MiddleName || ''}`.toLowerCase();
        return fullName.includes(searchLower);
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
    setFilters({ search: '', tipo: 'TODOS', projectId: undefined });
  };

  const deleteFileFromUploadThing = async (fileUrl: string) => {
    try {
      const urlParts = fileUrl.split('/');
      const fileKey = urlParts[urlParts.length - 1];
      if (!fileKey) return;
      await fetch('/api/uploadthing/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey }),
      });
    } catch (error) {
      console.error('Error al eliminar archivo:', error);
    }
  };

  const uploadSingleFile = async (file: File, tipo: string, employeeId: number): Promise<string> => {
    try {
      const response = await startUpload([file]);
      if (response && response.length > 0) return response[0].url;
      throw new Error('Error al subir archivo');
    } catch (error) {
      console.error(`Error al subir archivo ${tipo}:`, error);
      throw error;
    }
  };

  const handleEditClick = (employee: Employee) => {
    // Solo mostrar modal si es empleado de PROYECTO Y está activo
    if (employee.tipo === 'PROJECT' && employee.Status === 1) {
      setActiveEmployeeName(`${employee.FirstName} ${employee.LastName} ${employee.MiddleName || ''}`.trim());
      setShowActiveEmployeeModal(true);
      setIsEditing(true);
    } else {
      // Para BASE o PROJECT inactivo, permitir edición directamente
      setIsEditing(true);
    }
  };

  // Función para descargar todos los PDFs en un ZIP
  const handleDownloadAllPDFs = async () => {
    if (!updateSuccessDetails) return;
    
    try {
      setDownloadingZip(true);
      
      const zip = new JSZip();
      
      // Descargar FT-RH-02 PDF
      if (updateSuccessDetails.ftRh02PdfDownloadUrl) {
        try {
          const response = await fetch(updateSuccessDetails.ftRh02PdfDownloadUrl);
          if (response.ok) {
            const blob = await response.blob();
            zip.file(`FT-RH-02_${updateSuccessDetails.empleadoId}.pdf`, blob);
          }
        } catch (error) {
          console.error('Error al descargar FT-RH-02:', error);
        }
      }
      
      // Descargar FT-RH-04 PDF
      if (updateSuccessDetails.ftRh04PdfDownloadUrl) {
        try {
          const response = await fetch(updateSuccessDetails.ftRh04PdfDownloadUrl);
          if (response.ok) {
            const blob = await response.blob();
            zip.file(`FT-RH-04_${updateSuccessDetails.empleadoId}.pdf`, blob);
          }
        } catch (error) {
          console.error('Error al descargar FT-RH-04:', error);
        }
      }
      
      // Descargar FT-RH-07 PDF
      if (updateSuccessDetails.ftRh07PdfDownloadUrl) {
        try {
          const response = await fetch(updateSuccessDetails.ftRh07PdfDownloadUrl);
          if (response.ok) {
            const blob = await response.blob();
            zip.file(`FT-RH-07_${updateSuccessDetails.empleadoId}.pdf`, blob);
          }
        } catch (error) {
          console.error('Error al descargar FT-RH-07:', error);
        }
      }
      
      // Descargar FT-RH-29 PDF
      if (updateSuccessDetails.ftRh29PdfDownloadUrl) {
        try {
          const response = await fetch(updateSuccessDetails.ftRh29PdfDownloadUrl);
          if (response.ok) {
            const blob = await response.blob();
            zip.file(`FT-RH-29_${updateSuccessDetails.empleadoId}.pdf`, blob);
          }
        } catch (error) {
          console.error('Error al descargar FT-RH-29:', error);
        }
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      const downloadUrl = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `documentos_${updateSuccessDetails.empleadoId}.zip`;
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

  // Función para descargar todos los editables en un ZIP
  const handleDownloadAllEditables = async () => {
    if (!updateSuccessDetails) return;
    
    try {
      setDownloadingZip(true);
      
      const zip = new JSZip();
      
      // Descargar FT-RH-02 Word
      if (updateSuccessDetails.ftRh02WordUrl) {
        try {
          const response = await fetch(updateSuccessDetails.ftRh02WordUrl);
          if (response.ok) {
            const blob = await response.blob();
            zip.file(`FT-RH-02_${updateSuccessDetails.empleadoId}.docx`, blob);
          }
        } catch (error) {
          console.error('Error al descargar FT-RH-02 editable:', error);
        }
      }
      
      // Descargar FT-RH-04 Excel
      if (updateSuccessDetails.ftRh04ExcelUrl) {
        try {
          const response = await fetch(updateSuccessDetails.ftRh04ExcelUrl);
          if (response.ok) {
            const blob = await response.blob();
            zip.file(`FT-RH-04_${updateSuccessDetails.empleadoId}.xlsx`, blob);
          }
        } catch (error) {
          console.error('Error al descargar FT-RH-04 editable:', error);
        }
      }
      
      // Descargar FT-RH-07 Word
      if (updateSuccessDetails.ftRh07WordUrl) {
        try {
          const response = await fetch(updateSuccessDetails.ftRh07WordUrl);
          if (response.ok) {
            const blob = await response.blob();
            zip.file(`FT-RH-07_${updateSuccessDetails.empleadoId}.docx`, blob);
          }
        } catch (error) {
          console.error('Error al descargar FT-RH-07 editable:', error);
        }
      }
      
      // Descargar FT-RH-29 Word
      if (updateSuccessDetails.ftRh29WordUrl) {
        try {
          const response = await fetch(updateSuccessDetails.ftRh29WordUrl);
          if (response.ok) {
            const blob = await response.blob();
            zip.file(`FT-RH-29_${updateSuccessDetails.empleadoId}.docx`, blob);
          }
        } catch (error) {
          console.error('Error al descargar FT-RH-29 editable:', error);
        }
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      const downloadUrl = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `editables_${updateSuccessDetails.empleadoId}.zip`;
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

  const fetchEmployeeDetails = async (employee: Employee) => {
    try {
      setDetailsLoading(true);
      setSelectedEmployee(employee);
      
      setIsEditing(false);
      
      const resetFiles: UploadFiles = {
        cvFile: null, actaNacimientoFile: null, curpFile: null, rfcFile: null,
        imssFile: null, ineFile: null, comprobanteDomicilioFile: null,
        comprobanteEstudiosFile: null, comprobanteCapacitacionFile: null,
        licenciaManejoFile: null, cartaAntecedentesFile: null,
        cartaRecomendacionFile: null, retencionInfonavitFile: null,
        examenMedicoFile: null, fotoFile: null, folletoFile: null
      };
      setUploadFiles(resetFiles);
      
      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/query-update/query/details/${employee.EmployeeID}?tipo=${employee.tipo}`);
      if (!response.ok) throw new Error('Error al cargar detalles');
      const data = await response.json();
      
      if (data.success) {
        setEmployeeDetails(data);
        
        const allUrls: EmployeeDocuments = {};
        if (data.documentacion) {
          Object.assign(allUrls, data.documentacion);
        }
        setExistingUrls(allUrls);
        
        const personalInfo = data.personalInfo || {};
        const contractInfo = data.contractInfo || {};
        const beneficiario = data.beneficiario;
        
        const fechaNacimientoFormatted = formatDateForInput(personalInfo.fechaNacimiento);
        
        let benFirstName = '', benLastName = '', benMiddleName = '';
        if (beneficiario?.nombreCompleto) {
          const parts = beneficiario.nombreCompleto.split(' ');
          benFirstName = parts[0] || '';
          benLastName = parts[1] || '';
          benMiddleName = parts.slice(2).join(' ') || '';
        }
        
        setEditFormData({
          firstName: employee.FirstName || '',
          lastName: employee.LastName || '',
          middleName: employee.MiddleName || '',
          fechaNacimiento: fechaNacimientoFormatted,
          genero: personalInfo.genero || '',
          estadoCivil: personalInfo.estadoCivil || '',
          nacionalidad: personalInfo.nacionalidad || '',
          nci: personalInfo.nci || '',
          umf: personalInfo.umf || '',
          calle: personalInfo.calle || '',
          numeroExterior: personalInfo.numeroExterior || '',
          numeroInterior: personalInfo.numeroInterior || '',
          colonia: personalInfo.colonia || '',
          municipio: personalInfo.municipio || '',
          estado: personalInfo.estado || '',
          codigoPostal: personalInfo.codigoPostal || '',
          rfc: employee.RFC || '',
          curp: employee.CURP || '',
          nss: employee.NSS || '',
          telefono: employee.Phone || '',
          email: employee.Email || '',
          puesto: employee.Position || '',
          area: employee.tipo === 'BASE' ? (employee as BaseEmployee).Area || '' : '',
          salario: employee.Salary?.toString() || '',
          horario: employee.WorkSchedule || '',
          fechaInicio: formatDateForInput(contractInfo.fechaInicio),
          proyectoId: employee.tipo === 'PROJECT' ? ((employee as ProjectEmployee).ProjectID?.toString() || '') : '',
          salaryIMSS: contractInfo.salaryIMSS?.toString() || '',
          beneficiaryFirstName: benFirstName,
          beneficiaryLastName: benLastName,
          beneficiaryMiddleName: benMiddleName,
          beneficiaryRelationship: beneficiario?.parentesco || '',
          beneficiaryPercentage: beneficiario?.porcentaje?.toString() || '',
          jefeDirectoId: ''
        });
        
        setShowDetailsModal(true);
      } else {
        setError(data.message || 'Error al cargar detalles');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Error al cargar detalles del empleado');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleEditFormChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const shouldUpperCase = !['email', 'fechaNacimiento', 'fechaInicio', 'salario', 'salaryIMSS', 'beneficiaryPercentage'].includes(name);
    const newValue = shouldUpperCase ? toUpperCaseWithAccents(value) : value;
    setEditFormData(prev => ({ ...prev, [name]: newValue }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>, tipo: UploadFileKey) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (tipo === 'fotoFile') {
      if (!file.type.startsWith('image/')) {
        setError('Solo se permiten imágenes (JPG/PNG) para la fotografía');
        return;
      }
    } else {
      if (file.type !== 'application/pdf') {
        setError('Solo se permiten archivos PDF');
        return;
      }
    }
    const maxSize = 4 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('El archivo no puede ser mayor a 4MB');
      return;
    }
    setUploadFiles(prev => ({ ...prev, [tipo]: file }));
    setError('');
  };

  const removeFile = (tipo: UploadFileKey) => {
    setUploadFiles(prev => ({ ...prev, [tipo]: null }));
    if (fileInputRefs.current[tipo]) {
      fileInputRefs.current[tipo]!.value = '';
    }
  };

  const triggerFileInput = (tipo: UploadFileKey) => {
    fileInputRefs.current[tipo]?.click();
  };

  const uploadNewFiles = async (employeeId: number): Promise<Record<string, string>> => {
    const uploadedUrls: Record<string, string> = {};
    const filesToUpload: { file: File; tipo: UploadFileKey }[] = [];
    Object.entries(uploadFiles).forEach(([key, file]) => {
      if (file !== null) filesToUpload.push({ file, tipo: key as UploadFileKey });
    });
    if (filesToUpload.length === 0) return {};
    
    let uploadedCount = 0;
    const totalFiles = filesToUpload.length;
    
    for (const { file, tipo } of filesToUpload) {
      try {
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 50));
        const url = await uploadSingleFile(file, tipo, employeeId);
        const urlKey = fileToUrlKeyMap[tipo];
        if (urlKey) uploadedUrls[urlKey] = url;
        uploadedCount++;
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
      } catch (error) {
        throw new Error(`Error al subir archivo ${documentNames[tipo]}`);
      }
    }
    return uploadedUrls;
  };

  const deleteExistingFiles = async (newUrls: Record<string, string>) => {
    const filesToDelete: string[] = [];
    Object.entries(newUrls).forEach(([key, newUrl]) => {
      const oldUrl = existingUrls[key as keyof typeof existingUrls];
      if (oldUrl && newUrl) filesToDelete.push(oldUrl);
    });
    await Promise.all(filesToDelete.map(url => deleteFileFromUploadThing(url)));
  };

  const handleSaveChanges = async () => {
  if (!selectedEmployee) return;
  
  // Validación para empleados de PROYECTO activos - no permitir cambios laborales
  if (selectedEmployee.tipo === 'PROJECT' && selectedEmployee.Status === 1) {
    const laboralFieldsChanged = 
      editFormData.puesto !== selectedEmployee.Position ||
      editFormData.salario !== selectedEmployee.Salary?.toString() ||
      editFormData.horario !== selectedEmployee.WorkSchedule ||
      editFormData.proyectoId !== (selectedEmployee as ProjectEmployee).ProjectID?.toString() ||
      editFormData.jefeDirectoId !== '' ||
      editFormData.salaryIMSS !== (employeeDetails?.contractInfo?.salaryIMSS?.toString() || '');
    
    if (laboralFieldsChanged) {
      setError('NO SE PUEDEN GUARDAR CAMBIOS LABORALES. EL EMPLEADO DE PROYECTO ESTÁ ACTIVO. PRIMERO DEBE REALIZAR LA BAJA.');
      return;
    }
  }
  
  try {
    setSavingEdit(true);
    setError('');
    let newFileUrls: Record<string, string> = {};
    const hasFilesToUpload = Object.values(uploadFiles).some(file => file !== null);
    if (hasFilesToUpload) {
      try {
        newFileUrls = await uploadNewFiles(selectedEmployee.EmployeeID);
        await deleteExistingFiles(newFileUrls);
      } catch (uploadError) {
        setError('Error al subir archivos. Por favor, intente nuevamente.');
        setSavingEdit(false);
        return;
      }
    }
    const finalUrls = { ...existingUrls, ...newFileUrls };
    const documentUrls = {
      CVFileURL: finalUrls.CVFileURL,
      ANFileURL: finalUrls.ANFileURL,
      CURPFileURL: finalUrls.CURPFileURL,
      RFCFileURL: finalUrls.RFCFileURL,
      IMSSFileURL: finalUrls.IMSSFileURL,
      INEFileURL: finalUrls.INEFileURL,
      CDFileURL: finalUrls.CDFileURL,
      CEFileURL: finalUrls.CEFileURL,
      CPFileURL: finalUrls.CPFileURL,
      LMFileURL: finalUrls.LMFileURL,
      ANPFileURL: finalUrls.ANPFileURL,
      CRFileURL: finalUrls.CRFileURL,
      RIFileURL: finalUrls.RIFileURL,
      EMFileURL: finalUrls.EMFileURL,
      FotoFileURL: finalUrls.FotoFileURL,
      FolletoFileURL: finalUrls.FolletoFileURL
    };
    
    // IMPORTANTE: Determinar si el empleado está inactivo
    const isEmployeeInactive = selectedEmployee.Status === 0;
    
    // Construir contractInfo SOLO si el empleado está inactivo
    let contractInfoData = undefined;
    
    if (isEmployeeInactive) {
      if (selectedEmployee.tipo === 'BASE') {
        contractInfoData = {
          startDate: editFormData.fechaInicio,
          salaryIMSS: editFormData.salaryIMSS ? parseFloat(editFormData.salaryIMSS) : null,
          jefeDirectoId: editFormData.jefeDirectoId ? parseInt(editFormData.jefeDirectoId) : null
        };
      } else {
        contractInfoData = {
          salaryIMSS: editFormData.salaryIMSS ? parseFloat(editFormData.salaryIMSS) : null,
          position: toUpperCaseWithAccents(editFormData.puesto),
          salary: parseFloat(editFormData.salario) || 0,
          workSchedule: toUpperCaseWithAccents(editFormData.horario),
          projectId: editFormData.proyectoId ? parseInt(editFormData.proyectoId) : null,
          jefeDirectoId: editFormData.jefeDirectoId ? parseInt(editFormData.jefeDirectoId) : null
        };
      }
    }
    
    const updateData = {
      tipo: selectedEmployee.tipo,
      personalInfo: {
        firstName: toUpperCaseWithAccents(editFormData.firstName),
        lastName: toUpperCaseWithAccents(editFormData.lastName),
        middleName: toUpperCaseWithAccents(editFormData.middleName),
        // Siempre enviar posición, salario y horario para actualizar la tabla principal
        position: toUpperCaseWithAccents(editFormData.puesto),
        ...(selectedEmployee.tipo === 'BASE' && {
          area: toUpperCaseWithAccents(editFormData.area),
        }),
        salary: parseFloat(editFormData.salario) || 0,
        workSchedule: toUpperCaseWithAccents(editFormData.horario)
      },
      personalInfoExtra: {
        calle: toUpperCaseWithAccents(editFormData.calle),
        numeroExterior: editFormData.numeroExterior ? parseInt(editFormData.numeroExterior) : null,
        numeroInterior: editFormData.numeroInterior ? parseInt(editFormData.numeroInterior) : null,
        colonia: toUpperCaseWithAccents(editFormData.colonia),
        municipio: toUpperCaseWithAccents(editFormData.municipio),
        estado: toUpperCaseWithAccents(editFormData.estado),
        codigoPostal: editFormData.codigoPostal ? parseInt(editFormData.codigoPostal) : null,
        municipality: toUpperCaseWithAccents(editFormData.municipio),
        nationality: toUpperCaseWithAccents(editFormData.nacionalidad),
        gender: toUpperCaseWithAccents(editFormData.genero),
        birthdate: editFormData.fechaNacimiento,
        maritalStatus: toUpperCaseWithAccents(editFormData.estadoCivil),
        rfc: toUpperCaseWithAccents(editFormData.rfc),
        curp: toUpperCaseWithAccents(editFormData.curp),
        nss: editFormData.nss,
        nci: toUpperCaseWithAccents(editFormData.nci),
        umf: editFormData.umf ? parseInt(editFormData.umf) : null,
        phone: editFormData.telefono,
        email: editFormData.email.toLowerCase().trim()
      },
      contractInfo: contractInfoData,
      documentacion: documentUrls,
      beneficiario: {
        beneficiaryFirstName: toUpperCaseWithAccents(editFormData.beneficiaryFirstName),
        beneficiaryLastName: toUpperCaseWithAccents(editFormData.beneficiaryLastName),
        beneficiaryMiddleName: toUpperCaseWithAccents(editFormData.beneficiaryMiddleName),
        relationship: toUpperCaseWithAccents(editFormData.beneficiaryRelationship),
        percentage: parseFloat(editFormData.beneficiaryPercentage) || 0
      }
    };
    
    console.log('=== ENVIANDO ACTUALIZACIÓN ===');
    console.log('Empleado ID:', selectedEmployee.EmployeeID);
    console.log('Status actual:', selectedEmployee.Status);
    console.log('isEmployeeInactive:', isEmployeeInactive);
    console.log('contractInfo enviado:', contractInfoData);
    console.log('===============================');
    
    const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/query-update/update/${selectedEmployee.EmployeeID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    });
    const data = await response.json();
    
    console.log('=== RESPUESTA DEL SERVIDOR ===');
    console.log('success:', data.success);
    console.log('message:', data.message);
    console.log('contractFileURL:', data.contractFileURL);
    console.log('warningFileURL:', data.warningFileURL);
    console.log('letterFileURL:', data.letterFileURL);
    console.log('agreementFileURL:', data.agreementFileURL);
    console.log('===============================');
    
    if (response.ok && data.success) {
      setShowDetailsModal(false);
      setEmployeeDetails(null);
      setSelectedEmployee(null);
      setIsEditing(false);
      await fetchEmployees();
      
      // Solo mostrar el modal si se generaron documentos
      if (data.contractFileURL || data.warningFileURL || data.letterFileURL || data.agreementFileURL) {
        const nombreCompleto = data.employeeName || `${editFormData.firstName} ${editFormData.lastName} ${editFormData.middleName}`.trim();
        
        setUpdateSuccessDetails({
          empleadoId: data.employeeId,
          nombre: nombreCompleto,
          puesto: data.employeePosition || editFormData.puesto,
          tipoPersonal: selectedEmployee.tipo === 'BASE' ? 'PERSONAL BASE' : 'PERSONAL DE PROYECTO',
          fechaRegistro: new Date().toLocaleDateString('es-MX'),
          ftRh02PdfUrl: data.contractFileURL ? `${data.contractFileURL}` : `/api/download/pdf/FT-RH-02?empleadoId=${data.employeeId}&tipo=${selectedEmployee.tipo}`,
          ftRh02PdfDownloadUrl: data.contractFileURL || `/api/download/pdf/FT-RH-02?empleadoId=${data.employeeId}&tipo=${selectedEmployee.tipo}`,
          ftRh04PdfUrl: data.warningFileURL ? `${data.warningFileURL}` : `/api/download/pdf/FT-RH-04?empleadoId=${data.employeeId}&tipo=${selectedEmployee.tipo}`,
          ftRh04PdfDownloadUrl: data.warningFileURL || `/api/download/pdf/FT-RH-04?empleadoId=${data.employeeId}&tipo=${selectedEmployee.tipo}`,
          ftRh07PdfUrl: data.letterFileURL ? `${data.letterFileURL}` : `/api/download/pdf/FT-RH-07?empleadoId=${data.employeeId}&tipo=${selectedEmployee.tipo}`,
          ftRh07PdfDownloadUrl: data.letterFileURL || `/api/download/pdf/FT-RH-07?empleadoId=${data.employeeId}&tipo=${selectedEmployee.tipo}`,
          ftRh29PdfUrl: data.agreementFileURL ? `${data.agreementFileURL}` : `/api/download/pdf/FT-RH-29?empleadoId=${data.employeeId}&tipo=${selectedEmployee.tipo}`,
          ftRh29PdfDownloadUrl: data.agreementFileURL || `/api/download/pdf/FT-RH-29?empleadoId=${data.employeeId}&tipo=${selectedEmployee.tipo}`,
          ftRh02WordUrl: `/api/download/edit/FT-RH-02?empleadoId=${data.employeeId}&tipo=${selectedEmployee.tipo}`,
          ftRh04ExcelUrl: `/api/download/edit/FT-RH-04?empleadoId=${data.employeeId}&tipo=${selectedEmployee.tipo}`,
          ftRh07WordUrl: `/api/download/edit/FT-RH-07?empleadoId=${data.employeeId}&tipo=${selectedEmployee.tipo}`,
          ftRh29WordUrl: `/api/download/edit/FT-RH-29?empleadoId=${data.employeeId}&tipo=${selectedEmployee.tipo}`
        });
        setShowUpdateSuccessModal(true);
      } else {
        setSuccessMessage(data.message || 'EMPLEADO ACTUALIZADO EXITOSAMENTE');
        // Ocultar el mensaje después de 3 segundos
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } else {
      setError(data.message || 'ERROR AL ACTUALIZAR EMPLEADO');
    }
  } catch (error) {
    console.error('Error:', error);
    setError('ERROR DE CONEXIÓN AL ACTUALIZAR EMPLEADO');
  } finally {
    setSavingEdit(false);
    setUploadProgress(0);
  }
};

  const openPdfInNewTab = (url: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('es-MX', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  const formatCurrency = (amount: number): string => {
    try {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency', currency: 'MXN', minimumFractionDigits: 2
      }).format(amount);
    } catch {
      return `$${amount.toFixed(2)}`;
    }
  };

  const getDocumentName = (key: string): string => {
    const documentNamesMap: Record<string, string> = {
      CVFileURL: 'Solicitud de empleo o CV',
      ANFileURL: 'Copia de acta de nacimiento',
      CURPFileURL: 'Copia de CURP',
      RFCFileURL: 'Copia de constancia de RFC',
      IMSSFileURL: 'Copia de hoja de afiliación IMSS',
      INEFileURL: 'Copia de credencial de elector INE',
      CDFileURL: 'Copia de comprobante de domicilio',
      CEFileURL: 'Copia de comprobante de estudios',
      CPFileURL: 'Copia de comprobante de capacitación',
      LMFileURL: 'Copia de licencia de manejo',
      ANPFileURL: 'Carta de antecedentes no penales',
      CRFileURL: 'Copia de carta de recomendación',
      RIFileURL: 'Copia de hoja de retención infonavit',
      EMFileURL: 'Copia de examen médico',
      FotoFileURL: 'Fotografía',
      FolletoFileURL: 'Folletos de inducción'
    };
    return documentNamesMap[key] || key;
  };

  const hasAnyFormat = (employee: Employee): boolean => {
    return !!(employee.ContractFileURL || employee.WarningFileURL || employee.LetterFileURL || employee.AgreementFileURL);
  };

  const getStatusText = (status: number): string => {
    return status === 1 ? 'ACTIVO' : 'INACTIVO';
  };

  const getStatusColor = (status: number): string => {
    return status === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const FileDisplay = ({ tipo, file }: { tipo: UploadFileKey; file: File | null }) => {
    if (!file) return null;
    return (
      <div className="mt-2 flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm">
        <div className="flex items-center truncate">
          <File className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
          <span className="truncate">{file.name}</span>
          <span className="ml-2 text-xs text-gray-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
        </div>
        <button type="button" onClick={() => removeFile(tipo)} className="text-red-500 hover:text-red-700 ml-2">
          <XCircle className="h-4 w-4" />
        </button>
      </div>
    );
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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <AppHeader title="PANEL ADMINISTRATIVO" />
      <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
        <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5]">
              <h1 className="text-xl font-bold text-white tracking-tight">CONSULTA / ACTUALIZACIÓN</h1>
              <p className="text-sm text-gray-200 mt-1">Visualice, edite y administre la información de los empleados registrados en el sistema.</p>
            </div>
          </div>

          {successMessage && (
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
                  <button onClick={() => setFilters(prev => ({ ...prev, search: '' }))} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
            <select
              value={filters.tipo}
              onChange={(e) => setFilters(prev => ({ ...prev, tipo: e.target.value as 'TODOS' | EmployeeType, projectId: e.target.value !== 'PROJECT' ? undefined : prev.projectId }))}
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
                  <option key={proyecto.ProjectID} value={proyecto.ProjectID}>{proyecto.NameProject}</option>
                ))}
              </select>
            )}
            <button onClick={clearFilters} className="px-4 py-2.5 bg-gray-200 text-gray-800 font-bold rounded-md hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap">
              <RefreshCw className="h-4 w-4 mr-2" /> LIMPIAR
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
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">ESTADO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">PUESTO / PROYECTO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">CONTACTO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300 text-center">FORMATOS</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a6ea5] mb-2"></div>
                          <p className="text-gray-600">Cargando empleados...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <AlertCircle className="h-8 w-8 text-gray-400 mb-3" />
                          <p className="text-sm font-medium text-gray-600 mt-2 leading-5">
                            {filters.search || filters.tipo !== 'TODOS' || filters.projectId ? 'No se encontraron empleados que coincidan con la búsqueda' : 'No hay empleados registrados en el sistema'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentEmployees.map((employee) => (
                      <tr key={`${employee.tipo}-${employee.EmployeeID}`} className="hover:bg-gray-50 transition-colors border-b border-gray-300">
                        <td className="py-3 px-4 text-sm text-gray-800 font-medium">{employee.EmployeeID}</td>
                        <td className="py-3 px-4">
                          <div className="text-sm font-medium text-gray-800">{employee.FirstName} {employee.LastName} {employee.MiddleName}</div>
                        </td>
                        <td className="py-3 px-4"><div className="text-sm font-medium text-gray-800">{employee.tipo === 'BASE' ? 'BASE' : 'PROYECTO'}</div></td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(employee.Status)}`}>
                            {getStatusText(employee.Status)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-800">{employee.Position || 'N/A'}</div>
                          {employee.tipo === 'PROJECT' && <div className="text-xs text-gray-500 uppercase">{(employee as ProjectEmployee).ProjectName || 'Sin proyecto'}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-800">{employee.Email}</div>
                          <div className="text-xs text-gray-500">{employee.Phone}</div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {hasAnyFormat(employee) ? (
                            <div className="relative inline-block">
                              <div className="flex flex-col space-y-1">
                                {employee.ContractFileURL && (
                                  <button
                                    onClick={() => openPdfInNewTab(employee.ContractFileURL!)}
                                    className="text-xs text-gray-700 hover:underline"
                                    title="FT-RH-02 (Contrato)"
                                  >
                                    Ver Contrato
                                  </button>
                                )}
                                {employee.WarningFileURL && (
                                  <button
                                    onClick={() => openPdfInNewTab(employee.WarningFileURL!)}
                                    className="text-xs text-gray-700 hover:underline"
                                    title="FT-RH-04 (Carta Advertencia)"
                                  >
                                    Ver Aviso de Contratación
                                  </button>
                                )}
                                {employee.LetterFileURL && (
                                  <button
                                    onClick={() => openPdfInNewTab(employee.LetterFileURL!)}
                                    className="text-xs text-gray-700 hover:underline"
                                    title="FT-RH-07 (Carta Recomendación)"
                                  >
                                    Ver Carta Compromiso
                                  </button>
                                )}
                                {employee.AgreementFileURL && (
                                  <button
                                    onClick={() => openPdfInNewTab(employee.AgreementFileURL!)}
                                    className="text-xs text-gray-700 hover:underline"
                                    title="FT-RH-29 (Convenio)"
                                  >
                                    Ver Convenio
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Sin formatos</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => fetchEmployeeDetails(employee)} 
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors" 
                              title="Ver detalles"
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
                <div className="text-sm text-gray-700">Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredEmployees.length)} de {filteredEmployees.length} registros</div>
                <div className="flex space-x-2">
                  <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-4 py-2 bg-[#3a6ea5] text-white rounded-md">{currentPage} / {totalPages}</span>
                  <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />

      {/* MODAL DE ADVERTENCIA PARA EMPLEADO DE PROYECTO ACTIVO */}
      {showActiveEmployeeModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4" 
          style={{ 
            margin: 0, 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 99999
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-in" style={{ zIndex: 100000 }}>
            <div className="p-6 pb-4 border-b border-gray-300 flex items-center justify-between bg-white rounded-t-lg">
              <div className="flex items-center">
                <AlertCircle className="h-6 w-6 text-yellow-600 mr-2" />
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">EMPLEADO DE PROYECTO ACTIVO</h2>
              </div>
              <button onClick={() => { setShowActiveEmployeeModal(false); setIsEditing(false); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                El empleado de proyecto <span className="font-bold">{activeEmployeeName}</span> se encuentra en estado <span className="font-bold text-green-600">ACTIVO</span> en el sistema.
              </p>
              <p className="text-gray-700">
                Para poder modificar la <span className="font-bold">INFORMACIÓN LABORAL</span> de este empleado, primero debe realizar la <span className="font-bold">BAJA</span> correspondiente.
              </p>
            </div>
            <div className="p-6 pt-4 border-t border-gray-300 bg-gray-50 flex justify-end rounded-b-lg">
              <button
                onClick={() => { setShowActiveEmployeeModal(false); setIsEditing(false); }}
                className="bg-[#3a6ea5] text-white font-bold py-2.5 px-6 rounded-lg hover:bg-[#2d5592] transition-colors"
              >
                ENTENDIDO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DETALLES/EDICIÓN */}
      {showDetailsModal && selectedEmployee && employeeDetails && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/70" style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto animate-fade-in" style={{ zIndex: 10000 }}>
            <div className="p-6 pb-4 border-b border-gray-300 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight">{isEditing ? 'EDITAR EMPLEADO' : 'DETALLES DEL EMPLEADO'}</h2>
                </div>
                <p className="text-gray-600 mt-1 text-sm">{isEditing ? 'Modifique la información del empleado seleccionado.' : `Información completa del empleado ID: ${selectedEmployee.EmployeeID}`}</p>
              </div>
              <div className="flex items-center space-x-2">
                {!isEditing && (
                  <button 
                    onClick={() => handleEditClick(selectedEmployee)} 
                    className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap"
                  >
                    EDITAR
                  </button>
                )}
                <button onClick={() => { setShowDetailsModal(false); setEmployeeDetails(null); setSelectedEmployee(null); setIsEditing(false); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {detailsLoading ? (
                <div className="py-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3a6ea5] mx-auto"></div>
                  <p className="mt-4 text-gray-600">Cargando detalles...</p>
                </div>
              ) : isEditing ? (
                <div className="space-y-6">
                  {/* Información Personal - SIEMPRE EDITABLE */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">INFORMACIÓN PERSONAL</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Nombre(s)</label><input type="text" name="firstName" value={editFormData.firstName} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Apellido Paterno</label><input type="text" name="lastName" value={editFormData.lastName} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Apellido Materno</label><input type="text" name="middleName" value={editFormData.middleName} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Fecha Nacimiento</label><input type="date" name="fechaNacimiento" value={editFormData.fechaNacimiento} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Género</label><select name="genero" value={editFormData.genero} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]}"><option value="">Seleccione</option><option value="MASCULINO">MASCULINO</option><option value="FEMENINO">FEMENINO</option></select></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Estado Civil</label><select name="estadoCivil" value={editFormData.estadoCivil} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]"><option value="">Seleccione</option><option value="SOLTERO">SOLTERO</option><option value="CASADO">CASADO</option><option value="DIVORCIADO">DIVORCIADO</option><option value="VIUDO">VIUDO</option><option value="UNION LIBRE">UNIÓN LIBRE</option></select></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Nacionalidad</label><select name="nacionalidad" value={editFormData.nacionalidad} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]"><option value="">Seleccione</option><option value="MEXICANA">MEXICANA</option><option value="EXTRANJERA">EXTRANJERA</option></select></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">RFC</label><input type="text" name="rfc" value={editFormData.rfc} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">CURP</label><input type="text" name="curp" value={editFormData.curp} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">NSS</label><input type="text" name="nss" value={editFormData.nss} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">NCI</label><input type="text" name="nci" value={editFormData.nci} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">UMF</label><input type="text" name="umf" value={editFormData.umf} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                    </div>
                  </div>

                  {/* Contacto - SIEMPRE EDITABLE */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">CONTACTO</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Teléfono</label><input type="text" name="telefono" value={editFormData.telefono} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Email</label><input type="email" name="email" value={editFormData.email} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                    </div>
                  </div>

                  {/* Dirección - SIEMPRE EDITABLE */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">DIRECCIÓN</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Calle</label><input type="text" name="calle" value={editFormData.calle} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">No. Exterior</label><input type="text" name="numeroExterior" value={editFormData.numeroExterior} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">No. Interior</label><input type="text" name="numeroInterior" value={editFormData.numeroInterior} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                      <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Colonia</label><input type="text" name="colonia" value={editFormData.colonia} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Municipio</label><input type="text" name="municipio" value={editFormData.municipio} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Estado</label><select name="estado" value={editFormData.estado} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]"><option value="">Seleccione</option><option value="AGUASCALIENTES">AGUASCALIENTES</option><option value="BAJA CALIFORNIA">BAJA CALIFORNIA</option><option value="BAJA CALIFORNIA SUR">BAJA CALIFORNIA SUR</option><option value="CAMPECHE">CAMPECHE</option><option value="CHIAPAS">CHIAPAS</option><option value="CHIHUAHUA">CHIHUAHUA</option><option value="CIUDAD DE MÉXICO">CIUDAD DE MÉXICO</option><option value="COAHUILA">COAHUILA</option><option value="COLIMA">COLIMA</option><option value="DURANGO">DURANGO</option><option value="ESTADO DE MÉXICO">ESTADO DE MÉXICO</option><option value="GUANAJUATO">GUANAJUATO</option><option value="GUERRERO">GUERRERO</option><option value="HIDALGO">HIDALGO</option><option value="JALISCO">JALISCO</option><option value="MICHOACÁN">MICHOACÁN</option><option value="MORELOS">MORELOS</option><option value="NAYARIT">NAYARIT</option><option value="NUEVO LEÓN">NUEVO LEÓN</option><option value="OAXACA">OAXACA</option><option value="PUEBLA">PUEBLA</option><option value="QUERÉTARO">QUERÉTARO</option><option value="QUINTANA ROO">QUINTANA ROO</option><option value="SAN LUIS POTOSÍ">SAN LUIS POTOSÍ</option><option value="SINALOA">SINALOA</option><option value="SONORA">SONORA</option><option value="TABASCO">TABASCO</option><option value="TAMAULIPAS">TAMAULIPAS</option><option value="TLAXCALA">TLAXCALA</option><option value="VERACRUZ">VERACRUZ</option><option value="YUCATÁN">YUCATÁN</option><option value="ZACATECAS">ZACATECAS</option></select></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Código Postal</label><input type="text" name="codigoPostal" value={editFormData.codigoPostal} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                    </div>
                  </div>

                  {/* Información Laboral - DESHABILITADA para PROJECT si Status = 1 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">INFORMACIÓN LABORAL</h3>
                    {selectedEmployee.tipo === 'PROJECT' && selectedEmployee.Status === 1 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-yellow-800 flex items-center">
                          <AlertCircle className="h-5 w-5 mr-2" />
                          La información laboral no puede ser modificada porque el empleado de proyecto está activo. 
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Puesto</label>
                        <input 
                          type="text" 
                          name="puesto" 
                          value={editFormData.puesto} 
                          onChange={handleEditFormChange} 
                          disabled={selectedEmployee.tipo === 'PROJECT' && selectedEmployee.Status === 1}
                          className={`w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5] ${(selectedEmployee.tipo === 'PROJECT' && selectedEmployee.Status === 1) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`} 
                        />
                      </div>
                      {selectedEmployee.tipo === 'BASE' && (
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Área</label>
                          <input 
                            type="text" 
                            name="area" 
                            value={editFormData.area} 
                            onChange={handleEditFormChange} 
                            disabled={selectedEmployee.Status === 1}
                            className={`w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5] ${selectedEmployee.Status === 1 ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`} 
                          />
                        </div>
                      )}
                      {selectedEmployee.tipo === 'PROJECT' && (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Proyecto</label>
                            <select 
                              name="proyectoId" 
                              value={editFormData.proyectoId} 
                              onChange={handleEditFormChange} 
                              disabled={selectedEmployee.Status === 1}
                              className={`w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5] ${selectedEmployee.Status === 1 ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
                            >
                              <option value="">Seleccione proyecto</option>
                              {proyectos.map((proyecto) => (<option key={proyecto.ProjectID} value={proyecto.ProjectID}>{proyecto.NameProject}</option>))}
                            </select>
                          </div>
                          <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Fecha Inicio (Proyecto)</label><input type="text" value={employeeDetails?.projectInfo?.startDate ? formatDate(employeeDetails.projectInfo.startDate) : 'N/A'} disabled className="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded text-gray-600" /></div>
                          <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Fecha Fin (Proyecto)</label><input type="text" value={employeeDetails?.projectInfo?.endDate ? formatDate(employeeDetails.projectInfo.endDate) : 'N/A'} disabled className="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded text-gray-600" /></div>
                        </>
                      )}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Salario</label>
                        <input 
                          type="number" 
                          name="salario" 
                          value={editFormData.salario} 
                          onChange={handleEditFormChange} 
                          step="0.01" 
                          disabled={selectedEmployee.tipo === 'PROJECT' && selectedEmployee.Status === 1}
                          className={`w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5] ${(selectedEmployee.tipo === 'PROJECT' && selectedEmployee.Status === 1) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`} 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Salario IMSS</label>
                        <input 
                          type="number" 
                          name="salaryIMSS" 
                          value={editFormData.salaryIMSS} 
                          onChange={handleEditFormChange} 
                          step="0.01" 
                          disabled={selectedEmployee.tipo === 'PROJECT' && selectedEmployee.Status === 1}
                          className={`w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5] ${(selectedEmployee.tipo === 'PROJECT' && selectedEmployee.Status === 1) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`} 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Horario</label>
                        <select 
                          name="horario" 
                          value={editFormData.horario} 
                          onChange={handleEditFormChange} 
                          disabled={selectedEmployee.tipo === 'PROJECT' && selectedEmployee.Status === 1}
                          className={`w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5] ${(selectedEmployee.tipo === 'PROJECT' && selectedEmployee.Status === 1) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
                        >
                          <option value="">Seleccione</option>
                          <option value="08:15 AM A 06:00 PM">08:15 AM A 06:00 PM</option>
                          <option value="OTRO">OTRO</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Jefe Directo</label>
                        <select 
                          name="jefeDirectoId" 
                          value={editFormData.jefeDirectoId} 
                          onChange={handleEditFormChange} 
                          disabled={loadingJefes || (selectedEmployee.tipo === 'PROJECT' && selectedEmployee.Status === 1)}
                          className={`w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5] ${(selectedEmployee.tipo === 'PROJECT' && selectedEmployee.Status === 1) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
                        >
                          <option value="">Seleccione jefe directo</option>
                          {jefesDirectos.map((jefe) => (<option key={jefe.id} value={jefe.id}>{jefe.nombreCompleto} - {jefe.puesto} ({jefe.tipoPersonal})</option>))}
                        </select>
                      </div>
                      {selectedEmployee.tipo === 'BASE' && (
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Fecha Inicio</label>
                          <input 
                            type="date" 
                            name="fechaInicio" 
                            value={editFormData.fechaInicio} 
                            onChange={handleEditFormChange} 
                            disabled={selectedEmployee.Status === 1}
                            className={`w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5] ${selectedEmployee.Status === 1 ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`} 
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* DOCUMENTACIÓN DEL EMPLEADO - SIEMPRE EDITABLE */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">DOCUMENTACIÓN DEL EMPLEADO</h3>
                    <p className="text-xs text-gray-600 mb-4">Seleccione un archivo para reemplazar el documento actual. PDF para documentos, JPG/PNG para fotografía.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div><label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Solicitud de empleo o CV</label><input type="file" ref={el => { if (el) fileInputRefs.current.cvFile = el; }} onChange={(e) => handleFileChange(e, 'cvFile')} className="hidden" accept=".pdf"/><button type="button" onClick={() => triggerFileInput('cvFile')} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:border-[#3a6ea5] hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"><Upload className="h-4 w-4 mr-2" />{uploadFiles.cvFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}</button><FileDisplay tipo="cvFile" file={uploadFiles.cvFile} /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Copia de Acta de Nacimiento</label><input type="file" ref={el => { if (el) fileInputRefs.current.actaNacimientoFile = el; }} onChange={(e) => handleFileChange(e, 'actaNacimientoFile')} className="hidden" accept=".pdf"/><button type="button" onClick={() => triggerFileInput('actaNacimientoFile')} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:border-[#3a6ea5] hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"><Upload className="h-4 w-4 mr-2" />{uploadFiles.actaNacimientoFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}</button><FileDisplay tipo="actaNacimientoFile" file={uploadFiles.actaNacimientoFile} /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Copia de CURP</label><input type="file" ref={el => { if (el) fileInputRefs.current.curpFile = el; }} onChange={(e) => handleFileChange(e, 'curpFile')} className="hidden" accept=".pdf"/><button type="button" onClick={() => triggerFileInput('curpFile')} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:border-[#3a6ea5] hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"><Upload className="h-4 w-4 mr-2" />{uploadFiles.curpFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}</button><FileDisplay tipo="curpFile" file={uploadFiles.curpFile} /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Copia de Constancia de RFC</label><input type="file" ref={el => { if (el) fileInputRefs.current.rfcFile = el; }} onChange={(e) => handleFileChange(e, 'rfcFile')} className="hidden" accept=".pdf"/><button type="button" onClick={() => triggerFileInput('rfcFile')} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:border-[#3a6ea5] hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"><Upload className="h-4 w-4 mr-2" />{uploadFiles.rfcFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}</button><FileDisplay tipo="rfcFile" file={uploadFiles.rfcFile} /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Copia de hoja de afiliación IMSS</label><input type="file" ref={el => { if (el) fileInputRefs.current.imssFile = el; }} onChange={(e) => handleFileChange(e, 'imssFile')} className="hidden" accept=".pdf"/><button type="button" onClick={() => triggerFileInput('imssFile')} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:border-[#3a6ea5] hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"><Upload className="h-4 w-4 mr-2" />{uploadFiles.imssFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}</button><FileDisplay tipo="imssFile" file={uploadFiles.imssFile} /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Copia de credencial de elector INE</label><input type="file" ref={el => { if (el) fileInputRefs.current.ineFile = el; }} onChange={(e) => handleFileChange(e, 'ineFile')} className="hidden" accept=".pdf"/><button type="button" onClick={() => triggerFileInput('ineFile')} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:border-[#3a6ea5] hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"><Upload className="h-4 w-4 mr-2" />{uploadFiles.ineFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}</button><FileDisplay tipo="ineFile" file={uploadFiles.ineFile} /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Copia de Comprobante de Domicilio</label><input type="file" ref={el => { if (el) fileInputRefs.current.comprobanteDomicilioFile = el; }} onChange={(e) => handleFileChange(e, 'comprobanteDomicilioFile')} className="hidden" accept=".pdf"/><button type="button" onClick={() => triggerFileInput('comprobanteDomicilioFile')} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:border-[#3a6ea5] hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"><Upload className="h-4 w-4 mr-2" />{uploadFiles.comprobanteDomicilioFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}</button><FileDisplay tipo="comprobanteDomicilioFile" file={uploadFiles.comprobanteDomicilioFile} /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Copia de Comprobante de Estudios</label><input type="file" ref={el => { if (el) fileInputRefs.current.comprobanteEstudiosFile = el; }} onChange={(e) => handleFileChange(e, 'comprobanteEstudiosFile')} className="hidden" accept=".pdf"/><button type="button" onClick={() => triggerFileInput('comprobanteEstudiosFile')} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:border-[#3a6ea5] hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"><Upload className="h-4 w-4 mr-2" />{uploadFiles.comprobanteEstudiosFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}</button><FileDisplay tipo="comprobanteEstudiosFile" file={uploadFiles.comprobanteEstudiosFile} /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Copia de Comprobante de Capacitación</label><input type="file" ref={el => { if (el) fileInputRefs.current.comprobanteCapacitacionFile = el; }} onChange={(e) => handleFileChange(e, 'comprobanteCapacitacionFile')} className="hidden" accept=".pdf"/><button type="button" onClick={() => triggerFileInput('comprobanteCapacitacionFile')} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:border-[#3a6ea5] hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"><Upload className="h-4 w-4 mr-2" />{uploadFiles.comprobanteCapacitacionFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}</button><FileDisplay tipo="comprobanteCapacitacionFile" file={uploadFiles.comprobanteCapacitacionFile} /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Copia de Licencia de Manejo</label><input type="file" ref={el => { if (el) fileInputRefs.current.licenciaManejoFile = el; }} onChange={(e) => handleFileChange(e, 'licenciaManejoFile')} className="hidden" accept=".pdf"/><button type="button" onClick={() => triggerFileInput('licenciaManejoFile')} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:border-[#3a6ea5] hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"><Upload className="h-4 w-4 mr-2" />{uploadFiles.licenciaManejoFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}</button><FileDisplay tipo="licenciaManejoFile" file={uploadFiles.licenciaManejoFile} /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Carta de Antecedentes No Penales</label><input type="file" ref={el => { if (el) fileInputRefs.current.cartaAntecedentesFile = el; }} onChange={(e) => handleFileChange(e, 'cartaAntecedentesFile')} className="hidden" accept=".pdf"/><button type="button" onClick={() => triggerFileInput('cartaAntecedentesFile')} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:border-[#3a6ea5] hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"><Upload className="h-4 w-4 mr-2" />{uploadFiles.cartaAntecedentesFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}</button><FileDisplay tipo="cartaAntecedentesFile" file={uploadFiles.cartaAntecedentesFile} /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Copia de Carta de Recomendación</label><input type="file" ref={el => { if (el) fileInputRefs.current.cartaRecomendacionFile = el; }} onChange={(e) => handleFileChange(e, 'cartaRecomendacionFile')} className="hidden" accept=".pdf"/><button type="button" onClick={() => triggerFileInput('cartaRecomendacionFile')} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:border-[#3a6ea5] hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"><Upload className="h-4 w-4 mr-2" />{uploadFiles.cartaRecomendacionFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}</button><FileDisplay tipo="cartaRecomendacionFile" file={uploadFiles.cartaRecomendacionFile} /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Copia de Hoja de Retención Infonavit</label><input type="file" ref={el => { if (el) fileInputRefs.current.retencionInfonavitFile = el; }} onChange={(e) => handleFileChange(e, 'retencionInfonavitFile')} className="hidden" accept=".pdf"/><button type="button" onClick={() => triggerFileInput('retencionInfonavitFile')} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:border-[#3a6ea5] hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"><Upload className="h-4 w-4 mr-2" />{uploadFiles.retencionInfonavitFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}</button><FileDisplay tipo="retencionInfonavitFile" file={uploadFiles.retencionInfonavitFile} /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Copia de Examen Médico</label><input type="file" ref={el => { if (el) fileInputRefs.current.examenMedicoFile = el; }} onChange={(e) => handleFileChange(e, 'examenMedicoFile')} className="hidden" accept=".pdf"/><button type="button" onClick={() => triggerFileInput('examenMedicoFile')} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:border-[#3a6ea5] hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"><Upload className="h-4 w-4 mr-2" />{uploadFiles.examenMedicoFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}</button><FileDisplay tipo="examenMedicoFile" file={uploadFiles.examenMedicoFile} /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Fotografía</label><input type="file" ref={el => { if (el) fileInputRefs.current.fotoFile = el; }} onChange={(e) => handleFileChange(e, 'fotoFile')} className="hidden" accept=".jpg,.jpeg,.png"/><button type="button" onClick={() => triggerFileInput('fotoFile')} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:border-[#3a6ea5] hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"><Upload className="h-4 w-4 mr-2" />{uploadFiles.fotoFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}</button><FileDisplay tipo="fotoFile" file={uploadFiles.fotoFile} /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Folletos de Inducción</label><input type="file" ref={el => { if (el) fileInputRefs.current.folletoFile = el; }} onChange={(e) => handleFileChange(e, 'folletoFile')} className="hidden" accept=".pdf"/><button type="button" onClick={() => triggerFileInput('folletoFile')} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:border-[#3a6ea5] hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"><Upload className="h-4 w-4 mr-2" />{uploadFiles.folletoFile ? 'Cambiar archivo' : 'Seleccionar Archivo'}</button><FileDisplay tipo="folletoFile" file={uploadFiles.folletoFile} /></div>
                    </div>
                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="mt-6"><div className="flex justify-between text-sm text-gray-600 mb-1"><span>Subiendo documentos...</span><span>{uploadProgress}%</span></div><div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-[#3a6ea5] h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div></div></div>
                    )}
                  </div>

                  {/* Beneficiario - SIEMPRE EDITABLE */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">BENEFICIARIO</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Nombre(s)</label><input type="text" name="beneficiaryFirstName" value={editFormData.beneficiaryFirstName} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Apellido Paterno</label><input type="text" name="beneficiaryLastName" value={editFormData.beneficiaryLastName} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Apellido Materno</label><input type="text" name="beneficiaryMiddleName" value={editFormData.beneficiaryMiddleName} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Parentesco</label><select name="beneficiaryRelationship" value={editFormData.beneficiaryRelationship} onChange={handleEditFormChange} className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]"><option value="">Seleccione</option><option value="CÓNYUGE">CÓNYUGE</option><option value="HIJO(A)">HIJO(A)</option><option value="PADRE">PADRE</option><option value="MADRE">MADRE</option><option value="HERMANO(A)">HERMANO(A)</option><option value="OTRO">OTRO</option></select></div>
                      <div><label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Porcentaje (%)</label><input type="number" name="beneficiaryPercentage" value={editFormData.beneficiaryPercentage} onChange={handleEditFormChange} min="0" max="100" step="1" className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]" /></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">INFORMACIÓN PERSONAL</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">Nombre completo</span><span className="text-sm text-gray-900">{employeeDetails.personalInfo?.nombreCompleto || `${selectedEmployee.FirstName} ${selectedEmployee.LastName} ${selectedEmployee.MiddleName || ''}`}</span></div>
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">Fecha de Nacimiento</span><span className="text-sm text-gray-900">{formatDate(employeeDetails.personalInfo?.fechaNacimiento)}</span></div>
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">Género</span><span className="text-sm text-gray-900">{employeeDetails.personalInfo?.genero || 'N/A'}</span></div>
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">Estado Civil</span><span className="text-sm text-gray-900">{employeeDetails.personalInfo?.estadoCivil || 'N/A'}</span></div>
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">Nacionalidad</span><span className="text-sm text-gray-900">{employeeDetails.personalInfo?.nacionalidad || 'N/A'}</span></div>
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">RFC</span><span className="text-sm text-gray-900">{selectedEmployee.RFC || 'N/A'}</span></div>
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">CURP</span><span className="text-sm text-gray-900">{selectedEmployee.CURP || 'N/A'}</span></div>
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">NSS</span><span className="text-sm text-gray-900">{selectedEmployee.NSS || 'N/A'}</span></div>
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">NCI</span><span className="text-sm text-gray-900">{employeeDetails.personalInfo?.nci || 'N/A'}</span></div>
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">UMF</span><span className="text-sm text-gray-900">{employeeDetails.personalInfo?.umf || 'N/A'}</span></div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">CONTACTO</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><span className="block text-xs font-bold text-gray-500 uppercase">Teléfono</span><span className="text-sm text-gray-900">{selectedEmployee.Phone || 'N/A'}</span></div><div><span className="block text-xs font-bold text-gray-500 uppercase">Email</span><span className="text-sm text-gray-900">{selectedEmployee.Email || 'N/A'}</span></div></div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">DIRECCIÓN</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">Calle</span><span className="text-sm text-gray-900">{employeeDetails.personalInfo?.calle || 'N/A'}</span></div>
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">Número Exterior</span><span className="text-sm text-gray-900">{employeeDetails.personalInfo?.numeroExterior || 'N/A'}</span></div>
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">Número Interior</span><span className="text-sm text-gray-900">{employeeDetails.personalInfo?.numeroInterior || 'N/A'}</span></div>
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">Colonia</span><span className="text-sm text-gray-900">{employeeDetails.personalInfo?.colonia || 'N/A'}</span></div>
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">Municipio</span><span className="text-sm text-gray-900">{employeeDetails.personalInfo?.municipio || 'N/A'}</span></div>
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">Estado</span><span className="text-sm text-gray-900">{employeeDetails.personalInfo?.estado || 'N/A'}</span></div>
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">Código Postal</span><span className="text-sm text-gray-900">{employeeDetails.personalInfo?.codigoPostal || 'N/A'}</span></div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">INFORMACIÓN LABORAL</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">Puesto</span><span className="text-sm text-gray-900">{selectedEmployee.Position || 'N/A'}</span></div>
                      {selectedEmployee.tipo === 'BASE' ? <div><span className="block text-xs font-bold text-gray-500 uppercase">Área</span><span className="text-sm text-gray-900">{(selectedEmployee as BaseEmployee).Area || 'N/A'}</span></div> : <div><span className="block text-xs font-bold text-gray-500 uppercase">Proyecto</span><span className="text-sm text-gray-900">{(selectedEmployee as ProjectEmployee).ProjectName || 'N/A'}</span></div>}
                      {selectedEmployee.tipo === 'PROJECT' && (
                        <>
                          <div><span className="block text-xs font-bold text-gray-500 uppercase">Fecha Inicio Proyecto</span><span className="text-sm text-gray-900">{formatDate(employeeDetails?.projectInfo?.startDate)}</span></div>
                          <div><span className="block text-xs font-bold text-gray-500 uppercase">Fecha Fin Proyecto</span><span className="text-sm text-gray-900">{formatDate(employeeDetails?.projectInfo?.endDate)}</span></div>
                        </>
                      )}
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">Salario</span><span className="text-sm text-gray-900">{formatCurrency(selectedEmployee.Salary)}</span></div>
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">Salario IMSS</span><span className="text-sm text-gray-900">{employeeDetails.contractInfo?.salaryIMSS ? formatCurrency(employeeDetails.contractInfo.salaryIMSS) : 'N/A'}</span></div>
                      <div><span className="block text-xs font-bold text-gray-500 uppercase">Horario</span><span className="text-sm text-gray-900">{employeeDetails.contractInfo?.workSchedule || selectedEmployee.WorkSchedule || 'N/A'}</span></div>
                      {selectedEmployee.tipo === 'BASE' && <div><span className="block text-xs font-bold text-gray-500 uppercase">Fecha Inicio</span><span className="text-sm text-gray-900">{formatDate(employeeDetails.contractInfo?.fechaInicio)}</span></div>}
                    </div>
                  </div>
                  
                  {/* SECCIÓN DE FORMATOS FT-RH */}
                  {employeeDetails.contractInfo && (employeeDetails.contractInfo.contractFileURL || employeeDetails.contractInfo.warningFileURL || employeeDetails.contractInfo.letterFileURL || employeeDetails.contractInfo.agreementFileURL) && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">FORMATOS FT-RH</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {employeeDetails.contractInfo.contractFileURL && (
                          <div className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                            <div className="flex items-center">
                              <File className="h-5 w-5 text-gray-500 mr-2" />
                              <span className="text-sm font-medium text-gray-700">FT-RH-02 (Contrato por Tiempo Determinado)</span>
                            </div>
                            <button onClick={() => openPdfInNewTab(employeeDetails.contractInfo!.contractFileURL!)} className="px-3 py-1 bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 transition-colors text-xs font-medium">Abrir</button>
                          </div>
                        )}
                        {employeeDetails.contractInfo.warningFileURL && (
                          <div className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                            <div className="flex items-center">
                              <File className="h-5 w-5 text-gray-500 mr-2" />
                              <span className="text-sm font-medium text-gray-700">FT-RH-04 (Aviso de Contratación)</span>
                            </div>
                            <button onClick={() => openPdfInNewTab(employeeDetails.contractInfo!.warningFileURL!)} className="px-3 py-1 bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 transition-colors text-xs font-medium">Abrir</button>
                          </div>
                        )}
                        {employeeDetails.contractInfo.letterFileURL && (
                          <div className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                            <div className="flex items-center">
                              <File className="h-5 w-5 text-gray-500 mr-2" />
                              <span className="text-sm font-medium text-gray-700">FT-RH-07 (Carta Compromiso)</span>
                            </div>
                            <button onClick={() => openPdfInNewTab(employeeDetails.contractInfo!.letterFileURL!)} className="px-3 py-1 bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 transition-colors text-xs font-medium">Abrir</button>
                          </div>
                        )}
                        {employeeDetails.contractInfo.agreementFileURL && (
                          <div className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                            <div className="flex items-center">
                              <File className="h-5 w-5 text-gray-500 mr-2" />
                              <span className="text-sm font-medium text-gray-700">FT-RH-29 (Convenio de Confidencialidad)</span>
                            </div>
                            <button onClick={() => openPdfInNewTab(employeeDetails.contractInfo!.agreementFileURL!)} className="px-3 py-1 bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 transition-colors text-xs font-medium">Abrir</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {employeeDetails.beneficiario && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">BENEFICIARIO</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div><span className="block text-xs font-bold text-gray-500 uppercase">Nombre completo</span><span className="text-sm text-gray-900">{employeeDetails.beneficiario.nombreCompleto}</span></div>
                        <div><span className="block text-xs font-bold text-gray-500 uppercase">Parentesco</span><span className="text-sm text-gray-900">{employeeDetails.beneficiario.parentesco}</span></div>
                        <div><span className="block text-xs font-bold text-gray-500 uppercase">Porcentaje</span><span className="text-sm text-gray-900">{employeeDetails.beneficiario.porcentaje}%</span></div>
                      </div>
                    </div>
                  )}
                  {employeeDetails.documentacion && Object.keys(employeeDetails.documentacion).filter(k => employeeDetails.documentacion?.[k]).length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">DOCUMENTACIÓN DEL EMPLEADO</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {Object.entries(employeeDetails.documentacion).map(([key, value]) => {
                          if (!value) return null;
                          return <div key={key} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"><span className="text-xs font-medium text-gray-700">{getDocumentName(key)}:</span><a href={value} target="_blank" rel="noopener noreferrer" className="flex items-center text-xs text-gray-700 hover:underline">Ver</a></div>;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 pt-4 border-t border-gray-300 bg-gray-50 flex justify-end gap-3">
              {isEditing ? (
                <>
                  <button onClick={() => { setIsEditing(false); setUploadProgress(0); setError(''); }} disabled={savingEdit} className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50">CANCELAR</button>
                  <button onClick={handleSaveChanges} disabled={savingEdit} className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors disabled:opacity-50">
                    {savingEdit ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>{uploadProgress > 0 && uploadProgress < 100 ? `SUBIDO ${uploadProgress}%` : 'GUARDANDO...'}</>) : 'ACTUALIZAR'}
                  </button>
                </>
              ) : (
                <button onClick={() => { setShowDetailsModal(false); setEmployeeDetails(null); setSelectedEmployee(null); }} className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors">CERRAR</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ACTUALIZACIÓN CON FORMATOS */}
      {showUpdateSuccessModal && updateSuccessDetails && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70" style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full h-[90vh] flex flex-col animate-fade-in" style={{ zIndex: 10000 }}>
            <div className="p-6 pb-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  ¡ACTUALIZACIÓN EXITOSA!
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  El empleado ha sido actualizado correctamente en el sistema.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowUpdateSuccessModal(false);
                  setUpdateSuccessDetails(null);
                  setUpdateFormatoActivo('FT-RH-02');
                }}
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
                    <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">DETALLES DE LA ACTUALIZACIÓN</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">ID EMPLEADO:</span>
                        <span className="text-gray-600 mt-1 text-sm">{updateSuccessDetails.empleadoId}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">NOMBRE:</span>
                        <span className="text-gray-600 mt-1 text-sm">{updateSuccessDetails.nombre}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">PUESTO:</span>
                        <span className="text-gray-600 mt-1 text-sm">{updateSuccessDetails.puesto}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">TIPO:</span>
                        <span className="text-gray-600 mt-1 text-sm">{updateSuccessDetails.tipoPersonal}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">FECHA DE ACTUALIZACIÓN:</span>
                        <span className="text-gray-600 mt-1 text-sm">{updateSuccessDetails.fechaRegistro}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">DOCUMENTOS GENERADOS</h3>
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => {
                          if (updateFormatoActivo === 'FT-RH-02') setUpdateFormatoActivo('FT-RH-04');
                          else if (updateFormatoActivo === 'FT-RH-04') setUpdateFormatoActivo('FT-RH-07');
                          else if (updateFormatoActivo === 'FT-RH-07') setUpdateFormatoActivo('FT-RH-29');
                          else if (updateFormatoActivo === 'FT-RH-29') setUpdateFormatoActivo('FT-RH-02');
                        }}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        title="Formato anterior"
                      >
                        <ChevronLeft className="h-4 w-4 text-gray-700" />
                      </button>
                      <span className="font-bold text-gray-800 text-sm">
                        {updateFormatoActivo === 'FT-RH-02' ? 'FORMATO FT-RH-02' : 
                         updateFormatoActivo === 'FT-RH-04' ? 'FORMATO FT-RH-04' : 
                         updateFormatoActivo === 'FT-RH-07' ? 'FORMATO FT-RH-07' : 
                         'FORMATO FT-RH-29'}
                      </span>
                      <button
                        onClick={() => {
                          if (updateFormatoActivo === 'FT-RH-02') setUpdateFormatoActivo('FT-RH-04');
                          else if (updateFormatoActivo === 'FT-RH-04') setUpdateFormatoActivo('FT-RH-07');
                          else if (updateFormatoActivo === 'FT-RH-07') setUpdateFormatoActivo('FT-RH-29');
                          else if (updateFormatoActivo === 'FT-RH-29') setUpdateFormatoActivo('FT-RH-02');
                        }}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        title="Siguiente formato"
                      >
                        <ChevronRight className="h-4 w-4 text-gray-700" />
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {updateFormatoActivo === 'FT-RH-02' && (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <FileText className="h-5 w-5 text-gray-600 mr-2" />
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-02 (PDF)</span>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={updateSuccessDetails.ftRh02PdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                title="Vista previa"
                              >
                                <Eye className="h-4 w-4 text-gray-700" />
                              </a>
                              <button
                                onClick={() => window.open(updateSuccessDetails.ftRh02PdfDownloadUrl, '_blank')}
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                title="Descargar PDF"
                              >
                                <Download className="h-4 w-4 text-gray-700" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <FileText className="h-5 w-5 text-gray-600 mr-2" />
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-02 (EDITABLE)</span>
                            </div>
                            <a
                              href={updateSuccessDetails.ftRh02WordUrl}
                              download={`FT-RH-02_${updateSuccessDetails.empleadoId}.docx`}
                              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                              <Download className="h-4 w-4 text-gray-700" />
                            </a>
                          </div>
                        </>
                      )}
                      
                      {updateFormatoActivo === 'FT-RH-04' && (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <FileText className="h-5 w-5 text-gray-600 mr-2" />
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-04 (PDF)</span>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={updateSuccessDetails.ftRh04PdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                title="Vista previa"
                              >
                                <Eye className="h-4 w-4 text-gray-700" />
                              </a>
                              <button
                                onClick={() => window.open(updateSuccessDetails.ftRh04PdfDownloadUrl, '_blank')}
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                title="Descargar PDF"
                              >
                                <Download className="h-4 w-4 text-gray-700" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <FileText className="h-5 w-5 text-gray-600 mr-2" />
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-04 (EDITABLE)</span>
                            </div>
                            <a
                              href={updateSuccessDetails.ftRh04ExcelUrl}
                              download={`FT-RH-04_${updateSuccessDetails.empleadoId}.xlsx`}
                              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                              <Download className="h-4 w-4 text-gray-700" />
                            </a>
                          </div>
                        </>
                      )}
                      
                      {updateFormatoActivo === 'FT-RH-07' && (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <FileText className="h-5 w-5 text-gray-600 mr-2" />
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-07 (PDF)</span>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={updateSuccessDetails.ftRh07PdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                title="Vista previa"
                              >
                                <Eye className="h-4 w-4 text-gray-700" />
                              </a>
                              <button
                                onClick={() => window.open(updateSuccessDetails.ftRh07PdfDownloadUrl, '_blank')}
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                title="Descargar PDF"
                              >
                                <Download className="h-4 w-4 text-gray-700" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <FileText className="h-5 w-5 text-gray-600 mr-2" />
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-07 (EDITABLE)</span>
                            </div>
                            <a
                              href={updateSuccessDetails.ftRh07WordUrl}
                              download={`FT-RH-07_${updateSuccessDetails.empleadoId}.docx`}
                              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                              <Download className="h-4 w-4 text-gray-700" />
                            </a>
                          </div>
                        </>
                      )}
                      
                      {updateFormatoActivo === 'FT-RH-29' && (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <FileText className="h-5 w-5 text-gray-600 mr-2" />
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-29 (PDF)</span>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={updateSuccessDetails.ftRh29PdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                title="Vista previa"
                              >
                                <Eye className="h-4 w-4 text-gray-700" />
                              </a>
                              <button
                                onClick={() => window.open(updateSuccessDetails.ftRh29PdfDownloadUrl, '_blank')}
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                title="Descargar PDF"
                              >
                                <Download className="h-4 w-4 text-gray-700" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <FileText className="h-5 w-5 text-gray-600 mr-2" />
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-29 (EDITABLE)</span>
                            </div>
                            <a
                              href={updateSuccessDetails.ftRh29WordUrl}
                              download={`FT-RH-29_${updateSuccessDetails.empleadoId}.docx`}
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
                      updateFormatoActivo === 'FT-RH-02' ? 'FORMATO FT-RH-02' : 
                      updateFormatoActivo === 'FT-RH-04' ? 'FORMATO FT-RH-04' : 
                      updateFormatoActivo === 'FT-RH-07' ? 'FORMATO FT-RH-07' : 
                      'FORMATO FT-RH-29'
                    }
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      {updateFormatoActivo === 'FT-RH-02' ? '1 de 4' : 
                       updateFormatoActivo === 'FT-RH-04' ? '2 de 4' : 
                       updateFormatoActivo === 'FT-RH-07' ? '3 de 4' : 
                       '4 de 4'}
                    </span>
                  </div>
                </div>
                
                <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden relative bg-gray-50">
                  <iframe
                    src={
                      updateFormatoActivo === 'FT-RH-02' ? updateSuccessDetails.ftRh02PdfUrl :
                      updateFormatoActivo === 'FT-RH-04' ? updateSuccessDetails.ftRh04PdfUrl : 
                      updateFormatoActivo === 'FT-RH-07' ? updateSuccessDetails.ftRh07PdfUrl : 
                      updateSuccessDetails.ftRh29PdfUrl
                    }
                    className="w-full h-full border-0"
                    title={`Vista previa del ${updateFormatoActivo}`}
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 pt-4 border-t border-gray-300 bg-gray-50 flex justify-end">
              <button
                onClick={() => {
                  setShowUpdateSuccessModal(false);
                  setUpdateSuccessDetails(null);
                  setUpdateFormatoActivo('FT-RH-02');
                }}
                className="bg-[#3a6ea5] text-white font-bold py-2.5 px-6 rounded-lg hover:bg-[#2d5592] transition-colors"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        .animate-spin { animation: spin 1s linear infinite; }
        body { padding-top: 0; padding-bottom: 0; margin: 0; overflow-x: hidden; }
        header, footer { z-index: 50 !important; }
        body.modal-open { overflow: hidden; }
        textarea { resize: none; }
      `}</style>
    </div>
  );
}
'use client';
import AppHeader from '@/components/header/2/2.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/2';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { useState, ChangeEvent, FormEvent, useRef, useEffect } from 'react';
import { User, Calendar, CheckCircle, X, Upload, File, XCircle, Download, Eye, FileText, ChevronLeft, ChevronRight, Archive } from 'lucide-react';
import { useUploadThing } from '@/lib/uploadthing';
import JSZip from 'jszip';

// Definir el tipo para el formulario base
type FormDataBase = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nss: string;
  curp: string;
  rfc: string;
  fechaNacimiento: string;
  genero: string;
  nacionalidad: string;
  estadoCivil: string;
  telefono: string;
  email: string;
  puesto: string;
  departamento: string;
  salario: string;
  horarioLaboral: string;
  tipoContrato: string;
  fechaInicioContrato: string;
  fechaFinContrato: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  colonia: string;
  municipio: string;
  estado: string;
  codigoPostal: string;
  nci: string;
  umf: string;
  salaryIMSS: string;
  proyectoId: string;
};

// Tipo para formulario de proyecto
type FormDataProyecto = FormDataBase & {
  proyectoId: string;
};

// Tipo para formulario base
type FormDataPersonalBase = Omit<FormDataBase, 'fechaFinContrato' | 'proyectoId'>;

// Tipo para beneficiario
type Beneficiario = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  parentesco: string;
  porcentaje: string;
};

// Tipo para pestaña activa
type TabType = 'proyecto' | 'base';

// Tipo para documentos
type Documentos = {
  cv: File[];
  actaNacimiento: File[];
  curp: File[];
  rfc: File[];
  imss: File[];
  ine: File[];
  comprobanteDomicilio: File[];
  comprobanteEstudios: File[];
  comprobanteCapacitacion: File[];
  licenciaManejo: File[];
  cartaAntecedentes: File[];
  cartaRecomendacion: File[];
  retencionInfonavit: File[];
  examenMedico: File[];
  foto: File[];
  folleto: File[];
};

// Tipo para proyectos
type Proyecto = {
  ProjectID: number;
  NameProject: string;
};

// Tipo para los detalles del éxito
type SuccessDetails = {
  empleadoId: string;
  nombre: string;
  puesto: string;
  tipoPersonal: string;
  fechaRegistro: string;
  ftRh02PdfUrl?: string;
  ftRh02PdfDownloadUrl?: string;
  ftRh04PdfUrl?: string;
  ftRh04PdfDownloadUrl?: string;
  ftRh07PdfUrl?: string;
  ftRh07PdfDownloadUrl?: string;
  ftRh29PdfUrl?: string;
  ftRh29PdfDownloadUrl?: string;
  ftRh02WordUrl?: string;
  ftRh04ExcelUrl?: string;
  ftRh07WordUrl?: string;
  ftRh29WordUrl?: string;
};

// Tipo para formato activo en el modal
type FormatoActivo = 'FT-RH-02' | 'FT-RH-04' | 'FT-RH-07' | 'FT-RH-29';

// Mapa de nombres de campos para mensajes de error
const fieldNames: Record<string, string> = {
  nombre: 'Nombre',
  apellidoPaterno: 'Apellido Paterno',
  nss: 'NSS',
  curp: 'CURP',
  rfc: 'RFC',
  fechaNacimiento: 'Fecha de Nacimiento',
  telefono: 'Teléfono',
  email: 'Email',
  puesto: 'Puesto',
  salario: 'Salario',
  calle: 'Calle',
  numeroExterior: 'Número Exterior',
  colonia: 'Colonia',
  municipio: 'Municipio',
  estado: 'Estado',
  codigoPostal: 'Código Postal'
};

// Mapa de nombres de documentos
const documentoNombres: Record<keyof Documentos, string> = {
  cv: 'Solicitud de empleo o CV',
  actaNacimiento: 'Copia de Acta de Nacimiento',
  curp: 'Copia de CURP',
  rfc: 'Copia de Constancia de RFC',
  imss: 'Copia de Hoja de Afiliación IMSS',
  ine: 'Copia de Credencial de Elector INE',
  comprobanteDomicilio: 'Copia de Comprobante de Domicilio',
  comprobanteEstudios: 'Copia de Comprobante de Estudios',
  comprobanteCapacitacion: 'Copia de Comprobante de Capacitación',
  licenciaManejo: 'Copia de Licencia de Manejo',
  cartaAntecedentes: 'Carta de Antecedentes No Penales',
  cartaRecomendacion: 'Copias de Cartas de Recomendación',
  retencionInfonavit: 'Copia de Hoja de Retención Infonavit',
  examenMedico: 'Copia de Examen Médico',
  foto: 'Fotografía (JPG/PNG)',
  folleto: 'Folletos de Inducción'
};

export default function SystemAdminDashboard() {
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();

  // Estado para la pestaña activa
  const [activeTab, setActiveTab] = useState<TabType>('proyecto');

  // Estados para el formulario de proyecto
  const [formDataProyecto, setFormDataProyecto] = useState<FormDataProyecto>({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    nss: '',
    curp: '',
    rfc: '',
    fechaNacimiento: '',
    genero: '',
    nacionalidad: '',
    estadoCivil: '',
    telefono: '',
    email: '',
    puesto: '',
    departamento: '',
    salario: '',
    horarioLaboral: '',
    tipoContrato: '',
    fechaInicioContrato: '',
    fechaFinContrato: '',
    calle: '',
    numeroExterior: '',
    numeroInterior: '',
    colonia: '',
    municipio: '',
    estado: '',
    codigoPostal: '',
    nci: '',
    umf: '',
    salaryIMSS: '',
    proyectoId: ''
  });

  // Estados para el formulario de personal base
  const [formDataBase, setFormDataBase] = useState<FormDataPersonalBase>({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    nss: '',
    curp: '',
    rfc: '',
    fechaNacimiento: '',
    genero: '',
    nacionalidad: '',
    estadoCivil: '',
    telefono: '',
    email: '',
    puesto: '',
    departamento: '',
    salario: '',
    horarioLaboral: '',
    tipoContrato: '',
    fechaInicioContrato: '',
    calle: '',
    numeroExterior: '',
    numeroInterior: '',
    colonia: '',
    municipio: '',
    estado: '',
    codigoPostal: '',
    nci: '',
    umf: '',
    salaryIMSS: ''
  });

  // Estados para beneficiarios
  const [beneficiarioProyecto, setBeneficiarioProyecto] = useState<Beneficiario>({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    parentesco: '',
    porcentaje: ''
  });

  const [beneficiarioBase, setBeneficiarioBase] = useState<Beneficiario>({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    parentesco: '',
    porcentaje: ''
  });

  // Estados para documentos (compartidos entre ambas pestañas)
  const [documentos, setDocumentos] = useState<Documentos>({
    cv: [],
    actaNacimiento: [],
    curp: [],
    rfc: [],
    imss: [],
    ine: [],
    comprobanteDomicilio: [],
    comprobanteEstudios: [],
    comprobanteCapacitacion: [],
    licenciaManejo: [],
    cartaAntecedentes: [],
    cartaRecomendacion: [],
    retencionInfonavit: [],
    examenMedico: [],
    foto: [],
    folleto: []
  });

  // Estado para proyectos
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [successDetails, setSuccessDetails] = useState<SuccessDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [formatoActivo, setFormatoActivo] = useState<FormatoActivo>('FT-RH-02');

  // UploadThing
  const { startUpload } = useUploadThing('hiringFiles', {
    onClientUploadComplete: () => {
      console.log("Documentos subidos exitosamente");
      setUploadProgress(100);
    },
    onUploadError: (error) => {
      console.error("Error al subir documentos:", error);
      setErrorMessage('Error al subir documentos. Por favor, intente nuevamente.');
      setUploadProgress(0);
    },
  });

  // Referencias para inputs de archivo
  const fileInputRefs = useRef<{ [key in keyof Documentos]?: HTMLInputElement }>({});

  // Cargar proyectos al montar el componente
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await fetch('/api/projects');
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

  // Función para obtener URLs de archivos desde la BD
  const getDocumentUrls = async (employeeId: string): Promise<{
    contractFileURL?: string;
    warningFileURL?: string;
    letterFileURL?: string;
    agreementFileURL?: string;
  }> => {
    try {
      const response = await fetch(`/api/empleados/document-urls/${employeeId}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        return {
          contractFileURL: data.contractFileURL,
          warningFileURL: data.warningFileURL,
          letterFileURL: data.letterFileURL,
          agreementFileURL: data.agreementFileURL
        };
      }
      return {};
    } catch (error) {
      console.error('Error al obtener URLs de documentos:', error);
      return {};
    }
  };

  // Función para forzar la descarga de archivos
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
      setErrorMessage('Error al descargar el archivo. Intente nuevamente.');
      setDownloading(false);
    }
  };

  // Función para descargar todos los PDFs en un ZIP
  const handleDownloadAllPDFs = async () => {
    if (!successDetails) return;
    
    try {
      setDownloadingZip(true);
      
      const zip = new JSZip();
      
      // Descargar FT-RH-02 PDF
      if (successDetails.ftRh02PdfDownloadUrl) {
        const response = await fetch(successDetails.ftRh02PdfDownloadUrl);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(`FT-RH-02_${successDetails.empleadoId}.pdf`, blob);
        }
      }
      
      // Descargar FT-RH-04 PDF
      if (successDetails.ftRh04PdfDownloadUrl) {
        const response = await fetch(successDetails.ftRh04PdfDownloadUrl);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(`FT-RH-04_${successDetails.empleadoId}.pdf`, blob);
        }
      }
      
      // Descargar FT-RH-07 PDF
      if (successDetails.ftRh07PdfDownloadUrl) {
        const response = await fetch(successDetails.ftRh07PdfDownloadUrl);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(`FT-RH-07_${successDetails.empleadoId}.pdf`, blob);
        }
      }
      
      // Descargar FT-RH-29 PDF
      if (successDetails.ftRh29PdfDownloadUrl) {
        const response = await fetch(successDetails.ftRh29PdfDownloadUrl);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(`FT-RH-29_${successDetails.empleadoId}.pdf`, blob);
        }
      }
      
      // Generar el archivo ZIP
      const content = await zip.generateAsync({ type: "blob" });
      const downloadUrl = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `documentos_${successDetails.empleadoId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      
      setDownloadingZip(false);
    } catch (error) {
      console.error('Error al crear ZIP:', error);
      setErrorMessage('Error al crear archivo ZIP. Intente nuevamente.');
      setDownloadingZip(false);
    }
  };

  // Función para descargar todos los editables en un ZIP
  const handleDownloadAllEditables = async () => {
    if (!successDetails) return;
    
    try {
      setDownloadingZip(true);
      
      const zip = new JSZip();
      
      // Descargar FT-RH-02 Word
      if (successDetails.ftRh02WordUrl) {
        const response = await fetch(successDetails.ftRh02WordUrl);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(`FT-RH-02_${successDetails.empleadoId}.docx`, blob);
        }
      }
      
      // Descargar FT-RH-04 Excel
      if (successDetails.ftRh04ExcelUrl) {
        const response = await fetch(successDetails.ftRh04ExcelUrl);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(`FT-RH-04_${successDetails.empleadoId}.xlsx`, blob);
        }
      }
      
      // Descargar FT-RH-07 Word
      if (successDetails.ftRh07WordUrl) {
        const response = await fetch(successDetails.ftRh07WordUrl);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(`FT-RH-07_${successDetails.empleadoId}.docx`, blob);
        }
      }
      
      // Descargar FT-RH-29 Word
      if (successDetails.ftRh29WordUrl) {
        const response = await fetch(successDetails.ftRh29WordUrl);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(`FT-RH-29_${successDetails.empleadoId}.docx`, blob);
        }
      }
      
      // Generar el archivo ZIP
      const content = await zip.generateAsync({ type: "blob" });
      const downloadUrl = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `editables_${successDetails.empleadoId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      
      setDownloadingZip(false);
    } catch (error) {
      console.error('Error al crear ZIP de editables:', error);
      setErrorMessage('Error al crear archivo ZIP. Intente nuevamente.');
      setDownloadingZip(false);
    }
  };

  // Función para generar URLs de descarga
  const generateDownloadUrls = async (
    empleadoId: string, 
    contractFileURL?: string,
    warningFileURL?: string, 
    letterFileURL?: string,
    agreementFileURL?: string
  ): Promise<{
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
  }> => {
    // URLs para FT-RH-02 (Contract)
    const ftRh02PdfUrl = contractFileURL || `/api/download/pdf/FT-RH-02?empleadoId=${empleadoId}&preview=1`;
    const ftRh02PdfDownloadUrl = contractFileURL || `/api/download/pdf/FT-RH-02?empleadoId=${empleadoId}`;
    
    // URLs para FT-RH-04 (Warning)
    const ftRh04PdfUrl = warningFileURL || `/api/download/pdf/FT-RH-04?empleadoId=${empleadoId}&preview=1`;
    const ftRh04PdfDownloadUrl = warningFileURL || `/api/download/pdf/FT-RH-04?empleadoId=${empleadoId}`;
    
    // URLs para FT-RH-07 (Letter)
    const ftRh07PdfUrl = letterFileURL || `/api/download/pdf/FT-RH-07?empleadoId=${empleadoId}&preview=1`;
    const ftRh07PdfDownloadUrl = letterFileURL || `/api/download/pdf/FT-RH-07?empleadoId=${empleadoId}`;
    
    // URLs para FT-RH-29 (Agreement)
    const ftRh29PdfUrl = agreementFileURL || `/api/download/pdf/FT-RH-29?empleadoId=${empleadoId}&preview=1`;
    const ftRh29PdfDownloadUrl = agreementFileURL || `/api/download/pdf/FT-RH-29?empleadoId=${empleadoId}`;
    
    return {
      ftRh02PdfUrl,
      ftRh02PdfDownloadUrl,
      ftRh04PdfUrl,
      ftRh04PdfDownloadUrl,
      ftRh07PdfUrl,
      ftRh07PdfDownloadUrl,
      ftRh29PdfUrl,
      ftRh29PdfDownloadUrl,
      ftRh02WordUrl: `/api/download/edit/FT-RH-02?empleadoId=${empleadoId}`,
      ftRh04ExcelUrl: `/api/download/edit/FT-RH-04?empleadoId=${empleadoId}`,
      ftRh07WordUrl: `/api/download/edit/FT-RH-07?empleadoId=${empleadoId}`,
      ftRh29WordUrl: `/api/download/edit/FT-RH-29?empleadoId=${empleadoId}`
    };
  };

  // Obtener el formulario activo según la pestaña
  const getActiveFormData = () => {
    return activeTab === 'proyecto' ? formDataProyecto : formDataBase;
  };

  const getActiveBeneficiario = () => {
    return activeTab === 'proyecto' ? beneficiarioProyecto : beneficiarioBase;
  };

  // Manejar cambios en los inputs del formulario activo
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (activeTab === 'proyecto') {
      setFormDataProyecto(prev => ({
        ...prev,
        [name]: name === 'email' ? value : value.toUpperCase()
      }));
    } else {
      setFormDataBase(prev => ({
        ...prev,
        [name]: name === 'email' ? value : value.toUpperCase()
      }));
    }
  };

  // Manejar cambios en el beneficiario del formulario activo
  const handleBeneficiarioChange = (field: keyof Beneficiario, value: string) => {
    if (activeTab === 'proyecto') {
      setBeneficiarioProyecto(prev => ({
        ...prev,
        [field]: value.toUpperCase()
      }));
    } else {
      setBeneficiarioBase(prev => ({
        ...prev,
        [field]: value.toUpperCase()
      }));
    }
  };

  // Manejar cambios en documentos - SOLO PDF y JPG/PNG
  const handleDocumentChange = (tipo: keyof Documentos, files: FileList) => {
    const filesArray = Array.from(files);
    
    // Validar tipo de archivo basado en el tipo de documento
    let validExtensions: string[] = [];
    
    if (tipo === 'foto') {
      // Solo imágenes para la foto
      validExtensions = ['.jpg', '.jpeg', '.png'];
    } else {
      // Solo PDF para todos los demás documentos
      validExtensions = ['.pdf'];
    }
    
    const invalidFiles = filesArray.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      return !validExtensions.includes(extension);
    });

    if (invalidFiles.length > 0) {
      const extensionList = validExtensions.join(', ');
      setErrorMessage(`Tipo de archivo no válido para ${documentoNombres[tipo]}. Solo se permiten: ${extensionList}`);
      return;
    }

    // Validar tamaño máximo (4MB)
    const maxSize = 4 * 1024 * 1024; // 4MB
    const oversizedFiles = filesArray.filter(file => file.size > maxSize);

    if (oversizedFiles.length > 0) {
      setErrorMessage(`Archivo demasiado grande para ${documentoNombres[tipo]}. Tamaño máximo: 4MB.`);
      return;
    }

    setDocumentos(prev => ({
      ...prev,
      [tipo]: filesArray
    }));
  };

  // Eliminar documento
  const removeDocument = (tipo: keyof Documentos, index: number) => {
    setDocumentos(prev => {
      const newFiles = [...prev[tipo]];
      newFiles.splice(index, 1);
      return {
        ...prev,
        [tipo]: newFiles
      };
    });
  };

  // Abrir selector de archivos
  const triggerFileInput = (tipo: keyof Documentos) => {
    fileInputRefs.current[tipo]?.click();
  };

  // Validar documentos
  const validateDocuments = (): boolean => {
    const documentosRequeridos: (keyof Documentos)[] = [
      'cv', 'actaNacimiento', 'curp', 'rfc', 'imss', 
      'ine', 'comprobanteDomicilio', 'foto'
    ];

    for (const docType of documentosRequeridos) {
      if (documentos[docType].length === 0) {
        setErrorMessage(`El documento ${documentoNombres[docType]} es requerido`);
        return false;
      }
    }

    return true;
  };

  // Subir documentos
  const uploadDocuments = async (): Promise<Record<keyof Documentos, string[]>> => {
    const uploadedUrls: Record<keyof Documentos, string[]> = {
      cv: [], actaNacimiento: [], curp: [], rfc: [], imss: [], ine: [],
      comprobanteDomicilio: [], comprobanteEstudios: [], comprobanteCapacitacion: [],
      licenciaManejo: [], cartaAntecedentes: [], cartaRecomendacion: [], retencionInfonavit: [],
      examenMedico: [], foto: [], folleto: []
    };

    let totalFiles = 0;
    let uploadedFiles = 0;

    // Contar total de archivos
    Object.values(documentos).forEach(files => {
      totalFiles += files.length;
    });

    if (totalFiles === 0) return uploadedUrls;

    // Subir archivos por tipo
    for (const [docType, files] of Object.entries(documentos)) {
      if (files.length > 0) {
        try {
          setUploadProgress(Math.round((uploadedFiles / totalFiles) * 50));
          
          const response = await startUpload(files as File[]);
          
          if (response && response.length > 0) {
            uploadedUrls[docType as keyof Documentos] = response.map(file => file.url);
            uploadedFiles += files.length;
            setUploadProgress(Math.round((uploadedFiles / totalFiles) * 100));
          }
        } catch (error) {
          console.error(`Error al subir ${docType}:`, error);
          throw new Error(`Error al subir ${documentoNombres[docType as keyof Documentos]}`);
        }
      }
    }

    return uploadedUrls;
  };

  // Validar formulario según la pestaña activa
  const validateForm = () => {
    const formData = getActiveFormData();
    const beneficiario = getActiveBeneficiario();

    // Campos requeridos para ambos tipos
    const requiredFieldsBase = [
      'nombre', 'apellidoPaterno', 'nss', 'curp', 'rfc',
      'fechaNacimiento', 'telefono', 'email', 'puesto',
      'salario', 'calle', 'numeroExterior',
      'colonia', 'municipio', 'estado', 'codigoPostal'
    ];

    // Validar campos adicionales según el tipo
    if (activeTab === 'proyecto') {
      const proyectoData = formData as FormDataProyecto;
      if (!proyectoData.proyectoId?.trim()) {
        setErrorMessage('El proyecto es requerido para personal de proyecto');
        return false;
      }
      if (!proyectoData.fechaFinContrato?.trim()) {
        setErrorMessage('La fecha de fin de contrato es requerida para personal de proyecto');
        return false;
      }
    }

    // Validar campos requeridos del formulario principal
    for (const field of requiredFieldsBase) {
      if (!formData[field as keyof typeof formData]?.trim()) {
        const fieldName = fieldNames[field] || field;
        setErrorMessage(`El campo ${fieldName} es requerido`);
        return false;
      }
    }

    // Validar formato de CURP (18 caracteres)
    if (formData.curp && formData.curp.length !== 18) {
      setErrorMessage('La CURP debe tener 18 caracteres');
      return false;
    }

    // Validar formato de NSS (11 dígitos)
    if (formData.nss && !/^\d{11}$/.test(formData.nss)) {
      setErrorMessage('El NSS debe tener 11 dígitos');
      return false;
    }

    // Validar RFC (12-13 caracteres)
    if (formData.rfc && (formData.rfc.length < 12 || formData.rfc.length > 13)) {
      setErrorMessage('El RFC debe tener entre 12 y 13 caracteres');
      return false;
    }

    // Validar formato de email
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      setErrorMessage('El email no tiene un formato válido');
      return false;
    }

    // Validar documentos
    if (!validateDocuments()) {
      return false;
    }

    // Validar que si se llena algún campo de beneficiario, todos los requeridos estén completos
    if (beneficiario.nombre || beneficiario.apellidoPaterno || beneficiario.porcentaje) {
      if (!beneficiario.nombre.trim()) {
        setErrorMessage('El nombre del beneficiario es requerido');
        return false;
      }
      if (!beneficiario.apellidoPaterno.trim()) {
        setErrorMessage('El apellido paterno del beneficiario es requerido');
        return false;
      }
      if (!beneficiario.parentesco) {
        setErrorMessage('El parentesco del beneficiario es requerido');
        return false;
      }
      if (!beneficiario.porcentaje) {
        setErrorMessage('El porcentaje del beneficiario es requerido');
        return false;
      }
      
      // Validar que el porcentaje sea 100% (solo un beneficiario)
      const porcentaje = parseFloat(beneficiario.porcentaje) || 0;
      if (Math.abs(porcentaje - 100) > 0.01) {
        setErrorMessage('El porcentaje del beneficiario debe ser 100% (solo se permite un beneficiario)');
        return false;
      }
    }

    return true;
  };

  // Limpiar todos los formularios
  const limpiarTodosFormularios = () => {
    // Limpiar formulario de proyecto
    setFormDataProyecto({
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      nss: '',
      curp: '',
      rfc: '',
      fechaNacimiento: '',
      genero: '',
      nacionalidad: '',
      estadoCivil: '',
      telefono: '',
      email: '',
      puesto: '',
      departamento: '',
      salario: '',
      horarioLaboral: '',
      tipoContrato: '',
      fechaInicioContrato: '',
      fechaFinContrato: '',
      calle: '',
      numeroExterior: '',
      numeroInterior: '',
      colonia: '',
      municipio: '',
      estado: '',
      codigoPostal: '',
      nci: '',
      umf: '',
      salaryIMSS: '',
      proyectoId: ''
    });
    setBeneficiarioProyecto({
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      parentesco: '',
      porcentaje: ''
    });

    // Limpiar formulario de personal base
    setFormDataBase({
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      nss: '',
      curp: '',
      rfc: '',
      fechaNacimiento: '',
      genero: '',
      nacionalidad: '',
      estadoCivil: '',
      telefono: '',
      email: '',
      puesto: '',
      departamento: '',
      salario: '',
      horarioLaboral: '',
      tipoContrato: '',
      fechaInicioContrato: '',
      calle: '',
      numeroExterior: '',
      numeroInterior: '',
      colonia: '',
      municipio: '',
      estado: '',
      codigoPostal: '',
      nci: '',
      umf: '',
      salaryIMSS: ''
    });
    setBeneficiarioBase({
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      parentesco: '',
      porcentaje: ''
    });

    // Limpiar documentos
    setDocumentos({
      cv: [],
      actaNacimiento: [],
      curp: [],
      rfc: [],
      imss: [],
      ine: [],
      comprobanteDomicilio: [],
      comprobanteEstudios: [],
      comprobanteCapacitacion: [],
      licenciaManejo: [],
      cartaAntecedentes: [],
      cartaRecomendacion: [],
      retencionInfonavit: [],
      examenMedico: [],
      foto: [],
      folleto: []
    });

    setSuccessMessage('');
    setErrorMessage('');
    setShowSuccessModal(false);
    setUploadProgress(0);
  };

  // Función para convertir texto a mayúsculas manteniendo acentos
  const toUpperCaseWithAccents = (text: string): string => {
    return text.toUpperCase();
  };

  // Manejar envío del formulario
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');
    setSuccessDetails(null);
    setUploadProgress(0);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const formData = getActiveFormData();
      const beneficiario = getActiveBeneficiario();

      // Subir documentos primero
      setUploadProgress(10);
      const documentosUrls = await uploadDocuments();
      setUploadProgress(50);

      // Solo incluir beneficiario si tiene datos
      const beneficiariosFiltrados = beneficiario.nombre.trim() && beneficiario.apellidoPaterno.trim()
        ? [{
            nombre: toUpperCaseWithAccents(beneficiario.nombre.trim()),
            apellidoPaterno: toUpperCaseWithAccents(beneficiario.apellidoPaterno.trim()),
            apellidoMaterno: toUpperCaseWithAccents(beneficiario.apellidoMaterno.trim()),
            parentesco: toUpperCaseWithAccents(beneficiario.parentesco.trim()),
            porcentaje: beneficiario.porcentaje
          }]
        : [];

      // Crear objeto con formato correcto según el tipo de personal
      const formDataToSend: any = {
        // Información personal (común para ambos)
        nombre: toUpperCaseWithAccents(formData.nombre.trim()),
        apellidoPaterno: toUpperCaseWithAccents(formData.apellidoPaterno.trim()),
        apellidoMaterno: toUpperCaseWithAccents(formData.apellidoMaterno.trim()),
        fechaNacimiento: formData.fechaNacimiento,
        genero: toUpperCaseWithAccents(formData.genero),
        nacionalidad: toUpperCaseWithAccents(formData.nacionalidad),
        estadoCivil: toUpperCaseWithAccents(formData.estadoCivil),
        telefono: formData.telefono,
        email: formData.email.toLowerCase().trim(),
        
        // Documentos
        nss: formData.nss,
        curp: toUpperCaseWithAccents(formData.curp.trim()),
        rfc: toUpperCaseWithAccents(formData.rfc.trim()),
        nci: toUpperCaseWithAccents(formData.nci.trim()),
        umf: formData.umf,
        
        // Dirección
        calle: toUpperCaseWithAccents(formData.calle.trim()),
        numeroExterior: toUpperCaseWithAccents(formData.numeroExterior.trim()),
        numeroInterior: toUpperCaseWithAccents(formData.numeroInterior.trim()),
        colonia: toUpperCaseWithAccents(formData.colonia.trim()),
        municipio: toUpperCaseWithAccents(formData.municipio.trim()),
        estado: toUpperCaseWithAccents(formData.estado),
        codigoPostal: formData.codigoPostal,
        
        // Información laboral
        puesto: toUpperCaseWithAccents(formData.puesto.trim()),
        departamento: toUpperCaseWithAccents(formData.departamento.trim()),
        salario: formData.salario,
        horarioLaboral: toUpperCaseWithAccents(formData.horarioLaboral),
        tipoContrato: toUpperCaseWithAccents(formData.tipoContrato),
        
        // Información de contrato
        fechaInicioContrato: formData.fechaInicioContrato,
        salaryIMSS: formData.salaryIMSS,
        
        // Tipo de personal
        tipoPersonal: activeTab === 'proyecto' ? 'proyecto' : 'base',
        
        // Beneficiarios
        beneficiarios: beneficiariosFiltrados,

        // Documentos adjuntos
        documentos: documentosUrls
      };

      // Agregar campos específicos según el tipo
      if (activeTab === 'proyecto') {
        const proyectoData = formData as FormDataProyecto;
        formDataToSend.fechaFinContrato = proyectoData.fechaFinContrato;
        formDataToSend.proyectoId = proyectoData.proyectoId;
      }

      setUploadProgress(75);
      const response = await fetch('/api/empleados/registrar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formDataToSend),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setUploadProgress(100);
        setSuccessMessage(result.message);
        
        // Obtener URLs de documentos desde la BD
        const documentUrls = await getDocumentUrls(result.empleadoId);
        
        // Generar URLs para descarga
        const downloadUrls = await generateDownloadUrls(
          result.empleadoId,
          documentUrls.contractFileURL,
          documentUrls.warningFileURL, 
          documentUrls.letterFileURL,
          documentUrls.agreementFileURL
        );
        
        const details: SuccessDetails = {
          empleadoId: result.employeeId,
          nombre: `${toUpperCaseWithAccents(formData.nombre)} ${toUpperCaseWithAccents(formData.apellidoPaterno)} ${toUpperCaseWithAccents(formData.apellidoMaterno)}`.trim(),
          puesto: toUpperCaseWithAccents(formData.puesto),
          tipoPersonal: activeTab === 'proyecto' ? 'PERSONAL DE PROYECTO' : 'PERSONAL BASE',
          fechaRegistro: new Date().toLocaleDateString('es-MX'),
          ftRh02PdfUrl: downloadUrls.ftRh02PdfUrl,
          ftRh02PdfDownloadUrl: downloadUrls.ftRh02PdfDownloadUrl,
          ftRh04PdfUrl: downloadUrls.ftRh04PdfUrl,
          ftRh04PdfDownloadUrl: downloadUrls.ftRh04PdfDownloadUrl,
          ftRh07PdfUrl: downloadUrls.ftRh07PdfUrl,
          ftRh07PdfDownloadUrl: downloadUrls.ftRh07PdfDownloadUrl,
          ftRh29PdfUrl: downloadUrls.ftRh29PdfUrl,
          ftRh29PdfDownloadUrl: downloadUrls.ftRh29PdfDownloadUrl,
          ftRh02WordUrl: downloadUrls.ftRh02WordUrl,
          ftRh04ExcelUrl: downloadUrls.ftRh04ExcelUrl,
          ftRh07WordUrl: downloadUrls.ftRh07WordUrl,
          ftRh29WordUrl: downloadUrls.ftRh29WordUrl
        };
        
        setSuccessDetails(details);
        setShowSuccessModal(true);
        
        // Limpiar solo el formulario activo después de éxito
        if (activeTab === 'proyecto') {
          setFormDataProyecto({
            nombre: '',
            apellidoPaterno: '',
            apellidoMaterno: '',
            nss: '',
            curp: '',
            rfc: '',
            fechaNacimiento: '',
            genero: '',
            nacionalidad: '',
            estadoCivil: '',
            telefono: '',
            email: '',
            puesto: '',
            departamento: '',
            salario: '',
            horarioLaboral: '',
            tipoContrato: '',
            fechaInicioContrato: '',
            fechaFinContrato: '',
            calle: '',
            numeroExterior: '',
            numeroInterior: '',
            colonia: '',
            municipio: '',
            estado: '',
            codigoPostal: '',
            nci: '',
            umf: '',
            salaryIMSS: '',
            proyectoId: ''
          });
          setBeneficiarioProyecto({
            nombre: '',
            apellidoPaterno: '',
            apellidoMaterno: '',
            parentesco: '',
            porcentaje: ''
          });
        } else {
          setFormDataBase({
            nombre: '',
            apellidoPaterno: '',
            apellidoMaterno: '',
            nss: '',
            curp: '',
            rfc: '',
            fechaNacimiento: '',
            genero: '',
            nacionalidad: '',
            estadoCivil: '',
            telefono: '',
            email: '',
            puesto: '',
            departamento: '',
            salario: '',
            horarioLaboral: '',
            tipoContrato: '',
            fechaInicioContrato: '',
            calle: '',
            numeroExterior: '',
            numeroInterior: '',
            colonia: '',
            municipio: '',
            estado: '',
            codigoPostal: '',
            nci: '',
            umf: '',
            salaryIMSS: ''
          });
          setBeneficiarioBase({
            nombre: '',
            apellidoPaterno: '',
            apellidoMaterno: '',
            parentesco: '',
            porcentaje: ''
          });
        }

        // Limpiar documentos
        setDocumentos({
          cv: [],
          actaNacimiento: [],
          curp: [],
          rfc: [],
          imss: [],
          ine: [],
          comprobanteDomicilio: [],
          comprobanteEstudios: [],
          comprobanteCapacitacion: [],
          licenciaManejo: [],
          cartaAntecedentes: [],
          cartaRecomendacion: [],
          retencionInfonavit: [],
          examenMedico: [],
          foto: [],
          folleto: []
        });
      } else {
        setErrorMessage(result.message || 'ERROR AL REGISTRAR EL EMPLEADO. POR FAVOR, INTENTE NUEVAMENTE.');
      }
    } catch (error: unknown) {
      console.error('Error:', error);
      setErrorMessage('ERROR DE CONEXIÓN. POR FAVOR, VERIFIQUE SU CONEXIÓN A INTERNET E INTENTE NUEVAMENTE.');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  // Cerrar modal
  const closeModal = () => {
    setShowSuccessModal(false);
    setPdfLoading(false);
    setFormatoActivo('FT-RH-02');
  };

  // Navegar entre formatos
  const siguienteFormato = () => {
    if (formatoActivo === 'FT-RH-02') {
      setFormatoActivo('FT-RH-04');
    } else if (formatoActivo === 'FT-RH-04') {
      setFormatoActivo('FT-RH-07');
    } else if (formatoActivo === 'FT-RH-07') {
      setFormatoActivo('FT-RH-29');
    }
  };

  const anteriorFormato = () => {
    if (formatoActivo === 'FT-RH-29') {
      setFormatoActivo('FT-RH-07');
    } else if (formatoActivo === 'FT-RH-07') {
      setFormatoActivo('FT-RH-04');
    } else if (formatoActivo === 'FT-RH-04') {
      setFormatoActivo('FT-RH-02');
    }
  };

  // Componente para mostrar archivos seleccionados
  const FileListDisplay = ({ tipo }: { tipo: keyof Documentos }) => {
    const files = documentos[tipo];
    
    if (files.length === 0) return null;

    return (
      <div className="mt-2 space-y-1">
        {files.map((file, index) => (
          <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded text-sm">
            <div className="flex items-center truncate">
              <File className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
              <span className="truncate">{file.name}</span>
              <span className="ml-2 text-xs text-gray-500">
                ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
            <button
              type="button"
              onClick={() => removeDocument(tipo, index)}
              className="text-red-500 hover:text-red-700 ml-2"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  // Componente para input de documento
  const DocumentInput = ({ tipo, required = false }: { tipo: keyof Documentos, required?: boolean }) => {
    // Definir accept basado en el tipo de documento
    const accept = tipo === 'foto' 
      ? '.jpg,.jpeg,.png' 
      : '.pdf';
    
    return (
      <div className="space-y-2">
        <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">
          {documentoNombres[tipo]} {required && '*'}
        </label>
        <input
          type="file"
          ref={el => {
            if (el) fileInputRefs.current[tipo] = el;
          }}
          onChange={(e) => e.target.files && handleDocumentChange(tipo, e.target.files)}
          className="hidden"
          accept={accept}
          multiple={false}
        />
        <button
          type="button"
          onClick={() => triggerFileInput(tipo)}
          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded hover:border-[#3a6ea5] hover:bg-gray-50 transition-colors font-medium flex items-center justify-center"
        >
          <Upload className="h-4 w-4 mr-2" />
          Seleccionar archivo
        </button>
        <FileListDisplay tipo={tipo} />
        {required && documentos[tipo].length === 0 && (
          <p className="text-xs text-red-500">Este documento es requerido</p>
        )}
        <p className="text-xs text-gray-500">
          {tipo === 'foto' 
            ? 'Formato: JPG/PNG • Máx: 4MB' 
            : 'Formato: PDF • Máx: 4MB'}
        </p>
      </div>
    );
  };

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

  // Si no hay usuario (sesión inválida), no renderizar nada
  if (!user) {
    return null;
  }

  // Renderizar el formulario correspondiente
  const renderFormulario = () => {
    const formData = getActiveFormData();
    const beneficiario = getActiveBeneficiario();

    return (
      <form onSubmit={handleSubmit}>
        {/* TARJETA DE INFORMACIÓN PERSONAL */}
        <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden mb-6">
          <div className="bg-gray-200 px-6 py-4 border-b-2 border-gray-300">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
              INFORMACIÓN PERSONAL
            </h2>
          </div>
          
          <div className="p-6">
            <div className="space-y-6">
              {/* Nombre completo */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    NOMBRE(S) *
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder='Ingrese el nombre (s)'
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    APELLIDO PATERNO *
                  </label>
                  <input
                    type="text"
                    name="apellidoPaterno"
                    value={formData.apellidoPaterno}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder='Ingrese el apellido paterno'
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    APELLIDO MATERNO *
                  </label>
                  <input
                    type="text"
                    name="apellidoMaterno"
                    value={formData.apellidoMaterno}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder='Ingrese el apellido materno'
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    FECHA DE NACIMIENTO *
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <Calendar className="h-4 w-4 text-gray-600" />
                    </div>
                    <input
                      type="date"
                      name="fechaNacimiento"
                      value={formData.fechaNacimiento}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Documentos de identificación */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    ESTADO CIVIL *
                  </label>
                  <select
                    name="estadoCivil"
                    value={formData.estadoCivil}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                  >
                    <option value="">Seleccione un tipo</option>
                    <option value="SOLTERO">SOLTERO (A)</option>
                    <option value="CASADO">CASADO (A)</option>
                    <option value="DIVORCIADO">DIVORCIADO (A)</option>
                    <option value="VIUDO">VIUDO (A)</option>
                    <option value="UNION LIBRE">UNIÓN LIBRE</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    GÉNERO *
                  </label>
                  <select
                    name="genero"
                    value={formData.genero}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                  >
                    <option value="">Seleccione un tipo</option>
                    <option value="MASCULINO">MASCULINO</option>
                    <option value="FEMENINO">FEMENINO</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    TELÉFONO *
                  </label>
                  <input
                    type="text"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder="Ingrese el teléfono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    EMAIL *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder="Ingrese el correo"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    NSS *
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <User className="h-4 w-4 text-gray-600" />
                    </div>
                    <input
                      type="text"
                      name="nss"
                      value={formData.nss}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      placeholder="Ingrese el NSS"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    CURP *
                  </label>
                  <input
                    type="text"
                    name="curp"
                    value={formData.curp}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder="Ingrese el CURP"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    RFC *
                  </label>
                  <input
                    type="text"
                    name="rfc"
                    value={formData.rfc}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder="Ingrese el RFC"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    NÚMERO DE CONVENIO DE INFONAVIT *
                  </label>
                  <input
                    type="text"
                    name="nci"
                    value={formData.nci}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder="Ingrese el NCI"
                    required
                  />
                </div>
              </div>

              {/* Dirección */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    CALLE *
                  </label>
                  <input
                    type="text"
                    name="calle"
                    value={formData.calle}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder="Ingrese la calle"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    NO. EXTERIOR *
                  </label>
                  <input
                    type="text"
                    name="numeroExterior"
                    value={formData.numeroExterior}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder="Ingrese el número exterior"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    NO. INTERIOR *
                  </label>
                  <input
                    type="text"
                    name="numeroInterior"
                    value={formData.numeroInterior}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder="Ingrese el número interior"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    COLONIA *
                  </label>
                  <input
                    type="text"
                    name="colonia"
                    value={formData.colonia}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder="Ingrese la colonia"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    MUNICIPIO *
                  </label>
                  <input
                    type="text"
                    name="municipio"
                    value={formData.municipio}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder="Ingrese el municipio"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    ESTADO *
                  </label>
                  <select
                    name="estado"
                    value={formData.estado}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    required
                  >
                    <option value="">Seleccione un estado</option>
                    <option value="AGUASCALIENTES">AGUASCALIENTES</option>
                    <option value="BAJA CALIFORNIA">BAJA CALIFORNIA</option>
                    <option value="BAJA CALIFORNIA SUR">BAJA CALIFORNIA SUR</option>
                    <option value="CAMPECHE">CAMPECHE</option>
                    <option value="CHIAPAS">CHIAPAS</option>
                    <option value="CHIHUAHUA">CHIHUAHUA</option>
                    <option value="CIUDAD DE MÉXICO">CIUDAD DE MÉXICO</option>
                    <option value="COAHUILA">COAHUILA</option>
                    <option value="COLIMA">COLIMA</option>
                    <option value="DURANGO">DURANGO</option>
                    <option value="ESTADO DE MÉXICO">ESTADO DE MÉXICO</option>
                    <option value="GUANAJUATO">GUANAJUATO</option>
                    <option value="GUERRERO">GUERRERO</option>
                    <option value="HIDALGO">HIDALGO</option>
                    <option value="JALISCO">JALISCO</option>
                    <option value="MICHOACÁN">MICHOACÁN</option>
                    <option value="MORELOS">MORELOS</option>
                    <option value="NAYARIT">NAYARIT</option>
                    <option value="NUEVO LEÓN">NUEVO LEÓN</option>
                    <option value="OAXACA">OAXACA</option>
                    <option value="PUEBLA">PUEBLA</option>
                    <option value="QUERÉTARO">QUERÉTARO</option>
                    <option value="QUINTANA ROO">QUINTANA ROO</option>
                    <option value="SAN LUIS POTOSÍ">SAN LUIS POTOSÍ</option>
                    <option value="SINALOA">SINALOA</option>
                    <option value="SONORA">SONORA</option>
                    <option value="TABASCO">TABASCO</option>
                    <option value="TAMAULIPAS">TAMAULIPAS</option>
                    <option value="TLAXCALA">TLAXCALA</option>
                    <option value="VERACRUZ">VERACRUZ</option>
                    <option value="YUCATÁN">YUCATÁN</option>
                    <option value="ZACATECAS">ZACATECAS</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    CÓDIGO POSTAL *
                  </label>
                  <input
                    type="text"
                    name="codigoPostal"
                    value={formData.codigoPostal}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder="Ingrese el código postal"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    NACIONALIDAD *
                  </label>
                  <select
                    name="nacionalidad"
                    value={formData.nacionalidad}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                  >
                    <option value="">Seleccione un tipo</option>
                    <option value="MEXICANA">MEXICANA</option>
                    <option value="EXTRANJERA">EXTRANJERA</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    NÚMERO DE UNIDAD DE MEDICINA FAMILIAR *
                  </label>
                  <input
                    type="Number"
                    name="umf"
                    value={formData.umf}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder="Ingrese UMF"
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TARJETA DE DATOS LABORALES */}
        <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden mb-6">
          <div className="bg-gray-200 px-6 py-4 border-b-2 border-gray-300">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
              INFORMACIÓN LABORAL
            </h2>
          </div>
          
          <div className="p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    PUESTO *
                  </label>
                  <input
                    type="text"
                    name="puesto"
                    value={formData.puesto}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder="Ingrese el puesto"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    ÁREA *
                  </label>
                  <input
                    type="text"
                    name="departamento"
                    value={formData.departamento}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder="Ingrese el área"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    SALARIO *
                  </label>
                  <input
                    type="number"
                    name="salario"
                    value={formData.salario}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder="Ingrese el salario"
                    step="0.01"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    SALARIO IMSS *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="salaryIMSS"
                      value={formData.salaryIMSS}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      placeholder="Ingrese el salario para IMSS"
                      step="0.01"
                      required
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    HORARIO LABORAL
                  </label>
                  <select
                    name="horarioLaboral"
                    value={formData.horarioLaboral}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                  >
                    <option value="">Seleccione un tipo</option>
                    <option value="08:15 AM A 06:00 PM">08:15 AM A 06:00 PM</option>
                    <option value="OTRO">OTRO</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    FECHA DE INICIO CONTRATO *
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <Calendar className="h-4 w-4 text-gray-600" />
                    </div>
                    <input
                      type="date"
                      name="fechaInicioContrato"
                      value={formData.fechaInicioContrato}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                    />
                  </div>
                </div>
                
                {/* Solo mostrar fecha de fin de contrato para personal de proyecto */}
                {activeTab === 'proyecto' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      FECHA DE FIN CONTRATO *
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                        <Calendar className="h-4 w-4 text-gray-600" />
                      </div>
                      <input
                        type="date"
                        name="fechaFinContrato"
                        value={(formData as FormDataProyecto).fechaFinContrato}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                        required
                      />
                    </div>
                  </div>
                )}
                
                {/* Campo de proyecto solo para personal de proyecto */}
                {activeTab === 'proyecto' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      PROYECTO *
                    </label>
                    <select
                      name="proyectoId"
                      value={(formData as FormDataProyecto).proyectoId}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                      disabled={loadingProjects}
                    >
                      <option value="">Seleccione un proyecto</option>
                      {proyectos.map((proyecto) => (
                        <option key={proyecto.ProjectID} value={proyecto.ProjectID}>
                          {proyecto.NameProject}
                        </option>
                      ))}
                    </select>
                    {loadingProjects && (
                      <p className="text-xs text-gray-500 mt-1">Cargando proyectos...</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* TARJETA DE BENEFICIARIO (SOLO UNO) */}
        <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden mb-6">
          <div className="bg-gray-200 px-6 py-4 border-b-2 border-gray-300">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
              BENEFICIARIO 
            </h2>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                  NOMBRE (S) *
                </label>
                <input
                  type="text"
                  value={beneficiario.nombre}
                  onChange={(e) => handleBeneficiarioChange('nombre', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                  placeholder="Ingrese el nombre (s) del beneficiario"
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                  APELLIDO PATERNO *
                </label>
                <input
                  type="text"
                  value={beneficiario.apellidoPaterno}
                  onChange={(e) => handleBeneficiarioChange('apellidoPaterno', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                  placeholder="Ingrese el apellido paterno"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                  APELLIDO MATERNO *
                </label>
                <input
                  type="text"
                  value={beneficiario.apellidoMaterno}
                  onChange={(e) => handleBeneficiarioChange('apellidoMaterno', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                  placeholder="Ingrese el apellido materno"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                  PARENTESCO *
                </label>
                <select
                  value={beneficiario.parentesco}
                  onChange={(e) => handleBeneficiarioChange('parentesco', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                >
                  <option value="">Seleccione un tipo</option>
                  <option value="CÓNYUGE">CÓNYUGE</option>
                  <option value="HIJO">HIJO (A)</option>
                  <option value="PADRE">PADRE</option>
                  <option value="MADRE">MADRE</option>
                  <option value="HERMANO">HERMANO (A)</option>
                  <option value="OTRO">OTRO</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                  PORCENTAJE (%) *
                </label>
                <input
                  type="text"
                  value={beneficiario.porcentaje}
                  onChange={(e) => handleBeneficiarioChange('porcentaje', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                  placeholder="Ingrese el porcentaje"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* TARJETA DE DOCUMENTACIÓN */}
        <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden mb-6">
          <div className="bg-gray-200 px-6 py-4 border-b-2 border-gray-300">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
              DOCUMENTACIÓN REQUERIDA
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Todos los documentos son obligatorios. Documentos: PDF • Fotografía: JPG/PNG • Tamaño máximo: 4MB por archivo.
            </p>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Documentos obligatorios */}
              <DocumentInput tipo="cv" required />
              <DocumentInput tipo="actaNacimiento" required />
              <DocumentInput tipo="curp" required />
              <DocumentInput tipo="rfc" required />
              <DocumentInput tipo="imss" required />
              <DocumentInput tipo="ine" required />
              <DocumentInput tipo="comprobanteDomicilio" required />
              <DocumentInput tipo="foto" required />
              
              {/* Documentos opcionales */}
              <DocumentInput tipo="comprobanteEstudios" required/>
              <DocumentInput tipo="comprobanteCapacitacion" required/>
              <DocumentInput tipo="licenciaManejo" />
              <DocumentInput tipo="cartaAntecedentes" />
              <DocumentInput tipo="cartaRecomendacion" required/>
              <DocumentInput tipo="retencionInfonavit" required/>
              <DocumentInput tipo="examenMedico" required/>
              <DocumentInput tipo="folleto" required/>
            </div>

            {/* Barra de progreso */}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-6">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Subiendo documentos...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-[#3a6ea5] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER */}
      <AppHeader 
        title="PANEL ADMINISTRATIVO"
      />

      {/* MODAL DE CONFIRMACIÓN EXITOSA CON VISTA PREVIA DE PDF */}
      {showSuccessModal && successDetails && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/70">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full h-[90vh] flex flex-col animate-fade-in">
            {/* Encabezado del modal */}
            <div className="p-6 pb-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  ¡REGISTRO EXITOSO!
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  El empleado ha sido registrado correctamente en el sistema.
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
            
            {/* Contenido del modal - dos columnas */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Columna izquierda - Detalles del registro */}
              <div className="w-full md:w-1/3 p-6 border-r border-gray-200 overflow-y-auto">
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">DETALLES DEL REGISTRO</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">ID EMPLEADO:</span>
                        <span className="text-gray-600 mt-1 text-sm">{successDetails.empleadoId}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">NOMBRE:</span>
                        <span className="text-gray-600 mt-1 text-sm">{successDetails.nombre}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">PUESTO:</span>
                        <span className="text-gray-600 mt-1 text-sm">{successDetails.puesto}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">TIPO:</span>
                        <span className="text-gray-600 mt-1 text-sm">{successDetails.tipoPersonal}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="block text-xs font-bold text-gray-700 uppercase">FECHA DE REGISTRO:</span>
                        <span className="text-gray-600 mt-1 text-sm">{successDetails.fechaRegistro}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase">CONTROL DE FORMATOS</h3>
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={anteriorFormato}
                        disabled={formatoActivo === 'FT-RH-02'}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Formato anterior"
                      >
                        <ChevronLeft className="h-4 w-4 text-gray-700" />
                      </button>
                      <span className="font-bold text-gray-800 text-sm">
                        {formatoActivo === 'FT-RH-02' ? 'FORMATO FT-RH-02' : 
                         formatoActivo === 'FT-RH-04' ? 'FORMATO FT-RH-04' : 
                         formatoActivo === 'FT-RH-07' ? 'FORMATO FT-RH-07' : 
                         'FORMATO FT-RH-29'}
                      </span>
                      <button
                        onClick={siguienteFormato}
                        disabled={formatoActivo === 'FT-RH-29'}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Siguiente formato"
                      >
                        <ChevronRight className="h-4 w-4 text-gray-700" />
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Documentos del formato activo */}
                      {formatoActivo === 'FT-RH-02' ? (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <FileText className="h-5 w-5 text-gray-600 mr-2" />
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-02 (PDF)</span>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={successDetails.ftRh02PdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                title="Vista previa"
                              >
                                <Eye className="h-4 w-4 text-gray-700" />
                              </a>
                              <button
                                onClick={() => handleDownloadFile(successDetails.ftRh02PdfDownloadUrl || '', `FT-RH-02_${successDetails.empleadoId}.pdf`)}
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
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-02 (EDITABLE)</span>
                            </div>
                            <a
                              href={successDetails.ftRh02WordUrl}
                              download={`FT-RH-02_${successDetails.empleadoId}.docx`}
                              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                              <Download className="h-4 w-4 text-gray-700" />
                            </a>
                          </div>
                        </>
                      ) : formatoActivo === 'FT-RH-04' ? (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <FileText className="h-5 w-5 text-gray-600 mr-2" />
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-04 (PDF)</span>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={successDetails.ftRh04PdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                title="Vista previa"
                              >
                                <Eye className="h-4 w-4 text-gray-700" />
                              </a>
                              <button
                                onClick={() => handleDownloadFile(successDetails.ftRh04PdfDownloadUrl || '', `FT-RH-04_${successDetails.empleadoId}.pdf`)}
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
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-04 (EDITABLE)</span>
                            </div>
                            <a
                              href={successDetails.ftRh04ExcelUrl}
                              download={`FT-RH-04_${successDetails.empleadoId}.xlsx`}
                              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                              <Download className="h-4 w-4 text-gray-700" />
                            </a>
                          </div>
                        </>
                      ) : formatoActivo === 'FT-RH-07' ? (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <FileText className="h-5 w-5 text-gray-600 mr-2" />
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-07 (PDF)</span>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={successDetails.ftRh07PdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                title="Vista previa"
                              >
                                <Eye className="h-4 w-4 text-gray-700" />
                              </a>
                              <button
                                onClick={() => handleDownloadFile(successDetails.ftRh07PdfDownloadUrl || '', `FT-RH-07_${successDetails.empleadoId}.pdf`)}
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
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-07 (EDITABLE)</span>
                            </div>
                            <a
                              href={successDetails.ftRh07WordUrl}
                              download={`FT-RH-07_${successDetails.empleadoId}.docx`}
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
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-29 (PDF)</span>
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={successDetails.ftRh29PdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                title="Vista previa"
                              >
                                <Eye className="h-4 w-4 text-gray-700" />
                              </a>
                              <button
                                onClick={() => handleDownloadFile(successDetails.ftRh29PdfDownloadUrl || '', `FT-RH-29_${successDetails.empleadoId}.pdf`)}
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
                              <span className="block text-xs font-bold text-gray-700 uppercase">FT-RH-29 (EDITABLE)</span>
                            </div>
                            <a
                              href={successDetails.ftRh29WordUrl}
                              download={`FT-RH-29_${successDetails.empleadoId}.docx`}
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
                         <Download className="h-4 w-4 text-gray-700" />
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
                         <Download className="h-4 w-4 text-gray-700" />
                      </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-bold text-yellow-800 mb-2 text-sm">SIGUIENTES PASOS</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• Revisar la vista previa de cada documento</li>
                      <li>• Descargar archivos individuales o en ZIP</li>
                      <li>• Archivar la documentación física</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              {/* Columna derecha - Vista previa del PDF */}
              <div className="flex-1 flex flex-col p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800 text-sm uppercase">
                    VISTA PREVIA - {
                      formatoActivo === 'FT-RH-02' ? 'FORMATO FT-RH-02' : 
                      formatoActivo === 'FT-RH-04' ? 'FORMATO FT-RH-04' : 
                      formatoActivo === 'FT-RH-07' ? 'FORMATO FT-RH-07' : 
                      'FORMATO FT-RH-29'
                    }
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      {formatoActivo === 'FT-RH-02' ? '1 de 4' : 
                       formatoActivo === 'FT-RH-04' ? '2 de 4' : 
                       formatoActivo === 'FT-RH-07' ? '3 de 4' : 
                       '4 de 4'}
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
                      formatoActivo === 'FT-RH-02' ? successDetails.ftRh02PdfUrl :
                      formatoActivo === 'FT-RH-04' ? successDetails.ftRh04PdfUrl : 
                      formatoActivo === 'FT-RH-07' ? successDetails.ftRh07PdfUrl : 
                      successDetails.ftRh29PdfUrl
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

      {/* CONTENT */}
      <main className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5] w-full">
              <h1 className="text-xl font-bold text-white tracking-tight">INGRESO / CONTRATACIÓN</h1>
              <p className="text-sm text-gray-200 mt-1">
                Para dar de alta a un nuevo empleado en el sistema, seleccione el tipo de personal y complete el formulario correspondiente.
              </p>
            </div>
          </div>

          {/* PESTAÑAS - Versión minimalista */}
          <div className="mb-6">
            <div className="flex space-x-1 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('proyecto')}
                className={`flex-1 py-3 px-4 text-center font-bold text-sm uppercase tracking-tight transition-all duration-200 ${
                  activeTab === 'proyecto'
                    ? 'text-[#3a6ea5] border-b-2 border-[#3a6ea5] -mb-px'
                    : 'text-black hover:text-black'
                }`}
              >
                PERSONAL DE PROYECTO
              </button>
              
              <button
                onClick={() => setActiveTab('base')}
                className={`flex-1 py-3 px-4 text-center font-bold text-sm uppercase tracking-tight transition-all duration-200 ${
                  activeTab === 'base'
                    ? 'text-[#3a6ea5] border-b-2 border-[#3a6ea5] -mb-px'
                    : 'text-black hover:text-black'
                }`}
              >
                PERSONAL BASE
              </button>
            </div>
          </div>

          {/* CONTENIDO DE LAS PESTAÑAS */}
          <div className="space-y-6">
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 animate-fade-in">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-700 font-bold text-center uppercase">{errorMessage}</p>
                </div>
              </div>
            )}

            {renderFormulario()}

            {/* BOTONES */}
            <div className="flex flex-col sm:flex-row gap-4 pt-8 pb-8 justify-center">
              <button
                type="submit"
                form={activeTab === 'proyecto' ? undefined : undefined}
                onClick={(e) => {
                  const form = document.querySelector('form');
                  if (form) {
                    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                  }
                }}
                disabled={loading || uploadProgress > 0 && uploadProgress < 100}
                className="w-full sm:w-auto min-w-[280px] bg-[#3a6ea5] text-white font-bold py-3 px-8 rounded-md hover:bg-[#2d5592] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center uppercase tracking-tight"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    {uploadProgress > 0 && uploadProgress < 100 ? `SUBIDO ${uploadProgress}%` : 'REGISTRANDO...'}
                  </>
                ) : (
                  `REGISTRAR ${activeTab === 'proyecto' ? 'PERSONAL DE PROYECTO' : 'PERSONAL BASE'}`
                )}
              </button>
              
              <button
                type="button"
                onClick={limpiarTodosFormularios}
                disabled={loading || uploadProgress > 0 && uploadProgress < 100}
                className="w-full sm:w-auto min-w-[280px] bg-gray-200 text-gray-800 font-bold py-3 px-8 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-tight"
              >
                LIMPIAR FORMULARIO
              </button>
            </div>
          </div>
        </div>

        <Footer/>
      </main>

      {/* Agregar estilos para animaciones */}
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
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
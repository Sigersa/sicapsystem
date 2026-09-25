'use client';
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppHeader from '@/components/header/5/5.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/5';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { X, CheckCircle, AlertCircle, Download, Eye } from 'lucide-react';

interface UserData {
  id: number;
  usuario: string;
  tipoUsuario: string;
  nombre: string;
  apellido: string;
  email: string;
  proyectoAsignado: string;
  proyectoActivo: boolean;
  projectId: number | null;
}

interface Project {
  ProjectID: number;
  NameProject: string;
  ProjectType: number;
  ProjectBudget: number;
}

interface ReportType {
  value: string;
  label: string;
}

interface PaymentMethod {
  id: string;
  name: string;
}

interface ReportRequestBody {
  type: string;
  startDate?: string;
  endDate?: string;
  projectId?: number | '';
  paymentMethod?: string;
}

interface CategoryDetail {
  categoria: string;
  total: number;
  detalles: any[];
  columnas: string[];
}

interface ReportPreviewData {
  tipoReporte: string;
  proyecto?: string;
  fechaInicio?: string;
  fechaFin?: string;
  presupuesto?: number;
  gastosTotales?: number;
  utilidad?: number;
  porcentajeUtilidad?: number;
  categorias?: CategoryDetail[];
  proyectosRentabilidad?: Array<{
    proyecto: string;
    presupuesto: number;
    gastos: number;
    rentabilidad: number;
    porcentaje: number;
  }>;
  metodoPagoFiltro?: string;
}

// Componente Modal mejorado con diseño consistente
const Modal = ({ isOpen, onClose, title, message, type = 'info' }: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info';
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-blue-600" />;
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-in relative z-[10000]">
        <div className="p-6 pb-4 border-b border-gray-300">
          <div className="flex items-center">
            <div className="flex-shrink-0 mr-3">
              {getIcon()}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h3>
              <p className="text-sm text-gray-600 mt-1 leading-5">{message}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="p-6 pt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors"
          >
            ACEPTAR
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente Modal para Vista Previa
const PreviewModal = ({ 
  isOpen, 
  onClose, 
  previewData 
}: {
  isOpen: boolean;
  onClose: () => void;
  previewData: ReportPreviewData | null;
}) => {
  const [activeTab, setActiveTab] = useState<string>('resumen');

  if (!isOpen || !previewData) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'percent',
      minimumFractionDigits: 2
    }).format(percent);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  const simplifyColumnName = (columnName: string): string => {
    const lowerColumn = columnName.toLowerCase();
    if (lowerColumn.includes('id') || lowerColumn.includes('ID')) {
      return 'ID';
    }
    return columnName;
  };

  // Componente de tabla con diseño consistente
  const ConsistentTable = ({ 
    headers, 
    rows, 
    footer,
    className = ""
  }: {
    headers: string[];
    rows: React.ReactNode[][];
    footer?: React.ReactNode;
    className?: string;
  }) => {
    return (
      <div className={`overflow-hidden rounded-lg border border-gray-300 ${className}`}>
        <table className="w-full bg-white text-sm">
          <thead className="bg-gray-100">
            <tr>
              {headers.map((header, index) => (
                <th 
                  key={index}
                  className={`px-4 py-2.5 text-left font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 ${
                    index < headers.length - 1 ? 'border-r border-gray-300' : ''
                  }`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row, rowIndex) => (
              <tr 
                key={rowIndex}
                className={`transition-colors duration-150 ${
                  rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                } hover:bg-gray-100`}
              >
                {row.map((cell, cellIndex) => (
                  <td 
                    key={cellIndex}
                    className={`px-4 py-2.5 text-sm text-gray-800 ${
                      cellIndex < headers.length - 1 ? 'border-r border-gray-300' : ''
                    } ${
                      typeof cell === 'string' && 
                      (cell.includes('$') || cell.includes('MXN'))
                        ? 'text-right font-medium'
                        : ''
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && (
            <tfoot className="bg-gray-200">
              <tr>{footer}</tr>
            </tfoot>
          )}
        </table>
      </div>
    );
  };

  const renderTabContent = () => {
    if (!previewData) return null;

    if (activeTab === 'resumen') {
      const summaryRows = previewData.categorias?.map((categoria) => [
        categoria.categoria,
        formatCurrency(categoria.total)
      ]) || [];

      const summaryFooter = (
        <>
          <td className="px-4 py-2.5 font-bold text-gray-700 border-r border-gray-300 text-left" colSpan={1}>
            TOTAL GENERAL DEL PROYECTO
          </td>
          <td className="px-4 py-2.5 font-bold text-gray-700 text-right">
            {formatCurrency(previewData.gastosTotales || 0)}
          </td>
        </>
      );

      return (
        <div className="space-y-4">
          <ConsistentTable
            headers={['Categoría', 'Total']}
            rows={summaryRows}
            footer={summaryFooter}
          />
        </div>
      );
    }

    const activeCategory = previewData.categorias?.find(cat => cat.categoria === activeTab);
    if (!activeCategory) return null;

    const simplifiedHeaders = activeCategory.columnas.map(col => simplifyColumnName(col));

    const categoryRows = activeCategory.detalles.map((detalle) => 
      activeCategory.columnas.map((columna) => {
        const value = detalle[columna];
        if (value === null || value === undefined) return '-';
        
        if ((columna.toLowerCase().includes('fecha') || 
             columna.toLowerCase().includes('primer') ||
             columna.toLowerCase().includes('descuento') ||
             columna.toLowerCase().includes('pestamos') ||
             columna.toLowerCase().includes('inicio') ||
             columna.toLowerCase().includes('término')) && value) {
          return formatDate(value);
        }
        
        if ((columna.toLowerCase().includes('total') || 
             columna.toLowerCase().includes('costo') ||
             columna.toLowerCase().includes('tarifa') ||
             columna.toLowerCase().includes('monto') ||
             columna.toLowerCase().includes('fee') ||
             columna.toLowerCase().includes('precio') ||
             columna.toLowerCase().includes('importe') ||
             columna.toLowerCase().includes('subtotal') ||
             columna.toLowerCase().includes('descuento') ||
             columna.toLowerCase().includes('litercost')) && 
            typeof value === 'number') {
          return formatCurrency(value);
        }
        
        if (typeof value === 'number') {
          return value.toLocaleString('es-MX');
        }
        
        return String(value);
      })
    );

    return (
      <div className="space-y-4">
        <ConsistentTable
          headers={simplifiedHeaders}
          rows={categoryRows}
        />
        
        <div className="bg-gray-200 rounded-lg border border-gray-300 p-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">
              Subtotal {activeCategory.categoria}
            </span>
            <span className="text-sm font-bold text-gray-700">
              {formatCurrency(activeCategory.total)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full animate-fade-in relative z-[10000] max-h-[90vh] overflow-hidden flex flex-col">
        
        <div className="p-4 border-b border-gray-300 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                VISTA PREVIA DEL REPORTE
              </h2>
              <p className="text-sm text-gray-600">
                {previewData.tipoReporte === 'rentabilidad' && 'Reporte de Rentabilidad'}
                {previewData.tipoReporte === 'utilidad' && 'Reporte de Utilidad por Proyecto'}
                {previewData.tipoReporte === 'resumen' && 'Resumen de Gastos por Proyecto'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {previewData.tipoReporte === 'resumen' && previewData.categorias && (
            <div className="space-y-4">
              <div className="border-b border-gray-300">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('resumen')}
                    className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm tracking-wide transition-all duration-200 ${
                      activeTab === 'resumen'
                        ? 'border-[#3a6ea5] text-[#3a6ea5]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Resumen General
                  </button>

                  {previewData.categorias.map((categoria) => (
                    <button
                      key={categoria.categoria}
                      onClick={() => setActiveTab(categoria.categoria)}
                      className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm tracking-wide transition-all duration-200 ${
                        activeTab === categoria.categoria
                          ? 'border-[#3a6ea5] text-[#3a6ea5]'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {categoria.categoria}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="min-h-[300px]">
                {renderTabContent()}
              </div>
            </div>
          )}

          {previewData.tipoReporte === 'utilidad' && (
            <div className="space-y-4">
              <ConsistentTable
                headers={['Concepto', 'Monto']}
                rows={[
                  ['Presupuesto', formatCurrency(previewData.presupuesto || 0)],
                  ['Gastos Totales', formatCurrency(previewData.gastosTotales || 0)],
                  [
                    'Utilidad', 
                    <span key="utilidad" className={`font-medium ${(previewData.utilidad || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(previewData.utilidad || 0)}
                    </span>
                  ],
                  [
                    'Porcentaje de Utilidad', 
                    <span key="porcentaje" className={`font-medium ${(previewData.porcentajeUtilidad || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(previewData.porcentajeUtilidad || 0)}
                    </span>
                  ]
                ]}
                footer={
                  <>
                    <td className="px-4 py-2.5 font-bold text-gray-700 border-r border-gray-300 text-left">
                      Resultado Final
                    </td>
                    <td className="px-4 py-2.5 font-bold text-gray-700 text-right">
                      <span className={(previewData.utilidad || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(previewData.utilidad || 0)}
                      </span>
                    </td>
                  </>
                }
              />
            </div>
          )}

          {previewData.tipoReporte === 'rentabilidad' && previewData.proyectosRentabilidad && (
            <div>
              <ConsistentTable
                headers={['Proyecto', 'Presupuesto', 'Gastos', 'Rentabilidad', '%']}
                rows={previewData.proyectosRentabilidad.map((proyecto) => [
                  proyecto.proyecto,
                  formatCurrency(proyecto.presupuesto),
                  formatCurrency(proyecto.gastos),
                  formatCurrency(proyecto.rentabilidad),
                  formatPercent(proyecto.porcentaje)
                ])}
              />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-300 bg-gray-50 flex-shrink-0">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors"
            >
              CERRAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente personalizado para el input de fecha
const CustomDateInput = React.forwardRef<HTMLInputElement, any>(({ value, onClick, placeholder }, ref) => (
  <div className="relative">
    <input
      type="text"
      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium cursor-pointer"
      value={value}
      onClick={onClick}
      ref={ref}
      readOnly
      placeholder={placeholder}
    />
    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2.25 2.25 0 002.25-2.25V7a2.25 2.25 0 00-2.25-2.25H5a2.25 2.25 0 00-2.25 2.25v12A2.25 2.25 0 005 21z" />
      </svg>
    </div>
  </div>
));

CustomDateInput.displayName = 'CustomDateInput';

export default function ReportsPage() {
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();
  const router = useRouter();
  
  const [userData, setUserData] = useState<UserData>({
    id: 0,
    usuario: '',
    tipoUsuario: '',
    nombre: '',
    apellido: '',
    email: '',
    proyectoAsignado: '',
    proyectoActivo: false,
    projectId: null
  });
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | ''>('');
  const [selectedReportType, setSelectedReportType] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ReportPreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [loading, setLoading] = useState(true);

  const reportTypes: ReportType[] = [
    { value: 'rentabilidad', label: 'Reporte de Rentabilidad' },
    { value: 'utilidad', label: 'Reporte de Utilidad por Proyecto' },
    { value: 'resumen', label: 'Resumen de Gastos por Proyecto' }
  ];

  // Función para obtener los datos del usuario desde la sesión usando validate-session
  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/auth/validate-session', {
        credentials: 'include'
      });

      if (!response.ok) {
        console.log('Sesión no válida, redirigiendo a login');
        router.replace('/');
        return;
      }

      const data = await response.json();

      // Validar que los datos del usuario existan
      if (!data?.valid || !data?.user) {
        console.log('Datos de sesión inválidos, redirigiendo a login');
        router.replace('/');
        return;
      }

      // Actualizar el estado con los datos del usuario
      setUserData({
        id: data.user.SystemUserID || 0,
        usuario: data.user.UserName || '',
        tipoUsuario: data.role?.toString() || '',
        nombre: data.user.UserName || '',
        apellido: '',
        email: '',
        proyectoAsignado: '',
        proyectoActivo: true,
        projectId: null
      });

    } catch (error) {
      console.error('Error al obtener datos de usuario:', error);
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch('/api/administrative-dashboard/payment-methods');
      if (response.ok) {
        const methods = await response.json();
        setPaymentMethods(methods);
      }
    } catch (error) {
      console.error('Error al obtener métodos de pago:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const projectsRes = await fetch('/api/administrative-dashboard/projects/with-users');
      if (!projectsRes.ok) throw new Error('Error al obtener proyectos');
      const projectsData = await projectsRes.json();
      setProjects(projectsData);
    } catch (err) {
      console.error('Error:', err);
      setError('Error al cargar los proyectos');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        await fetchUserData();
        await fetchPaymentMethods();
        await fetchProjects();
      } catch (err) {
        console.error('Error:', err);
        setError('Error al cargar los datos iniciales');
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const generatePreview = async () => {
    if (!selectedReportType) {
      setError('Por favor selecciona un tipo de reporte');
      return;
    }

    if (selectedReportType === 'rentabilidad' && (!startDate || !endDate)) {
      setError('Para el reporte de rentabilidad se requieren ambas fechas');
      return;
    }

    if ((selectedReportType === 'utilidad' || selectedReportType === 'resumen') && !selectedProject) {
      setError('Para este reporte se requiere seleccionar un proyecto');
      return;
    }

    try {
      setIsLoadingPreview(true);
      setError('');

      const requestBody: ReportRequestBody = { type: selectedReportType };
      
      if (selectedReportType === 'rentabilidad') {
        requestBody.startDate = startDate?.toISOString().split('T')[0] || '';
        requestBody.endDate = endDate?.toISOString().split('T')[0] || '';
      } else {
        requestBody.projectId = selectedProject;
        if (selectedReportType === 'resumen' && selectedPaymentMethod) {
          requestBody.paymentMethod = selectedPaymentMethod;
        }
      }

      const res = await fetch('/api/executive-manager/generate-report-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Error al generar la vista previa');
      }

      const previewData = await res.json();
      setPreviewData(previewData);
      setShowPreview(true);
    } catch (err: unknown) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Error al generar la vista previa');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const generateReport = async () => {
    if (!selectedReportType) {
      setError('Por favor selecciona un tipo de reporte');
      return;
    }

    if (selectedReportType === 'rentabilidad' && (!startDate || !endDate)) {
      setError('Para el reporte de rentabilidad se requieren ambas fechas');
      return;
    }

    if ((selectedReportType === 'utilidad' || selectedReportType === 'resumen') && !selectedProject) {
      setError('Para este reporte se requiere seleccionar un proyecto');
      return;
    }

    try {
      setIsGenerating(true);
      setError('');
      setSuccessMessage('');

      const requestBody: ReportRequestBody = { type: selectedReportType };
      
      if (selectedReportType === 'rentabilidad') {
        requestBody.startDate = startDate?.toISOString().split('T')[0] || '';
        requestBody.endDate = endDate?.toISOString().split('T')[0] || '';
      } else {
        requestBody.projectId = selectedProject;
        if (selectedReportType === 'resumen' && selectedPaymentMethod) {
          requestBody.paymentMethod = selectedPaymentMethod;
        }
      }

      const res = await fetch('/api/executive-manager/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Error al generar el reporte');
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('spreadsheet')) {
        throw new Error('Respuesta no es un archivo Excel válido');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const contentDisposition = res.headers.get('Content-Disposition');
      let fileName = 'reporte.xlsx';
      
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
        if (fileNameMatch?.[1]) {
          fileName = fileNameMatch[1];
        }
      }
      
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccessMessage('Reporte generado y descargado exitosamente');
      setShowPreview(false);
    } catch (err: unknown) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Error al generar el reporte');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReportTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedReportType(e.target.value);
    setError('');
    setSuccessMessage('');
    setShowPreview(false);
    setPreviewData(null);
    setSelectedPaymentMethod('');
  };

  const isGenerateDisabled = 
    !selectedReportType || 
    (selectedReportType === 'rentabilidad' && (!startDate || !endDate)) || 
    ((selectedReportType === 'utilidad' || selectedReportType === 'resumen') && !selectedProject);

  // Mostrar loading mientras se verifica la sesión
  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3a6ea5] mx-auto"></div>
          <p className="mt-4 text-gray-700 font-medium">Cargando panel de reportes...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario (sesión inválida), no renderizar nada
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <AppHeader title="PANEL ADMINISTRATIVO" />

      <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
        <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
          
          {/* Header del Panel */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5] w-full">
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center">
                  REPORTES Y ANÁLISIS
                </h1>
                <p className="text-sm text-gray-200 mt-1">
                  Selecciona el tipo de reporte y los parámetros requeridos para generar análisis detallados.
                </p>
              </div>
            </div>

            {/* Mensajes de Éxito/Error */}
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

            {/* Panel Principal de Reportes */}
            <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
              
              {/* Contenido del Formulario */}
              <div className="p-6">
                {selectedReportType === "rentabilidad" ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Tipo de Reporte */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        Tipo de Reporte
                      </label>
                      <div className="relative">
                        <select
                          value={selectedReportType}
                          onChange={handleReportTypeChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium appearance-none"
                        >
                          <option value="">Selecciona un tipo</option>
                          {reportTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Fecha de Inicio */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        Fecha de Inicio
                      </label>
                      <div className="relative">
                        <DatePicker
                          selected={startDate}
                          onChange={(date: Date | null) => setStartDate(date)}
                          selectsStart
                          startDate={startDate || undefined}
                          endDate={endDate || undefined}
                          customInput={<CustomDateInput />}
                          placeholderText="Selecciona fecha inicio"
                          dateFormat="dd/MM/yyyy"
                          isClearable
                          clearButtonTitle="Limpiar"
                          className="react-datepicker-custom"
                          popperPlacement="bottom-start"
                          popperProps={{
                            strategy: "fixed"
                          }}
                          wrapperClassName="w-full"
                        />
                      </div>
                    </div>

                    {/* Fecha de Fin */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        Fecha de Fin
                      </label>
                      <div className="relative">
                        <DatePicker
                          selected={endDate}
                          onChange={(date: Date | null) => setEndDate(date)}
                          selectsEnd
                          startDate={startDate || undefined}
                          endDate={endDate || undefined}
                          minDate={startDate || undefined}
                          customInput={<CustomDateInput />}
                          placeholderText="Selecciona fecha fin"
                          dateFormat="dd/MM/yyyy"
                          isClearable
                          clearButtonTitle="Limpiar"
                          className="react-datepicker-custom"
                          popperPlacement="bottom-start"
                          popperProps={{
                            strategy: "fixed"
                          }}
                          wrapperClassName="w-full"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Tipo de Reporte */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        Tipo de Reporte
                      </label>
                      <div className="relative">
                        <select
                          value={selectedReportType}
                          onChange={handleReportTypeChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium appearance-none"
                        >
                          <option value="">Selecciona un tipo</option>
                          {reportTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Proyecto */}
                    {(selectedReportType === "utilidad" || selectedReportType === "resumen") && (
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          Proyecto
                        </label>
                        <div className="relative">
                          <select
                            value={selectedProject}
                            onChange={(e) => {
                              setSelectedProject(e.target.value ? Number(e.target.value) : "");
                              setShowPreview(false);
                              setPreviewData(null);
                            }}
                            className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium appearance-none"
                          >
                            <option value="">Selecciona un proyecto</option>
                            {projects.map((project) => (
                              <option key={project.ProjectID} value={project.ProjectID}>
                                {project.NameProject}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Filtro de Método de Pago (solo para reporte de resumen) */}
                {selectedReportType === "resumen" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        Método de Pago (Filtro Opcional)
                      </label>
                      <div className="relative">
                        <select
                          value={selectedPaymentMethod}
                          onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium appearance-none"
                        >
                          <option value="">Todos los métodos de pago</option>
                          {paymentMethods.map((method) => (
                            <option key={method.id} value={method.id}>
                              {method.name}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    {selectedPaymentMethod && (
                      <div className="flex items-end">
                        <button
                          onClick={() => setSelectedPaymentMethod('')}
                          className="px-6 py-2.5 bg-gray-200 text-black font-bold rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          LIMPIAR FILTRO
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Botones de Acción */}
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <button
                    onClick={generatePreview}
                    disabled={isLoadingPreview || isGenerateDisabled}
                    className={`px-6 py-2.5 text-white font-bold rounded-lg transition-colors flex items-center justify-center whitespace-nowrap ${
                      isLoadingPreview || isGenerateDisabled
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-[#3a6ea5] hover:bg-[#2d5592]"
                    }`}
                  >
                    {isLoadingPreview ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        CARGANDO...
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        VISTA PREVIA
                      </>
                    )}
                  </button>

                  <button
                    onClick={generateReport}
                    disabled={isGenerating || isGenerateDisabled}
                    className={`px-6 py-2.5 text-white font-bold rounded-lg transition-colors flex items-center justify-center whitespace-nowrap ${
                      isGenerating || isGenerateDisabled
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-[#3a6ea5] hover:bg-[#2d5592]"
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        GENERANDO...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        DESCARGAR REPORTE
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Modal de Vista Previa */}
      <PreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        previewData={previewData}
      />

      {/* Modal de mensajes */}
      {error && (
        <Modal
          isOpen={!!error}
          onClose={() => setError('')}
          title="Error"
          message={error}
          type="error"
        />
      )}

      {successMessage && (
        <Modal
          isOpen={!!successMessage}
          onClose={() => setSuccessMessage('')}
          title="Éxito"
          message={successMessage}
          type="success"
        />
      )}

      {/* Estilos globales consistentes */}
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

        .react-datepicker-wrapper {
          width: 100%;
          position: relative;
        }
        
        .react-datepicker__input-container input {
          cursor: pointer !important;
        }
        
        .react-datepicker__close-icon {
          position: absolute !important;
          right: 30px !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
          width: 16px !important;
          height: 16px !important;
          z-index: 20 !important;
        }
        
        .react-datepicker__close-icon::after {
          background-color: #3a6ea5 !important;
          color: white !important;
          border-radius: 50% !important;
          width: 16px !important;
          height: 16px !important;
          font-size: 12px !important;
          line-height: 16px !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        
        .react-datepicker__triangle {
          display: none !important;
        }
        
        .react-datepicker {
          position: fixed !important;
          top: auto !important;
          bottom: 0 !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          z-index: 9999 !important;
          border: 1px solid #d1d5db !important;
          border-radius: 0.5rem !important;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15) !important;
        }
        
        .react-datepicker-popper {
          z-index: 9999 !important;
        }
        
        .react-datepicker__header {
          background-color: #f9fafb !important;
          border-bottom: 1px solid #d1d5db !important;
        }
        
        .react-datepicker__current-month {
          color: #374151 !important;
          font-weight: 700 !important;
        }
        
        .react-datepicker__day--selected {
          background-color: #3a6ea5 !important;
          color: white !important;
        }
        
        .react-datepicker__day--keyboard-selected {
          background-color: #e5e7eb !important;
          color: #374151 !important;
        }
        
        .react-datepicker__day:hover {
          background-color: #e5e7eb !important;
        }
        
        @media (min-width: 768px) {
          .react-datepicker {
            position: absolute !important;
            top: 100% !important;
            bottom: auto !important;
            left: 0 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
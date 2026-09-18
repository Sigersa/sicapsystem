'use client';

import AppHeader from '@/components/header/3/3.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/3';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { useState, useEffect, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  FileText, 
  X, 
  AlertCircle, 
  CheckCircle, 
  Eye,
  Download,
  Filter,
  RefreshCw
} from 'lucide-react';

// ============ INTERFACES ============

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

interface ReportPreviewData {
  tipoReporte: string;
  proyecto?: string;
  presupuesto?: number;
  gastosTotales?: number;
  utilidad?: number;
  porcentajeUtilidad?: number;
  categorias?: CategoryDetail[];
  metodoPagoFiltro?: string;
}

interface CategoryDetail {
  categoria: string;
  total: number;
  detalles: any[];
  columnas: string[];
}

// ✅ CORREGIDO: Estructura correcta según el módulo de proyectos
interface PaymentMethod {
  methodId: number;
  methodName: string;
}

interface PageProps {
  params: Promise<{
    projectId: string;
  }>;
}

// ============ FUNCIONES AUXILIARES ============

const normalizarMayusculas = (texto: string): string => {
  return texto.toUpperCase();
};

// ============ COMPONENTES DE MODALES ============

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, message, type = 'info' }) => {
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

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-100';
      case 'error':
        return 'bg-red-100';
      default:
        return 'bg-blue-100';
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-in relative z-[10000]">
        <div className="p-6">
          <div className="flex items-center space-x-3">
            <div className={`flex items-center justify-center w-10 h-10 ${getBgColor()} rounded-full`}>
              {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h3>
              <div className="mt-1">
                <p className="text-sm text-gray-600 leading-5">{message}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-gray-500 transition-colors duration-200 bg-gray-100 hover:bg-gray-200 rounded-full p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors"
            >
              ACEPTAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ MODAL DE VISTA PREVIA ============

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: ReportPreviewData | null;
}

const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose, previewData }) => {
  const [activeTab, setActiveTab] = useState<string>('resumen');

  if (!isOpen || !previewData) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatColumnName = (columnName: string): string => {
    if (columnName.toLowerCase().endsWith('id') && columnName !== 'ProjectID' && columnName !== 'MethodID') {
      return 'ID';
    }
    
    const headerMap: Record<string, string> = {
      'NombreProyecto': 'PROYECTO',
      'MetodoPago': 'MÉTODO DE PAGO',
      'NombreUsuario': 'USUARIO',
      'Date': 'FECHA',
      'Concept': 'CONCEPTO',
      'Total': 'TOTAL',
      'Observations': 'OBSERVACIONES',
      'PlaceAccommodation': 'LUGAR DE ALOJAMIENTO',
      'CheckInDate': 'FECHA DE INICIO',
      'CheckOutDate': 'FECHA DE TÉRMINO',
      'Fee': 'TARIFA',
      'Nights': 'NOCHES',
      'Archivos': 'ARCHIVOS ADJUNTOS',
      'ProjectID': 'ID PROYECTO',
      'MethodID': 'ID MÉTODO PAGO'
    };
    
    return headerMap[columnName] || columnName.toUpperCase();
  };

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
    const formattedHeaders = headers.map(header => formatColumnName(header));

    return (
      <div className={`overflow-hidden rounded-lg border border-gray-300 shadow-sm ${className}`}>
        <table className="w-full bg-white text-xs">
          <thead className="bg-[#3a6ea5]">
            <tr>
              {formattedHeaders.map((header, index) => (
                <th 
                  key={index}
                  className={`px-3 py-2 text-center font-bold text-white uppercase tracking-wider ${
                    index < formattedHeaders.length - 1 ? 'border-r border-gray-400' : ''
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
                    className={`px-3 py-2 ${
                      cellIndex < formattedHeaders.length - 1 ? 'border-r border-gray-300' : ''
                    } ${
                      typeof cell === 'string' && 
                      (cell.includes('$') || cell.includes('MXN'))
                        ? 'text-right font-medium text-gray-900'
                        : 'text-gray-700'
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
        categoria.categoria.toUpperCase(),
        formatCurrency(categoria.total)
      ]) || [];

      const summaryFooter = (
        <>
          <td className="px-3 py-2 font-bold text-gray-600 uppercase tracking-wide border-r border-gray-300 text-center" colSpan={1}>
            TOTAL GENERAL DEL PROYECTO
          </td>
          <td className="px-3 py-2 font-bold text-gray-600 text-right">
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

    const categoryRows = activeCategory.detalles.map((detalle) => 
      activeCategory.columnas.map((columna) => {
        const value = detalle[columna];
        if (value === null || value === undefined) return '-';
        
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
        
        return String(value).toUpperCase();
      })
    );

    return (
      <div className="space-y-4">
        <ConsistentTable
          headers={activeCategory.columnas}
          rows={categoryRows}
        />
        
        <div className="bg-gray-200 rounded-lg border border-gray-300 p-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
              SUBTOTAL {activeCategory.categoria.toUpperCase()}
            </span>
            <span className="text-xs font-bold text-gray-600">
              {formatCurrency(activeCategory.total)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col animate-fade-in relative z-[10000]">
        
        <div className="p-6 pb-4 border-b border-gray-300 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
              <Eye className="h-5 w-5 text-[#3a6ea5] mr-2" />
              VISTA PREVIA DEL REPORTE
            </h2>
            <p className="text-gray-600 mt-1 text-sm">Revise los datos antes de descargar el reporte.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="mb-6 p-4 bg-white rounded-lg border border-gray-300 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
              INFORMACIÓN DEL PROYECTO
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600 font-medium">Proyecto:</span>
                <p className="font-bold text-gray-800">{previewData.proyecto?.toUpperCase() || 'NO ESPECIFICADO'}</p>
              </div>
              <div>
                <span className="text-gray-600 font-medium">Presupuesto:</span>
                <p className="font-bold text-gray-800">{formatCurrency(previewData.presupuesto || 0)}</p>
              </div>
              <div>
                <span className="text-gray-600 font-medium">Gastos Totales:</span>
                <p className="font-bold text-gray-800">{formatCurrency(previewData.gastosTotales || 0)}</p>
              </div>
            </div>
          </div>

          {previewData.categorias && (
            <div className="space-y-4">
              <div className="border-b border-gray-300 bg-white rounded-t-lg">
                <nav className="-mb-px flex space-x-6 overflow-x-auto px-4">
                  <button
                    onClick={() => setActiveTab('resumen')}
                    className={`whitespace-nowrap py-3 px-1 border-b-2 font-bold text-sm tracking-wide transition-all duration-200 ${
                      activeTab === 'resumen'
                        ? 'border-[#3a6ea5] text-[#3a6ea5]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    RESUMEN GENERAL
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
                      {categoria.categoria.toUpperCase()}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="min-h-[300px] bg-white rounded-b-lg p-4">
                {renderTabContent()}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-300 bg-gray-50 flex-shrink-0">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-200 text-black font-bold rounded-lg hover:bg-gray-300 transition-colors"
            >
              CERRAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ COMPONENTE PRINCIPAL ============

export default function ReportsPage({ params }: PageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get('projectId');
  
  const { projectId: paramProjectId } = use(params);
  
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [currentProject, setCurrentProject] = useState<{projectName: string} | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ReportPreviewData | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
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

  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'info'
  });

  const projectId = urlProjectId || paramProjectId;

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setModal({ isOpen: true, title, message, type });
    if (type === 'success') {
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(''), 3000);
    } else if (type === 'error') {
      setError(message);
    }
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
    setError('');
  };

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const response = await fetch('/api/project-manager/projects/payment-methods');
      if (response.ok) {
        const methods = await response.json();
        // ✅ Validación defensiva por si la API cambia
        const normalizedMethods: PaymentMethod[] = Array.isArray(methods)
          ? methods.map((m: any) => ({
              methodId: m.methodId ?? m.id ?? 0,
              methodName: m.methodName ?? m.name ?? ''
            }))
          : [];
        setPaymentMethods(normalizedMethods);
      }
    } catch (error) {
      console.error('Error al obtener métodos de pago:', error);
    }
  }, []);

  const fetchCurrentProject = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/project-manager/projects/get-project-name?projectId=${projectId}`);
      if (response.ok) {
        const projectData = await response.json();
        setCurrentProject(projectData);
      }
    } catch (error) {
      console.error('Error al obtener proyecto:', error);
    }
  }, []);

  const fetchUserData = useCallback(async () => {
    try {
      const response = await fetch('/api/project-manager/auth/sessions');
      if (response.ok) {
        const userData = await response.json();
        setUserData(userData);

        if (projectId) {
          await fetchCurrentProject(projectId);
          await fetchPaymentMethods();
        }
      } else {
        console.error('Error al obtener datos de usuario');
        router.push('/');
      }
    } catch (error) {
      console.error('Error al obtener datos de usuario:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [router, fetchCurrentProject, fetchPaymentMethods, projectId]);

  useEffect(() => {
    if (user && projectId) {
      fetchUserData();
    }
  }, [user, projectId, fetchUserData]);

  const generatePreview = async () => {
    if (!projectId) {
      showModal('Error', 'No se ha especificado un proyecto', 'error');
      return;
    }

    setIsLoadingPreview(true);
    try {
      const url = selectedPaymentMethod 
        ? `/api/project-manager/projects/reports-preview?projectId=${projectId}&paymentMethod=${selectedPaymentMethod}`
        : `/api/project-manager/projects/reports-preview?projectId=${projectId}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Error al generar vista previa');

      const data = await res.json();
      setPreviewData(data);
      setShowPreview(true);
      setError('');
    } catch (err) {
      console.error('Error:', err);
      showModal('Error', 'Error al generar la vista previa', 'error');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const generateReport = async () => {
    if (!projectId) {
      showModal('Error', 'No se ha especificado un proyecto', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const url = selectedPaymentMethod 
        ? `/api/project-manager/projects/reports?projectId=${projectId}&paymentMethod=${selectedPaymentMethod}`
        : `/api/project-manager/projects/reports?projectId=${projectId}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Error al generar reporte');

      const blob = await res.blob();
      const urlObject = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      const projectName = currentProject?.projectName || userData.proyectoAsignado || 'proyecto';
      const safeProjectName = projectName.replace(/\s+/g, '_').toLowerCase();
      
      let fileName = safeProjectName !== 'ningún_proyecto_asignado'
        ? `reporte_gastos_${safeProjectName}`
        : 'reporte_gastos';

      if (selectedPaymentMethod) {
        const selectedMethod = paymentMethods.find(
          method => method.methodId.toString() === selectedPaymentMethod
        );
        const methodName = selectedMethod?.methodName?.replace(/\s+/g, '_').toLowerCase() || selectedPaymentMethod;
        fileName += `_${methodName}`;
      }
      
      a.href = urlObject;
      a.download = `${fileName}.xlsx`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(urlObject);
      
      showModal('Éxito', 'REPORTE GENERADO Y DESCARGADO EXITOSAMENTE', 'success');
    } catch (err) {
      console.error('Error:', err);
      showModal('Error', 'Error al generar el reporte', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const displayProjectName = currentProject?.projectName || userData.proyectoAsignado;

  if (sessionLoading || loading) {
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
      <AppHeader title="REPORTES DE GASTOS" />

      <PreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        previewData={previewData}
      />

      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
        <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
          
          <div className="mb-6">
            <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5]">
              <h1 className="text-xl font-bold text-white tracking-tight">
                REPORTES DE GASTOS
              </h1>
              <p className="text-sm text-gray-200 mt-1">
                Genere un reporte en Excel con todos los gastos registrados del proyecto actual.
              </p>
              {projectId && (
                <p className="text-xs text-gray-300 mt-1">
                  Proyecto ID: {projectId}
                </p>
              )}
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

          <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
            
            <div className="p-6 border-b border-gray-300 bg-gray-50">
              <div className="flex items-center">
                <FileText className="h-6 w-6 text-[#3a6ea5] mr-3" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                    GENERAR REPORTE
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Seleccione los filtros y genere su reporte
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {displayProjectName && displayProjectName !== "Ningún proyecto asignado" && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-300">
                  <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase border-b border-gray-200 pb-2">
                    INFORMACIÓN DEL PROYECTO
                  </h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{displayProjectName.toUpperCase()}</p>
                      {projectId && (
                        <p className="text-xs text-gray-500 mt-1">
                          ID: {projectId}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2 flex items-center">
                  <Filter className="h-4 w-4 mr-2" />
                  FILTROS
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="metodoPago" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      Método de Pago (Opcional)
                    </label>
                    <select
                      id="metodoPago"
                      value={selectedPaymentMethod}
                      onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    >
                      <option value="">TODOS LOS MÉTODOS DE PAGO</option>
                      {paymentMethods.map((method) => (
                        <option key={method.methodId} value={method.methodId.toString()}>
                          {method.methodName ? method.methodName.toUpperCase() : `MÉTODO ${method.methodId}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedPaymentMethod && (
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethod('')}
                        className="px-4 py-2.5 bg-gray-200 text-black font-bold rounded-lg hover:bg-gray-300 transition-colors flex items-center"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        LIMPIAR FILTRO
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button
                  onClick={generatePreview}
                  disabled={isLoadingPreview || !projectId}
                  className={`px-6 py-2.5 rounded-lg font-bold transition-colors flex items-center justify-center min-w-[180px] ${
                    isLoadingPreview || !projectId
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-gray-200 text-black hover:bg-gray-300"
                  }`}
                >
                  {isLoadingPreview ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
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
                  disabled={isGenerating || !projectId}
                  className={`px-6 py-2.5 rounded-lg font-bold transition-colors flex items-center justify-center min-w-[180px] ${
                    isGenerating || !projectId
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-[#3a6ea5] text-white hover:bg-[#2d5592]"
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
      `}</style>
    </div>
  );
}
'use client';

import AppHeader from '@/components/header/3/3.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/3';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { useUploadThing } from '@/lib/uploadthing';
import { useState, useRef, useEffect, useCallback, ChangeEvent, FormEvent, use } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Edit, 
  Trash2, 
  X, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Upload
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

interface LoanData {
  date: Date | null;
  beneficiary: string;
  methodId: string;
  total: number;
  formattedTotal?: string;
  firstDiscount: Date | null;
  numberOfPayments: number | null;
  observations: string;
  archivos: File[];
}

interface LoanRecord {
  id: number;
  beneficiary: string;
  methodId: string;
  date: string;
  total: number;
  formattedTotal?: string;
  firstDiscount: string;
  numberOfPayments: number | null;
  observations: string;
  status: number;
  archivos: ArchivoAdjunto[];
}

interface ArchivoAdjunto {
  nombre: string;
  url: string;
  tipo: string;
  key: string;
}

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

const formatCurrency = (value: string): string => {
  const num = value.replace(/[^0-9.]/g, '');
  if (!num) return '';
  
  const parts = num.split('.');
  if (parts.length > 2) {
    return `${parts[0]}.${parts[1]}`;
  }
  
  const numParts = num.split('.');
  const integerPart = numParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return numParts.length > 1 ? `${integerPart}.${numParts[1]}` : integerPart;
};

const parseCurrency = (value: string): number => {
  return parseFloat(value.replace(/,/g, '')) || 0;
};

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

const formatCurrencyNumber = (amount: number): string => {
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

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  registro: LoanRecord | null;
  isDeleting: boolean;
}

const DeleteModal: React.FC<DeleteModalProps> = ({ isOpen, onClose, onConfirm, registro, isDeleting }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-in relative z-[10000]">
        <div className="p-6 pb-4 border-b border-gray-300">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            CONFIRMAR ELIMINACIÓN
          </h2>
          <p className="text-sm text-gray-600 mt-2 leading-5">
            ¿Está seguro que desea eliminar el préstamo a <span className="font-bold">{registro?.beneficiary}</span>?
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Esta acción no se puede deshacer.
          </p>
        </div>
        <div className="p-6 pt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center min-w-[100px] disabled:opacity-50"
          >
            {isDeleting ? (
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
  );
};

// ============ COMPONENTE DE ICONO DE ARCHIVO ============

function FileIcon({ type, size = 5 }: { type: string; size?: number }) {
  const iconClass = `h-${size} w-${size}`;

  if (type?.startsWith('image/')) {
    return <ImageIcon className={`${iconClass} text-blue-500`} />;
  } else if (type === 'application/pdf') {
    return <FileText className={`${iconClass} text-red-500`} />;
  } else if (type?.includes('excel') || type?.includes('spreadsheet')) {
    return <FileSpreadsheet className={`${iconClass} text-green-500`} />;
  } else {
    return <FileText className={`${iconClass} text-gray-500`} />;
  }
}

// ============ MODAL DE EDICIÓN ============

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  registro: LoanRecord | null;
  onSave: (data: LoanRecord) => void;
  paymentMethods: PaymentMethod[];
  isSaving: boolean;
}

const EditModal: React.FC<EditModalProps> = ({ 
  isOpen, 
  onClose, 
  registro, 
  onSave, 
  paymentMethods,
  isSaving 
}) => {
  const [editData, setEditData] = useState<LoanRecord | null>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [filesToDelete, setFilesToDelete] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'info'
  });

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  const { startUpload } = useUploadThing('loanFiles', {
    onClientUploadComplete: (files) => {
      console.log("Archivos subidos:", files);
    },
    onUploadError: (error) => {
      setModal({
        isOpen: true,
        title: 'Error al subir archivos',
        message: error.message,
        type: 'error'
      });
    }
  });

  const validateFiles = (files: File[]): { valid: boolean; message: string } => {
    const MAX_FILE_SIZE = 4 * 1024 * 1024;
    const MAX_FILE_COUNT = 3;
    const ALLOWED_TYPES = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (files.length > MAX_FILE_COUNT) {
      return { valid: false, message: `No puedes subir más de ${MAX_FILE_COUNT} archivos a la vez.` };
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return { valid: false, message: `Tipo de archivo no permitido: ${file.name}. Solo se permiten PDF, imágenes (JPG/PNG) y archivos de Excel.` };
      }
      if (file.size > MAX_FILE_SIZE) {
        return { valid: false, message: `El archivo ${file.name} excede el tamaño máximo de 4MB.` };
      }
    }

    return { valid: true, message: '' };
  };

  useEffect(() => {
    if (registro) {
      setEditData({
        ...registro,
        observations: registro.observations || '',
        formattedTotal: registro.total !== 0 ? 
          registro.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
        numberOfPayments: registro.numberOfPayments || null
      });
      setArchivos([]);
      setFilesToDelete([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; 
      }
    }
  }, [registro]);

  const handleClose = () => {
    setArchivos([]); 
    setFilesToDelete([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; 
    }
    onClose(); 
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!editData) return;
    
    const { name, value } = e.target;
    
    if (name === 'total') {
      const formattedValue = formatCurrency(value);
      setEditData({
        ...editData,
        [name]: parseCurrency(formattedValue),
        formattedTotal: formattedValue
      });
    } else if (name === 'numberOfPayments') {
      setEditData({
        ...editData,
        [name]: value === '' ? null : parseInt(value)
      });
    } else if (name === 'beneficiary' || name === 'observations') {
      setEditData({
        ...editData,
        [name]: normalizarMayusculas(value || '')
      });
    } else {
      setEditData({
        ...editData,
        [name]: value || ''
      });
    }
  };

  const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!editData) return;
    setEditData({
      ...editData,
      date: e.target.value
    });
  };

  const handleFirstDiscountChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!editData) return;
    setEditData({
      ...editData,
      firstDiscount: e.target.value
    });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      
      const totalFiles = (editData?.archivos?.length || 0) + archivos.length + filesArray.length;
      if (totalFiles > 3) {
        setModal({
          isOpen: true,
          title: 'Error en archivos',
          message: 'No puedes tener más de 3 archivos en total (incluyendo los existentes).',
          type: 'error'
        });
        return;
      }

      const validation = validateFiles(filesArray);
      if (!validation.valid) {
        setModal({
          isOpen: true,
          title: 'Error en archivos',
          message: validation.message,
          type: 'error'
        });
        return;
      }

      setArchivos(prev => [...prev, ...filesArray]);
    }
  };

  const removeFile = (index: number) => {
    setArchivos(prev => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const formatDateForInput = (dateString: string): string => {
    if (!dateString) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (e) {
      console.error('Error formatting date:', e);
      return '';
    }
  };

  const removeExistingFile = async (index: number) => {
    if (!editData) return;
    
    const fileToRemove = editData.archivos[index];
    
    if (!fileToRemove.key) {
      console.error('No se pudo encontrar la key del archivo');
      return;
    }

    setFilesToDelete(prev => [...prev, fileToRemove.key]);

    const newArchivos = [...editData.archivos];
    newArchivos.splice(index, 1);
    
    setEditData({
      ...editData,
      archivos: newArchivos
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editData) return;

    try {
      let nuevosArchivos: ArchivoAdjunto[] = [];
      if (archivos.length > 0) {
        const validation = validateFiles(archivos);
        if (!validation.valid) {
          setModal({
            isOpen: true,
            title: 'Error en archivos',
            message: validation.message,
            type: 'error'
          });
          return;
        }

        const response = await startUpload(archivos);
        if (response) {
          nuevosArchivos = response.map(file => ({
            nombre: file.name,
            url: file.ufsUrl || file.url,
            tipo: file.type,
            key: file.key
          }));
        }
      }

      if (filesToDelete.length > 0) {
        try {
          await fetch('/api/uploadthing', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileKeys: filesToDelete })
          });
        } catch (error) {
          console.error('Error al eliminar archivos antiguos:', error);
        }
      }

      await onSave({
        ...editData,
        archivos: [...(editData.archivos || []), ...nuevosArchivos]
      });
    } catch (error) {
      console.error('Error al guardar:', error);
    }
  };

  if (!isOpen || !editData) return null;

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70">
        <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto animate-fade-in relative z-[10000]">
          <div className="p-6 pb-4 border-b border-gray-300 flex items-center justify-between sticky top-0 bg-white z-10">
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">EDITAR PRÉSTAMO</h2>
              <p className="text-gray-600 mt-1 text-sm">Modifique la información del préstamo.</p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-6">
              {/* Información principal */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                  INFORMACIÓN DEL PRÉSTAMO
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      FECHA DE SOLICITUD *
                    </label>
                    <input
                      type="date"
                      name="date"
                      value={formatDateForInput(editData.date)}
                      onChange={handleDateChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      BENEFICIARIO *
                    </label>
                    <input
                      type="text"
                      name="beneficiary"
                      value={editData.beneficiary}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      PROCEDENCIA DEL MONTO *
                    </label>
                    <select
                      name="methodId"
                      value={editData.methodId}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                    >
                      <option value="">SELECCIONA UNA PROCEDENCIA</option>
                      {paymentMethods.map(method => (
                        <option key={method.methodId} value={method.methodId.toString()}>
                          {method.methodName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Detalles del préstamo */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                  DETALLES DEL PRÉSTAMO
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      TOTAL ($) *
                    </label>
                    <input
                      type="text"
                      name="total"
                      value={editData.formattedTotal || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      FECHA PRIMER DESCUENTO *
                    </label>
                    <input
                      type="date"
                      name="firstDiscount"
                      value={formatDateForInput(editData.firstDiscount)}
                      onChange={handleFirstDiscountChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      NÚMERO DE PAGOS *
                    </label>
                    <input
                      type="number"
                      name="numberOfPayments"
                      value={editData.numberOfPayments || ''}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Archivos */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                  ARCHIVOS
                </h3>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    AGREGAR ARCHIVOS
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx"
                      multiple
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#3a6ea5] transition-colors flex items-center justify-center text-gray-500 hover:text-[#3a6ea5] text-sm"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      SELECCIONAR ARCHIVOS
                    </button>
                  </div>

                  {archivos.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {archivos.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                          <div className="flex items-center truncate">
                            <FileIcon type={file.type} size={5} />
                            <span className="ml-3 text-sm truncate font-medium text-gray-700">{file.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {editData.archivos && editData.archivos.length > 0 && (
                  <div className="mt-4">
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      ARCHIVOS ADJUNTOS
                    </label>
                    <div className="space-y-2">
                      {editData.archivos.map((archivo, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                          <div className="flex items-center">
                            <FileIcon type={archivo.tipo} size={5} />
                            <a 
                              href={archivo.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="ml-3 text-sm text-[#3a6ea5] hover:underline truncate max-w-xs font-medium"
                            >
                              {archivo.nombre}
                            </a>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeExistingFile(index)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Observaciones */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                  OBSERVACIONES
                </h3>
                <textarea
                  name="observations"
                  value={editData.observations}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium resize-none"
                  placeholder="INGRESE LAS OBSERVACIONES"
                />
              </div>
            </div>

            {/* Botones */}
            <div className="mt-6 pt-4 border-t border-gray-300 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSaving}
                className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                CANCELAR
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center min-w-[120px] disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    GUARDANDO...
                  </>
                ) : (
                  'GUARDAR CAMBIOS'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <Modal 
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </>
  );
};

// ============ MODAL DE AGREGAR PRÉSTAMO ============

interface AddLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: LoanData) => void;
  isSubmitting: boolean;
  paymentMethods: PaymentMethod[];
}

const AddLoanModal: React.FC<AddLoanModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  isSubmitting, 
  paymentMethods 
}) => {
  const [loanData, setLoanData] = useState<LoanData>({
    date: null,
    beneficiary: '',
    methodId: '',
    total: 0,
    formattedTotal: '',
    firstDiscount: null,
    observations: '',
    numberOfPayments: null,
    archivos: []
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'info'
  });

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  const { startUpload } = useUploadThing('loanFiles', {
    onClientUploadComplete: (files) => {
      console.log("Archivos subidos:", files);
    },
    onUploadError: (error) => {
      setModal({
        isOpen: true,
        title: 'Error al subir archivos',
        message: error.message,
        type: 'error'
      });
    }
  });

  const validateFiles = (files: File[]): { valid: boolean; message: string } => {
    const MAX_FILE_SIZE = 4 * 1024 * 1024;
    const MAX_FILE_COUNT = 3;
    const ALLOWED_TYPES = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (files.length > MAX_FILE_COUNT) {
      return { valid: false, message: `No puedes subir más de ${MAX_FILE_COUNT} archivos a la vez.` };
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return { valid: false, message: `Tipo de archivo no permitido: ${file.name}. Solo se permiten PDF, imágenes (JPG/PNG) y archivos de Excel.` };
      }
      if (file.size > MAX_FILE_SIZE) {
        return { valid: false, message: `El archivo ${file.name} excede el tamaño máximo de 4MB.` };
      }
    }

    return { valid: true, message: '' };
  };

  const handleClose = () => {
    setLoanData({
      date: null,
      beneficiary: '',
      methodId: paymentMethods.length > 0 ? paymentMethods[0].methodId.toString() : '',
      total: 0,
      formattedTotal: '',
      firstDiscount: null,
      observations: '',
      numberOfPayments: null,
      archivos: []
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'total') {
      const formattedValue = formatCurrency(value);
      setLoanData(prev => ({
        ...prev,
        [name]: parseCurrency(formattedValue),
        formattedTotal: formattedValue
      }));
    } else if (name === 'numberOfPayments') {
      setLoanData(prev => ({
        ...prev,
        [name]: value === '' ? null : parseInt(value)
      }));
    } else if (name === 'beneficiary' || name === 'observations') {
      setLoanData(prev => ({
        ...prev,
        [name]: normalizarMayusculas(value || '')
      }));
    } else {
      setLoanData(prev => ({
        ...prev,
        [name]: value || ''
      }));
    }
  };

  const handleDateChange = (date: Date | null, field: 'date' | 'firstDiscount') => {
    setLoanData(prev => ({
      ...prev,
      [field]: date
    }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      
      const totalFiles = loanData.archivos.length + filesArray.length;
      if (totalFiles > 3) {
        setModal({
          isOpen: true,
          title: 'Error en archivos',
          message: 'No puedes subir más de 3 archivos en total.',
          type: 'error'
        });
        return;
      }

      const validation = validateFiles(filesArray);
      if (!validation.valid) {
        setModal({
          isOpen: true,
          title: 'Error en archivos',
          message: validation.message,
          type: 'error'
        });
        return;
      }

      setLoanData(prev => ({
        ...prev,
        archivos: [...prev.archivos, ...filesArray]
      }));
    }
  };

  const removeFile = (index: number) => {
    setLoanData(prev => {
      const newFiles = [...prev.archivos];
      newFiles.splice(index, 1);
      return { ...prev, archivos: newFiles };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSave(loanData);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70">
        <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto animate-fade-in relative z-[10000]">
          <div className="p-6 pb-4 border-b border-gray-300 flex items-center justify-between sticky top-0 bg-white z-10">
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">NUEVO PRÉSTAMO</h2>
              <p className="text-gray-600 mt-1 text-sm">Complete la información del préstamo.</p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-6">
              {/* Información principal */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                  INFORMACIÓN DEL PRÉSTAMO
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      FECHA DE SOLICITUD *
                    </label>
                    <input
                      type="date"
                      name="date"
                      value={loanData.date ? loanData.date.toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : null;
                        handleDateChange(date, 'date');
                      }}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      BENEFICIARIO *
                    </label>
                    <input
                      type="text"
                      name="beneficiary"
                      value={loanData.beneficiary}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      PROCEDENCIA DEL MONTO *
                    </label>
                    <select
                      name="methodId"
                      value={loanData.methodId}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                    >
                      <option value="">SELECCIONA UNA PROCEDENCIA</option>
                      {paymentMethods.map(method => (
                        <option key={method.methodId} value={method.methodId.toString()}>
                          {method.methodName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Detalles del préstamo */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                  DETALLES DEL PRÉSTAMO
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      TOTAL ($) *
                    </label>
                    <input
                      type="text"
                      name="total"
                      value={loanData.formattedTotal || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      FECHA PRIMER DESCUENTO *
                    </label>
                    <input
                      type="date"
                      name="firstDiscount"
                      value={loanData.firstDiscount ? loanData.firstDiscount.toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : null;
                        handleDateChange(date, 'firstDiscount');
                      }}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      NÚMERO DE PAGOS *
                    </label>
                    <input
                      type="number"
                      name="numberOfPayments"
                      value={loanData.numberOfPayments || ''}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Archivos */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                  ARCHIVOS ADJUNTOS
                </h3>
                
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx"
                    multiple
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#3a6ea5] transition-colors flex items-center justify-center text-gray-500 hover:text-[#3a6ea5] text-sm"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    SELECCIONAR ARCHIVOS
                  </button>
                </div>

                {loanData.archivos.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {loanData.archivos.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                        <div className="flex items-center truncate">
                          <FileIcon type={file.type} size={5} />
                          <span className="ml-3 text-sm truncate font-medium text-gray-700">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Observaciones */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                  OBSERVACIONES
                </h3>
                <textarea
                  name="observations"
                  value={loanData.observations}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium resize-none"
                  placeholder="INGRESE LAS OBSERVACIONES"
                />
              </div>
            </div>

            {/* Botones */}
            <div className="mt-6 pt-4 border-t border-gray-300 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                CANCELAR
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center min-w-[150px] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    GUARDANDO...
                  </>
                ) : (
                  'GUARDAR PRÉSTAMO'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <Modal 
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </>
  );
};

// ============ COMPONENTE PRINCIPAL ============

export default function LoansPage({ params }: PageProps) {
  const router = useRouter();
  
  const { projectId } = use(params);

  // Session management
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();

  // Estados
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingRegistros, setIsFetchingRegistros] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Datos
  const [registros, setRegistros] = useState<LoanRecord[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
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

  // Modales
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'info'
  });

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    registro: null as LoanRecord | null,
    isDeleting: false
  });

  const [editModal, setEditModal] = useState({
    isOpen: false,
    registro: null as LoanRecord | null,
    isSaving: false
  });

  const [addLoanModal, setAddLoanModal] = useState({
    isOpen: false
  });

  // Upload hook
  const { startUpload } = useUploadThing('loanFiles', {
    onClientUploadComplete: (files) => {
      console.log("Archivos subidos:", files);
    },
    onUploadError: (error) => {
      showModal('Error al subir archivos', error.message, 'error');
    }
  });

  // ============ FUNCIONES AUXILIARES ============

  const getMondayOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const getSundayOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() + (day === 0 ? 0 : 7 - day);
    return new Date(d.setDate(diff));
  };

  const formatDateShort = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const groupRegistrosByWeek = (registros: LoanRecord[]) => {
    const grouped: { [key: string]: LoanRecord[] } = {};
    
    registros.forEach(registro => {
      const fecha = new Date(registro.date);
      const monday = getMondayOfWeek(fecha);
      const sunday = getSundayOfWeek(fecha);
      const weekKey = `${formatDateShort(monday)} - ${formatDateShort(sunday)}`;
      
      if (!grouped[weekKey]) {
        grouped[weekKey] = [];
      }
      grouped[weekKey].push(registro);
    });
    
    return grouped;
  };

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

  const validateFiles = (files: File[]): { valid: boolean; message: string } => {
    const MAX_FILE_SIZE = 4 * 1024 * 1024;
    const MAX_FILE_COUNT = 3;
    const ALLOWED_TYPES = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (files.length > MAX_FILE_COUNT) {
      return { valid: false, message: `No puedes subir más de ${MAX_FILE_COUNT} archivos a la vez.` };
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return { valid: false, message: `Tipo de archivo no permitido: ${file.name}. Solo se permiten PDF, imágenes (JPG/PNG) y archivos de Excel.` };
      }
      if (file.size > MAX_FILE_SIZE) {
        return { valid: false, message: `El archivo ${file.name} excede el tamaño máximo de 4MB.` };
      }
    }

    return { valid: true, message: '' };
  };

  const uploadFiles = async (files: File[]): Promise<ArchivoAdjunto[]> => {
    try {
      const validation = validateFiles(files);
      if (!validation.valid) {
        showModal('Error en archivos', validation.message, 'error');
        throw new Error(validation.message);
      }

      const uploadedFiles = await startUpload(files);
      
      if (!uploadedFiles) {
        throw new Error('No se recibió respuesta del servidor');
      }

      return uploadedFiles.map(file => ({
        nombre: file.name,
        url: file.ufsUrl || file.url,
        tipo: file.type,
        key: file.key
      }));
    } catch (error) {
      console.error('Error al subir archivos:', error);
      throw error;
    }
  };

  // ============ FUNCIONES DE API ============

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const response = await fetch('/api/project-manager/projects/payment-methods');
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data);
      } else {
        console.error('Error al obtener métodos de pago');
      }
    } catch (error) {
      console.error('Error al obtener métodos de pago:', error);
    }
  }, []);

  const fetchRegistros = useCallback(async () => {
    try {
      if (!projectId) return;
      
      setIsFetchingRegistros(true);
      const response = await fetch(`/api/project-manager/projects/loans?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setRegistros(data.map((item: any) => ({
          id: item.LoansID,
          beneficiary: item.Beneficiary,
          methodId: item.MethodID?.toString() || '',
          date: item.Date,
          total: parseFloat(item.Total),
          formattedTotal: item.Total?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '',
          firstDiscount: item.FirstDiscount,
          numberOfPayments: item.NumberOfPayments || null,
          observations: item.Observations || '',
          status: item.Status || 0,
          archivos: item.Archivos ? JSON.parse(item.Archivos) : []
        })));
      } else {
        console.error('Error al obtener préstamos');
        showModal('Error', 'Error al obtener préstamos', 'error');
      }
    } catch (error) {
      console.error('Error al obtener préstamos:', error);
      showModal('Error', 'Error al obtener préstamos', 'error');
    } finally {
      setIsFetchingRegistros(false);
    }
  }, [projectId]);

  const fetchUserData = useCallback(async () => {
    try {
      const response = await fetch('/api/project-manager/auth/sessions');
      if (response.ok) {
        const userData = await response.json();
        setUserData(userData);
        
        if (projectId) {
          const projectIdNum = parseInt(projectId);
          
          try {
            const projectResponse = await fetch(`/api/project-manager/projects/get-project-name?projectId=${projectId}`);
            if (projectResponse.ok) {
              const projectData = await projectResponse.json();
              setUserData(prev => ({
                ...prev,
                proyectoAsignado: projectData.projectName || prev.proyectoAsignado,
                projectId: projectIdNum
              }));
            }
          } catch (error) {
            console.error('Error al obtener datos del proyecto:', error);
          }
          
          await fetchPaymentMethods();
        } else {
          showModal('Error', 'No se especificó un proyecto en la URL', 'error');
          router.push('/project-manager-dashboard/projects');
          return;
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
  }, [router, fetchPaymentMethods, projectId]);

  // ============ EFFECTS ============

  useEffect(() => {
    if (user && projectId) {
      fetchRegistros();
      fetchUserData();
    }
  }, [user, projectId, fetchRegistros, fetchUserData]);

  // ============ HANDLERS ============

  const openDeleteModal = (registro: LoanRecord) => {
    setDeleteModal({ isOpen: true, registro, isDeleting: false });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, registro: null, isDeleting: false });
  };

  const openEditModal = (registro: LoanRecord) => {
    setEditModal({ isOpen: true, registro, isSaving: false });
  };

  const closeEditModal = () => {
    setEditModal({ isOpen: false, registro: null, isSaving: false });
  };

  const openAddLoanModal = () => {
    setAddLoanModal({ isOpen: true });
  };

  const closeAddLoanModal = () => {
    setAddLoanModal({ isOpen: false });
  };

  const handleAddLoan = async (data: LoanData) => {
    if (!projectId) {
      showModal('Error', 'No se ha identificado el proyecto asociado', 'error');
      return;
    }

    if (!data.date || !data.firstDiscount) {
      showModal('Error', 'Las fechas son requeridas', 'error');
      return;
    }

    if (data.numberOfPayments === null || data.numberOfPayments === undefined) {
      showModal('Error', 'El número de pagos es requerido', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const fechaFormateada = data.date.toISOString().split('T')[0];
      const firstDiscountFormateada = data.firstDiscount.toISOString().split('T')[0];
      
      const response = await fetch('/api/project-manager/projects/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId,
          date: fechaFormateada,
          beneficiary: data.beneficiary,
          methodId: data.methodId,
          total: data.total,
          firstDiscount: firstDiscountFormateada,
          numberOfPayments: data.numberOfPayments,
          observations: data.observations || ''
        })
      });

      if (response.ok) {
        const newLoan = await response.json();
        const loanId = newLoan.id;

        let archivosSubidos: ArchivoAdjunto[] = [];
        if (data.archivos.length > 0) {
          archivosSubidos = await uploadFiles(data.archivos);
          
          await fetch(`/api/project-manager/projects/loans?id=${loanId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: fechaFormateada,
              beneficiary: data.beneficiary,
              methodId: data.methodId,
              total: data.total,
              firstDiscount: firstDiscountFormateada,
              numberOfPayments: data.numberOfPayments,
              observations: data.observations || '',
              archivos: archivosSubidos
            })
          });
        }

        await sendNotification(loanId);
        await fetchRegistros();
        
        showModal('Éxito', '¡REGISTRO DE PRÉSTAMO GUARDADO EXITOSAMENTE!', 'success');
        closeAddLoanModal();
      } else {
        const errorData = await response.json();
        showModal('Error', `Error al guardar: ${errorData.message}`, 'error');
      }
    } catch (error) {
      console.error('Error al enviar los datos:', error);
      showModal('Error', 'Error al conectar con el servidor', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendNotification = async (loanId: number, isUpdate: boolean = false) => {
    try {
      await fetch('/api/notifications/notifications-loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, loanId, isUpdate })
      });
    } catch (error) {
      console.error('Error al enviar notificación:', error);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.registro) return;
    
    setDeleteModal(prev => ({ ...prev, isDeleting: true }));
    
    try {
      if (deleteModal.registro.archivos && deleteModal.registro.archivos.length > 0) {
        const filesToRemove = deleteModal.registro.archivos
          .filter(archivo => archivo.key)
          .map(archivo => archivo.key);

        if (filesToRemove.length > 0) {
          await fetch('/api/uploadthing', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileKeys: filesToRemove })
          });
        }
      }

      const response = await fetch(`/api/project-manager/projects/loans?id=${deleteModal.registro.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchRegistros();
        showModal('Éxito', '¡REGISTRO Y ARCHIVOS DE PRÉSTAMO ELIMINADOS EXITOSAMENTE!', 'success');
      } else {
        const errorData = await response.json();
        showModal('Error', `Error al eliminar: ${errorData.message}`, 'error');
      }
    } catch (error) {
      console.error('Error al eliminar préstamo:', error);
      showModal('Error', 'Error al conectar con el servidor', 'error');
    } finally {
      closeDeleteModal();
    }
  };

  const handleUpdate = async (data: LoanRecord) => {
    setEditModal(prev => ({ ...prev, isSaving: true }));
    
    try {
      const fechaFormateada = data.date.includes('T') 
        ? data.date.split('T')[0] 
        : data.date;
      const firstDiscountFormateada = data.firstDiscount.includes('T')
        ? data.firstDiscount.split('T')[0]
        : data.firstDiscount;

      const response = await fetch(`/api/project-manager/projects/loans?id=${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: fechaFormateada,
          beneficiary: data.beneficiary,
          methodId: data.methodId,
          total: data.total,
          firstDiscount: firstDiscountFormateada,
          numberOfPayments: data.numberOfPayments,
          observations: data.observations || '',
          archivos: data.archivos
        })
      });

      if (response.ok) {
        await sendNotification(data.id, true);
        await fetchRegistros();
        showModal('Éxito', '¡REGISTRO DE PRÉSTAMO ACTUALIZADO EXITOSAMENTE!', 'success');
      } else {
        const errorData = await response.json();
        showModal('Error', `Error al actualizar: ${errorData.message}`, 'error');
      }
    } catch (error) {
      console.error('Error al actualizar préstamo:', error);
      showModal('Error', 'Error al conectar con el servidor', 'error');
    } finally {
      closeEditModal();
    }
  };

  // ============ FILTRADO ============

  const filteredRegistros = registros.filter(registro =>
    registro.beneficiary.toLowerCase().includes(searchTerm.toLowerCase()) ||
    registro.observations.toLowerCase().includes(searchTerm.toLowerCase()) ||
    registro.methodId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ============ RENDER ============

  // Loading de sesión
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
      <AppHeader title="GESTIÓN DE PRÉSTAMOS" />

      {/* Modal de confirmación para eliminar */}
      <DeleteModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        registro={deleteModal.registro}
        isDeleting={deleteModal.isDeleting}
      />

      {/* Modal de edición */}
      <EditModal
        isOpen={editModal.isOpen}
        onClose={closeEditModal}
        registro={editModal.registro}
        onSave={handleUpdate}
        paymentMethods={paymentMethods}
        isSaving={editModal.isSaving}
      />

      {/* Modal de agregar préstamo */}
      <AddLoanModal
        isOpen={addLoanModal.isOpen}
        onClose={closeAddLoanModal}
        onSave={handleAddLoan}
        isSubmitting={isSubmitting}
        paymentMethods={paymentMethods}
      />

      {/* Modal de mensajes */}
      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
        <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
          
          {/* Header de la página */}
          <div className="mb-6">
            <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5]">
              <h1 className="text-xl font-bold text-white tracking-tight">
                GESTIÓN DE PRÉSTAMOS
              </h1>
              <p className="text-sm text-gray-200 mt-1">
                Administre y visualice todos los registros de préstamos del proyecto.
              </p>
              {projectId && (
                <p className="text-xs text-gray-300 mt-1">
                  Proyecto ID: {projectId}
                </p>
              )}
            </div>
          </div>

          {/* Mensajes de éxito/error */}
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
                  placeholder="Buscar por beneficiario, observaciones..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(normalizarMayusculas(e.target.value))}
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
              onClick={() => {
                setSearchTerm('');
                fetchRegistros();
              }}
              className="px-4 py-2.5 bg-gray-200 text-black font-bold rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              ACTUALIZAR
            </button>

            <button
              onClick={openAddLoanModal}
              className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap"
            >
              NUEVO PRÉSTAMO
            </button>
          </div>

          {/* Tabla de registros */}
          <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
            <div className="overflow-x-auto">
              {isFetchingRegistros ? (
                <div className="flex justify-center items-center py-12">
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a6ea5] mb-2"></div>
                    <p className="text-gray-600">Cargando registros...</p>
                  </div>
                </div>
              ) : filteredRegistros.length > 0 ? (
                <>
                  {Object.entries(groupRegistrosByWeek(filteredRegistros)).map(([weekRange, weekRegistros]) => (
                    <div key={weekRange}>
                      <div className="px-4 py-3 bg-[#3a6ea5] border-b border-gray-300">
                        <h3 className="text-sm font-bold text-white flex items-center">
                          <FileText className="w-4 h-4 mr-2" />
                          SEMANA {weekRange}
                        </h3>
                      </div>
                      <table className="w-full">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">FECHA</th>
                            <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">BENEFICIARIO</th>
                            <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">TOTAL</th>
                            <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">1ER DESCUENTO</th>
                            <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">N° PAGOS</th>
                            <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">PROCEDENCIA</th>
                            <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">ARCHIVOS</th>
                            <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">OBSERVACIONES</th>
                            <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300 text-center">ACCIONES</th>
                          </tr>
                        </thead>
                        <tbody>
                          {weekRegistros.map((registro) => {
                            const paymentMethodName = paymentMethods.find(
                              m => m.methodId.toString() === registro.methodId
                            )?.methodName || registro.methodId;

                            return (
                              <tr key={registro.id} className="hover:bg-gray-50 transition-colors border-b border-gray-300">
                                <td className="py-3 px-4 text-sm text-gray-800">
                                  {formatDate(registro.date)}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="text-sm font-medium text-gray-800 uppercase max-w-[150px] truncate" title={registro.beneficiary}>
                                    {registro.beneficiary}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-800 font-medium">
                                  {formatCurrencyNumber(registro.total)}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-800">
                                  {formatDate(registro.firstDiscount)}
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-800 text-center">
                                  {registro.numberOfPayments || '-'}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="text-sm text-gray-800 uppercase">{paymentMethodName}</div>
                                </td>
                                <td className="py-3 px-4">
                                  {registro.archivos?.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {registro.archivos.map((archivo, index) => (
                                        <a
                                          key={index}
                                          href={archivo.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                                          title={archivo.nombre}
                                        >
                                          <FileIcon type={archivo.tipo} size={5} />
                                        </a>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-400">Sin archivos</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="text-sm text-gray-800 max-w-[150px] truncate" title={registro.observations}>
                                    {registro.observations || '-'}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center justify-center gap-2">
                                    {registro.status === 1 ? (
                                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-green-100 text-green-800">
                                        VALIDADO
                                      </span>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => openEditModal(registro)}
                                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                          title="Editar préstamo"
                                        >
                                          <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => openDeleteModal(registro)}
                                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                          title="Eliminar préstamo"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </>
              ) : (
                <div className="py-12 text-center">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-bold text-gray-900">NO HAY REGISTROS</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm 
                      ? 'No se encontraron registros que coincidan con tu búsqueda.' 
                      : 'No se han encontrado registros de préstamos.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Estilos globales */}
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
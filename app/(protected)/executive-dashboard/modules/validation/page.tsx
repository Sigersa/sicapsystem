'use client'

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, CheckCircle, AlertCircle, Search, FileText, Check, XCircle } from 'lucide-react';
import AppHeader from '@/components/header/4/4.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/4';
import { useInactivityManager } from '@/hooks/useInactivityManager';

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

interface ValidationData {
  id: number;
  Date?: string;
  Concept?: string;
  MethodID?: number;
  MethodName?: string;
  Total?: number;
  Observations?: string;
  Archivos?: string;
  Status: number;
  type: string;
  Vehicle?: string;
  StartingPoint?: string;
  ArrivalPoint?: string;
  Liters?: number;
  LitersCost?: number;
  PlaceAccommodation?: string;
  CheckInDate?: string;
  CheckOutDate?: string;
  Fee?: number;
  Nights?: number;
  Beneficiary?: string;
  FirstDiscount?: string;
  NumberOfPayments?: number;
  StartDate?: string;
  EndDate?: string;
  ProjectID?: number;
  NameProject?: string;
  MeansOfTransportation?: string;
  LiterCost?: number;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'confirm' | 'reject';
  onConfirm?: () => void;
  onReject?: (reason: string) => void;
  confirmText?: string;
  cancelText?: string;
  showReasonInput?: boolean;
}

interface FileData {
  nombre: string;
  url: string;
  tipo: string;
}

interface RejectionData {
  id: number;
  type: string;
  projectId?: number;
  concept?: string;
  total?: number;
}

// Componente Modal mejorado
const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  type = 'info',
  onConfirm,
  onReject,
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  showReasonInput = false
}) => {
  const [rejectionReason, setRejectionReason] = useState('');

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    setRejectionReason('');
    onClose();
  };

  const handleReject = () => {
    if (onReject && rejectionReason.trim()) {
      onReject(rejectionReason);
      setRejectionReason('');
      onClose();
    }
  };

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'confirm':
        return <AlertCircle className="h-5 w-5 text-blue-600" />;
      case 'reject':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
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
        <div className="p-6 pt-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors"
          >
            {type === 'reject' || type === 'confirm' ? cancelText : 'Cerrar'}
          </button>
          
          {type === 'confirm' && (
            <button
              onClick={handleConfirm}
              className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center min-w-[120px]"
            >
              {confirmText}
            </button>
          )}
          
          {type === 'reject' && (
            <button
              onClick={handleReject}
              disabled={!rejectionReason.trim()}
              className={`px-6 py-2.5 font-bold rounded-lg transition-colors flex items-center justify-center min-w-[120px] ${
                rejectionReason.trim() 
                  ? 'bg-orange-600 text-white hover:bg-orange-700' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {confirmText}
            </button>
          )}
          
          {(type === 'success' || type === 'error' || type === 'info') && (
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors"
            >
              ACEPTAR
            </button>
          )}
        </div>
        
        {showReasonInput && (
          <div className="p-6 pt-0">
            <label htmlFor="rejectionReason" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
              Razón del rechazo:
            </label>
            <textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Describe la razón por la cual rechazas este gasto..."
              className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium min-h-[80px]"
              rows={3}
            />
            {rejectionReason.trim() === '' && (
              <p className="mt-1 text-xs text-red-600 font-medium">Debes proporcionar una razón para el rechazo.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Componente FileIcon
const FileIcon = ({ type = '' }: { type?: string }) => {
  const iconClass = "h-6 w-6";

  if (type.startsWith('image/')) {
    return (
      <svg className={`${iconClass} text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  } else if (type === 'application/pdf') {
    return (
      <svg className={`${iconClass} text-red-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  } else if (type.includes('excel') || type.includes('spreadsheet')) {
    return (
      <svg className={`${iconClass} text-green-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  } else {
    return (
      <svg className={`${iconClass} text-gray-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
};

export default function ValidationPage() {
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

  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'confirm' | 'reject';
    onConfirm?: () => void;
    onReject?: (reason: string) => void;
    confirmText?: string;
    cancelText?: string;
    showReasonInput?: boolean;
    rejectionReason?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    rejectionReason: ''
  });

  const [pendingValidations, setPendingValidations] = useState<{
    [key: string]: ValidationData[];
  }>({});

  const [activeTab, setActiveTab] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<RejectionData | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const closeModal = () => {
    setModal({
      isOpen: false,
      title: '',
      message: '',
      type: 'info',
      rejectionReason: ''
    });
    setSelectedItem(null);
    setRejectionReason('');
  };

  const showConfirmationModal = (title: string, message: string, onConfirm: () => void) => {
    setModal({
      isOpen: true,
      title,
      message,
      type: 'confirm',
      onConfirm,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      showReasonInput: false,
      rejectionReason: ''
    });
  };

  const showRejectionModal = (title: string, message: string, onReject: (reason: string) => void) => {
    setModal({
      isOpen: true,
      title,
      message,
      type: 'reject',
      onReject,
      confirmText: 'Rechazar',
      cancelText: 'Cancelar',
      showReasonInput: true,
      rejectionReason: ''
    });
  };

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

      if (!data?.valid || !data?.user) {
        console.log('Datos de sesión inválidos, redirigiendo a login');
        router.replace('/');
        return;
      }

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

      await fetchPendingValidations();

    } catch (error) {
      console.error('Error al obtener datos de usuario:', error);
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingValidations = async () => {
    try {
      const response = await fetch('/api/executive-manager/validation');
      if (response.ok) {
        const data = await response.json();
        
        const transformedData: {[key: string]: ValidationData[]} = {};
        let firstTabWithData = '';
        
        for (const [key, records] of Object.entries(data)) {
          if (Array.isArray(records)) {
            const typedRecords = records as any[];
            
            transformedData[key] = typedRecords
              .filter(record => record && record.id)
              .map((record) => {
                if (key === 'lodgings' && record.CheckInDate && record.Nights) {
                  const checkInDate = new Date(record.CheckInDate);
                  checkInDate.setDate(checkInDate.getDate() + record.Nights);
                  record.CheckOutDate = checkInDate.toISOString().split('T')[0];
                }
                
                return {
                  ...record,
                  type: key.replace(/s$/, ''),
                  id: record.id,
                  Vehicle: record.Vehicle || record.MeansOfTransportation,
                  StartingPoint: record.StartingPoint,
                  ArrivalPoint: record.ArrivalPoint,
                  Liters: record.Liters,
                  LitersCost: record.LitersCost || record.LiterCost,
                  PlaceAccommodation: record.PlaceAccommodation,
                  CheckInDate: record.CheckInDate,
                  Fee: record.Fee,
                  Nights: record.Nights,
                  Beneficiary: record.Beneficiary,
                  FirstDiscount: record.FirstDiscount,
                  NumberOfPayments: record.NumberOfPayments,
                  StartDate: record.StartDate,
                  EndDate: record.EndDate,
                  NameProject: record.NameProject || 'Sin proyecto',
                  Status: record.Status || 0
                };
              });
            
            if (typedRecords.length > 0 && !firstTabWithData) {
              firstTabWithData = key.replace(/s$/, '');
            }
          }
        }

        setPendingValidations(transformedData);
        
        if (firstTabWithData) {
          setActiveTab(firstTabWithData);
        } else if (Object.keys(transformedData).length > 0) {
          setActiveTab(Object.keys(transformedData)[0].replace(/s$/, ''));
        }
      } else {
        throw new Error('Error al cargar validaciones pendientes');
      }
    } catch (error) {
      console.error('Error fetching pending validations:', error);
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al cargar validaciones pendientes',
        type: 'error'
      });
    }
  };

  const updateValidationStatus = async (id: number, type: string, status: number, projectId?: number, concept?: string, total?: number, rejectionReason?: string) => {
    try {
      if (!id || isNaN(id)) {
        throw new Error('ID de gasto inválido');
      }
      
      if (!type || typeof type !== 'string') {
        throw new Error('Tipo de gasto no especificado');
      }
      
      if (status !== 1 && status !== 2) {
        throw new Error('Estado de validación inválido (debe ser 1 o 2)');
      }

      const response = await fetch('/api/executive-manager/validation', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id: Number(id), 
          type: String(type), 
          status: Number(status),
          projectId,
          rejectionReason: rejectionReason || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al actualizar el estado');
      }
            
      await fetchPendingValidations();
      setModal({
        isOpen: true,
        title: 'Éxito',
        message: status === 1 
          ? 'Gasto aprobado correctamente' 
          : 'Gasto rechazado correctamente',
        type: 'success'
      });
    } catch (error) {
      console.error('Error updating validation status:', error);
      setModal({
        isOpen: true,
        title: 'Error',
        message: error instanceof Error ? error.message : 'Error al actualizar el estado del gasto',
        type: 'error'
      });
    }
  };

  const handleApproveClick = (id: number, type: string, projectId?: number, concept?: string, total?: number) => {
    setSelectedItem({id, type, projectId, concept, total});
    showConfirmationModal(
      'Confirmar Aprobación',
      '¿Estás seguro que deseas aprobar este gasto?',
      () => updateValidationStatus(id, type, 1, projectId, concept, total)
    );
  };

  const handleRejectClick = (id: number, type: string, projectId?: number, concept?: string, total?: number) => {
    setSelectedItem({id, type, projectId, concept, total});
    showRejectionModal(
      'Confirmar Rechazo',
      '¿Estás seguro que deseas rechazar este gasto? Por favor, indica la razón del rechazo:',
      (reason: string) => updateValidationStatus(id, type, 2, projectId, concept, total, reason)
    );
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3a6ea5] mx-auto"></div>
          <p className="mt-4 text-gray-700 font-medium">Cargando panel de validaciones...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getTypeLabel = (type: string): string => {
    const labels: {[key: string]: string} = {
      administrativeconsumable: 'Consumibles Administrativos',
      consumableclient: 'Consumibles (Cliente)',
      epp: 'EPP',
      financingservices: 'Servicios de Financiamiento (Cliente)',
      fuelclient: 'Combustibles (Cliente)',
      infrastructuretransfer: 'Traslados de Infraestructura',
      infrastructureservices: 'Servicios de Infraestructura',
      installationmaterials: 'Materiales de Instalación',
      loans: 'Préstamos',
      localtransportationfuel: 'Combustibles de Transportación Local',
      lodging: 'Hospedajes',
      operativeconsumable: 'Consumibles (Operativos)',
      outsourcedservices: 'Servicios Subcontratados',
      payroll: 'Nóminas',
      personneltransfer: 'Traslados de Personal a Sitio',
      toolsequipment: 'Herramientas y/o Equipo',
      uniondues: 'Cuotas Sindicales',
      waterice: 'Agua y Hielo (Cliente)'
    };
    
    return labels[type] || type;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (e) {
      console.error('Error formateando fecha:', e);
      return 'Fecha inválida';
    }
  };

  const parseArchivos = (archivosString?: string): FileData[] => {
    if (!archivosString) return [];
    try {
      return JSON.parse(archivosString);
    } catch (error) {
      console.error('Error parsing archivos:', error);
      return [];
    }
  };

  const getTableHeaders = (type: string) => {
    const headersMap: {[key: string]: {title: string, key: string}[]} = {
      administrativeconsumable: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ],
      consumableclient: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ],
      epp: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ],
      financingservices: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ],
      fuelclient: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Litros', key: 'Liters' },
        { title: 'Costo Litros', key: 'LitersCost' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ],
      infrastructuretransfer: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ],
      infrastructureservices: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ],
      installationmaterials: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ],
      loans: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Beneficiario', key: 'Beneficiary' },
        { title: 'Primer Descuento', key: 'FirstDiscount' },
        { title: 'Número Pagos', key: 'NumberOfPayments' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ],
      localtransportationfuel: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Vehículo', key: 'Vehicle' },
        { title: 'Litros', key: 'Liters' },
        { title: 'Costo Litros', key: 'LitersCost' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ],
      lodging: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Lugar Hospedaje', key: 'PlaceAccommodation' },
        { title: 'Check In', key: 'CheckInDate' },
        { title: 'Check Out', key: 'CheckOutDate' },
        { title: 'Tarifa', key: 'Fee' },
        { title: 'Noches', key: 'Nights' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ],
      operativeconsumable: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ],
      outsourcedservices: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ],
      payroll: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ],
      personneltransfer: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Vehículo', key: 'Vehicle' },
        { title: 'Punto Inicio', key: 'StartingPoint' },
        { title: 'Punto Llegada', key: 'ArrivalPoint' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ],
      toolsequipment: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ],
      uniondues: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ],
      waterice: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Acciones', key: 'actions' }
      ]
    };

    return headersMap[type] || [
      { title: 'Proyecto', key: 'NameProject' },
      { title: 'Fecha', key: 'Date' },
      { title: 'Concepto', key: 'Concept' },
      { title: 'Pago', key: 'MethodName' },
      { title: 'Total', key: 'Total' },
      { title: 'Archivos', key: 'Archivos' },
      { title: 'Observaciones', key: 'Observations' },
      { title: 'Acciones', key: 'actions' }
    ];
  };

  const renderCellContent = (key: string, value: any) => {
    if (value === undefined || value === null) return '-';
    
    switch (key) {
      case 'Date':
      case 'CheckInDate':
      case 'CheckOutDate':
      case 'FirstDiscount':
      case 'StartDate':
      case 'EndDate':
        return <span className="text-sm text-gray-700">{formatDate(value)}</span>;
      case 'Total':
      case 'Fee':
      case 'LitersCost':
      case 'LiterCost':
        return <span className="text-sm text-gray-700 font-medium">${parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
      case 'Liters':
        return <span className="text-sm text-gray-700">{parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
      case 'NameProject':
        return <div className="text-sm font-medium text-gray-900">{value || 'Sin proyecto'}</div>;
      case 'Archivos':
        const archivos = parseArchivos(value);
        return archivos.length > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {archivos.map((archivo, index) => (
              <div key={index} className="flex flex-col items-center">
                <a
                  href={archivo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-underline"
                  title={`Abrir ${archivo.nombre}`}
                >
                  <div className="p-1.5 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors">
                    <FileIcon type={archivo.tipo} />
                  </div>
                </a>
                <span className="mt-1 text-xs text-gray-600 truncate max-w-[70px]">
                  {archivo.nombre}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        );
      case 'actions':
        return (
          <div className="flex items-center justify-center space-x-2">
            {value.Status === 1 ? (
              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 w-20 justify-center">
                Validado
              </span>
            ) : value.Status === 2 ? (
              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 w-20 justify-center">
                Rechazado
              </span>
            ) : (
              <>
                <button
                  onClick={() => handleApproveClick(
                    value.id, 
                    value.type, 
                    value.ProjectID, 
                    value.Concept, 
                    value.Total
                  )}
                  className="p-1.5 rounded-md text-[#3a6ea5] hover:text-white hover:bg-[#3a6ea5] transition-colors duration-200"
                  aria-label="Aprobar"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleRejectClick(
                    value.id, 
                    value.type, 
                    value.ProjectID, 
                    value.Concept, 
                    value.Total
                  )}
                  className="p-1.5 rounded-md text-red-600 hover:text-white hover:bg-red-500 transition-colors duration-200"
                  aria-label="Rechazar"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        );
      default:
        return <div className="text-sm text-gray-700 break-words max-h-[80px] overflow-y-auto">{value}</div>;
    }
  };

  const renderTable = (type: string) => {
    const data = pendingValidations[`${type}s`] || [];
    
    if (data.length === 0) {
      return (
        <div className="px-6 py-12 text-center">
          <div className="flex flex-col items-center">
            <div className="bg-gray-100 rounded-full p-4 mb-4">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">No hay validaciones pendientes</h3>
            <p className="mt-1 text-sm text-gray-500">
              No hay {getTypeLabel(type).toLowerCase()} pendientes por validar.
            </p>
          </div>
        </div>
      );
    }

    const headers = getTableHeaders(type);
    const filteredData = searchTerm 
      ? data.filter(item => {
          const searchLower = searchTerm.toLowerCase();
          return (
            (item.NameProject || '').toLowerCase().includes(searchLower) ||
            (item.Concept || '').toLowerCase().includes(searchLower) ||
            (item.Beneficiary || '').toLowerCase().includes(searchLower)
          );
        })
      : data;

    if (filteredData.length === 0) {
      return (
        <div className="px-6 py-12 text-center">
          <div className="flex flex-col items-center">
            <div className="bg-gray-100 rounded-full p-4 mb-4">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">No hay resultados</h3>
            <p className="mt-1 text-sm text-gray-500">
              No se encontraron gastos que coincidan con tu búsqueda.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <div className="overflow-hidden rounded-lg border border-gray-300">
          <table className="min-w-full bg-white text-sm">
            <thead className="bg-gray-100">
              <tr>
                {headers.map((header, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="px-3 py-3 text-center align-top text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300 last:border-r-0"
                  >
                    {header.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((item, index) => (
                <tr 
                  key={`${item.type}-${item.id}`} 
                  className={`transition-colors duration-150 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  } hover:bg-gray-100`}
                >
                  {headers.map((header, i) => (
                    <td
                      key={i}
                      className="px-3 py-3 align-top text-center text-gray-700 border-r border-gray-300 last:border-r-0"
                    >
                      {renderCellContent(
                        header.key,
                        header.key === 'actions'
                          ? { id: item.id, type: item.type, Status: item.Status, ProjectID: item.ProjectID, Concept: item.Concept, Total: item.Total }
                          : item[header.key as keyof ValidationData]
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const sortedTabs = Object.keys(pendingValidations).sort((a, b) => {
    const aCount = pendingValidations[a].length;
    const bCount = pendingValidations[b].length;
    
    if (aCount > 0 && bCount === 0) return -1;
    if (aCount === 0 && bCount > 0) return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <AppHeader title="EJECUTIVO" />

      <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
        <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
          
          {/* Header del Panel */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5] w-full">
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center">
                  VALIDACIÓN Y CONTROL DE GASTOS
                </h1>
                <p className="text-sm text-gray-200 mt-1">
                  Gestiona las validaciones pendientes de gastos por categoría.
                </p>
              </div>
            </div>

            {/* Panel Principal */}
            <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
              
              {/* Header con Búsqueda */}
              <div className="p-6 border-b border-gray-300 bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-72">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Buscar por proyecto, concepto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      />
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 font-medium">
                    {Object.values(pendingValidations).reduce((acc, curr) => acc + curr.length, 0)} pendientes
                  </div>
                </div>
              </div>

              {/* Navegación de Pestañas */}
              <div className="border-b border-gray-300 bg-gray-50">
                <nav className="-mb-px flex space-x-6 overflow-x-auto px-6">
                  {sortedTabs.map((type) => {
                    const singularType = type.replace(/s$/, '');
                    const count = pendingValidations[type].length;
                    
                    return (
                      <button
                        key={type}
                        onClick={() => setActiveTab(singularType)}
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm tracking-wide transition-colors duration-200 ${
                          activeTab === singularType
                            ? 'border-[#3a6ea5] text-gray-900'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } ${count > 0 ? 'font-bold' : ''}`}
                      >
                        {getTypeLabel(singularType)} 
                        <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                          count > 0 
                            ? 'bg-[#3a6ea5] text-white' 
                            : 'bg-gray-200 text-gray-500'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Contenido de la Tabla */}
              <div className="p-6">
                {activeTab && renderTable(activeTab)}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Modales */}
      <Modal 
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm}
        onReject={modal.onReject}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
        showReasonInput={modal.showReasonInput}
      />

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
      `}</style>
    </div>
  );
}
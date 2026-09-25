'use client';

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppHeader from '@/components/header/5/5.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/5';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { X, CheckCircle, AlertCircle, Search, FileText } from 'lucide-react';

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
  ApprovedByName?: string;
  FirstName?: string;
  LastName?: string;
  FullName?: string;
}

interface ProjectData {
  ProjectID: number;
  NameProject: string;
}

interface FileData {
  nombre: string;
  url: string;
  tipo: string;
}

// Modal consistente con el sistema existente
const Modal = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info'
}: {
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
            <div className="flex-shrink-0 mr-3">{getIcon()}</div>
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
  const router = useRouter();
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();

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

  const [pendingValidations, setPendingValidations] = useState<{
    [key: string]: ValidationData[];
  }>({});

  const [projects, setProjects] = useState<ProjectData[]>([
    { ProjectID: 0, NameProject: 'Todos los proyectos' }
  ]);

  const [selectedProject, setSelectedProject] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredData, setFilteredData] = useState<ValidationData[]>([]);
  const [tabCounts, setTabCounts] = useState<{ [key: string]: number }>({});

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/administrative-dashboard/inquiry/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects([{ ProjectID: 0, NameProject: 'Todos los proyectos' }, ...data]);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchPendingValidations = async () => {
    try {
      const response = await fetch('/api/administrative-dashboard/inquiry');
      if (response.ok) {
        const data = await response.json();

        const transformedData: { [key: string]: ValidationData[] } = {};
        const counts: { [key: string]: number } = {};
        let firstTabWithData = '';

        for (const [key, records] of Object.entries(data)) {
          if (Array.isArray(records)) {
            const typedRecords = records as any[];

            transformedData[key] = typedRecords
              .filter(record => record && record.id)
              .map((record) => {
                if (key === 'lodgings' && record.CheckInDate && record.Nights && !record.CheckOutDate) {
                  const checkInDate = new Date(record.CheckInDate);
                  checkInDate.setDate(checkInDate.getDate() + record.Nights);
                  record.CheckOutDate = checkInDate.toISOString().split('T')[0];
                }

                const backendFullName = (record.FullName || '').toString().trim();
                const approvedByName = (record.ApprovedByName || '').toString().trim();
                const fullName = backendFullName || approvedByName;

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
                  Status: record.Status || 0,
                  ApprovedByName: approvedByName,
                  FullName: fullName
                };
              });

            counts[key] = transformedData[key].length;

            if (typedRecords.length > 0 && !firstTabWithData) {
              firstTabWithData = key.replace(/s$/, '');
            }
          }
        }

        setPendingValidations(transformedData);
        setTabCounts(counts);

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
      showModal('Error', 'Error al cargar validaciones pendientes', 'error');
    }
  };

  const fetchUserData = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/validate-session', {
        credentials: 'include'
      });

      if (!response.ok) {
        router.replace('/');
        return;
      }

      const data = await response.json();

      if (!data?.valid || !data?.user) {
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

      await Promise.all([fetchProjects(), fetchPendingValidations()]);
    } catch (error) {
      console.error('Error fetching user data:', error);
      router.replace('/');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!sessionLoading) {
      fetchUserData();
    }
  }, [sessionLoading, fetchUserData]);

  // Actualizar conteos y datos filtrados
  useEffect(() => {
    const newCounts: { [key: string]: number } = {};

    Object.keys(pendingValidations).forEach(key => {
      if (selectedProject !== 0) {
        newCounts[key] = pendingValidations[key].filter(
          item => item.ProjectID === selectedProject
        ).length;
      } else {
        newCounts[key] = pendingValidations[key].length;
      }
    });

    setTabCounts(newCounts);

    if (activeTab && pendingValidations[`${activeTab}s`]) {
      let data = pendingValidations[`${activeTab}s`];

      if (selectedProject !== 0) {
        data = data.filter(item => item.ProjectID === selectedProject);
      }

      if (searchTerm.trim() !== '') {
        const searchLower = searchTerm.toLowerCase();
        data = data.filter(item => {
          return (
            (item.Concept && item.Concept.toLowerCase().includes(searchLower)) ||
            (item.NameProject && item.NameProject.toLowerCase().includes(searchLower)) ||
            (item.Beneficiary && item.Beneficiary.toLowerCase().includes(searchLower)) ||
            (item.PlaceAccommodation && item.PlaceAccommodation.toLowerCase().includes(searchLower)) ||
            (item.Vehicle && item.Vehicle.toLowerCase().includes(searchLower)) ||
            (item.StartingPoint && item.StartingPoint.toLowerCase().includes(searchLower)) ||
            (item.ArrivalPoint && item.ArrivalPoint.toLowerCase().includes(searchLower)) ||
            (item.FullName && item.FullName.toLowerCase().includes(searchLower)) ||
            (item.ApprovedByName && item.ApprovedByName.toLowerCase().includes(searchLower))
          );
        });
      }

      setFilteredData(data);
    }
  }, [selectedProject, searchTerm, activeTab, pendingValidations]);

  const getTypeLabel = (type: string): string => {
    const labels: { [key: string]: string } = {
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
    const headersMap: { [key: string]: { title: string, key: string }[] } = {
      administrativeconsumable: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Validado Por', key: 'FullName' }
      ],
      consumableclient: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Validado Por', key: 'FullName' }
      ],
      epp: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Validado Por', key: 'FullName' }
      ],
      financingservices: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Validado Por', key: 'FullName' }
      ],
      fuelclient: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Litros', key: 'Liters' },
        { title: 'Costo Litros', key: 'LitersCost' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Validado Por', key: 'FullName' }
      ],
      infrastructuretransfer: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Validado Por', key: 'FullName' }
      ],
      infrastructureservices: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Validado Por', key: 'FullName' }
      ],
      installationmaterials: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Validado Por', key: 'FullName' }
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
        { title: 'Validado Por', key: 'FullName' }
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
        { title: 'Validado Por', key: 'FullName' }
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
        { title: 'Validado Por', key: 'FullName' }
      ],
      operativeconsumable: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Validado Por', key: 'FullName' }
      ],
      outsourcedservices: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Validado Por', key: 'FullName' }
      ],
      payroll: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Validado Por', key: 'FullName' }
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
        { title: 'Validado Por', key: 'FullName' }
      ],
      toolsequipment: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Validado Por', key: 'FullName' }
      ],
      uniondues: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Validado Por', key: 'FullName' }
      ],
      waterice: [
        { title: 'Proyecto', key: 'NameProject' },
        { title: 'Fecha', key: 'Date' },
        { title: 'Concepto', key: 'Concept' },
        { title: 'Pago', key: 'MethodName' },
        { title: 'Total', key: 'Total' },
        { title: 'Archivos', key: 'Archivos' },
        { title: 'Observaciones', key: 'Observations' },
        { title: 'Validado Por', key: 'FullName' }
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
      { title: 'Validado Por', key: 'FullName' }
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
        return formatDate(value);
      case 'Total':
      case 'Fee':
      case 'LitersCost':
      case 'LiterCost':
        return `$${parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'Liters':
        return parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'NameProject':
        return <div className="text-sm font-medium text-gray-700">{value || 'Sin proyecto'}</div>;
      case 'Archivos':
        const archivos = parseArchivos(value);
        return archivos.length > 0 ? (
          <div className="flex flex-col items-center gap-2 max-h-[80px] overflow-y-auto">
            {archivos.map((archivo, index) => (
              <div key={index} className="flex flex-col items-center">
                <a
                  href={archivo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-underline"
                  title={`Abrir ${archivo.nombre}`}
                >
                  <div className="p-1 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors">
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
      case 'FullName':
        if (value && value.trim() !== '') {
          return (
            <div className="text-sm font-medium text-gray-700 text-center">
              {value}
            </div>
          );
        } else {
          return (
            <div className="text-sm text-gray-400 italic text-center">
              Pendiente
            </div>
          );
        }
      default:
        return <div className="text-sm text-gray-700 font-medium break-words max-h-[80px] overflow-y-auto">{value}</div>;
    }
  };

  const renderTable = (type: string) => {
    const data = filteredData;

    if (data.length === 0) {
      return (
        <div className="px-6 py-12 text-center">
          <div className="flex flex-col items-center">
            <div className="bg-gray-100 rounded-full p-4 mb-4">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">No hay gastos</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm.trim() !== ''
                ? `No se encontraron resultados para "${searchTerm}"`
                : selectedProject !== 0
                  ? `No hay ${getTypeLabel(type).toLowerCase()} registrados para este proyecto.`
                  : `No hay ${getTypeLabel(type).toLowerCase()} registrados.`}
            </p>
          </div>
        </div>
      );
    }

    const headers = getTableHeaders(type);

    return (
      <div className="overflow-x-auto">
        <table className="w-full bg-white text-sm">
          <thead className="bg-gray-100">
            <tr>
              {headers.map((header, i) => (
                <th
                  key={i}
                  scope="col"
                  className="px-4 py-3 text-center align-top text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300 last:border-r-0"
                >
                  {header.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((item, index) => (
              <tr
                key={`${item.type}-${item.id}`}
                className={`transition-colors duration-150 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                } hover:bg-gray-100`}
              >
                {headers.map((header, i) => (
                  <td
                    key={i}
                    className="px-4 py-3 align-top text-center text-gray-700 border-r border-gray-300 last:border-r-0"
                  >
                    {renderCellContent(header.key, item[header.key as keyof ValidationData])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const sortedTabs = Object.keys(pendingValidations).sort((a, b) => {
    const aCount = tabCounts[a] || 0;
    const bCount = tabCounts[b] || 0;

    if (aCount > bCount) return -1;
    if (aCount < bCount) return 1;
    return 0;
  });

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3a6ea5] mx-auto"></div>
          <p className="mt-4 text-gray-700 font-medium">Cargando consulta de gastos...</p>
        </div>
      </div>
    );
  }

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
            <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5] w-full mb-6">
              <h1 className="text-xl font-bold text-white tracking-tight">
                CONSULTA DE GASTOS
              </h1>
              <p className="text-sm text-gray-200 mt-1">
                Visualiza los gastos registrados durante la ejecución de proyectos.
              </p>
            </div>

            {/* Panel Principal */}
            <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">

              {/* Controles de filtro */}
              <div className="p-6 border-b border-gray-300 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="w-full">
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      Filtrar por proyecto:
                    </label>
                    <div className="relative w-full">
                      <select
                        id="projectFilter"
                        value={selectedProject}
                        onChange={(e) => setSelectedProject(Number(e.target.value))}
                        className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium appearance-none"
                      >
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

                  <div className="w-full">
                    <label htmlFor="searchInput" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      Buscar:
                    </label>
                    <div className="relative w-full">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="searchInput"
                        placeholder={`Buscar en ${activeTab ? getTypeLabel(activeTab) : 'gastos'}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Navegación de Pestañas */}
              <div className="border-b border-gray-300 bg-white">
                <nav className="flex overflow-x-auto px-6">
                  {sortedTabs.map((type) => {
                    const singularType = type.replace(/s$/, '');
                    const count = tabCounts[type] || 0;

                    return (
                      <button
                        key={type}
                        onClick={() => {
                          setActiveTab(singularType);
                          setSearchTerm('');
                        }}
                        className={`whitespace-nowrap py-3 px-3 border-b-2 text-sm transition-colors duration-200 ${
                          activeTab === singularType
                            ? 'border-[#3a6ea5] text-[#3a6ea5] font-bold'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium'
                        }`}
                      >
                        {getTypeLabel(singularType)} ({count})
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Contenido de la Tabla */}
              <div className="overflow-x-auto">
                {activeTab && renderTable(activeTab)}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
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
'use client';

import React, { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/header/5/5.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/5';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

interface Project {
  ProjectID: number;
  NameProject: string;
}

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

// Componente principal envuelto en Suspense
export default function ExpensesVerificationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3a6ea5] mx-auto"></div>
            <p className="mt-4 text-gray-700 font-medium">Cargando...</p>
          </div>
        </div>
      }
    >
      <ExpensesVerificationContent />
    </Suspense>
  );
}

function ExpensesVerificationContent() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loading, setLoading] = useState(true);

  // Estados para los checkboxes
  const [mostrarDeposito, setMostrarDeposito] = useState(false);
  const [mostrarCajaChica, setMostrarCajaChica] = useState(false);
  const [mostrarSaldoAnterior, setMostrarSaldoAnterior] = useState(false);

  // Campos para caja chica, depósito y saldo anterior
  const [fechaCajaChica, setFechaCajaChica] = useState('');
  const [montoCajaChica, setMontoCajaChica] = useState('');
  const [fechaDeposito, setFechaDeposito] = useState('');
  const [montoDeposito, setMontoDeposito] = useState('');
  const [fechaSaldoAnterior, setFechaSaldoAnterior] = useState('');
  const [montoSaldoAnterior, setMontoSaldoAnterior] = useState('');

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

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  const fetchProjectsData = useCallback(async () => {
    try {
      setLoadingProjects(true);
      const res = await fetch('/api/administrative-dashboard/inquiry/projects');
      if (!res.ok) {
        throw new Error(`Error fetching projects: ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjects(data);
      } else {
        console.error('Formato de datos inesperado:', data);
        setProjects([]);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      showModal('Error', 'No se pudieron cargar los proyectos', 'error');
    } finally {
      setLoadingProjects(false);
    }
  }, []);

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
    } catch (error) {
      console.error('Error fetching user data:', error);
      router.replace('/');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!sessionLoading) {
      (async () => {
        await fetchUserData();
        await fetchProjectsData();
      })();
    }
  }, [sessionLoading, fetchUserData, fetchProjectsData]);

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const projectExists = projects.some(p => p.NameProject === value);
    if (!projectExists && value !== '') {
      console.warn('El proyecto seleccionado no existe en la lista:', value);
    }
    setSelectedProject(value);
  };

  const handleDownload = async () => {
    if (!selectedProject) {
      showModal('Atención', 'Selecciona un proyecto', 'error');
      return;
    }
    if (!selectedDate) {
      showModal('Atención', 'Selecciona una fecha del reporte', 'error');
      return;
    }
    if (!startDate) {
      showModal('Atención', 'Selecciona la fecha de inicio del período', 'error');
      return;
    }
    if (!endDate) {
      showModal('Atención', 'Selecciona la fecha de término del período', 'error');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      showModal('Atención', 'La fecha de inicio no puede ser mayor a la fecha de término', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/administrative-dashboard/excel/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: selectedProject,
          date: selectedDate,
          startDate,
          endDate,
          fechaDeposito: fechaDeposito || null,
          montoDeposito: montoDeposito !== '' ? montoDeposito : null,
          fechaCajaChica: fechaCajaChica || null,
          montoCajaChica: montoCajaChica !== '' ? montoCajaChica : null,
          fechaSaldoAnterior: fechaSaldoAnterior || null,
          montoSaldoAnterior: montoSaldoAnterior !== '' ? montoSaldoAnterior : null
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al generar el archivo');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;

      const projectNameSafe = selectedProject.replace(/[^a-z0-9]/gi, '_').toLowerCase();

      const formatDateForFilename = (dateStr: string) => {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr ? dateStr.replace(/[^0-9]/g, '_') : 'fecha';
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
      };

      a.download = `gastos_${projectNameSafe}_${formatDateForFilename(startDate)}_${formatDateForFilename(endDate)}.xlsx`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showModal('Éxito', 'Reporte generado correctamente', 'success');
    } catch (error: any) {
      console.error('Error:', error);
      showModal('Error', error?.message || 'Error al generar el archivo', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const isFormInvalid =
    !selectedProject ||
    !selectedDate ||
    !startDate ||
    !endDate ||
    loadingProjects;

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3a6ea5] mx-auto"></div>
          <p className="mt-4 text-gray-700 font-medium">Cargando...</p>
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
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center">
                GENERAR REPORTE DE GASTOS
              </h1>
              <p className="text-sm text-gray-200 mt-1">
                Selecciona el proyecto y define los parámetros del reporte.
              </p>
            </div>

            {/* Panel Principal */}
            <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">

              {/* Header del Formulario */}
              <div className="p-6 border-b border-gray-300 bg-gray-50">
                <h3 className="text-base font-bold text-gray-900 tracking-tight">
                  Parámetros del Reporte
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Todos los campos marcados con (*) son obligatorios.
                </p>
              </div>

              {/* Contenido del Formulario */}
              <div className="p-6">
                <div className="space-y-6">

                  {/* Proyecto y Fecha del Reporte */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        Proyecto *
                        {projects.length === 0 && !loadingProjects && (
                          <span className="ml-2 text-red-500 text-xs normal-case">
                            (No hay proyectos disponibles)
                          </span>
                        )}
                      </label>
                      <div className="relative">
                        <select
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium appearance-none"
                          value={selectedProject}
                          onChange={handleProjectChange}
                          disabled={loadingProjects || projects.length === 0}
                        >
                          <option value="">Seleccione un proyecto</option>
                          {projects.map((p) => (
                            <option key={p.ProjectID} value={p.NameProject}>
                              {p.NameProject}
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

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                        Fecha del Reporte *
                      </label>
                      <input
                        type="date"
                        className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Período a Comprobar */}
                  <div className="pt-2">
                    <h3 className="text-base font-bold text-gray-900 tracking-tight mb-4">
                      Período a Comprobar
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          Fecha de Inicio *
                        </label>
                        <input
                          type="date"
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          max={endDate || undefined}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          Fecha de Término *
                        </label>
                        <input
                          type="date"
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          min={startDate || undefined}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sección de Checkboxes */}
                  <div className="pt-4 border-t border-gray-300">
                    <h3 className="text-base font-bold text-gray-900 tracking-tight mb-4">
                      Información Adicional (Opcional)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="check-deposito"
                          checked={mostrarDeposito}
                          onChange={(e) => setMostrarDeposito(e.target.checked)}
                          className="h-4 w-4 text-[#3a6ea5] border-gray-400 rounded focus:ring-[#3a6ea5]"
                        />
                        <label htmlFor="check-deposito" className="text-sm font-medium text-gray-700 cursor-pointer">
                          Agregar Depósito
                        </label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="check-caja-chica"
                          checked={mostrarCajaChica}
                          onChange={(e) => setMostrarCajaChica(e.target.checked)}
                          className="h-4 w-4 text-[#3a6ea5] border-gray-400 rounded focus:ring-[#3a6ea5]"
                        />
                        <label htmlFor="check-caja-chica" className="text-sm font-medium text-gray-700 cursor-pointer">
                          Agregar Caja Chica
                        </label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="check-saldo-anterior"
                          checked={mostrarSaldoAnterior}
                          onChange={(e) => setMostrarSaldoAnterior(e.target.checked)}
                          className="h-4 w-4 text-[#3a6ea5] border-gray-400 rounded focus:ring-[#3a6ea5]"
                        />
                        <label htmlFor="check-saldo-anterior" className="text-sm font-medium text-gray-700 cursor-pointer">
                          Agregar Saldo Anterior
                        </label>
                      </div>
                    </div>

                    {/* Campos dinámicos */}
                    <div className="space-y-6">
                      {mostrarDeposito && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                              Fecha de depósito
                            </label>
                            <input
                              type="date"
                              className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                              value={fechaDeposito}
                              onChange={(e) => setFechaDeposito(e.target.value)}
                              max={endDate || undefined}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                              Monto del depósito
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                              value={montoDeposito}
                              onChange={(e) => setMontoDeposito(e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      {mostrarCajaChica && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                              Fecha de caja chica
                            </label>
                            <input
                              type="date"
                              className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                              value={fechaCajaChica}
                              onChange={(e) => setFechaCajaChica(e.target.value)}
                              max={endDate || undefined}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                              Monto en caja chica
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                              value={montoCajaChica}
                              onChange={(e) => setMontoCajaChica(e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      {mostrarSaldoAnterior && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                              Fecha del saldo anterior
                            </label>
                            <input
                              type="date"
                              className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                              value={fechaSaldoAnterior}
                              onChange={(e) => setFechaSaldoAnterior(e.target.value)}
                              max={endDate || undefined}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                              Monto del saldo anterior
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                              value={montoSaldoAnterior}
                              onChange={(e) => setMontoSaldoAnterior(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botón de Generar */}
                  <div className="flex justify-center pt-6 border-t border-gray-300">
                    <button
                      onClick={handleDownload}
                      disabled={isLoading || isFormInvalid}
                      className={`px-6 py-3 rounded-lg text-white font-bold tracking-wide transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#3a6ea5] focus:ring-offset-2 min-w-[280px] ${
                        isLoading || isFormInvalid
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-[#3a6ea5] hover:bg-[#2d5592]'
                      }`}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                          <span className="text-sm">Generando archivo...</span>
                        </span>
                      ) : (
                        <span className="text-sm">BUSCAR GASTOS Y GENERAR EXCEL</span>
                      )}
                    </button>
                  </div>

                </div>
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
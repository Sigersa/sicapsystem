'use client';
import { useState, useEffect } from 'react';
import AppHeader from '@/components/header/1/1.1';
import {  Download,  Shield, AlertTriangle, CheckCircle, Lock } from 'lucide-react';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/1';
import { useInactivityManager } from '@/hooks/useInactivityManager';

type UserProfile = {
  SystemUserID: number;
  UserName: string;
  FirstName: string;
  LastName: string;
  MiddleName: string;
  FullName: string;
  Email: string;
  UserTypeID: number;
  CreationDate: string;
};

type UserTypeMap = {
  [key: number]: string;
};

export default function UserProfilePage() {
  // Usar hooks personalizados
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userTypeName, setUserTypeName] = useState<string>('');
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Mapeo de tipos de usuario
  const userTypeMap: UserTypeMap = {
    2: 'Administrativo',
  };

  // Función para formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  // Cargar datos del perfil
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/menu/user-details');
        
        if (!response.ok) {
          throw new Error('Error al cargar el perfil');
        }

        const data = await response.json();
        
        if (data.success && data.user) {
          setProfile(data.user);
          setUserTypeName(userTypeMap[data.user.UserTypeID] || 'Usuario del Sistema');
        } else {
          throw new Error('Datos de perfil no disponibles');
        }
      } catch (err: any) {
        console.error('Error fetching profile:', err);
        setError(err.message || 'Error al cargar la información del perfil');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user]);

  // Función para descargar el manual de usuario
  const downloadUserManual = () => {
    const manualUrl = '/MANUAL.pdf';
    
    const link = document.createElement('a');
    link.href = manualUrl;
    link.download = 'Manual_de_Usuario_SICAP.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setDownloadSuccess('MANUAL DESCARGADO EXITOSAMENTE');
    setTimeout(() => setDownloadSuccess(null), 3000);
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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER */}
      <AppHeader 
        title="PANEL ADMINISTRATIVO"
      />

      {/* CONTENIDO PRINCIPAL */}
      <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
        <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <div className="mb-6">
              <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5] w-full">
                <h1 className="text-xl font-bold text-white tracking-tight">INFORMACIÓN DEL PERFIL</h1>
                <p className="text-sm text-gray-200 mt-1">
                  Consulte su información personal en el sistema
                </p>
              </div>
            </div>

            {/* MENSAJES DE ÉXITO/ERROR */}
            {downloadSuccess && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 animate-fade-in">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <p className="text-sm font-medium text-gray-600 leading-5">
                    {downloadSuccess}
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 animate-fade-in">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                  <p className="text-sm font-medium text-gray-600 leading-5">
                    {error}
                  </p>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-3 px-4 py-2 bg-red-100 text-red-700 border border-red-300 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors uppercase tracking-wide"
                >
                  REINTENTAR
                </button>
              </div>
            )}

            {/* CONTENEDOR PRINCIPAL DE INFORMACIÓN */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* COLUMNA IZQUIERDA - INFORMACIÓN PERSONAL */}
              <div className="lg:col-span-2 space-y-6">
                {/* TARJETA DE INFORMACIÓN PERSONAL */}
                <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
                  <div className="bg-gray-200 px-6 py-4 border-b-2 border-gray-300">
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                      INFORMACIÓN PERSONAL
                    </h2>
                  </div>
                  
                  <div className="p-6">
                    {loading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a6ea5] mx-auto"></div>
                        <p className="mt-4 text-gray-700 font-medium">CARGANDO INFORMACIÓN...</p>
                      </div>
                    ) : profile ? (
                      <div className="space-y-6">
                        {/* Nombre completo */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                              NOMBRE COMPLETO
                            </label>
                            <div className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-300 rounded-lg font-medium">
                              <p className="text-gray-900">
                                {profile.FirstName} {profile.LastName} {profile.MiddleName}
                              </p>
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                              CORREO ELECTRÓNICO
                            </label>
                            <div className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-300 rounded-lg font-medium">
                              <p className="text-gray-900">
                                {profile.Email || 'No especificado'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Información de usuario */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                              NOMBRE DE USUARIO
                            </label>
                            <div className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-300 rounded-lg font-mono font-bold">
                              <p className="text-gray-900">
                                {profile.UserName}
                              </p>
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                              TIPO DE USUARIO
                            </label>
                            <div className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-300 rounded-lg font-medium">
                              <p className="text-gray-900">
                                {userTypeName}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Fechas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                              FECHA DE CREACIÓN
                            </label>
                            <div className="flex items-center relative">
                              <div className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-300 rounded-lg font-medium">
                                <p className="text-gray-900">
                                  {formatDate(profile.CreationDate)}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                              ID DE USUARIO
                            </label>
                            <div className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-300 rounded-lg font-mono font-bold">
                              <p className="text-gray-900">
                                {profile.SystemUserID.toString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 font-medium">No se pudo cargar la información del perfil</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* TARJETA DE ACERCA DEL SISTEMA */}
                <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
                  <div className="bg-gray-200 px-6 py-4 border-b-2 border-gray-300">
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                      ACERCA DEL SISTEMA
                    </h2>
                  </div>
                  
                  <div className="p-6">
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                        <h3 className="font-bold text-gray-900 mb-3 flex items-center text-base">
                          SICAP
                        </h3>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          Sistema Integral de Control Administrativo y de Procesos. Plataforma especializada en la gestión 
                          integral del capital humano, diseñada para optimizar procesos administrativos, control de personal, 
                          nómina, capacitación y desarrollo del talento organizacional.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg">
                          <h4 className="font-bold text-gray-900 mb-1 text-xs uppercase tracking-wide">Versión</h4>
                          <p className="text-sm text-gray-700 font-medium">1.0.0</p>
                        </div>
                        
                        <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg">
                          <h4 className="font-bold text-gray-900 mb-1 text-xs uppercase tracking-wide">Soporte</h4>
                          <p className="text-sm text-gray-700 font-medium">tics@gersainnovaciones.com</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMNA DERECHA - INFORMACIÓN DEL SISTEMA */}
              <div className="space-y-6">
                {/* TARJETA DE DOCUMENTACIÓN */}
                <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
                  <div className="bg-gray-200 px-6 py-4 border-b-2 border-gray-300">
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                      DOCUMENTACIÓN
                    </h2>
                  </div>
                  
                  <div className="p-6">
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                        <h3 className="font-bold text-gray-900 mb-2 flex items-center text-sm uppercase tracking-wide">
                          MANUAL DE USUARIO
                        </h3>
                        <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                          Descargue el manual completo del sistema para conocer todas las funcionalidades disponibles y el correcto uso de cada módulo.
                        </p>
                        <button
                          onClick={downloadUserManual}
                          className="w-full inline-flex items-center justify-center px-4 py-3 bg-[#3a6ea5] border border-[#3a6ea5] rounded-lg font-bold text-white hover:bg-[#2a4a75] focus:outline-none transition-colors text-sm uppercase tracking-wide"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          DESCARGAR MANUAL
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* TARJETA DE CONSEJOS DE SEGURIDAD */}
                <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
                  <div className="bg-gray-200 px-6 py-4 border-b-2 border-gray-300">
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                      SEGURIDAD
                    </h2>
                  </div>
                  
                  <div className="p-6">
                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg flex items-start">
                        <Lock className="h-4 w-4 text-[#3a6ea5] mr-2 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700">
                          Mantenga su contraseña en secreto y cámbiela periódicamente
                        </p>
                      </div>
                      
                      <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg flex items-start">
                        <Shield className="h-4 w-4 text-[#3a6ea5] mr-2 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700">
                          Cierre sesión cuando termine su trabajo, especialmente en equipos compartidos
                        </p>
                      </div>

                      <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg flex items-start">
                        <AlertTriangle className="h-4 w-4 text-[#3a6ea5] mr-2 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700">
                          No comparta sus credenciales de acceso con otros usuarios
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-300">
                      <p className="text-xs text-gray-600 leading-relaxed">
                        Para cualquier duda o incidente de seguridad, contacte inmediatamente al equipo de soporte técnico.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
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
        
        header, footer {
          z-index: 50 !important;
        }
      `}</style>
    </div>
  );
}
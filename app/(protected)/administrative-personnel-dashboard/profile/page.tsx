'use client';
import { useState, useEffect } from 'react';
import AppHeader from '@/components/header/2/2.1';
import { User, Calendar, FileText, Download, Info, Shield, Key, AlertTriangle } from 'lucide-react';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/2';
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
      <main className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="mb-6">
            <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5] w-full">
              <h1 className="text-xl font-bold text-white tracking-tight">INFORMACIÓN DEL PERFIL</h1>
              <p className="text-sm text-gray-200 mt-1">
                Consulte su información personal en el sistema
              </p>
            </div>
          </div>

          {/* Mostrar error si existe */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 font-medium flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                {error}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-3 py-1.5 bg-red-100 text-red-700 border border-red-300 rounded text-sm font-medium hover:bg-red-200 transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* CONTENEDOR PRINCIPAL DE INFORMACIÓN */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* COLUMNA IZQUIERDA - INFORMACIÓN PERSONAL */}
            <div className="lg:col-span-2 space-y-6"> {/* 3/5 = 60% */}
              {/* TARJETA DE INFORMACIÓN PERSONAL */}
              <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
                <div className="bg-gray-200 px-6 py-4 border-b-2 border-gray-300">
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                    <User className="h-5 w-5 mr-2 text-[#3a6ea5]" />
                    INFORMACIÓN PERSONAL
                  </h2>
                </div>
                
                <div className="p-6">
                  {profile ? (
                    <div className="space-y-6">
                      {/* Nombre completo */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                            NOMBRE COMPLETO
                          </label>
                          <div className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium">
                            <p className="text-sm text-gray-900 font-medium">
                              {profile.FirstName}
                              {' '}
                              {profile.LastName}
                              {' '}
                              {profile.MiddleName}
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                            CORREO ELECTRÓNICO
                          </label>
                          <div className="flex items-center relative">
                          <div className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium">
                              <p className="text-sm text-gray-900 font-medium">
                                {profile.Email || 'No especificado'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Información de usuario */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                            NOMBRE DE USUARIO
                          </label>
                          <div className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium">
                            <p className="text-sm text-gray-900 font-mono font-bold">
                              {profile.UserName}
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                            TIPO DE USUARIO
                          </label>
                          <div className="flex items-center relative">
                          <div className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium">
                              <p className="text-sm text-gray-900 font-medium">
                                {userTypeName}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Fechas */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                            FECHA DE CREACIÓN DE LA CUENTA
                          </label>
                          <div className="flex items-center relative">
                            <div className="absolute left-3">
                              <Calendar className="h-4 w-4 text-gray-600" />
                            </div>
                            <div className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none font-medium">
                              <p className="text-sm text-gray-900 font-medium">
                                {formatDate(profile.CreationDate)}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                            ID DE USUARIO
                          </label>
                          <div className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium">
                            <p className="text-sm text-gray-900 font-mono font-bold">
                              SICAP-{profile.SystemUserID.toString().padStart(6, '0')}
                            </p>
                          </div>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a6ea5] mx-auto"></div>
                      <p className="mt-4 text-gray-700 font-medium">Cargando información del usuario...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* TARJETA DE MANUAL DE USUARIO */}
              <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
                <div className="bg-gray-200 px-6 py-4 border-b-2 border-gray-300">
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                    <Info className="h-5 w-5 mr-2 text-[#3a6ea5]" />
                    ACERCA DEL SISTEMA
                  </h2>
                </div>
                
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                      <h3 className="font-bold text-gray-900 mb-2">SICAP -  Sistema Integral de Control Administrativo y de Procesos</h3>
                      <p className="text-sm text-gray-700">
                        Sistema web especializado en la gestión integral del capital humano, diseñada para optimizar
                         procesos administrativos, control de personal, nómina, capacitación y desarrollo del 
                         talento organizacional.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 border border-gray-300 rounded">
                        <h4 className="font-bold text-gray-900 mb-1 text-sm">Versión del Sistema</h4>
                        <p className="text-xs text-gray-600">1.0.0</p>
                      </div>
                      
                      <div className="p-3 bg-gray-50 border border-gray-300 rounded">
                        <h4 className="font-bold text-gray-900 mb-1 text-sm">Soporte Técnico</h4>
                        <p className="text-xs text-gray-600">tics@gersainnovaciones.com</p>
                      </div>
                      
                    </div>

                    <div className="pt-4 border-t border-gray-300">
                      <h4 className="font-bold text-gray-900 mb-2 text-sm">Funcionalidades Principales</h4>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-start">
                          <Key className="h-3 w-3 text-[#3a6ea5] mr-2 mt-0.5" />
                          <span>Gestión completa de usuarios y roles</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA - INFORMACIÓN DEL SISTEMA */}
            <div className="space-y-6"> {/* 2/5 = 40% */}
              {/* TARJETA DE DESCRIPCIÓN DEL SISTEMA */}
              
              <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
                <div className="bg-gray-200 px-6 py-4 border-b-2 border-gray-300">
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-[#3a6ea5]" />
                    DOCUMENTACIÓN DEL SISTEMA
                  </h2>
                </div>
                
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                      <h3 className="font-bold text-gray-900 mb-2 flex items-center">
                        MANUAL DE USUARIO
                      </h3>
                      <p className="text-sm text-gray-700 mb-3">
                        Descargue el manual completo del sistema para conocer todas las funcionalidades disponibles y el correcto uso de cada módulo.
                      </p>
                      <button
                        onClick={downloadUserManual}
                        className="inline-flex items-center justify-center px-4 py-2.5 bg-[#3a6ea5] border border-[#3a6ea5] rounded font-bold text-white hover:bg-[#2a4a75] focus:outline-none transition-colors text-sm"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        DESCARGAR MANUAL (PDF)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* TARJETA DE CONSEJOS DE SEGURIDAD */}
              <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
                <div className="bg-gray-200 px-6 py-4 border-b-2 border-gray-300">
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-[#3a6ea5]" />
                    CONSEJOS DE SEGURIDAD
                  </h2>
                </div>
                
                <div className="p-6">
                  <div className="space-y-3">
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                      <p className="text-xs text-gray-900 font-medium">
                         Mantenga su contraseña en secreto
                      </p>
                    </div>
                    
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                      <p className="text-xs text-gray-900 font-medium">
                         Cierre sesión cuando termine su trabajo
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-600">
                      Para cualquier duda o incidente de seguridad, contacte inmediatamente al equipo de soporte.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <Footer/>
      </main>
    </div>
  );
}
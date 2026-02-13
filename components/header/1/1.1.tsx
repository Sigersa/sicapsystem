'use client';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Bell, LogOut, User, ChevronDown, Home } from 'lucide-react';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  onLogout?: () => void;
  notificationCount?: number;
};

type UserData = {
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

export default function AppHeader({
  title,
  subtitle,
  onLogout,
  notificationCount = 0,
}: AppHeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Obtener datos del usuario al cargar el componente
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/menu/user-details');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setUserData(data.user);
          }
        } else {
          console.error('Error al obtener datos del usuario');
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Cerrar menús al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notifications = [
    { id: 1, text: 'Tienes un nuevo mensaje', time: 'Hace 5 min', read: false },
    { id: 2, text: 'Tu reporte está listo', time: 'Hace 1 hora', read: false },
    { id: 3, text: 'Recordatorio: Reunión a las 3 PM', time: 'Hace 2 horas', read: true },
    { id: 4, text: 'Actualización del sistema completada', time: 'Ayer', read: true },
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  // Función para manejar logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });      
      window.location.href = '/';
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Función para navegar a la pantalla principal
  const handleGoToMain = () => {
    // Redirige al dashboard principal basado en el tipo de usuario
    if (userData?.UserTypeID === 1) {
      window.location.href = '/system-admin-dashboard';
    } 
  };

  // Determinar qué mostrar en el header
  const displayName = userData?.FullName || userData?.UserName || 'Usuario';
  const displayEmail = userData?.Email || userData?.UserName || '';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <header className="fixed top-0 left-0 w-full bg-[#3a6ea5] shadow-sm border-b border-[#3a6ea5] z-50">
      <div className="w-full px-6 py-3 flex items-center justify-between">

        {/* Logo (sin fondo) y título */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <Image
              src="/1.png"
              alt="Logo del sistema"
              width={42}
              height={42}
              className="object-contain"
              priority
            />
          </div>

          <div className="border-l-2 border-white pl-4">
            <h1 className="text-xl font-bold text-white tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-gray-200 leading-tight mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Botón Principal, Notificaciones y usuario */}
        <div className="flex items-center space-x-4">

          {/* Botón Principal */}
          <button
            onClick={handleGoToMain}
            className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white transition-colors duration-200"
            title="Volver a la pantalla principal"
          >
            <Home className="w-4 h-4" />
            <span className="text-sm font-medium">Principal</span>
          </button>

          {/* Separador */}
          <div className="h-6 w-px bg-white/50" />

          {/* Notificaciones */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => {
                setIsNotificationsOpen(!isNotificationsOpen);
                setIsUserMenuOpen(false);
              }}
              className="relative p-2 text-white hover:bg-white/20 rounded-lg border border-white transition-colors"
              aria-label="Notificaciones"
            >
              <Bell className="w-5 h-5" />
              
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border border-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Panel de notificaciones */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-3 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">NOTIFICACIONES</h3>
                  <p className="text-xs text-gray-600">{unreadCount} sin leer</p>
                </div>
                
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 border-b border-gray-100 hover:bg-gray-50 ${
                        !notification.read ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <p className="text-sm text-gray-900">{notification.text}</p>
                        {!notification.read && (
                          <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{notification.time}</p>
                    </div>
                  ))}
                </div>
                
                <div className="p-2 border-t border-gray-200 bg-gray-50">
                  <button className="w-full text-center text-xs text-[#3a6ea5] hover:text-[#2a4a75] py-1">
                    Ver todas las notificaciones
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Separador */}
          <div className="h-6 w-px bg-white/50" />

          {/* Usuario */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => {
                setIsUserMenuOpen(!isUserMenuOpen);
                setIsNotificationsOpen(false);
              }}
              className="flex items-center space-x-3 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg border border-white transition-colors"
              disabled={loading}
            >
              <div className="flex items-center justify-center w-8 h-8 bg-white rounded-full border border-gray-200">
                <span className="text-[#3a6ea5] font-semibold text-sm">
                  {loading ? '...' : initials}
                </span>
              </div>

              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-white">
                  {loading ? 'Cargando...' : displayName}
                </p>
                {displayEmail && (
                  <p className="text-xs text-gray-200">
                    {loading ? '' : displayEmail}
                  </p>
                )}
              </div>

              <ChevronDown 
                className={`w-4 h-4 text-white transition-transform ${
                  isUserMenuOpen ? 'rotate-180' : ''
                } ${loading ? 'opacity-50' : ''}`}
              />
            </button>

            {/* Menú desplegable del usuario */}
            {isUserMenuOpen && userData && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                {/* Encabezado del menú */}
                <div className="p-3 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">INFORMACIÓN DEL USUARIO</h3>
                </div>
                
                {/* Información del usuario */}
                <div className="p-3 border-b border-gray-100 bg-white">
                  <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                  <p className="text-xs text-gray-600 truncate">{displayEmail}</p>
                  <div className="flex items-center mt-2">
                    <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full border border-gray-200">
                      ID: {userData.SystemUserID.toString()}
                    </span>
                  </div>
                </div>
                
                {/* Opciones del menú */}
                <div className="py-1">
                  <a
                    href="/system-admin-dashboard/profile"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <User className="w-4 h-4 mr-2 text-gray-500" />
                    Mi perfil
                  </a>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 border-t border-gray-100"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Cerrar sesión
                  </button>
                </div>
                
                {/* Pie del menú */}
                <div className="p-2 border-t border-gray-200 bg-gray-50">
                  <p className="text-xs text-gray-500 text-center">
                    SICAP v1.0.0
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
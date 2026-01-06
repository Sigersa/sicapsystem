'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

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
      // Opcional: llamar a API de logout para limpiar cookie
await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include'
  });      
      window.location.href = '/';
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };



  // Determinar qué mostrar en el header
  const displayName = userData?.FullName || userData?.UserName || 'Usuario';
  const displayEmail = userData?.Email || userData?.UserName || '';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <header className="bg-[#2358a2] shadow-sm border-b border-gray-200 relative z-30">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">

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

          <div>
            {/* Título corregido */}
            <h1 className="text-sm font-medium text-white tracking-wide uppercase leading-normal">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-white/70 leading-tight mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Notificaciones y usuario */}
        <div className="flex items-center space-x-4">

          {/* Notificaciones */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => {
                setIsNotificationsOpen(!isNotificationsOpen);
                setIsUserMenuOpen(false);
              }}
              className="relative p-2 text-white hover:bg-white/10 rounded-md transition"
              aria-label="Notificaciones"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>

              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center px-1">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Separador */}
          <div className="h-6 w-px bg-white/30" />

          {/* Usuario */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => {
                setIsUserMenuOpen(!isUserMenuOpen);
                setIsNotificationsOpen(false);
              }}
              className="flex items-center space-x-3"
              disabled={loading}
            >
              <div className="flex items-center justify-center w-8 h-8 bg-white rounded-md">
                <span className="text-[#2358a2] font-semibold text-sm">
                  {loading ? '...' : initials}
                </span>
              </div>

              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-white">
                  {loading ? 'Cargando...' : displayName}
                </p>
                {displayEmail && (
                  <p className="text-xs text-white/70">
                    {loading ? '' : displayEmail}
                  </p>
                )}
              </div>

              <svg
                className={`w-4 h-4 text-white transition-transform ${
                  isUserMenuOpen ? 'rotate-180' : ''
                } ${loading ? 'opacity-50' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Menú desplegable del usuario */}
            {isUserMenuOpen && userData && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                <div className="px-4 py-2 border-b">
                  <p className="text-sm font-medium text-gray-900">{displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{displayEmail}</p>
                </div>
                <a
                  href="/profile"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Mi perfil
                </a>
                <a
                  href="/settings"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Configuración
                </a>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
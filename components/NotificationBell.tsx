'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, CheckCircle, AlertCircle, Bell, User } from 'lucide-react';

// ==================== TIPOS ====================
interface Notification {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  entityType?: string;
  entityId?: number;
  type?: number;
  projectId?: number;
  createdByUserId?: number;
  createdByFirstName?: string;
  createdByLastName?: string;
}

interface NotificationBellProps {
  disabled?: boolean;
}

// ==================== MODALES REUTILIZABLES ====================
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

// ==================== COMPONENTE PRINCIPAL ====================
function NotificationBellContent({ disabled = false }: NotificationBellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Estado para el modal de confirmación
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'info'
  });

  const closeModal = () => {
    setModal({
      isOpen: false,
      title: '',
      message: '',
      type: 'info'
    });
  };

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setModal({
      isOpen: true,
      title,
      message,
      type
    });
  };

  const getUserInitials = (firstName?: string, lastName?: string) => {
    const f = firstName?.charAt(0).toUpperCase() || '';
    const l = lastName?.charAt(0).toUpperCase() || '';
    return f + l || 'U';
  };

  const getAvatarColor = (initials: string) => {
    const colors = [
      'bg-blue-100 text-blue-600',
      'bg-green-100 text-green-600', 
      'bg-red-100 text-red-600',
      'bg-yellow-100 text-yellow-600',
      'bg-purple-100 text-purple-600',
      'bg-pink-100 text-pink-600',
      'bg-indigo-100 text-indigo-600',
      'bg-teal-100 text-teal-600',
      'bg-orange-100 text-orange-600'
    ];
    return colors[initials.charCodeAt(0) % colors.length];
  };

  const fetchNotifications = async () => {
    if (disabled) return;
    try {
      const response = await fetch('/api/executive-manager/notificationsBell', { 
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Sesión expirada, redirigir al login
          router.replace('/');
          return;
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (Array.isArray(data)) {
        setNotifications(data);
        setUnreadCount(data.filter((n: Notification) => !n.isRead).length);
      }
    } catch (error) {
      console.error('Error al obtener notificaciones:', error);
      // No mostramos modal para evitar spam de errores
    }
  };

  const markAsRead = async (id: number) => {
    try {
      const response = await fetch('/api/executive-manager/notificationsBell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notificationId: id })
      });
      
      if (response.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else if (response.status === 401) {
        router.replace('/');
      }
    } catch (error) {
      console.error('Error al marcar como leída:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/executive-manager/notificationsBell/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
      } else if (response.status === 401) {
        router.replace('/');
      } else {
        showModal('Error', 'Error al marcar todas como leídas', 'error');
      }
    } catch (error) {
      console.error('Error al marcar todas como leídas:', error);
      showModal('Error', 'Error al conectar con el servidor', 'error');
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.isRead) await markAsRead(n.id);

    // Obtener projectId de la URL actual para pasarlo a las rutas
    const currentProjectId = searchParams.get('projectId');

    try {
      switch (n.type) {
        case 1:
          router.push('/executive-dashboard/modules/validation');
          break;
          
        case 3:
          if (n.projectId) {
            const projectId = n.projectId.toString();
            if (n.entityType) {
              router.push(`/project-manager-dashboard/projects/${projectId}/${n.entityType}`);
            } else {
              router.push(`/project-manager-dashboard/projects/${projectId}`);
            }
          }
          break;
          
        case 4:
          if (n.entityType && n.entityId) {
            const projectIdParam = currentProjectId ? `?projectId=${currentProjectId}` : '';
            router.push(`/dashboard/executives/${n.entityType}/${n.entityId}${projectIdParam}`);
          }
          break;
          
        case 5:
          router.push('/administrative-dashboard/modules/expenses-inquiry');
          break;
          
        default:
          // Manejar otros casos si es necesario
          break;
      }
    } catch (error) {
      console.error('Error al navegar:', error);
      showModal('Error', 'Error al procesar la notificación', 'error');
    }
    setIsOpen(false);
  };

  useEffect(() => {
    if (!disabled) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [disabled]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <div className="relative">
        <button
          className={`relative p-2 rounded-xl transition-all duration-300 group ${
            disabled 
              ? 'text-white/40 cursor-not-allowed' 
              : 'text-white/90 hover:text-white hover:bg-white/10'
          }`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          aria-label="Notificaciones"
        >
          <div className="absolute -inset-1 bg-white/10 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-300"></div>
          <Bell className="h-5 w-5 relative z-10" strokeWidth={2} />
          {unreadCount > 0 && !disabled && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-5 w-5 text-xs font-light text-white bg-red-500 rounded-full shadow-lg z-20">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && !disabled && (
          <div 
            ref={dropdownRef} 
            className="absolute right-0 mt-2 w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-blue-900/30 border border-white/20 overflow-hidden z-50 transform origin-top-right transition-all duration-300 scale-95 animate-in fade-in slide-in-from-top-2"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-[#3e6eb0] to-[#4a7bc1]">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-light text-white tracking-tight">Notificaciones</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-xs text-white/80 hover:text-white font-light tracking-wide transition-colors duration-200 bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg"
                  >
                    Marcar todas como leídas
                  </button>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <div className="flex justify-center mb-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-[#3e6eb0]/10 rounded-full animate-ping"></div>
                      <Bell className="h-8 w-8 text-gray-300 relative z-10" strokeWidth={1} />
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 font-light tracking-wide">No hay notificaciones nuevas</p>
                </div>
              ) : (
                notifications.map((n, index) => {
                  const initials = getUserInitials(n.createdByFirstName, n.createdByLastName);
                  const avatarColor = getAvatarColor(initials);
                  return (
                    <div 
                      key={n.id || index} 
                      className={`px-4 py-3 border-b border-white/10 hover:bg-gradient-to-r hover:from-blue-50 hover:to-white cursor-pointer transition-all duration-300 group ${
                        !n.isRead ? 'bg-blue-50/80 border-l-2 border-l-[#3e6eb0]' : 'hover:border-l-2 hover:border-l-[#3e6eb0]/20'
                      }`} 
                      onClick={() => handleNotificationClick(n)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleNotificationClick(n);
                        }
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        {/* Avatar */}
                        <div className={`flex-shrink-0 ${avatarColor} h-8 w-8 rounded-xl flex items-center justify-center text-xs font-light shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                          {initials}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <h4 className={`text-sm font-light tracking-wide ${
                              n.isRead ? 'text-gray-700' : 'text-[#3e6eb0]'
                            }`}>
                              {n.title}
                            </h4>
                            {!n.isRead && (
                              <span className="flex-shrink-0 ml-2 h-2 w-2 rounded-full bg-[#3e6eb0] animate-pulse"></span>
                            )}
                          </div>
                          
                          <p className="mt-1 text-sm text-gray-600 font-light tracking-wide leading-relaxed line-clamp-2">
                            {n.message}
                          </p>
                          
                          <div className="mt-2 flex items-center justify-between">
                            <p className="text-xs text-gray-500 font-light tracking-wide">
                              {n.createdAt}
                            </p>
                            {!n.isRead && (
                              <span className="text-xs text-[#3e6eb0] font-light tracking-wide bg-[#3e6eb0]/10 px-2 py-0.5 rounded-full">
                                Nuevo
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-white/10 bg-gray-50/80">
              <div className="flex justify-center">
                <button 
                  className="text-sm text-[#3e6eb0] hover:text-[#2d5599] font-light tracking-wide transition-colors duration-200 bg-white hover:bg-gray-50 px-4 py-1.5 rounded-lg border border-white/20 hover:shadow-md"
                  onClick={() => setIsOpen(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal para errores */}
      <Modal 
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      {/* Estilos globales consistentes con el sistema */}
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
        
        @keyframes slide-in-from-top-2 {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        
        .animate-in {
          animation-duration: 0.3s;
          animation-fill-mode: both;
        }
        
        .fade-in {
          animation-name: fade-in;
        }
        
        .slide-in-from-top-2 {
          animation-name: slide-in-from-top-2;
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        body.modal-open {
          overflow: hidden;
        }
      `}</style>
    </>
  );
}

// ==================== COMPONENTE PRINCIPAL CON SUSPENSE ====================
export default function NotificationBell({ disabled = false }: NotificationBellProps) {
  return (
    <Suspense fallback={
      <div className="relative">
        <button className="relative p-2 rounded-xl text-white/90" aria-label="Cargando notificaciones">
          <div className="absolute -inset-1 bg-white/10 rounded-xl blur opacity-0 transition duration-300"></div>
          <Bell className="h-5 w-5 relative z-10" strokeWidth={2} />
        </button>
      </div>
    }>
      <NotificationBellContent disabled={disabled} />
    </Suspense>
  );
}
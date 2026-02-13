'use client';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/header/2/2';
import Footer from '@/components/footer';
import { UserPlus, Users, FileText, ToolCase} from 'lucide-react';
import { useSessionManager } from '@/hooks/useSessionManager/2';
import { useInactivityManager } from '@/hooks/useInactivityManager';

type MenuItem = {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
};

export default function SystemAdminDashboard() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();

  const menuItems: MenuItem[] = [
    {
      id: 1,
      title: 'INGRESO / CONTRATACIÓN',
      description: 'Gestión de nuevos empleados y contratos',
      icon: <UserPlus className="h-6 w-6" />,
      href: '/administrative-personnel-dashboard/hiring'
    },
    {
      id: 2,
      title: 'GESTIÓN DEL PERSONAL',
      description: 'Administración de empleados activos',
      icon: <Users className="h-6 w-6" />,
      href: '/administrative-personnel-dashboard/personnel-management'
    },
    {
      id: 3,
      title: 'BAJA / TERMINACIÓN LABORAL',
      description: 'Procesos de terminación laboral',
      icon: <FileText className="h-6 w-6" />,
      href: '/administrative-personnel-dashboard/job-termination'
    },
    {
      id: 4,
      title: 'GESTIÓN DE PROYECTOS',
      description: 'Administración de proyectos',
      icon: <ToolCase className="h-6 w-6" />,
      href: '/administrative-personnel-dashboard/projects'
    }
  ];

  const handleMenuItemClick = (href: string) => {
    router.push(href);
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
      {/* HEADER - Fixed */}
      <AppHeader 
        title="PANEL ADMINISTRATIVO"
      />

      {/* CONTENT - Ajustado para header y footer fijos */}
      <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
        <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5] w-full">
                <h1 className="text-xl font-bold text-white tracking-tight">MENÚ PRINCIPAL</h1>
                <p className="text-sm text-gray-200 mt-1">
                  Seleccione una opción para acceder a las funciones del sistema
                </p>
              </div>
            </div>
          </div>

          {/* MENÚ DE OPCIONES */}
          <div className="bg-white rounded-lg shadow border border-gray-300 p-4 md:p-6 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="relative border-2 border-gray-300 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-[#3a6ea5] bg-white group"
                  onClick={() => handleMenuItemClick(item.href)}
                >
                  {/* Icono */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded border border-gray-300 bg-gray-100 group-hover:bg-[#3a6ea5] group-hover:border-[#3a6ea5] transition-colors">
                      <div className="text-gray-700 group-hover:text-white transition-colors">
                        {item.icon}
                      </div>
                    </div>
                    <div className="h-5 w-5 text-gray-400 group-hover:text-[#3a6ea5] transition-colors opacity-0 group-hover:opacity-100">
                      →
                    </div>
                  </div>
                  
                  {/* Contenido */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1 uppercase">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-600 font-medium">
                      {item.description}
                    </p>
                  </div>
                  
                  {/* Estado activo */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-transparent group-hover:bg-[#3a6ea5] rounded-b-lg transition-colors"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER - Fixed */}
      <Footer />

      {/* Estilos globales para layout */}
      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        
        /* Ajustes de layout para header y footer fijos */
        body {
          padding-top: 0;
          padding-bottom: 0;
          margin: 0;
          overflow-x: hidden;
        }
        
        /* Asegurar que el header y footer tengan z-index adecuado */
        header, footer {
          z-index: 50 !important;
        }
        
        /* Mejorar la visualización en móviles */
        @media (max-width: 640px) {
          .grid {
            gap: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
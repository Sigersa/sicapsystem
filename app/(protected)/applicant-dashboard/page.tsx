'use client';
import AppHeader from '@/components/header/2/2';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/4';
import { useInactivityManager } from '@/hooks/useInactivityManager';

export default function SystemAdminDashboard() {
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();

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
        title="PANEL ASPIRANTE"
      />

      {/* CONTENT */}
      <main className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5] w-full">
              <h1 className="text-xl font-bold text-white tracking-tight">BIENVENIDO ASPIRANTE</h1>
              
            </div>
          </div>
        </div>
        <Footer/>
      </main>
    </div>
  );
}
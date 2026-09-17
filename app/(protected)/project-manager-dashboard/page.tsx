'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/header/3/3'
import Footer from '@/components/footer'
import { useSessionManager } from '@/hooks/useSessionManager/3'
import { useInactivityManager } from '@/hooks/useInactivityManager'

interface UserData {
  id: number
  usuario: string
  tipoUsuario: string
  nombre: string
  apellido: string
  email: string
  proyectoAsignado: string
  proyectoActivo: boolean
}

interface Project {
  ProjectID: number
  NameProject: string
  ProjectType: number
  Status: number
  ProjectBudget: number
  StartDate: string
  EndDate: string
  CreatedBy: string
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: sessionLoading } = useSessionManager()
  useInactivityManager()

  const [userData, setUserData] = useState<UserData>({
    id: 0,
    usuario: '',
    tipoUsuario: '',
    nombre: '',
    apellido: '',
    email: '',
    proyectoAsignado: '',
    proyectoActivo: false
  })
  const [loading, setLoading] = useState(true)
  const [activeProjects, setActiveProjects] = useState<Project[]>([])
  const [currentProjectName, setCurrentProjectName] = useState('')

  // Efecto para cargar datos del usuario y proyectos
  useEffect(() => {
    let isMounted = true

    const fetchData = async () => {
      try {
        // Primero validar sesión
        const sessionResponse = await fetch('/api/auth/validate-session', {
          credentials: 'include'
        })

        if (!sessionResponse.ok) {
          console.log('Sesión no válida, redirigiendo a login')
          router.replace('/')
          return
        }

        const sessionData = await sessionResponse.json()

        if (!isMounted) return

        if (!sessionData?.valid || !sessionData?.user) {
          console.log('Datos de sesión inválidos, redirigiendo a login')
          router.replace('/')
          return
        }

        // Establecer datos del usuario desde la sesión
        setUserData({
          id: sessionData.user.SystemUserID || 0,
          usuario: sessionData.user.UserName || '',
          tipoUsuario: sessionData.role?.toString() || '',
          nombre: sessionData.user.UserName || '',
          apellido: '',
          email: '',
          proyectoAsignado: '',
          proyectoActivo: true
        })

        // Luego cargar proyectos activos
        const projectsResponse = await fetch('/api/project-manager/projects/active', {
          credentials: 'include'
        })

        if (!projectsResponse.ok) {
          console.error('Error al obtener proyectos:', projectsResponse.status)
          // No redirigir, solo mostrar sin proyectos
          if (isMounted) {
            setActiveProjects([])
            setLoading(false)
          }
          return
        }

        const projectsData = await projectsResponse.json()

        if (!isMounted) return

        setActiveProjects(projectsData.projects || [])
        setCurrentProjectName(projectsData.currentProjectName || '')

      } catch (error) {
        console.error('Error al obtener datos:', error)
        router.replace('/')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchData()

    return () => {
      isMounted = false
    }
  }, [router])

  // Calcular nombre completo del usuario
  const userFullName = React.useMemo(() => {
    if (userData.nombre && userData.apellido) {
      return `${userData.nombre} ${userData.apellido}`
    }
    return userData.usuario || 'Usuario'
  }, [userData])

  // Mostrar loading mientras se verifica la sesión
  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3a6ea5] mx-auto"></div>
          <p className="mt-4 text-gray-700 font-medium">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  // Si no hay usuario (sesión inválida), no renderizar nada
  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <AppHeader title="PANEL DE ADMINISTRACIÓN DE PROYECTOS" />

      <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
        <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
          
          {/* Header Section */}
          <div className="mb-6 sm:mb-8">
            <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5] w-full">
              <h1 className="text-xl font-bold text-white tracking-tight">
                ¡BIENVENIDO(A)!
              </h1>
              <p className="text-sm text-gray-200 mt-1">
                Gestiona y accede a tus proyectos activos
              </p>
            </div>
          </div>

          {/* Proyectos Activos */}
          <div className="bg-white rounded-lg shadow border border-gray-300 p-4 md:p-6 mb-6">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">
                  Proyectos Activos
                </h2>
                <p className="text-sm text-gray-600 font-medium mt-1">
                  Gestiona y accede a tus proyectos activos
                </p>
              </div>
              <span className="bg-[#3a6ea5] text-white text-xs px-3 py-1 rounded-full font-medium tracking-wide">
                {activeProjects.length} Proyecto(s)
              </span>
            </div>

            {activeProjects.length === 0 ? (
              <div className="p-8 text-center">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 mb-2 text-sm font-medium">
                    No tienes proyectos activos
                  </p>
                  <p className="text-gray-500 text-xs">
                    Los proyectos asignados aparecerán aquí
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {activeProjects.map((project) => (
                  <ProjectCard
                    key={project.ProjectID}
                    project={project}
                    userId={userData.id}
                  />
                ))}
              </div>
            )}
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
        header,
        footer {
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
  )
}

// Componente ProjectCard
function ProjectCard({ project, userId }: { project: Project; userId: number }) {
  const getProjectTypeText = (type: number) => {
    return type === 1 ? 'Servicio Especializado' : 'Servicio Llave en Mano'
  }

  const getDashboardUrl = (type: number, projectId: number) => {
    return type === 1
      ? `/project-manager-dashboard/${projectId}/main-specialized-service`
      : `/project-manager-dashboard/${projectId}/main-turnkey-service`
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-MX')
  }

  return (
    <div className="relative border-2 border-gray-300 rounded-lg p-4 transition-all duration-200 hover:shadow-md hover:border-[#3a6ea5] bg-white group">
      {/* Header de la tarjeta */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 uppercase mb-1 truncate">
            {project.NameProject || `Proyecto ${project.ProjectID}`}
          </h3>
          <span className="bg-[#3a6ea5] text-white text-xs px-2 py-0.5 rounded-full font-medium tracking-wide">
            ID: {project.ProjectID}
          </span>
        </div>
        <div className="flex-shrink-0 ml-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
            Activo
          </span>
        </div>
      </div>

      {/* Información del proyecto */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center text-xs">
          <svg className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="text-gray-600 font-medium truncate">{getProjectTypeText(project.ProjectType)}</span>
        </div>

        {project.ProjectBudget && (
          <div className="flex items-center text-xs">
            <svg className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-gray-600 font-medium">{formatCurrency(Number(project.ProjectBudget))}</span>
          </div>
        )}

        {project.StartDate && (
          <div className="flex items-center text-xs">
            <svg className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span className="text-gray-600 font-medium">Inicio: {formatDate(project.StartDate)}</span>
          </div>
        )}
      </div>

      {/* Botón de acción */}
      <Link
        href={getDashboardUrl(project.ProjectType, project.ProjectID)}
        className="group/btn relative w-full px-4 py-2.5 rounded-lg text-white font-bold tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#3a6ea5] focus:ring-offset-2 overflow-hidden block text-center bg-[#3a6ea5] hover:bg-[#2d5a8a]"
      >
        <div className="relative z-10 flex items-center justify-center text-sm">
          Ir al Dashboard
          <span className="ml-2 opacity-0 group-hover/btn:opacity-100 transition-opacity">→</span>
        </div>
      </Link>

      {/* Estado activo (barra inferior) */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-transparent group-hover:bg-[#3a6ea5] rounded-b-lg transition-colors"></div>
    </div>
  )
}
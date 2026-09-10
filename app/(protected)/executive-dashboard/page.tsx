'use client'

import React, { useEffect, useState, useRef } from 'react'
import AppHeader from '@/components/header/4/4'
import Footer from '@/components/footer'
import { useRouter } from 'next/navigation'
import { useSessionManager } from '@/hooks/useSessionManager/4'
import { useInactivityManager } from '@/hooks/useInactivityManager'
import { UserPlus, Users, FileText, ToolCase } from 'lucide-react'

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

interface ProjectInfo {
  projectId: number
  projectName: string
  projectBudget: number
  totalExpenses: number
  budgetUsagePercentage: number
  budgetExceeded: boolean
  createdBy?: number
}

interface ProjectStatus {
  hasProject: boolean
  projects?: ProjectInfo[]
  budgetExceeded?: boolean
}

interface MenuItem {
  id: number
  title: string
  description: string
  icon: React.ReactNode
  href: string
}

export default function Page() {
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
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [filteredProjects, setFilteredProjects] = useState<ProjectInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const menuItems: MenuItem[] = [
    {
      id: 1,
      title: 'REPORTES Y ANÁLISIS',
      description: 'Generación de reportes detallados y análisis de datos',
      icon: <UserPlus className="h-6 w-6" />,
      href: '/executive-dashboard/modules/reports'
    },
    {
      id: 2,
      title: 'GESTIÓN DE CLIENTES',
      description: 'Administración integral de la información de clientes',
      icon: <FileText className="h-6 w-6" />,
      href: '/executive-dashboard/modules/clients'
    },
    {
      id: 3,
      title: 'VALIDACIÓN Y CONTROL DE GASTOS',
      description: 'Validación y control de registros de gastos por proyecto',
      icon: <ToolCase className="h-6 w-6" />,
      href: '/executive-dashboard/modules/validation'
    },
    {
      id: 4,
      title: 'GESTIÓN DE PROYECTOS',
      description: 'Asignación y conclusión de proyectos corporativos',
      icon: <ToolCase className="h-6 w-6" />,
      href: '/executive-dashboard/modules/project-assignment-completion'
    }
  ]

  // Efecto principal para cargar datos del usuario
  useEffect(() => {
    let isMounted = true

    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/auth/validate-session', {
          credentials: 'include'
        })

        if (!response.ok) {
          console.log('Sesión no válida, redirigiendo a login')
          router.replace('/')
          return
        }

        const data = await response.json()

        if (!isMounted) return

        if (!data?.valid || !data?.user) {
          console.log('Datos de sesión inválidos, redirigiendo a login')
          router.replace('/')
          return
        }

        setUserData({
          id: data.user.SystemUserID || 0,
          usuario: data.user.UserName || '',
          tipoUsuario: data.role?.toString() || '',
          nombre: data.user.UserName || '',
          apellido: '',
          email: '',
          proyectoAsignado: '',
          proyectoActivo: true
        })

      } catch (error) {
        console.error('Error al obtener datos de usuario:', error)
        router.replace('/')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchUserData()

    return () => {
      isMounted = false
    }
  }, [router])

  // Efecto separado para cargar proyectos una vez que userData esté disponible
  useEffect(() => {
    if (!userData.id || userData.id === 0) return

    const fetchProjectStatus = async () => {
      try {
        const res = await fetch('/api/executive-manager/projects/status', {
          credentials: 'include'
        })

        if (!res.ok) {
          console.error('Error en la respuesta:', res.status, res.statusText)
          return
        }

        const data: ProjectStatus = await res.json()

        if (data.projects && data.projects.length > 0) {
          setFilteredProjects(data.projects)

          const hasBudgetExceeded = data.projects.some(project => project.budgetExceeded)

          setProjectStatus({
            ...data,
            budgetExceeded: hasBudgetExceeded
          })

          if (hasBudgetExceeded && data.projects.length > 0) {
            setShowModal(true)
          }
        } else {
          setProjectStatus(data)
          setFilteredProjects([])
        }
      } catch (error) {
        console.error('Error al obtener estado del proyecto:', error)
      }
    }

    fetchProjectStatus()
  }, [userData.id])

  const handleMenuItemClick = (href: string) => {
    router.push(href)
  }

  // Mostrar loading mientras se verifica la sesión
  if (sessionLoading || isLoading) {
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
      <AppHeader title="PANEL EJECUTIVO" />

      <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
        <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
          {/* Header Section */}
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

          {/* Dashboard Grid */}
          <div className="bg-white rounded-lg shadow border border-gray-300 p-4 md:p-6 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="relative border-2 border-gray-300 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-[#3a6ea5] bg-white group"
                  onClick={() => handleMenuItemClick(item.href)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleMenuItemClick(item.href)
                    }
                  }}
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

      {/* Budget Alert Modal */}
      {showModal && filteredProjects && filteredProjects.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false)
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl border border-gray-300 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="relative p-6 border-b border-gray-200 bg-[#3a6ea5] rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="relative">
                      <div className="absolute inset-0 bg-white/20 rounded-full animate-ping"></div>
                      <svg className="h-8 w-8 text-white relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-white">Alerta de Presupuesto</h3>
                    <p className="text-white/80 font-medium text-sm mt-1">
                      {userData.tipoUsuario === '4'
                        ? 'Tus proyectos que requieren atención inmediata'
                        : 'Proyectos que requieren atención inmediata'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white/80 hover:text-white transition-colors duration-200 bg-white/10 hover:bg-white/20 rounded-full p-1"
                  aria-label="Cerrar modal"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mt-3 flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                  <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                </div>
                <span className="text-white/70 text-xs font-medium">Nivel de Alerta: Alto</span>
              </div>
            </div>

            <div className="p-6 max-h-80 overflow-y-auto">
              <div className="space-y-4">
                {filteredProjects.map((project) => (
                  <div
                    key={project.projectId}
                    className="bg-white rounded-lg border border-gray-300 p-4"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="text-lg font-bold tracking-tight text-[#3a6ea5]">{project.projectName}</h4>
                          <span className="bg-[#3a6ea5] text-white text-xs px-2 py-0.5 rounded-full font-medium tracking-wide">
                            ID: {project.projectId}
                          </span>
                        </div>
                        <p className="text-gray-600 font-medium text-xs">
                          Estado:{' '}
                          <span
                            className={`font-bold ${
                              project.budgetUsagePercentage >= 100
                                ? 'text-red-500'
                                : project.budgetUsagePercentage >= 80
                                ? 'text-orange-400'
                                : 'text-yellow-500'
                            }`}
                          >
                            {project.budgetUsagePercentage >= 100
                              ? 'Presupuesto Excedido'
                              : project.budgetUsagePercentage >= 80
                              ? 'Alto Consumo'
                              : 'Consumo Moderado'}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <div
                          className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                            project.budgetUsagePercentage >= 100
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : project.budgetUsagePercentage >= 80
                              ? 'bg-orange-100 text-orange-800 border border-orange-200'
                              : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                          }`}
                        >
                          {project.budgetUsagePercentage.toFixed(1)}% Utilizado
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 font-medium text-xs">Presupuesto Total</span>
                          <span className="font-bold text-[#3a6ea5] text-sm">
                            ${project.projectBudget.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 font-medium text-xs">Gastos Acumulados</span>
                          <span className="font-bold text-[#3a6ea5] text-sm">
                            ${project.totalExpenses.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-lg font-bold text-[#3a6ea5] mb-0.5">
                            ${(project.projectBudget - project.totalExpenses).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-600 font-medium tracking-wide">Saldo Disponible</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex justify-between text-xs font-medium text-gray-600 mb-1">
                        <span>Progreso del Presupuesto</span>
                        <span>{project.budgetUsagePercentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full relative ${
                            project.budgetUsagePercentage >= 100
                              ? 'bg-gradient-to-r from-red-500 to-red-600'
                              : project.budgetUsagePercentage >= 80
                              ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                              : 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                          }`}
                          style={{ width: `${Math.min(project.budgetUsagePercentage, 100)}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 font-medium mt-0.5">
                        <span>0%</span>
                        <span>60%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <div className="flex justify-between items-center">
                <p className="text-gray-600 font-medium text-xs">
                  {filteredProjects.length} proyecto(s) requieren revisión
                  {userData.tipoUsuario === '4' && ' (Tus proyectos)'}
                </p>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 bg-[#3a6ea5] text-white font-bold tracking-wide rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#3a6ea5] focus:ring-offset-2 text-sm hover:bg-[#2d5a8a]"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
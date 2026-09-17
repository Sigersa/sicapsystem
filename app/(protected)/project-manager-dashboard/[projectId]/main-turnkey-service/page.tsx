'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/header/3/3.1'
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
  projectId: number | null
}

interface BudgetStatus {
  hasProject: boolean
  projectId: number | null
  projectBudget: number
  totalExpenses: number
  budgetUsagePercentage: number
  budgetExceeded: boolean
}

interface DashboardCardProps {
  title: string
  icon: React.ReactNode
  description: string
  linkText: string
  href: string
  disabled?: boolean
  budgetExceeded?: boolean
  projectId: number | null
}

interface ProjectData {
  projectId: number
  projectName: string
}

interface PageProps {
  params: Promise<{
    projectId: string
  }>
}

export default function Page({ params }: PageProps) {
  const router = useRouter()
  const { user, loading: sessionLoading } = useSessionManager()
  useInactivityManager()

  const { projectId } = React.use(params)

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
  })
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus>({
    hasProject: false,
    projectId: null,
    projectBudget: 0,
    totalExpenses: 0,
    budgetUsagePercentage: 0,
    budgetExceeded: false
  })
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)

  // Determinar si el sistema debe estar deshabilitado (solo por presupuesto excedido)
  const isSystemDisabled = useMemo(() => {
    return budgetStatus.budgetExceeded
  }, [budgetStatus.budgetExceeded])

  // Función para obtener el nombre del proyecto actual
  const fetchCurrentProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/project-manager/projects/get-project-name?projectId=${projectId}`, {
        credentials: 'include'
      })
      if (response.ok) {
        const projectData = await response.json()
        setCurrentProject(projectData)
      } else {
        console.error('Error al obtener datos del proyecto')
      }
    } catch (error) {
      console.error('Error al obtener proyecto:', error)
    }
  }

  useEffect(() => {
    let isMounted = true

    const fetchData = async () => {
      try {
        // Validar sesión usando el mismo endpoint del sistema existente
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
        const userSessionData: UserData = {
          id: sessionData.user.SystemUserID || 0,
          usuario: sessionData.user.UserName || '',
          tipoUsuario: sessionData.role?.toString() || '',
          nombre: sessionData.user.UserName || '',
          apellido: '',
          email: '',
          proyectoAsignado: '',
          proyectoActivo: true,
          projectId: projectId ? parseInt(projectId) : null
        }

        // Si hay projectId en los params, obtener datos específicos de ese proyecto
        if (projectId) {
          await fetchCurrentProject(projectId)

          const budgetResponse = await fetch(`/api/project-manager/projects/budget-status?projectId=${projectId}`, {
            credentials: 'include'
          })
          const budgetData = budgetResponse.ok
            ? await budgetResponse.json()
            : {
                hasProject: false,
                projectId: null,
                projectBudget: 0,
                totalExpenses: 0,
                budgetUsagePercentage: 0,
                budgetExceeded: false
              }

          if (!isMounted) return

          setUserData(userSessionData)
          setBudgetStatus(budgetData)
        } else {
          if (!isMounted) return
          setUserData(userSessionData)
        }
      } catch (error) {
        console.error('Error al obtener datos:', error)
        router.replace('/')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    // Solo ejecutar si la sesión ya cargó
    if (!sessionLoading && user) {
      fetchData()
    }
  }, [router, projectId, sessionLoading, user])

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

  const disableDashboards = budgetStatus.budgetExceeded
  const displayProjectName = currentProject?.projectName || userData.proyectoAsignado

  return (
    <div className="min-h-screen bg-gray-100">
      <AppHeader title="PANEL DE ADMINISTRACIÓN DE PROYECTOS" />

      <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
        <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
          
          {/* Header Section - Información del Proyecto */}
          <div className="mb-6 sm:mb-8">
            <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5] w-full">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-xl font-bold text-white tracking-tight uppercase">
                      {displayProjectName || 'PROYECTO'}
                    </h1>
                    <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-medium rounded-full border border-white/30">
                      ID: {projectId}
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 mt-1">
                    Gestiona los módulos del proyecto
                  </p>
                </div>

                {/* Barra de progreso circular */}
                {budgetStatus.hasProject && (
                  <div className="relative flex-shrink-0">
                    <div className="w-16 h-16">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth="8"
                          fill="none"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke={
                            budgetStatus.budgetExceeded
                              ? '#ef4444'
                              : budgetStatus.budgetUsagePercentage > 60
                                ? '#f59e0b'
                                : '#10b981'
                          }
                          strokeWidth="8"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={251.2}
                          strokeDashoffset={
                            251.2 -
                            (251.2 * Math.min(budgetStatus.budgetUsagePercentage, 100)) / 100
                          }
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">
                          {Math.min(Math.round(budgetStatus.budgetUsagePercentage), 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Estadísticas del presupuesto */}
              {budgetStatus.hasProject && (
                <div className="mt-4 pt-4 border-t border-white/20">
                  <div className="flex flex-wrap items-center gap-4 mb-3">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          budgetStatus.budgetExceeded
                            ? 'bg-red-400 animate-pulse'
                            : budgetStatus.budgetUsagePercentage > 60
                              ? 'bg-yellow-400'
                              : 'bg-green-400'
                        }`}
                      ></div>
                      <span className="text-xs font-medium text-white">
                        {typeof budgetStatus.budgetUsagePercentage === 'number'
                          ? budgetStatus.budgetUsagePercentage.toFixed(2)
                          : '0.00'}
                        % utilizado
                      </span>
                    </div>

                    <div className="w-px h-4 bg-white/30"></div>

                    <div className="flex items-center space-x-1">
                      <span className="text-xs font-medium text-gray-200">Presupuesto:</span>
                      <span className="text-xs font-bold text-white">
                        ${budgetStatus.projectBudget.toLocaleString()}
                      </span>
                    </div>

                    <div className="w-px h-4 bg-white/30"></div>

                    <div className="flex items-center space-x-1">
                      <span className="text-xs font-medium text-gray-200">Gastado:</span>
                      <span className="text-xs font-bold text-white">
                        ${budgetStatus.totalExpenses.toLocaleString()}
                      </span>
                    </div>

                    <div className="w-px h-4 bg-white/30"></div>

                    <div className="flex items-center space-x-1">
                      <span className="text-xs font-medium text-gray-200">Disponible:</span>
                      <span className="text-xs font-bold text-green-300">
                        $
                        {(
                          budgetStatus.projectBudget - budgetStatus.totalExpenses
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Barra de progreso horizontal */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-200 mb-1">
                      <span className="text-xs font-medium">Progreso del presupuesto</span>
                      <span className="font-bold text-white">
                        {typeof budgetStatus.budgetUsagePercentage === 'number'
                          ? budgetStatus.budgetUsagePercentage.toFixed(1)
                          : '0.0'}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full relative transition-all duration-1000 ease-out ${
                          budgetStatus.budgetExceeded
                            ? 'bg-gradient-to-r from-red-400 to-red-500'
                            : budgetStatus.budgetUsagePercentage > 60
                              ? 'bg-gradient-to-r from-yellow-300 to-yellow-400'
                              : 'bg-gradient-to-r from-green-300 to-green-400'
                        }`}
                        style={{ width: `${Math.min(budgetStatus.budgetUsagePercentage, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-300 mt-1">
                      <span className="text-xs">0%</span>
                      <span
                        className={`text-xs ${
                          budgetStatus.budgetUsagePercentage >= 80
                            ? 'text-red-300 font-medium'
                            : ''
                        }`}
                      >
                        80% Límite
                      </span>
                      <span className="text-xs">100%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Alertas - SOLO PRESUPUESTO EXCEDIDO */}
          {budgetStatus.budgetExceeded && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-lg shadow">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 font-medium">
                    <strong>Alerta de presupuesto:</strong> Se ha superado el 80% del presupuesto
                    asignado a tu proyecto (
                    {typeof budgetStatus.budgetUsagePercentage === 'number'
                      ? budgetStatus.budgetUsagePercentage.toFixed(2)
                      : '0.00'}
                    % utilizado). El acceso a las funcionalidades del sistema han sido
                    deshabilitadas hasta que se te asigne presupuesto adicional.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Dashboard Grid - Módulos del Proyecto */}
          <div className="bg-white rounded-lg shadow border border-gray-300 p-4 md:p-6 mb-6">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">
                  Módulos del Proyecto
                </h2>
                <p className="text-sm text-gray-600 font-medium mt-1">
                  Accede a las funcionalidades del proyecto
                </p>
              </div>
              <span
                className={`text-white text-xs px-3 py-1 rounded-full font-medium tracking-wide ${
                  budgetStatus.budgetExceeded ? 'bg-red-500' : 'bg-[#3a6ea5]'
                }`}
              >
                {budgetStatus.budgetExceeded ? 'Bloqueado' : 'Disponible'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              <DashboardCard
                title="Reportes"
                icon={
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                }
                description="Generación de reportes consolidados"
                linkText="Generar reportes"
                href={`/project-manager-dashboard/projects/${projectId}/reports`}
                disabled={disableDashboards}
                budgetExceeded={budgetStatus.budgetExceeded}
                projectId={projectId ? parseInt(projectId) : null}
              />

              <DashboardCard
                title="Hospedajes"
                icon={
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
                description="Gestión de hospedajes"
                linkText="Ver hospedajes"
                href={`/project-manager-dashboard/projects/${projectId}/lodging`}
                disabled={disableDashboards}
                budgetExceeded={budgetStatus.budgetExceeded}
                projectId={projectId ? parseInt(projectId) : null}
              />

              <DashboardCard
                title="Nóminas"
                icon={
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                }
                description="Gestión de nóminas"
                linkText="Ver nóminas"
                href={`/project-manager-dashboard/projects/${projectId}/payroll`}
                disabled={disableDashboards}
                budgetExceeded={budgetStatus.budgetExceeded}
                projectId={projectId ? parseInt(projectId) : null}
              />

              <DashboardCard
                title="Herramientas / Equipos"
                icon={
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                  </svg>
                }
                description="Gestión de herramientas y/o equipos"
                linkText="Ver herramientas y/o equipos"
                href={`/project-manager-dashboard/projects/${projectId}/tools-equipment`}
                disabled={disableDashboards}
                budgetExceeded={budgetStatus.budgetExceeded}
                projectId={projectId ? parseInt(projectId) : null}
              />

              <DashboardCard
                title="Traslados de personal a sitio"
                icon={
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                }
                description="Gestión de traslados de personal a sitio"
                linkText="Ver traslados"
                href={`/project-manager-dashboard/projects/${projectId}/personnel-transfer`}
                disabled={disableDashboards}
                budgetExceeded={budgetStatus.budgetExceeded}
                projectId={projectId ? parseInt(projectId) : null}
              />

              <DashboardCard
                title="Traslados de infraestructura"
                icon={
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                  </svg>
                }
                description="Gestión de traslados de infraestructura"
                linkText="Ver traslados"
                href={`/project-manager-dashboard/projects/${projectId}/infrastructure-transfer`}
                disabled={disableDashboards}
                budgetExceeded={budgetStatus.budgetExceeded}
                projectId={projectId ? parseInt(projectId) : null}
              />

              <DashboardCard
                title="Préstamos"
                icon={
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                description="Gestión de préstamos"
                linkText="Ver préstamos"
                href={`/project-manager-dashboard/projects/${projectId}/loans`}
                disabled={disableDashboards}
                budgetExceeded={budgetStatus.budgetExceeded}
                projectId={projectId ? parseInt(projectId) : null}
              />

              <DashboardCard
                title="Consumibles administrativos"
                icon={
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                }
                description="Gestión de consumibles administrativos"
                linkText="Ver consumibles"
                href={`/project-manager-dashboard/projects/${projectId}/administrative-consumable`}
                disabled={disableDashboards}
                budgetExceeded={budgetStatus.budgetExceeded}
                projectId={projectId ? parseInt(projectId) : null}
              />

              <DashboardCard
                title="EPP"
                icon={
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13a4 4 0 014-4h2a2 2 0 012 2v1a2 2 0 01-2 2H7a4 4 0 01-4-4zM21 13a4 4 0 00-4-4h-2a2 2 0 00-2 2v1a2 2 0 002 2h2a4 4 0 004-4z" />
                  </svg>
                }
                description="Gestión de equipo de protección personal"
                linkText="Ver EPP"
                href={`/project-manager-dashboard/projects/${projectId}/personal-protective-equipment`}
                disabled={disableDashboards}
                budgetExceeded={budgetStatus.budgetExceeded}
                projectId={projectId ? parseInt(projectId) : null}
              />

              <DashboardCard
                title="Combustibles de transportación local"
                icon={
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
                  </svg>
                }
                description="Gestión de combustibles de transportación local"
                linkText="Ver combustibles"
                href={`/project-manager-dashboard/projects/${projectId}/local-transportation-fuel`}
                disabled={disableDashboards}
                budgetExceeded={budgetStatus.budgetExceeded}
                projectId={projectId ? parseInt(projectId) : null}
              />

              <DashboardCard
                title="Servicios de financiamiento (cliente)"
                icon={
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                  </svg>
                }
                description="Gestión de servicios de financiamiento (cliente)"
                linkText="Ver servicios"
                href={`/project-manager-dashboard/projects/${projectId}/financing-services(client)`}
                disabled={disableDashboards}
                budgetExceeded={budgetStatus.budgetExceeded}
                projectId={projectId ? parseInt(projectId) : null}
              />

              <DashboardCard
                title="Consumibles operativos"
                icon={
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                }
                description="Gestión de consumibles operativos"
                linkText="Ver consumibles"
                href={`/project-manager-dashboard/projects/${projectId}/operational-consumable`}
                disabled={disableDashboards}
                budgetExceeded={budgetStatus.budgetExceeded}
                projectId={projectId ? parseInt(projectId) : null}
              />

              <DashboardCard
                title="Servicios de infraestructura en sitio"
                icon={
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                }
                description="Gestión de servicios de infraestructura en sitio"
                linkText="Ver servicios"
                href={`/project-manager-dashboard/projects/${projectId}/infrastructure`}
                disabled={disableDashboards}
                budgetExceeded={budgetStatus.budgetExceeded}
                projectId={projectId ? parseInt(projectId) : null}
              />

              <DashboardCard
                title="Materiales de instalación"
                icon={
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                  </svg>
                }
                description="Gestión de materiales de instalación"
                linkText="Ver materiales"
                href={`/project-manager-dashboard/projects/${projectId}/installation-materials`}
                disabled={disableDashboards}
                budgetExceeded={budgetStatus.budgetExceeded}
                projectId={projectId ? parseInt(projectId) : null}
              />

              <DashboardCard
                title="Servicios subcontratados"
                icon={
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                }
                description="Gestión de servicios subcontratados"
                linkText="Ver servicios"
                href={`/project-manager-dashboard/projects/${projectId}/outsourced-services`}
                disabled={disableDashboards}
                budgetExceeded={budgetStatus.budgetExceeded}
                projectId={projectId ? parseInt(projectId) : null}
              />

              <DashboardCard
                title="Cuotas sindicales"
                icon={
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                  </svg>
                }
                description="Gestión de cuotas sindicales"
                linkText="Ver cuotas"
                href={`/project-manager-dashboard/projects/${projectId}/union-dues`}
                disabled={disableDashboards}
                budgetExceeded={budgetStatus.budgetExceeded}
                projectId={projectId ? parseInt(projectId) : null}
              />
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER - Fixed */}
      <Footer />

      {/* Estilos globales */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
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

        header,
        footer {
          z-index: 50 !important;
        }

        @media (max-width: 640px) {
          .grid {
            gap: 1rem;
          }
        }
      `}</style>
    </div>
  )
}

// Componente DashboardCard - Estilo consistente con ProjectCard del sistema existente
function DashboardCard({
  title,
  icon,
  description,
  linkText,
  href,
  disabled = false,
  budgetExceeded = false
}: DashboardCardProps) {
  return (
    <div
      className={`relative border-2 rounded-lg p-4 transition-all duration-200 group ${
        disabled
          ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
          : 'border-gray-300 bg-white hover:shadow-md hover:border-[#3a6ea5]'
      }`}
    >
      {/* Icono con color corporativo */}
      <div
        className={`mb-3 inline-flex items-center justify-center w-10 h-10 rounded-lg ${
          disabled ? 'bg-gray-400' : 'bg-[#3a6ea5]'
        }`}
      >
        {icon}
      </div>

      {/* Contenido */}
      <div className="space-y-2 mb-4">
        <h3
          className={`text-sm font-bold uppercase tracking-tight ${
            disabled ? 'text-gray-500' : 'text-gray-900'
          }`}
        >
          {title}
        </h3>
        <p
          className={`text-xs font-medium leading-relaxed ${
            disabled ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          {description}
        </p>
      </div>

      {/* Enlace / Botón */}
      <div className="pt-3 border-t border-gray-200">
        <Link
          href={disabled ? '#' : href}
          className={`inline-flex items-center text-xs font-bold tracking-wide transition-all duration-200 ${
            disabled
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-[#3a6ea5] hover:text-[#2d5a8a] group-hover:translate-x-1'
          }`}
          aria-disabled={disabled}
          onClick={(e) => disabled && e.preventDefault()}
        >
          {linkText}
          {!disabled && (
            <svg className="ml-1.5 h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </Link>
      </div>

      {/* Barra inferior de estado */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-1 rounded-b-lg transition-colors ${
          disabled
            ? 'bg-gray-300'
            : budgetExceeded
              ? 'bg-red-400'
              : 'bg-transparent group-hover:bg-[#3a6ea5]'
        }`}
      ></div>
    </div>
  )
}
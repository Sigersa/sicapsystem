'use client';

import AppHeader from '@/components/header/2/2.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/2';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, UserX, UserMinus, X, RefreshCw, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

// Tipos de empleado
type EmployeeType = 'BASE' | 'PROJECT';

// Interface para empleado base
interface BaseEmployee {
  EmployeeID: number;
  BasePersonnelID: number;
  FirstName: string;
  LastName: string;
  MiddleName: string | null;
  Position: string;
  Area: string;
  Salary: number;
  WorkSchedule: string;
  RFC: string;
  CURP: string;
  NSS: string;
  Email: string;
  Phone: string;
  tipo: 'BASE';
}

// Interface para empleado de proyecto
interface ProjectEmployee {
  EmployeeID: number;
  ProjectPersonnelID: number;
  FirstName: string;
  LastName: string;
  MiddleName: string | null;
  ProjectName: string;
  ProjectID: number;
  Position: string;
  Salary: number;
  WorkSchedule: string;
  StartDate: string;
  EndDate: string | null;
  RFC: string;
  CURP: string;
  NSS: string;
  Email: string;
  Phone: string;
  tipo: 'PROJECT';
}

// Tipo unificado
type Employee = BaseEmployee | ProjectEmployee;

// Interface para filtros
interface Filters {
  search: string;
  tipo: 'TODOS' | EmployeeType;
  projectId?: string;
}

// Interface para proyectos
interface Proyecto {
  ProjectID: number;
  NameProject: string;
}


export default function EmployeesListPage() {
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();

  // Estados
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Estados para filtros
  const [filters, setFilters] = useState<Filters>({
    search: '',
    tipo: 'TODOS'
  });

  // Estado para proyectos (para filtro)
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Cargar empleados al montar
  useEffect(() => {
    fetchEmployees();
    fetchProjects();
  }, []);

  // Aplicar filtros cuando cambien
  useEffect(() => {
    applyFilters();
  }, [employees, filters]);

  // Actualizar páginas cuando cambien los empleados filtrados
  useEffect(() => {
    setTotalPages(Math.ceil(filteredEmployees.length / itemsPerPage));
    setCurrentPage(1);
  }, [filteredEmployees, itemsPerPage]);

  // Obtener empleados actuales de la página
  const currentEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Función para obtener empleados
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/administrative-personnel-dashboard/job-termination');
      
      if (!response.ok) {
        throw new Error('Error al cargar empleados');
      }

      const data = await response.json();
      
      if (data.success) {
        setEmployees(data.employees || []);
      } else {
        setError(data.message || 'Error al cargar empleados');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Error de conexión al cargar empleados');
    } finally {
      setLoading(false);
    }
  };

  // Función para obtener proyectos
  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await fetch('/api/catalogs/projects');
      if (response.ok) {
        const data = await response.json();
        setProyectos(data);
      }
    } catch (error) {
      console.error('Error al cargar proyectos:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Función para aplicar filtros
  const applyFilters = () => {
    let filtered = [...employees];

    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase().trim();
      const isNumber = /^\d+$/.test(searchLower);
      
      filtered = filtered.filter(emp => {
        if (isNumber && emp.EmployeeID.toString().includes(searchLower)) {
          return true;
        }
        
        const fullName = `${emp.FirstName} ${emp.LastName} ${emp.MiddleName || ''}`.toLowerCase();
        const firstNameMatch = emp.FirstName.toLowerCase().includes(searchLower);
        const lastNameMatch = emp.LastName.toLowerCase().includes(searchLower);
        const middleNameMatch = emp.MiddleName?.toLowerCase().includes(searchLower) || false;
        const fullNameMatch = fullName.includes(searchLower);
        
        return firstNameMatch || lastNameMatch || middleNameMatch || fullNameMatch;
      });
    }

    if (filters.tipo !== 'TODOS') {
      filtered = filtered.filter(emp => emp.tipo === filters.tipo);
    }

    if (filters.projectId && filters.tipo === 'PROJECT') {
      filtered = filtered.filter(emp => 
        emp.tipo === 'PROJECT' && (emp as ProjectEmployee).ProjectID === parseInt(filters.projectId!)
      );
    }

    setFilteredEmployees(filtered);
  };

  // Función para limpiar filtros
  const clearFilters = () => {
    setFilters({
      search: '',
      tipo: 'TODOS',
      projectId: undefined
    });
  };

  // Mostrar loading de sesión
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

  // Si no hay usuario
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <AppHeader title="PANEL ADMINISTRATIVO" />

      <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
        <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
          
          <div className="mb-6">
            <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5]">
              <h1 className="text-xl font-bold text-white tracking-tight">
                BAJA / TERMINACIÓN LABORAL
              </h1>
              <p className="text-sm text-gray-200 mt-1">
                Registre bajas y generación de documentación para la terminación laboral de empleados en el sistema.              
              </p>
            </div>
          </div>

          {successMessage && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 animate-fade-in">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                <p className="text-sm font-medium text-gray-600">{successMessage}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 animate-fade-in">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <p className="text-sm font-medium text-gray-600">{error}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar por ID o nombre del empleado..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full pl-10 px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                />
                {filters.search && (
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
            
            <select
              value={filters.tipo}
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                tipo: e.target.value as 'TODOS' | EmployeeType,
                projectId: e.target.value !== 'PROJECT' ? undefined : prev.projectId
              }))}
              className="w-full md:w-48 px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
            >
              <option value="TODOS">TODOS LOS TIPOS</option>
              <option value="BASE">PERSONAL BASE</option>
              <option value="PROJECT">PERSONAL DE PROYECTO</option>
            </select>

            {filters.tipo === 'PROJECT' && (
              <select
                value={filters.projectId || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, projectId: e.target.value }))}
                className="w-full md:w-64 px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                disabled={loadingProjects}
              >
                <option value="">TODOS LOS PROYECTOS</option>
                {proyectos.map((proyecto) => (
                  <option key={proyecto.ProjectID} value={proyecto.ProjectID}>
                    {proyecto.NameProject}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={clearFilters}
              className="px-4 py-2.5 bg-gray-200 text-gray-800 font-bold rounded-md hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              LIMPIAR
            </button>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">ID</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">EMPLEADO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">TIPO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">PUESTO / PROYECTO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">CONTACTO</th>
                    <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a6ea5] mb-2"></div>
                          <p className="text-gray-600">Cargando empleados...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <AlertCircle className="h-8 w-8 text-gray-400 mb-3" />
                          <p className="text-sm font-medium text-gray-600 mt-2 leading-5">
                            {filters.search || filters.tipo !== 'TODOS' || filters.projectId
                              ? 'No se encontraron empleados que coincidan con la búsqueda'
                              : 'No hay empleados registrados en el sistema'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentEmployees.map((employee) => (
                      <tr key={employee.EmployeeID} className="hover:bg-gray-50 transition-colors border-b border-gray-300">
                        <td className="py-3 px-4 text-sm text-gray-800 font-medium">{employee.EmployeeID}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-800">
                                {employee.FirstName} {employee.LastName} {employee.MiddleName}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-800">
                                {employee.tipo === 'BASE' ? 'BASE' : 'PROYECTO'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-800">{employee.Position || 'N/A'}</div>
                          {employee.tipo === 'PROJECT' && (
                            <div className="text-xs text-gray-500 uppercase">
                              {(employee as ProjectEmployee).ProjectName || 'Sin proyecto'}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-800">{employee.Email}</div>
                          <div className="text-xs text-gray-500">{employee.Phone}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                                className={`p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                                title={"Dar de baja usuario"}
                              >
                                { 0 ? (
                                  <UserX className="h-4 w-4" />
                                ) : (
                                  <UserMinus className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Eliminar usuario"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredEmployees.length > 0 && totalPages > 1 && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-300 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredEmployees.length)} de {filteredEmployees.length} registros
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-4 py-2 bg-[#3a6ea5] text-white rounded-md">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />

      {/* Estilos para animaciones */}
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
        
        .fixed.inset-0.z-\\[9999\\] {
          z-index: 9999 !important;
        }
        
        header, footer {
          z-index: 50 !important;
        }
        
        .fixed.inset-0.z-\\[9999\\] {
          z-index: 9999 !important;
        }
        
        body.modal-open {
          overflow: hidden;
        }
        
        textarea {
          resize: none;
        }
      `}</style>
    </div>
  );
}
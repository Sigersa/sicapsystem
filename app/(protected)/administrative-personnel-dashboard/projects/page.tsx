'use client';
import AppHeader from '@/components/header/2/2.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/2';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { Edit, Trash2, Search, X, CheckCircle, AlertCircle } from 'lucide-react';

// Definir el tipo para un proyecto
type Project = {
  ProjectID: number;
  NameProject: string;
  ProjectAddress: string;
  createdAt?: string;
  updatedAt?: string;
};

type UserType = {
  UserTypeID: number;
  Type: string;
};
export default function SystemAdminDashboard() {
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();

  // Estados para proyectos - TODOS LOS HOOKS VAN AQUÍ ARRIBA
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para el formulario
  const [formData, setFormData] = useState({
    NameProject: '',
    ProjectAddress: ''
  });

  // Estados para operaciones
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; id: number | null }>({ show: false, id: null });

  // Cargar proyectos al montar el componente
  useEffect(() => {
    if (user) { // Solo cargar proyectos si hay usuario
      fetchProjects();
    }
  }, [user]); // Agregar user como dependencia

  // Filtrar proyectos cuando cambia el término de búsqueda
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProjects(projects);
    } else {
      const filtered = projects.filter(project =>
        project.NameProject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.ProjectAddress.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProjects(filtered);
    }
  }, [searchTerm, projects]);

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

  // Función para normalizar texto a mayúsculas
  const normalizarMayusculas = (texto: string): string => {
    return texto.toUpperCase();
  };

  // Función para cargar proyectos
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
        setFilteredProjects(data);
      } else {
        throw new Error('ERROR AL CARGAR PROYECTOS');
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setErrorMessage('ERROR AL CARGAR LOS PROYECTOS. POR FAVOR, INTENTE NUEVAMENTE.');
    } finally {
      setLoading(false);
    }
  };

  // Manejar cambios en el formulario
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: normalizarMayusculas(value)
    }));
  };

  // Validar formulario
  const validateForm = () => {
    if (!formData.NameProject.trim()) {
      setErrorMessage('EL NOMBRE DEL PROYECTO ES REQUERIDO');
      return false;
    }
    if (!formData.ProjectAddress.trim()) {
      setErrorMessage('LA DIRECCIÓN DEL PROYECTO ES REQUERIDA');
      return false;
    }
    return true;
  };

  // Manejar envío del formulario (crear/editar)
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const url = isEditing ? `/api/projects/${editingId}` : '/api/projects';
      const method = isEditing ? 'PUT' : 'POST';

      // Preparar datos en mayúsculas
      const datosEnviar = {
        NameProject: normalizarMayusculas(formData.NameProject.trim()),
        ProjectAddress: normalizarMayusculas(formData.ProjectAddress.trim())
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(datosEnviar),
      });

      if (response.ok) {
        const result = await response.json();
        setSuccessMessage(isEditing 
          ? '¡PROYECTO ACTUALIZADO EXITOSAMENTE!' 
          : '¡PROYECTO CREADO EXITOSAMENTE!'
        );
        
        // Recargar proyectos
        fetchProjects();
        
        // Limpiar formulario y cerrar modal
        resetForm();
        setShowModal(false);
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'ERROR AL PROCESAR LA SOLICITUD');
      }
    } catch (error: any) {
      console.error('Error:', error);
      setErrorMessage(error.message || 'ERROR AL PROCESAR LA SOLICITUD. POR FAVOR, INTENTE NUEVAMENTE.');
    } finally {
      setLoading(false);
    }
  };

  // Editar proyecto
  const handleEdit = (project: Project) => {
    setFormData({
      NameProject: project.NameProject,
      ProjectAddress: project.ProjectAddress
    });
    setEditingId(project.ProjectID);
    setIsEditing(true);
    setShowModal(true);
  };

  // Eliminar proyecto
  const handleDelete = async (id: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuccessMessage('¡PROYECTO ELIMINADO EXITOSAMENTE!');
        fetchProjects();
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        throw new Error('ERROR AL ELIMINAR EL PROYECTO');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      setErrorMessage('ERROR AL ELIMINAR EL PROYECTO. POR FAVOR, INTENTE NUEVAMENTE.');
    } finally {
      setLoading(false);
      setConfirmDelete({ show: false, id: null });
    }
  };

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      NameProject: '',
      ProjectAddress: ''
    });
    setIsEditing(false);
    setEditingId(null);
  };

  // Abrir modal para nuevo proyecto
  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Cerrar modal
  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER - Fixed */}
      <AppHeader 
        title="PANEL ADMINISTRATIVO"
      />

      {/* MODAL PARA CREAR/EDITAR PROYECTO - Corregido para que se muestre sobre todo */}
      {showModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70" 
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-in relative z-[10000]">
            <div className="p-6 pb-4 border-b border-gray-300 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                  {isEditing ? 'EDITAR PROYECTO' : 'NUEVO PROYECTO'}
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  {isEditing 
                    ? 'Modifique los datos del proyecto seleccionado.' 
                    : 'Complete el formulario para registrar un nuevo proyecto.'
                  }
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    NOMBRE DEL PROYECTO *
                  </label>
                  <input
                    type="text"
                    name="NameProject"
                    value={formData.NameProject}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    placeholder="Ingrese el nombre del proyecto"
                    maxLength={1000}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    DIRECCIÓN DEL PROYECTO *
                  </label>
                  <textarea
                    name="ProjectAddress"
                    value={formData.ProjectAddress}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium h-32 resize-none"
                    placeholder="Ingrese la dirección completa del proyecto"
                    maxLength={1000}
                    required
                  />
                </div>
              </div>

              <div className="p-6 pt-4 border-t border-gray-300 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap"                
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      PROCESANDO...
                    </>
                  ) : (
                    isEditing ? 'ACTUALIZAR' : 'CREAR'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR - Corregido para que se muestre sobre todo */}
      {confirmDelete.show && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70"
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-in relative z-[10000]">
            <div className="p-6 pb-4 border-b border-gray-300">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                CONFIRMAR ELIMINACIÓN
              </h2>
              <p className="text-sm text-gray-600 mt-2 leading-5">
                ¿Está seguro que desea eliminar este proyecto? Esta acción no se puede deshacer.
              </p>
            </div>
            
            <div className="p-6 pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete({ show: false, id: null })}
                className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={() => confirmDelete.id && handleDelete(confirmDelete.id)}
                disabled={loading}
                className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center whitespace-nowrap"                
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ELIMINANDO...
                  </>
                ) : (
                  'ELIMINAR'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTENT - Ajustado para header y footer fijos */}
      <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
        <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5] w-full">
                <h1 className="text-xl font-bold text-white tracking-tight">GESTIÓN DE PROYECTOS</h1>
                <p className="text-sm text-gray-200 mt-1">
                  Administre los proyectos del sistema. Puede crear, editar, ver y eliminar proyectos.
                </p>
              </div>
            </div>

            {/* MENSAJES DE ÉXITO/ERROR */}
            {successMessage && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 animate-fade-in">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <p className="text-sm font-medium text-gray-600 leading-5">
                    {successMessage}
                  </p>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 animate-fade-in">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <p className="text-sm font-medium text-gray-600 leading-5">
                    {errorMessage}
                  </p>
                </div>
              </div>
            )}

            {/* BARRA DE ACCIONES Y BÚSQUEDA */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar proyectos por nombre o dirección..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
              
              <button
                onClick={openCreateModal}
                className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap"
              >
                NUEVO PROYECTO
              </button>
            </div>

            {/* TABLA DE PROYECTOS */}
            <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">ID</th>
                      <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">NOMBRE DEL PROYECTO</th>
                      <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">DIRECCIÓN</th>
                      <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300 text-center">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a6ea5] mb-2"></div>
                            <p className="text-gray-600">Cargando proyectos...</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredProjects.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <AlertCircle className="h-8 w-8 text-gray-400 mb-3" />
                            <p className="text-sm font-medium text-gray-600 mt-2 leading-5">
                              {searchTerm ? 'No se encontraron proyectos que coincidan con la búsqueda' : 'No hay proyectos registrados'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredProjects.map((project) => (
                        <tr key={project.ProjectID} className="hover:bg-gray-50 transition-colors border-b border-gray-300">
                          <td className="py-3 px-4 text-sm text-gray-800 font-medium">{project.ProjectID}</td>
                          <td className="py-3 px-4 text-sm text-gray-800 uppercase">{project.NameProject}</td>
                          <td className="py-3 px-4 text-sm text-gray-600 uppercase max-w-xs truncate">{project.ProjectAddress}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEdit(project)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                title="Editar proyecto"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setConfirmDelete({ show: true, id: project.ProjectID })}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Eliminar proyecto"
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
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER - Fixed */}
      <Footer />

      {/* Agregar estilos para animaciones y layout */}
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
        
        /* Ajustes de layout para header y footer fijos */
        body {
          padding-top: 0;
          padding-bottom: 0;
          margin: 0;
          overflow-x: hidden;
        }
        
        /* Asegurar que los modales estén por encima de todo */
        .fixed.inset-0.z-\\[9999\\] {
          z-index: 9999 !important;
        }
        
        /* Asegurar que el header y footer tengan z-index adecuado */
        header, footer {
          z-index: 50 !important;
        }
        
        /* El modal debe estar por encima del header y footer */
        .fixed.inset-0.z-\\[9999\\] {
          z-index: 9999 !important;
        }
        
        /* Prevenir scroll cuando el modal está abierto */
        body.modal-open {
          overflow: hidden;
        }
        
        /* Estilos para textarea */
        textarea {
          resize: none;
        }
      `}</style>
    </div>
  );
}
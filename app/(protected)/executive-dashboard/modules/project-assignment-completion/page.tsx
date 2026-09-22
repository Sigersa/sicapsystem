'use client';
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppHeader from '@/components/header/4/4.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/4';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { X, CheckCircle, AlertCircle, Search, Plus, Edit, Trash2 } from 'lucide-react';

interface UserData {
  id: number;
  usuario: string;
  tipoUsuario: string;
  nombre: string;
  apellido: string;
  email: string;
  proyectoAsignado: string;
  proyectoActivo: boolean;
  projectId: number | null;
}

interface Project {
  ProjectID: number;
  NameProject: string;
  ProjectAddress: string | null;
  AdminProjectID: number | null;
  StartDate: string | null;
  EndDate: string | null;
  Status: number;
  ProjectType: number;
  ProjectBudget: number | null;
  ClientID: number | null;
  AreaID: number | null;
  ExternalProjectManagerID: number | null;
  ExternalProjectManagerName?: string;
  ExternalProjectManagerEmail?: string;
  ExternalProjectManagerPhone?: string;
  CreatedBy: number | null;
  _budgetDisplay?: string;
}

interface SystemUser {
  SystemUserID: number;
  UserName: string;
  EmployeeID: number | null;
}

interface Employee {
  EmployeeID: number;
  EmployeeType: string;
  Status: number;
}

// Cliente desde la API (viene en minúscula)
interface ClientFromAPI {
  clientId: number;
  clientName: string;
  businessName: string;
}

// Cliente normalizado para el frontend
interface Client {
  ClientID: number;
  ClientName: string;
  BusinessName: string;
}

interface ExternalProjectManager {
  ExternalProjectManagerID: number;
  NameProjectManager: string;
  ClientID: number;
  Email: string;
  Phone: string;
}

interface Area {
  AreaID: number;
  AreaName: string;
  ClientID: number;
}

// Componente Modal mejorado
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

// Modal de confirmación para eliminar
const DeleteModal = ({ isOpen, onClose, onConfirm, project }: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  project: Project | null;
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-in relative z-[10000]">
        <div className="p-6 pb-4 border-b border-gray-300">
          <div className="flex items-center">
            <div className="flex-shrink-0 mr-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">Confirmar eliminación</h3>
              <p className="text-sm text-gray-600 mt-1 leading-5">
                ¿Estás seguro que deseas eliminar el proyecto <span className="font-bold">{project.NameProject}</span>?
              </p>
              <p className="text-sm text-gray-500 mt-2 leading-5">Esta acción no se puede deshacer.</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="p-6 pt-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-6 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors"
          >
            CANCELAR
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center min-w-[100px]"
          >
            {isDeleting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
            ) : (
              'ELIMINAR'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal de confirmación para concluir proyecto
const CompleteModal = ({ isOpen, onClose, onConfirm, project }: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  project: Project | null;
}) => {
  const [isCompleting, setIsCompleting] = useState(false);

  const handleConfirm = async () => {
    setIsCompleting(true);
    try {
      await onConfirm();
    } finally {
      setIsCompleting(false);
    }
  };

  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-in relative z-[10000]">
        <div className="p-6 pb-4 border-b border-gray-300">
          <div className="flex items-center">
            <div className="flex-shrink-0 mr-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">Confirmar conclusión</h3>
              <p className="text-sm text-gray-600 mt-1 leading-5">
                ¿Estás seguro que deseas marcar el proyecto <span className="font-bold">{project.NameProject}</span> como concluido?
              </p>
              <p className="text-sm text-gray-500 mt-2 leading-5">Esta acción no se puede deshacer.</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="p-6 pt-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isCompleting}
            className="px-6 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors"
          >
            CANCELAR
          </button>
          <button
            onClick={handleConfirm}
            disabled={isCompleting}
            className="px-6 py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center min-w-[100px]"
          >
            {isCompleting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
            ) : (
              'CONCLUIR'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal de Asignación de Proyecto
const AssignProjectModal = ({ isOpen, onClose, onSave, users, employees, clients, areas, isSubmitting }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: any) => void;
  users: SystemUser[];
  employees: Employee[];
  clients: Client[];
  areas: Area[];
  isSubmitting: boolean;
}) => {
  const [newProject, setNewProject] = useState({
    NameProject: '',
    ProjectAddress: '',
    AdminProjectID: '',
    ClientID: '',
    ProjectType: '',
    ProjectBudget: '',
    ExternalProjectManagerName: '',
    ExternalProjectManagerEmail: '',
    ExternalProjectManagerPhone: '',
    AreaID: '',
    Status: '0',
    StartDate: new Date().toISOString().split('T')[0]
  });

  const [localAreas, setLocalAreas] = useState<Area[]>([]);
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

  const formatInputCurrency = (value: string) => {
    if (value === '') return '';
    
    let cleanedValue = value.replace(/[^\d.]/g, '');
    
    const decimalParts = cleanedValue.split('.');
    if (decimalParts.length > 2) {
      cleanedValue = decimalParts[0] + '.' + decimalParts.slice(1).join('');
    }
    
    if (decimalParts.length === 2 && decimalParts[1].length > 2) {
      cleanedValue = decimalParts[0] + '.' + decimalParts[1].substring(0, 2);
    }
    
    if (cleanedValue.startsWith('.')) {
      cleanedValue = '0' + cleanedValue;
    }
    
    if (cleanedValue.includes('.')) {
      const [integerPart, decimalPart] = cleanedValue.split('.');
      const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return `${formattedInteger}.${decimalPart}`;
    }
    
    return cleanedValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const parseCurrency = (value: string) => {
    const numericValue = value.replace(/,/g, '');
    return numericValue ? parseFloat(numericValue) : 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'ProjectBudget') {
      const formattedValue = formatInputCurrency(value);
      setNewProject(prev => ({
        ...prev,
        [name]: formattedValue
      }));
    } else {
      setNewProject(prev => ({
        ...prev,
        [name]: value
      }));
    }

    if (name === 'ClientID') {
      if (value === '1') {
        const siemensAreas = areas.filter(area => area.ClientID === 1);
        setLocalAreas(siemensAreas);
      } else {
        setLocalAreas([]);
        setNewProject(prev => ({ ...prev, AreaID: '' }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newProject.NameProject.trim()) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'El nombre del proyecto es requerido',
        type: 'error'
      });
      return;
    }

    if (!newProject.AdminProjectID) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'El administrador de proyecto es requerido',
        type: 'error'
      });
      return;
    }

    if (!newProject.ClientID) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'El cliente es requerido',
        type: 'error'
      });
      return;
    }

    if (!newProject.ProjectBudget || parseCurrency(newProject.ProjectBudget) <= 0) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'El presupuesto debe ser mayor a 0',
        type: 'error'
      });
      return;
    }

    const projectData = {
      NameProject: newProject.NameProject,
      ProjectAddress: newProject.ProjectAddress || null,
      AdminProjectID: parseInt(newProject.AdminProjectID),
      ClientID: parseInt(newProject.ClientID),
      ProjectType: parseInt(newProject.ProjectType),
      ProjectBudget: parseCurrency(newProject.ProjectBudget),
      ExternalProjectManagerName: newProject.ExternalProjectManagerName || '',
      ExternalProjectManagerEmail: newProject.ExternalProjectManagerEmail || '',
      ExternalProjectManagerPhone: newProject.ExternalProjectManagerPhone || '',
      AreaID: newProject.ClientID === '1' ? (newProject.AreaID ? parseInt(newProject.AreaID) : null) : null,
      Status: 0,
      StartDate: newProject.StartDate || new Date().toISOString().split('T')[0]
    };

    await onSave(projectData);
  };

  const handleClose = () => {
    setNewProject({
      NameProject: '',
      ProjectAddress: '',
      AdminProjectID: '',
      ClientID: '',
      ProjectType: '',
      ProjectBudget: '',
      ExternalProjectManagerName: '',
      ExternalProjectManagerEmail: '',
      ExternalProjectManagerPhone: '',
      AreaID: '',
      Status: '0',
      StartDate: new Date().toISOString().split('T')[0]
    });
    setLocalAreas([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full animate-fade-in relative z-[10000] max-h-[90vh] overflow-y-auto">
          <div className="p-6 pb-4 border-b border-gray-300 sticky top-0 bg-white z-10">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">ASIGNAR NUEVO PROYECTO</h3>
                <p className="text-sm text-gray-600 mt-1">Complete la información del proyecto</p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="NameProject" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Nombre del Proyecto *
                  </label>
                  <input
                    type="text"
                    id="NameProject"
                    name="NameProject"
                    value={newProject.NameProject}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="ProjectAddress" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Dirección del Proyecto
                  </label>
                  <input
                    type="text"
                    id="ProjectAddress"
                    name="ProjectAddress"
                    value={newProject.ProjectAddress}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="AdminProjectID" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Administrador de Proyecto (Interno) *
                  </label>
                  <select
                    id="AdminProjectID"
                    name="AdminProjectID"
                    value={newProject.AdminProjectID}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium appearance-none"
                    required
                  >
                    <option value="">Seleccionar administrador</option>
                    {users && users.length > 0 ? (
                      users.map(user => {
                        const employee = employees.find(e => e.EmployeeID === user.EmployeeID);
                        const userValue = user.EmployeeID || user.SystemUserID;
                        return (
                          <option key={`user-${user.SystemUserID}`} value={userValue}>
                            {user.UserName} {employee ? `(${employee.EmployeeType})` : ''}
                          </option>
                        );
                      })
                    ) : (
                      <option value="" disabled>No hay usuarios disponibles</option>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="StartDate" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Fecha de Inicio
                  </label>
                  <input
                    type="date"
                    id="StartDate"
                    name="StartDate"
                    value={newProject.StartDate}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="ClientID" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Cliente *
                  </label>
                  <select
                    id="ClientID"
                    name="ClientID"
                    value={newProject.ClientID}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium appearance-none"
                    required
                  >
                    <option value="">Seleccionar cliente</option>
                    {clients && clients.length > 0 ? (
                      clients.map(client => {
                        if (!client.ClientID) {
                          return null;
                        }
                        return (
                          <option key={`client-${client.ClientID}`} value={client.ClientID}>
                            {client.ClientName || 'Cliente sin nombre'}
                          </option>
                        );
                      })
                    ) : (
                      <option value="" disabled>No hay clientes disponibles</option>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="ProjectType" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Tipo de Proyecto *
                  </label>
                  <select
                    id="ProjectType"
                    name="ProjectType"
                    value={newProject.ProjectType}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium appearance-none"
                    required
                  >
                    <option value="">Seleccionar tipo</option>
                    <option value="1">Servicio especializado</option>
                    <option value="2">Servicio llave en mano</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="ProjectBudget" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Presupuesto ($) *
                  </label>
                  <input
                    type="text"
                    id="ProjectBudget"
                    name="ProjectBudget"
                    value={newProject.ProjectBudget}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    required
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label htmlFor="ExternalProjectManagerName" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Project Manager (Externo) *
                  </label>
                  <input
                    type="text"
                    id="ExternalProjectManagerName"
                    name="ExternalProjectManagerName"
                    value={newProject.ExternalProjectManagerName}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="ExternalProjectManagerEmail" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Correo del Project Manager *
                  </label>
                  <input
                    type="email"
                    id="ExternalProjectManagerEmail"
                    name="ExternalProjectManagerEmail"
                    value={newProject.ExternalProjectManagerEmail}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="ExternalProjectManagerPhone" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Teléfono del Project Manager *
                  </label>
                  <input
                    type="tel"
                    id="ExternalProjectManagerPhone"
                    name="ExternalProjectManagerPhone"
                    value={newProject.ExternalProjectManagerPhone}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    required
                  />
                </div>
              </div>

              <div className={`transition-all duration-300 ${newProject.ClientID === '1' ? 'opacity-100 max-h-96' : 'opacity-0 max-h-0 overflow-hidden'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="AreaID" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      Área (Siemens) *
                    </label>
                    <select
                      id="AreaID"
                      name="AreaID"
                      value={newProject.AreaID}
                      onChange={handleInputChange}
                      className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium appearance-none"
                      required={newProject.ClientID === '1'}
                      disabled={newProject.ClientID !== '1'}
                    >
                      <option value="">Seleccionar área</option>
                      {localAreas.map(area => (
                        <option key={`area-${area.AreaID}`} value={area.AreaID}>
                          {area.AreaName}
                        </option>
                      ))}
                    </select>
                    {newProject.ClientID === '1' && localAreas.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">No hay áreas disponibles para Siemens</p>
                    )}
                  </div>
                  <div></div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-300">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center min-w-[120px]"
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  ) : (
                    'GUARDAR PROYECTO'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <Modal 
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </>
  );
};

// Modal de Edición de Proyecto
const EditProjectModal = ({ isOpen, onClose, project, onSave, users, employees, clients, areas, isSaving }: {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onSave: (data: any) => void;
  users: SystemUser[];
  employees: Employee[];
  clients: Client[];
  areas: Area[];
  isSaving: boolean;
}) => {
  const [editData, setEditData] = useState<Project | null>(null);
  const [editAreas, setEditAreas] = useState<Area[]>([]);
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

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined || isNaN(value)) return '';
    return new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const parseCurrency = (value: string) => {
    const numericValue = value.replace(/,/g, '');
    return numericValue ? parseFloat(numericValue) : 0;
  };

  const formatInputCurrency = (value: string) => {
    if (value === '') return '';
    
    let cleanedValue = value.replace(/[^\d.]/g, '');
    
    const decimalParts = cleanedValue.split('.');
    if (decimalParts.length > 2) {
      cleanedValue = decimalParts[0] + '.' + decimalParts.slice(1).join('');
    }
    
    if (decimalParts.length === 2 && decimalParts[1].length > 2) {
      cleanedValue = decimalParts[0] + '.' + decimalParts[1].substring(0, 2);
    }
    
    if (cleanedValue.startsWith('.')) {
      cleanedValue = '0' + cleanedValue;
    }
    
    if (cleanedValue.includes('.')) {
      const [integerPart, decimalPart] = cleanedValue.split('.');
      const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return `${formattedInteger}.${decimalPart}`;
    }
    
    return cleanedValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  useEffect(() => {
    if (project) {
      setEditData({
        ...project,
        _budgetDisplay: project.ProjectBudget ? formatCurrency(project.ProjectBudget) : ''
      });
      
      if (project.ClientID === 1) {
        const siemensAreas = areas.filter(area => area.ClientID === 1);
        setEditAreas(siemensAreas);
      } else {
        setEditAreas([]);
      }
    }
  }, [project, areas]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!editData) return;
    
    const { name, value } = e.target;
    
    if (name === 'ProjectBudget') {
      const formattedValue = formatInputCurrency(value);
      const numericValue = parseCurrency(formattedValue);
      
      setEditData(prev => ({
        ...prev!,
        _budgetDisplay: formattedValue,
        ProjectBudget: numericValue
      }));
    } else if (name === 'ClientID') {
      const newClientId = value ? parseInt(value) : null;
      setEditData(prev => ({
        ...prev!,
        [name]: newClientId,
        AreaID: newClientId === 1 ? prev?.AreaID || null : null
      }));
      
      if (newClientId === 1) {
        const siemensAreas = areas.filter(area => area.ClientID === 1);
        setEditAreas(siemensAreas);
      } else {
        setEditAreas([]);
      }
    } else if (name === 'AdminProjectID' || name === 'ProjectType' || name === 'AreaID') {
      setEditData(prev => ({
        ...prev!,
        [name]: value ? parseInt(value) : null
      }));
    } else {
      setEditData(prev => ({
        ...prev!,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData) return;

    if (!editData.NameProject.trim()) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'El nombre del proyecto es requerido',
        type: 'error'
      });
      return;
    }

    if (!editData.AdminProjectID) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'El administrador de proyecto es requerido',
        type: 'error'
      });
      return;
    }

    if (!editData.ClientID) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'El cliente es requerido',
        type: 'error'
      });
      return;
    }

    if (!editData.ProjectBudget || editData.ProjectBudget <= 0) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'El presupuesto debe ser mayor a 0',
        type: 'error'
      });
      return;
    }

    const projectData = {
      NameProject: editData.NameProject,
      AdminProjectID: editData.AdminProjectID,
      ClientID: editData.ClientID,
      ProjectType: editData.ProjectType,
      ProjectBudget: editData.ProjectBudget,
      ExternalProjectManagerName: editData.ExternalProjectManagerName || '',
      ExternalProjectManagerEmail: editData.ExternalProjectManagerEmail || '',
      ExternalProjectManagerPhone: editData.ExternalProjectManagerPhone || '',
      AreaID: editData.ClientID === 1 ? (editData.AreaID ?? null) : null
    };

    await onSave(projectData);
  };

  const handleClose = () => {
    setEditData(null);
    setEditAreas([]);
    onClose();
  };

  if (!isOpen || !editData) return null;

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full animate-fade-in relative z-[10000] max-h-[90vh] overflow-y-auto">
          <div className="p-6 pb-4 border-b border-gray-300 sticky top-0 bg-white z-10">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">EDITAR PROYECTO</h3>
                <p className="text-sm text-gray-600 mt-1">Modifica los datos del proyecto</p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="edit-NameProject" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Nombre del Proyecto *
                  </label>
                  <input
                    type="text"
                    id="edit-NameProject"
                    name="NameProject"
                    value={editData.NameProject}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="edit-AdminProjectID" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Administrador de Proyecto (Interno) *
                  </label>
                  <select
                    id="edit-AdminProjectID"
                    name="AdminProjectID"
                    value={editData.AdminProjectID || ''}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium appearance-none"
                    required
                  >
                    <option value="">Seleccionar administrador</option>
                    {users && users.length > 0 ? (
                      users.map(user => {
                        const employee = employees.find(e => e.EmployeeID === user.EmployeeID);
                        const userValue = user.EmployeeID || user.SystemUserID;
                        return (
                          <option key={`edit-user-${user.SystemUserID}`} value={userValue}>
                            {user.UserName} {employee ? `(${employee.EmployeeType})` : ''}
                          </option>
                        );
                      })
                    ) : (
                      <option value="" disabled>No hay usuarios disponibles</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="edit-ClientID" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Cliente *
                  </label>
                  <select
                    id="edit-ClientID"
                    name="ClientID"
                    value={editData.ClientID || ''}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium appearance-none"
                    required
                  >
                    <option value="">Seleccionar cliente</option>
                    {clients && clients.length > 0 ? (
                      clients.map(client => {
                        if (!client.ClientID) {
                          return null;
                        }
                        return (
                          <option key={`edit-client-${client.ClientID}`} value={client.ClientID}>
                            {client.ClientName || 'Cliente sin nombre'}
                          </option>
                        );
                      })
                    ) : (
                      <option value="" disabled>No hay clientes disponibles</option>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-ProjectType" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Tipo de Proyecto *
                  </label>
                  <select
                    id="edit-ProjectType"
                    name="ProjectType"
                    value={editData.ProjectType || ''}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium appearance-none"
                    required
                  >
                    <option value="">Seleccionar tipo</option>
                    <option value="1">Servicio especializado</option>
                    <option value="2">Servicio llave en mano</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="edit-ProjectBudget" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Presupuesto ($) *
                  </label>
                  <input
                    type="text"
                    id="edit-ProjectBudget"
                    name="ProjectBudget"
                    value={editData._budgetDisplay || ''}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    required
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label htmlFor="edit-ExternalProjectManagerName" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Project Manager (Externo) *
                  </label>
                  <input
                    type="text"
                    id="edit-ExternalProjectManagerName"
                    name="ExternalProjectManagerName"
                    value={editData.ExternalProjectManagerName || ''}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="edit-ExternalProjectManagerEmail" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Correo del Project Manager *
                  </label>
                  <input
                    type="email"
                    id="edit-ExternalProjectManagerEmail"
                    name="ExternalProjectManagerEmail"
                    value={editData.ExternalProjectManagerEmail || ''}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="edit-ExternalProjectManagerPhone" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                    Teléfono del Project Manager *
                  </label>
                  <input
                    type="tel"
                    id="edit-ExternalProjectManagerPhone"
                    name="ExternalProjectManagerPhone"
                    value={editData.ExternalProjectManagerPhone || ''}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                    required
                  />
                </div>
              </div>

              <div className={`transition-all duration-300 ${editData.ClientID === 1 ? 'opacity-100 max-h-96' : 'opacity-0 max-h-0 overflow-hidden'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="edit-AreaID" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      Área (Siemens) *
                    </label>
                    <select
                      id="edit-AreaID"
                      name="AreaID"
                      value={editData.AreaID || ''}
                      onChange={handleInputChange}
                      className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium appearance-none"
                      required={editData.ClientID === 1}
                      disabled={editData.ClientID !== 1}
                    >
                      <option value="">Seleccionar área</option>
                      {editAreas.map(area => (
                        <option key={`edit-area-${area.AreaID}`} value={area.AreaID}>
                          {area.AreaName}
                        </option>
                      ))}
                    </select>
                    {editData.ClientID === 1 && editAreas.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">No hay áreas disponibles para Siemens</p>
                    )}
                  </div>
                  <div></div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-300">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center min-w-[120px]"
                >
                  {isSaving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  ) : (
                    'GUARDAR CAMBIOS'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <Modal 
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </>
  );
};

export default function ProjectsPage() {
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();
  const router = useRouter();
  
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
  });
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [externalManagers, setExternalManagers] = useState<ExternalProjectManager[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'info'
  });

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    project: null as Project | null
  });

  const [completeModal, setCompleteModal] = useState({
    isOpen: false,
    project: null as Project | null
  });

  const [editModal, setEditModal] = useState({
    isOpen: false,
    project: null as Project | null
  });

  const [assignModal, setAssignModal] = useState({
    isOpen: false
  });

  const showModal = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setModal({
      isOpen: true,
      title,
      message,
      type
    });
  };

  const closeModal = () => {
    setModal({
      isOpen: false,
      title: '',
      message: '',
      type: 'info'
    });
  };

  const openDeleteModal = (project: Project) => {
    setDeleteModal({
      isOpen: true,
      project
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      project: null
    });
  };

  const openCompleteModal = (project: Project) => {
    setCompleteModal({
      isOpen: true,
      project
    });
  };

  const closeCompleteModal = () => {
    setCompleteModal({
      isOpen: false,
      project: null
    });
  };

  const openEditModal = (project: Project) => {
    setEditModal({
      isOpen: true,
      project
    });
  };

  const closeEditModal = () => {
    setEditModal({
      isOpen: false,
      project: null
    });
  };

  const openAssignModal = () => {
    setAssignModal({
      isOpen: true
    });
  };

  const closeAssignModal = () => {
    setAssignModal({
      isOpen: false
    });
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined || isNaN(value)) return 'No definido';
    return new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const getAreaName = (areaId: number | null | undefined) => {
    if (!areaId) return 'No asignada';
    const area = areas.find(a => a.AreaID === areaId);
    return area ? area.AreaName : 'No asignada';
  };

  const getUserName = (adminProjectId: number | null) => {
    if (!adminProjectId) return 'No asignado';
    const user = users.find(u => u.EmployeeID === adminProjectId);
    return user ? user.UserName : 'No asignado';
  };

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/auth/validate-session', {
        credentials: 'include'
      });

      if (!response.ok) {
        console.log('Sesión no válida, redirigiendo a login');
        router.replace('/');
        return;
      }

      const data = await response.json();

      if (!data?.valid || !data?.user) {
        console.log('Datos de sesión inválidos, redirigiendo a login');
        router.replace('/');
        return;
      }

      setUserData({
        id: data.user.SystemUserID || 0,
        usuario: data.user.UserName || '',
        tipoUsuario: data.role?.toString() || '',
        nombre: data.user.UserName || '',
        apellido: '',
        email: '',
        proyectoAsignado: '',
        proyectoActivo: true,
        projectId: null
      });

    } catch (error) {
      console.error('Error al obtener datos de usuario:', error);
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = useCallback(async () => {
    try {
      setTableLoading(true);
      const response = await fetch('/api/executive-manager/projects2');
      if (response.ok) {
        const data = await response.json();
        setProjects(Array.isArray(data) ? data : []);
      } else {
        showModal('Error', 'Error al obtener proyectos', 'error');
      }
    } catch (error) {
      console.error('Error al obtener proyectos:', error);
      showModal('Error', 'Error al obtener proyectos', 'error');
    } finally {
      setTableLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/executive-manager/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch('/api/executive-manager/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error al obtener empleados:', error);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const response = await fetch('/api/executive-manager/clients');
      if (response.ok) {
        const data = await response.json();
        // Normalizar los datos de clientes (vienen en minúscula desde la API)
        const normalizedClients = Array.isArray(data) ? data.map((client: any) => ({
          ClientID: client.clientId || client.ClientID || client.id,
          ClientName: client.clientName || client.ClientName || client.name || 'Cliente sin nombre',
          BusinessName: client.businessName || client.BusinessName || ''
        })) : [];
        setClients(normalizedClients);
      }
    } catch (error) {
      console.error('Error al obtener clientes:', error);
    }
  }, []);

  const fetchExternalManagers = useCallback(async () => {
    try {
      const response = await fetch('/api/executive-manager/projects2?externalManagers=true');
      if (response.ok) {
        const data = await response.json();
        setExternalManagers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error al obtener administradores externos:', error);
    }
  }, []);

  const fetchAreas = useCallback(async () => {
    try {
      const response = await fetch('/api/executive-manager/areas');
      if (response.ok) {
        const data = await response.json();
        setAreas(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error al obtener áreas:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      await fetchUserData();
      await Promise.all([
        fetchProjects(),
        fetchUsers(),
        fetchEmployees(),
        fetchClients(),
        fetchExternalManagers(),
        fetchAreas()
      ]);
    };
    loadData();
  }, [fetchProjects, fetchUsers, fetchEmployees, fetchClients, fetchExternalManagers, fetchAreas]);

  const checkProjectRecords = async (projectId: number) => {
    try {
      const response = await fetch(`/api/executive-manager/projects2?checkRecords=true&projectId=${projectId}`);
      if (response.ok) {
        return await response.json();
      }
      return { hasInvalidRecords: false, invalidTables: '' };
    } catch (error) {
      console.error('Error al verificar registros del proyecto:', error);
      return { hasInvalidRecords: false, invalidTables: '' };
    }
  };

  const handleAssignSubmit = async (projectData: any) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/executive-manager/projects2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData)
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(prev => [data, ...prev]);
        closeAssignModal();
        showModal('Éxito', 'Proyecto asignado correctamente', 'success');
      } else {
        const errorData = await response.json();
        showModal('Error', errorData.message || 'Error al asignar proyecto', 'error');
      }
    } catch (error) {
      console.error('Error al asignar proyecto:', error);
      showModal('Error', 'Error al conectar con el servidor', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (projectData: any) => {
    setIsSaving(true);
    try {
      const projectId = editModal.project?.ProjectID;
      
      if (!projectId) {
        showModal('Error', 'ID de proyecto no encontrado', 'error');
        return;
      }

      const response = await fetch(`/api/executive-manager/projects2?id=${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData)
      });

      if (response.ok) {
        const updatedProject = await response.json();
        setProjects(prev => 
          prev.map(project => 
            project.ProjectID === projectId 
              ? { ...project, ...updatedProject }
              : project
          )
        );
        closeEditModal();
        showModal('Éxito', 'Proyecto actualizado correctamente', 'success');
      } else {
        const errorData = await response.json();
        showModal('Error', errorData.message || 'Error al actualizar proyecto', 'error');
      }
    } catch (error) {
      console.error('Error al actualizar proyecto:', error);
      showModal('Error', 'Error al conectar con el servidor', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const completeProject = async (projectId: number) => {
    try {
      const response = await fetch(`/api/executive-manager/projects2?id=${projectId}&complete=true`, {
        method: 'PUT'
      });

      const data = await response.json();

      if (response.ok) {
        setProjects(prev => 
          prev.map(project => 
            project.ProjectID === projectId 
              ? { ...project, Status: 1 }
              : project
          )
        );
        closeCompleteModal();
        showModal('Éxito', 'Proyecto marcado como concluido', 'success');
      } else {
        const errorMessage = data.invalidTables 
          ? `No se puede concluir el proyecto. Tiene registros no validados en: ${data.invalidTables}`
          : data.message || 'Error al concluir proyecto';
        showModal('Error', errorMessage, 'error');
      }
    } catch (error) {
      console.error('Error al concluir proyecto:', error);
      showModal('Error', 'Error al conectar con el servidor', 'error');
    }
  };

  const deleteProject = async (projectId: number) => {
    try {
      const response = await fetch(`/api/executive-manager/projects2?id=${projectId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setProjects(prev => prev.filter(project => project.ProjectID !== projectId));
        closeDeleteModal();
        showModal('Éxito', 'Proyecto eliminado correctamente', 'success');
      } else {
        const errorData = await response.json();
        showModal('Error', errorData.message || 'Error al eliminar proyecto', 'error');
      }
    } catch (error) {
      console.error('Error al eliminar proyecto:', error);
      showModal('Error', 'Error al conectar con el servidor', 'error');
    }
  };

  const handleConfirmComplete = async (project: Project) => {
    const { hasInvalidRecords, invalidTables } = await checkProjectRecords(project.ProjectID);
    
    if (hasInvalidRecords) {
      showModal(
        'Error', 
        `No se puede concluir el proyecto. Tiene registros no validados en: ${invalidTables}`,
        'error'
      );
      return;
    }

    openCompleteModal(project);
  };

  const filteredProjects = projects.filter(project => {
    if (!project) return false;
    const searchLower = searchTerm.toLowerCase();
    const userName = getUserName(project.AdminProjectID).toLowerCase();
    const client = clients.find(c => c.ClientID === project.ClientID);
    const clientName = client ? (client.ClientName || '').toLowerCase() : '';
    
    return (
      (project.NameProject || '').toLowerCase().includes(searchLower) ||
      userName.includes(searchLower) ||
      clientName.includes(searchLower)
    );
  });

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3a6ea5] mx-auto"></div>
          <p className="mt-4 text-gray-700 font-medium">Cargando panel de proyectos...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <AppHeader title="PANEL EJECUTIVO" />

      <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
        <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
          
          {/* Header del Panel */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5] w-full">
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center">
                  GESTIÓN DE PROYECTOS
                </h1>
                <p className="text-sm text-gray-200 mt-1">
                  Administra y visualiza todos los proyectos registrados en el sistema.
                </p>
              </div>
            </div>

            {/* Panel de Proyectos */}
            <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
              
              {/* Header con Búsqueda y Botón */}
              <div className="p-6 border-b border-gray-300 bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-72">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Buscar por nombre..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={openAssignModal}
                    className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    ASIGNAR PROYECTO
                  </button>
                </div>
              </div>

              {/* Tabla de Proyectos */}
              <div className="overflow-x-auto">
                {tableLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3a6ea5]"></div>
                      <p className="text-sm text-gray-600 font-medium">Cargando proyectos...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {filteredProjects.length > 0 ? (
                      <div className="overflow-hidden">
                        <table className="w-full bg-white text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-3 text-left font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300">
                                Nombre
                              </th>
                              <th className="px-4 py-3 text-left font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300">
                                Estado
                              </th>
                              <th className="px-4 py-3 text-left font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300">
                                Administrador (Interno)
                              </th>
                              <th className="px-4 py-3 text-left font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300">
                                Project Manager (Externo)
                              </th>
                              <th className="px-4 py-3 text-left font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300">
                                Cliente
                              </th>
                              <th className="px-4 py-3 text-left font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300">
                                Tipo
                              </th>
                              <th className="px-4 py-3 text-left font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300">
                                Presupuesto
                              </th>
                              <th className="px-4 py-3 text-left font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300">
                                Área
                              </th>
                              <th className="px-4 py-3 text-center font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300">
                                Acciones
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {filteredProjects.map((project, index) => {
                              const user = users.find(u => u.EmployeeID === project.AdminProjectID);
                              const client = clients.find(c => c.ClientID === project.ClientID);
                              const externalManager = externalManagers.find(m => m.ExternalProjectManagerID === project.ExternalProjectManagerID);
                              const projectType = project.ProjectType === 1 ? 
                                'Servicio especializado' : 'Servicio llave en mano';
                              const clientName = client ? (client.ClientName || 'No asignado') : 'No asignado';
                              
                              return (
                                <tr 
                                  key={`project-${project.ProjectID}`}
                                  className={`transition-colors duration-150 ${
                                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                  } hover:bg-gray-100`}
                                >
                                  <td className="px-4 py-3 border-r border-gray-300 text-gray-700 font-medium">
                                    {project.NameProject}
                                  </td>
                                  <td className="px-4 py-3 border-r border-gray-300 text-gray-700">
                                    {project.Status === 1 ? (
                                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                        Concluido
                                      </span>
                                    ) : (
                                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                        En Progreso
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 border-r border-gray-300 text-gray-700">
                                    {user ? user.UserName : 'No asignado'}
                                  </td>
                                  <td className="px-4 py-3 border-r border-gray-300 text-gray-700">
                                    {externalManager ? (
                                      <div>
                                        <div className="font-medium">{externalManager.NameProjectManager}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                          {externalManager.Email} | {externalManager.Phone}
                                        </div>
                                      </div>
                                    ) : (
                                      'No asignado'
                                    )}
                                  </td>
                                  <td className="px-4 py-3 border-r border-gray-300 text-gray-700">
                                    {clientName}
                                  </td>
                                  <td className="px-4 py-3 border-r border-gray-300 text-gray-700">
                                    {projectType}
                                  </td>
                                  <td className="px-4 py-3 border-r border-gray-300 text-gray-700">
                                    {formatCurrency(project.ProjectBudget)}
                                  </td>
                                  <td className="px-4 py-3 border-r border-gray-300 text-gray-700">
                                    {project.ClientID === 1 ? getAreaName(project.AreaID) : 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 text-gray-700">
                                    <div className="flex justify-center space-x-1 flex-wrap gap-1">
                                      {project.Status === 0 ? (
                                        <>
                                          <button
                                            onClick={() => openEditModal(project)}
                                            className="inline-flex items-center px-3 py-1.5 border border-[#3a6ea5] text-[#3a6ea5] font-bold rounded-lg hover:bg-[#3a6ea5] hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#3a6ea5] focus:ring-offset-1 text-xs"
                                          >
                                            <Edit className="w-3 h-3 mr-1" />
                                            EDITAR
                                          </button>
                                          <button
                                            onClick={() => handleConfirmComplete(project)}
                                            className="inline-flex items-center px-3 py-1.5 border border-green-600 text-green-600 font-bold rounded-lg hover:bg-green-600 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 text-xs"
                                          >
                                            <CheckCircle className="w-3 h-3 mr-1" />
                                            CONCLUIR
                                          </button>
                                        </>
                                      ) : (
                                        <span className="text-xs text-gray-500 font-medium">Sin acciones</span>
                                      )}
                                      <button
                                        onClick={() => openDeleteModal(project)}
                                        className="inline-flex items-center px-3 py-1.5 border border-red-600 text-red-600 font-bold rounded-lg hover:bg-red-600 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 text-xs"
                                      >
                                        <Trash2 className="w-3 h-3 mr-1" />
                                        ELIMINAR
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <div className="bg-gray-100 rounded-full p-4 mb-4">
                            <Search className="h-8 w-8 text-gray-400" />
                          </div>
                          <h3 className="text-sm font-bold text-gray-900">No hay proyectos</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            {searchTerm ? 'No se encontraron proyectos que coincidan con tu búsqueda.' : 'No se han encontrado proyectos registrados.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Modales */}
      <Modal 
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      <DeleteModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={() => deleteProject(deleteModal.project!.ProjectID)}
        project={deleteModal.project}
      />

      <CompleteModal
        isOpen={completeModal.isOpen}
        onClose={closeCompleteModal}
        onConfirm={() => completeProject(completeModal.project!.ProjectID)}
        project={completeModal.project}
      />

      <AssignProjectModal
        isOpen={assignModal.isOpen}
        onClose={closeAssignModal}
        onSave={handleAssignSubmit}
        users={users}
        employees={employees}
        clients={clients}
        areas={areas}
        isSubmitting={isSubmitting}
      />

      <EditProjectModal
        isOpen={editModal.isOpen}
        onClose={closeEditModal}
        project={editModal.project}
        onSave={handleEditSubmit}
        users={users}
        employees={employees}
        clients={clients}
        areas={areas}
        isSaving={isSaving}
      />

      {/* Estilos globales consistentes */}
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
        
        body.modal-open {
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
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

interface ClientData {
  clientId: number;
  clientName: string;
  businessName: string;
}

// Componente Modal mejorado con diseño consistente
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
const DeleteModal = ({ isOpen, onClose, onConfirm, client }: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  client: ClientData | null;
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

  if (!isOpen || !client) return null;

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
                ¿Estás seguro que deseas eliminar el cliente <span className="font-bold">{client.clientName}</span>?
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

// Modal de Edición
const EditModal = ({ isOpen, onClose, client, onSave }: {
  isOpen: boolean;
  onClose: () => void;
  client: ClientData | null;
  onSave: (data: ClientData) => void;
}) => {
  const [editData, setEditData] = useState<ClientData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showCustomClient, setShowCustomClient] = useState(false);
  
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

  useEffect(() => {
    if (client) {
      setEditData(client);
      const predefinedClients = ['ESENTIA ENERGY', 'GENERAL ELECTRIC', 'SIEMENS ENERGY'];
      setShowCustomClient(!predefinedClients.includes(client.clientName));
    }
  }, [client]);

  const handleClose = () => {
    onClose();
  };

  const handleClientNameChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    if (!editData) return;
    
    const { value, name } = e.target;
    
    if (name === 'clientNameSelect') {
      if (value === 'OTRO') {
        setShowCustomClient(true);
        setEditData({
          ...editData,
          clientName: ''
        });
      } else {
        setShowCustomClient(false);
        setEditData({
          ...editData,
          clientName: value
        });
      }
    } else if (name === 'clientNameInput') {
      setEditData({
        ...editData,
        clientName: value
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editData) return;
    
    const { name, value } = e.target;
    
    setEditData({
      ...editData,
      [name]: value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData) return;

    if (!editData.clientName.trim()) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'El nombre del cliente es requerido',
        type: 'error'
      });
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editData);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !editData) return null;

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full animate-fade-in relative z-[10000] max-h-[90vh] overflow-y-auto">
          <div className="p-6 pb-4 border-b border-gray-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">EDITAR CLIENTE</h3>
                <p className="text-sm text-gray-600 mt-1">Modifica los datos del cliente</p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-clientNameSelect" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                  Nombre del cliente *
                </label>
                {!showCustomClient ? (
                  <select
                    id="edit-clientNameSelect"
                    name="clientNameSelect"
                    value={editData.clientName}
                    onChange={handleClientNameChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium appearance-none"
                    required
                  >
                    <option value="">Seleccione un cliente</option>
                    <option value="ESENTIA ENERGY">ESENTIA ENERGY</option>
                    <option value="GENERAL ELECTRIC">GENERAL ELECTRIC</option>
                    <option value="SIEMENS ENERGY">SIEMENS ENERGY</option>
                    <option value="OTRO">Otro (especificar)</option>
                  </select>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      id="edit-clientNameInput"
                      name="clientNameInput"
                      value={editData.clientName}
                      onChange={handleClientNameChange}
                      placeholder="Ingrese el nombre del cliente"
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCustomClient(false)}
                      className="text-sm text-[#3a6ea5] hover:text-[#2d5592] transition-colors font-medium"
                    >
                      ← Volver a seleccionar de la lista
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="edit-businessName" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                  Razón social *
                </label>
                <input
                  type="text"
                  id="edit-businessName"
                  name="businessName"
                  value={editData.businessName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-300">
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

// Modal para Agregar Cliente
const AddClientModal = ({ isOpen, onClose, onSave, isSubmitting }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ClientData) => void;
  isSubmitting: boolean;
}) => {
  const [clientData, setClientData] = useState<ClientData>({
    clientId: 0,
    clientName: '',
    businessName: ''
  });
  const [showCustomClient, setShowCustomClient] = useState(false);
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

  const handleClose = () => {
    setClientData({
      clientId: 0,
      clientName: '',
      businessName: ''
    });
    setShowCustomClient(false);
    onClose();
  };

  const handleClientNameChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { value, name } = e.target;
    
    if (name === 'clientNameSelect') {
      if (value === 'OTRO') {
        setShowCustomClient(true);
        setClientData(prev => ({
          ...prev,
          clientName: ''
        }));
      } else {
        setShowCustomClient(false);
        setClientData(prev => ({
          ...prev,
          clientName: value
        }));
      }
    } else if (name === 'clientNameInput') {
      setClientData(prev => ({
        ...prev,
        clientName: value
      }));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    setClientData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientData.clientName.trim()) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'El nombre del cliente es requerido',
        type: 'error'
      });
      return;
    }

    await onSave(clientData);
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full animate-fade-in relative z-[10000] max-h-[90vh] overflow-y-auto">
          <div className="p-6 pb-4 border-b border-gray-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">AGREGAR NUEVO CLIENTE</h3>
                <p className="text-sm text-gray-600 mt-1">Complete la información del cliente</p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="space-y-4">
              <div>
                <label htmlFor="clientNameSelect" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                  Nombre del cliente *
                </label>
                {!showCustomClient ? (
                  <select
                    id="clientNameSelect"
                    name="clientNameSelect"
                    value={clientData.clientName}
                    onChange={handleClientNameChange}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium appearance-none"
                    required
                  >
                    <option value="">Seleccione un cliente</option>
                    <option value="ESENTIA ENERGY">ESENTIA ENERGY</option>
                    <option value="GENERAL ELECTRIC">GENERAL ELECTRIC</option>
                    <option value="SIEMENS ENERGY">SIEMENS ENERGY</option>
                    <option value="OTRO">Otro (especificar)</option>
                  </select>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      id="clientNameInput"
                      name="clientNameInput"
                      value={clientData.clientName}
                      onChange={handleClientNameChange}
                      placeholder="Ingrese el nombre del cliente"
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCustomClient(false)}
                      className="text-sm text-[#3a6ea5] hover:text-[#2d5592] transition-colors font-medium"
                    >
                      ← Volver a seleccionar de la lista
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="businessName" className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                  Razón social *
                </label>
                <input
                  type="text"
                  id="businessName"
                  name="businessName"
                  value={clientData.businessName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-300">
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
                  'GUARDAR CLIENTE'
                )}
              </button>
            </div>
          </form>
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

export default function ClientsPage() {
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
  
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'info'
  });

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    client: null as ClientData | null
  });

  const [editModal, setEditModal] = useState({
    isOpen: false,
    client: null as ClientData | null
  });

  const [addClientModal, setAddClientModal] = useState({
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

  const openDeleteModal = (client: ClientData) => {
    setDeleteModal({
      isOpen: true,
      client
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      client: null
    });
  };

  const openEditModal = (client: ClientData) => {
    setEditModal({
      isOpen: true,
      client
    });
  };

  const closeEditModal = () => {
    setEditModal({
      isOpen: false,
      client: null
    });
  };

  const openAddClientModal = () => {
    setAddClientModal({
      isOpen: true
    });
  };

  const closeAddClientModal = () => {
    setAddClientModal({
      isOpen: false
    });
  };

  // Función para obtener los datos del usuario desde la sesión usando validate-session
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

  const fetchClients = useCallback(async () => {
    try {
      setTableLoading(true);
      
      const response = await fetch('/api/executive-manager/clients');
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      } else {
        console.error('Error al obtener clientes');
        showModal('Error', 'Error al obtener clientes', 'error');
      }
    } catch (error) {
      console.error('Error al obtener clientes:', error);
      showModal('Error', 'Error al obtener clientes', 'error');
    } finally {
      setTableLoading(false);
    }
  }, []);

  const handleAddClient = async (clientData: ClientData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/executive-manager/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientData)
      });

      if (response.ok) {
        await fetchClients();
        showModal('Éxito', 'Cliente guardado exitosamente.', 'success');
      } else {
        const errorData = await response.json();
        showModal('Error', `Error al guardar: ${errorData.message}`, 'error');
      }
    } catch (error) {
      console.error('Error al enviar los datos:', error);
      showModal('Error', 'Error al conectar con el servidor', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.client) return;
    
    try {
      const response = await fetch(`/api/executive-manager/clients?id=${deleteModal.client.clientId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchClients();
        showModal('Éxito', 'Cliente eliminado exitosamente.', 'success');
      } else {
        const errorData = await response.json();
        showModal('Error', `Error al eliminar: ${errorData.message}`, 'error');
      }
    } catch (error) {
      console.error('Error al eliminar cliente:', error);
      showModal('Error', 'Error al conectar con el servidor', 'error');
    } finally {
      closeDeleteModal();
    }
  };

  const handleUpdate = async (data: ClientData) => {
    try {
      const response = await fetch(`/api/executive-manager/clients?id=${data.clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        await fetchClients();
        showModal('Éxito', 'Cliente actualizado exitosamente.', 'success');
      } else {
        const errorData = await response.json();
        showModal('Error', `Error al actualizar: ${errorData.message}`, 'error');
      }
    } catch (error) {
      console.error('Error al actualizar cliente:', error);
      showModal('Error', 'Error al conectar con el servidor', 'error');
    } finally {
      closeEditModal();
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchUserData();
      await fetchClients();
    };
    loadData();
  }, []);

  const filteredClients = clients.filter(client =>
    client.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.businessName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Mostrar loading mientras se verifica la sesión
  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3a6ea5] mx-auto"></div>
          <p className="mt-4 text-gray-700 font-medium">Cargando panel de clientes...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario (sesión inválida), no renderizar nada
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <AppHeader title="PANEL DE CLIENTES" />

      <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
        <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
          
          {/* Header del Panel */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5] w-full">
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center">
                  GESTIÓN DE CLIENTES
                </h1>
                <p className="text-sm text-gray-200 mt-1">
                  Administra y visualiza todos los clientes registrados en el sistema.
                </p>
              </div>
            </div>

            {/* Panel de Clientes */}
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
                    onClick={openAddClientModal}
                    className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    AGREGAR CLIENTE
                  </button>
                </div>
              </div>

              {/* Tabla de Clientes */}
              <div className="overflow-x-auto">
                {tableLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3a6ea5]"></div>
                      <p className="text-sm text-gray-600 font-medium">Cargando clientes...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {filteredClients.length > 0 ? (
                      <div className="overflow-hidden">
                        <table className="w-full bg-white text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-3 text-left font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300">
                                Nombre del Cliente
                              </th>
                              <th className="px-4 py-3 text-left font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300 border-r border-gray-300">
                                Razón Social
                              </th>
                              <th className="px-4 py-3 text-center font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300">
                                Acciones
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {filteredClients.map((client, index) => (
                              <tr 
                                key={`client-${client.clientId}`}
                                className={`transition-colors duration-150 ${
                                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                } hover:bg-gray-100`}
                              >
                                <td className="px-4 py-3 border-r border-gray-300 text-gray-700 font-medium">
                                  {client.clientName}
                                </td>
                                <td className="px-4 py-3 border-r border-gray-300 text-gray-700">
                                  {client.businessName}
                                </td>
                                <td className="px-4 py-3 text-gray-700">
                                  <div className="flex justify-center space-x-2">
                                    <button
                                      onClick={() => openEditModal(client)}
                                      className="inline-flex items-center px-4 py-2 border border-[#3a6ea5] text-[#3a6ea5] font-bold rounded-lg hover:bg-[#3a6ea5] hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#3a6ea5] focus:ring-offset-1 text-xs"
                                    >
                                      <Edit className="w-3.5 h-3.5 mr-1.5" />
                                      EDITAR
                                    </button>
                                    <button
                                      onClick={() => openDeleteModal(client)}
                                      className="inline-flex items-center px-4 py-2 border border-red-600 text-red-600 font-bold rounded-lg hover:bg-red-600 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 text-xs"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                      ELIMINAR
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <div className="bg-gray-100 rounded-full p-4 mb-4">
                            <Search className="h-8 w-8 text-gray-400" />
                          </div>
                          <h3 className="text-sm font-bold text-gray-900">No hay clientes</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            {searchTerm ? 'No se encontraron clientes que coincidan con tu búsqueda.' : 'No se han encontrado clientes registrados.'}
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
        onConfirm={handleDelete}
        client={deleteModal.client}
      />

      <EditModal
        isOpen={editModal.isOpen}
        onClose={closeEditModal}
        client={editModal.client}
        onSave={handleUpdate}
      />

      <AddClientModal
        isOpen={addClientModal.isOpen}
        onClose={closeAddClientModal}
        onSave={handleAddClient}
        isSubmitting={isSubmitting}
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
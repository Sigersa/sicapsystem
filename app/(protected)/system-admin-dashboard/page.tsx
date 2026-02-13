'use client';
import React, { useState, useMemo, useEffect } from 'react';
import AppHeader from '@/components/header/1/1';
import Footer from '@/components/footer';
import { User, Lock, AlertTriangle, X, Search, RefreshCw, Edit2, Trash2, UserMinus, UserX, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { useSessionManager } from '@/hooks/useSessionManager/1';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { useUserData } from '@/hooks/useUserData';

type UserData = {
  SystemUserID: number;
  UserName: string;
  UserTypeID: number;
  UserType: string;
  EmployeeID: number;
  EmployeeName: string;
  EmployeeEmail: string;
};

type UserType = {
  UserTypeID: number;
  Type: string;
};

type Employee = {
  EmployeeID: number;
  FullName: string;
  Email: string;
};

const emptyForm = {
  EmployeeID: 0,
  UserTypeID: 0,
  UserName: '',
  Password: '',
};

const getUserTypeColor = (userTypeID: number) => {
  switch (userTypeID) {
    case 0: 
      return 'bg-red-200 text-red-900 border border-red-400';
    case 1: 
      return 'bg-pink-200 text-pink-900 border border-pink-400';
    case 2: 
      return 'bg-green-200 text-green-900 border border-green-400';
    case 3: 
      return 'bg-blue-200 text-blue-900 border border-blue-400';
    case 4: 
      return 'bg-yellow-200 text-yellow-900 border border-yellow-400';
    case 5: 
      return 'bg-gray-200 text-gray-900 border border-gray-400';
    case 6: 
      return 'bg-indigo-200 text-indigo-900 border border-indigo-400';
    case 7: 
      return 'bg-pink-200 text-pink-900 border border-pink-400';
    case 8: 
      return 'bg-orange-200 text-orange-900 border border-orange-400';
    case 9: 
      return 'bg-teal-200 text-teal-900 border border-teal-400';
    case 10: 
      return 'bg-cyan-200 text-cyan-900 border border-cyan-400';
    case 11: 
      return 'bg-lime-200 text-lime-900 border border-lime-400';
    case 12: 
      return 'bg-fuchsia-200 text-fuchsia-900 border border-fuchsia-400';
    default:
      return 'bg-blue-200 text-blue-900 border border-blue-400';
  }
};

const generateUsername = (employeeID: number): string => {
  const randomNumbers = Math.floor(100 + Math.random() * 900).toString();
  return `EMP${employeeID.toString().padStart(3, '0')}${randomNumbers}`;
};

const generatePassword = (employeeID: number): string => {
  const symbols = '!@#$%^&*';
  const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
  const randomNumbers = Math.floor(1000 + Math.random() * 9000).toString();
  return `EMP${employeeID}${randomSymbol}${randomNumbers}`;
};

export default function SystemAdminDashboard() {
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();
  const { 
    users, 
    userTypes, 
    dataLoading, 
    error: dataError,
    refreshData 
  } = useUserData();

  const [formData, setFormData] = useState<any>(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [userToDeactivate, setUserToDeactivate] = useState<UserData | null>(null);
  const [reactivateUserType, setReactivateUserType] = useState<number>(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [generatedCredentials, setGeneratedCredentials] = useState<{username: string, password: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [newGeneratedPassword, setNewGeneratedPassword] = useState<string>('');

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const res = await fetch('/api/system-admin-dashboard/employees');
        
        if (res.ok) {
          const data = await res.json();
          setEmployees(data);
        } else {
          const errorText = await res.text();
          console.error('Error en respuesta:', errorText);
          throw new Error(`Error ${res.status}: ${res.statusText}`);
        }
      } catch (error) {
        console.error('Error al cargar empleados:', error);
        setError('Error al cargar la lista de empleados');
      } finally {
        setLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: name === 'EmployeeID' || name === 'UserTypeID' ? parseInt(value) || 0 : value };
    setFormData(newFormData);
    
    if (name === 'EmployeeID' && value && !editingUser) {
      const employeeID = parseInt(value);
      if (employeeID > 0) {
        const username = generateUsername(employeeID);
        const password = generatePassword(employeeID);
        
        setGeneratedCredentials({ username, password });
        setFormData((prev: typeof formData) => ({
          ...prev,
          UserName: username,
          Password: password
        }));
      }
    }
  };

  const openCreate = () => {
    setEditingUser(null);
    setFormData(emptyForm);
    setGeneratedCredentials(null);
    setShowPasswordField(false);
    setNewGeneratedPassword('');
    setShowModal(true);
    setError(null);
  };

  const openEdit = (u: UserData) => {
    setEditingUser(u);
    setFormData({
      EmployeeID: u.EmployeeID,
      UserName: u.UserName,
      Password: '',
      UserTypeID: u.UserTypeID,
    });
    setGeneratedCredentials(null);
    setShowPasswordField(false);
    setNewGeneratedPassword('');
    setShowModal(true);
    setError(null);
  };

  const openDelete = (u: UserData) => {
    setUserToDelete(u);
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  const openDeactivate = (u: UserData) => {
    setUserToDeactivate(u);
    if (u.UserTypeID === 0) {
      const firstAvailableType = userTypes.find(t => t.UserTypeID !== 0);
      setReactivateUserType(firstAvailableType?.UserTypeID || 2);
    } else {
      setReactivateUserType(0);
    }
    setShowDeactivateModal(true);
    setDeactivateError(null);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
    setDeleteError(null);
    setDeleteLoading(false);
  };

  const closeDeactivateModal = () => {
    setShowDeactivateModal(false);
    setUserToDeactivate(null);
    setReactivateUserType(0);
    setDeactivateError(null);
    setDeactivateLoading(false);
  };

  const generateNewPassword = () => {
    if (!formData.EmployeeID) {
      setError('Por favor seleccione un empleado primero');
      return;
    }

    const newPassword = generatePassword(formData.EmployeeID);
    setNewGeneratedPassword(newPassword);
    setFormData((prev: typeof formData) => ({
      ...prev,
      Password: newPassword
    }));
    setShowPasswordField(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.EmployeeID || formData.EmployeeID === 0) {
        throw new Error('Por favor seleccione un empleado');
      }

      if (!formData.UserTypeID || formData.UserTypeID === 0) {
        throw new Error('Por favor seleccione un tipo de usuario');
      }

      let submitData = { ...formData };
      
      if (!editingUser) {
        if (!generatedCredentials) {
          throw new Error('Por favor seleccione un empleado para generar las credenciales');
        }
        
        submitData.UserName = generatedCredentials.username;
        submitData.Password = generatedCredentials.password;
      } else {
        if (newGeneratedPassword) {
          submitData.Password = newGeneratedPassword;
        }
        
        if (!submitData.Password || submitData.Password.trim() === '') {
          const { Password, ...dataWithoutPassword } = submitData;
          submitData = dataWithoutPassword;
        }
      }

      const url = editingUser
        ? `/api/system-admin-dashboard/crud-users/${editingUser.SystemUserID}`
        : `/api/system-admin-dashboard/crud-users`;

      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Error al ${editingUser ? 'actualizar' : 'crear'} el usuario`);
      }

      // Cerrar modal inmediatamente
      setShowModal(false);
      setFormData(emptyForm);
      setGeneratedCredentials(null);
      setNewGeneratedPassword('');
      setShowPasswordField(false);
      
      // Mostrar mensaje de éxito fuera del modal
      setSuccessMessage(editingUser ? '¡USUARIO ACTUALIZADO EXITOSAMENTE!' : '¡USUARIO CREADO EXITOSAMENTE!');
      
      // Recargar usuarios
      await refreshData();
      
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (err: any) {
      setError(err.message || 'Error en la operación');
      console.error('Submit error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    
    setDeleteLoading(true);
    setDeleteError(null);
    
    try {
      const res = await fetch(`/api/system-admin-dashboard/crud-users/${userToDelete.SystemUserID}`, { 
        method: 'DELETE' 
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Error al eliminar el usuario');
      }

      // Cerrar modal inmediatamente
      closeDeleteModal();
      
      // Mostrar mensaje de éxito fuera del modal
      setSuccessMessage('¡USUARIO ELIMINADO EXITOSAMENTE!');
      
      // Recargar usuarios
      await refreshData();
      
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (err: any) {
      setDeleteError(err.message || 'Error al eliminar el usuario');
      console.error('Delete error:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!userToDeactivate) return;
    
    setDeactivateLoading(true);
    setDeactivateError(null);
    
    try {
      const url = `/api/system-admin-dashboard/crud-users/${userToDeactivate.SystemUserID}`;
      
      const res = await fetch(url, { 
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ UserTypeID: reactivateUserType })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar el estado del usuario');
      }

      // Cerrar modal inmediatamente
      closeDeactivateModal();
      
      // Mostrar mensaje de éxito fuera del modal
      setSuccessMessage(userToDeactivate.UserTypeID === 0 
        ? '¡USUARIO REACTIVADO EXITOSAMENTE!' 
        : '¡USUARIO DADO DE BAJA EXITOSAMENTE!'
      );
      
      // Recargar usuarios
      await refreshData();
      
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (err: any) {
      setDeactivateError(err.message || 'Error al actualizar el estado del usuario');
      console.error('Deactivate/Reactivate error:', err);
    } finally {
      setDeactivateLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;

    const query = searchQuery.toLowerCase().trim();
    return users.filter(user => 
      user.EmployeeName?.toLowerCase().includes(query) ||
      user.UserName?.toLowerCase().includes(query) ||
      user.EmployeeEmail?.toLowerCase().includes(query) ||
      user.UserType?.toLowerCase().includes(query) ||
      user.EmployeeID?.toString().includes(query)
    );
  }, [users, searchQuery]);

  const availableEmployees = useMemo(() => {
    const assignedEmployeeIds = new Set(users.map(u => u.EmployeeID));
    return employees.filter(emp => !assignedEmployeeIds.has(emp.EmployeeID));
  }, [employees, users]);

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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER - Fixed */}
      <AppHeader 
        title="PANEL DE CONTROL DEL SISTEMA"
      />

      {/* MODAL PARA CREAR/EDITAR USUARIO - Estilo actualizado */}
      {showModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70"
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full animate-fade-in relative z-[10000] max-h-[90vh] overflow-y-auto">
            <div className="p-6 pb-4 border-b border-gray-300 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                  {editingUser ? 'EDITAR USUARIO' : 'NUEVO USUARIO'}
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  {editingUser 
                    ? 'Modifique los datos del usuario seleccionado.' 
                    : 'Complete el formulario para registrar un nuevo usuario.'
                  }
                </p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setGeneratedCredentials(null);
                  setNewGeneratedPassword('');
                  setShowPasswordField(false);
                  setFormData(emptyForm);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 animate-fade-in">
                    <div className="flex items-center">
                      <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                      <p className="text-sm font-medium text-gray-600 leading-5">
                        {error}
                      </p>
                    </div>
                  </div>
                )}

                {!editingUser && generatedCredentials && (
                  <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                    <h4 className="text-xs font-bold text-gray-700 mb-3 flex items-center uppercase tracking-wide">
                      CREDENCIALES GENERADAS
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                          USUARIO
                        </label>
                        <div className="flex items-center relative">
                          <div className="absolute left-3">
                            <User className="h-4 w-4 text-gray-600" />
                          </div>
                          <input
                            type="text"
                            value={generatedCredentials.username}
                            readOnly
                            className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                          CONTRASEÑA
                        </label>
                        <div className="flex items-center relative">
                          <div className="absolute left-3">
                            <Lock className="h-4 w-4 text-gray-600" />
                          </div>
                          <input
                            type="text"
                            value={generatedCredentials.password}
                            readOnly
                            className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {editingUser && newGeneratedPassword && (
                  <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                    <h4 className="text-xs font-bold text-gray-700 mb-3 flex items-center uppercase tracking-wide">
                      NUEVA CONTRASEÑA GENERADA
                    </h4>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                        CONTRASEÑA
                      </label>
                      <div className="flex items-center relative">
                        <div className="absolute left-3">
                          <Lock className="h-4 w-4 text-gray-600" />
                        </div>
                        <input
                          type={showPasswordField ? "text" : "password"}
                          value={newGeneratedPassword}
                          readOnly
                          className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none font-mono"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-600">
                      <strong>Nota:</strong> Esta contraseña se asignará al usuario al guardar los cambios.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                      EMPLEADO *
                    </label>
                    <select
                      name="EmployeeID"
                      value={formData.EmployeeID}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5]"
                      required
                      disabled={!!editingUser || loadingEmployees}
                    >
                      <option value="0">Seleccione un empleado</option>
                      {editingUser ? (
                        <option value={editingUser.EmployeeID}>
                          {editingUser.EmployeeName} (ID: {editingUser.EmployeeID.toString()})
                        </option>
                      ) : (
                        availableEmployees.map((emp) => (
                          <option key={emp.EmployeeID} value={emp.EmployeeID}>
                            {emp.FullName} (ID: {emp.EmployeeID.toString()})
                          </option>
                        ))
                      )}
                    </select>
                    {!editingUser && loadingEmployees && (
                      <p className="mt-1 text-xs text-gray-600">Cargando empleados...</p>
                    )}
                    {!editingUser && !loadingEmployees && availableEmployees.length === 0 && (
                      <p className="mt-1 text-xs text-red-600">Todos los empleados ya tienen usuario asignado</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                      TIPO DE USUARIO *
                    </label>
                    <select
                      name="UserTypeID"
                      value={formData.UserTypeID}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5]"
                      required
                      disabled={loading}
                    >
                      <option value="0">Seleccione un tipo</option>
                      {userTypes
                        .filter(t => t.UserTypeID !== 0)
                        .map((t) => (
                          <option key={t.UserTypeID} value={t.UserTypeID}>
                            {t.Type}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                      USUARIO
                    </label>
                    <input
                      type="text"
                      name="UserName"
                      value={formData.UserName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 text-sm bg-gray-100 border border-gray-400 rounded focus:outline-none font-mono"
                      placeholder="Se generará automáticamente"
                      readOnly
                    />
                  </div>

                  {editingUser && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                          CONTRASEÑA
                        </label>
                        <button
                          type="button"
                          onClick={generateNewPassword}
                          className="px-3 py-1.5 text-xs bg-[#3a6ea5] text-white font-bold rounded hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap uppercase tracking-wide"
                          disabled={loading}
                        >
                          <RefreshCw className="h-3 w-3 mr-2" />
                          GENERAR
                        </button>
                      </div>
                      <div className="space-y-2">
                        <input
                          type={showPasswordField ? "text" : "password"}
                          name="Password"
                          value={formData.Password}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5]"
                          placeholder="Dejar vacío para mantener contraseña"
                          disabled={loading}
                        />
                        {formData.Password && (
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="showPassword"
                              checked={showPasswordField}
                              onChange={() => setShowPasswordField(!showPasswordField)}
                              className="h-4 w-4 text-[#3a6ea5] focus:ring-[#3a6ea5] border border-gray-400 rounded"
                              disabled={loading}
                            />
                            <label htmlFor="showPassword" className="ml-2 text-xs text-gray-700">
                              Mostrar contraseña
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 pt-4 border-t border-gray-300 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setGeneratedCredentials(null);
                    setNewGeneratedPassword('');
                    setShowPasswordField(false);
                    setFormData(emptyForm);
                  }}
                  className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap"
                  disabled={loading}
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      PROCESANDO...
                    </>
                  ) : editingUser ? (
                    'ACTUALIZAR'
                  ) : (
                    'CREAR'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA DAR DE BAJA/REACTIVAR - Estilo actualizado */}
      {showDeactivateModal && userToDeactivate && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70"
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-in relative z-[10000]">
            <div className="p-6 pb-4 border-b border-gray-300">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                <AlertCircle className="h-5 w-5 text-gray-600 mr-2" />
                {userToDeactivate.UserTypeID === 0 ? 'REACTIVAR USUARIO' : 'DAR DE BAJA USUARIO'}
              </h2>
              <p className="text-sm text-gray-600 mt-2 leading-5">
                {userToDeactivate.UserTypeID === 0 
                  ? 'Reactivar acceso del usuario' 
                  : 'Esta acción desactivará el acceso del usuario'
                }
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              {deactivateError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 animate-fade-in">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                    <p className="text-sm font-medium text-gray-600 leading-5">
                      {deactivateError}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                    EMPLEADO
                  </label>
                  <input
                    type="text"
                    value={userToDeactivate.EmployeeName}
                    readOnly
                    className="w-full px-3 py-2.5 text-sm bg-gray-100 border border-gray-400 rounded focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                    USUARIO
                  </label>
                  <input
                    type="text"
                    value={userToDeactivate.UserName}
                    readOnly
                    className="w-full px-3 py-2.5 text-sm bg-gray-100 border border-gray-400 rounded focus:outline-none font-mono"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                    TIPO DE USUARIO ACTUAL
                  </label>
                  <input
                    type="text"
                    value={userToDeactivate.UserTypeID === 0 ? 'DADO DE BAJA' : userToDeactivate.UserType || ''}
                    readOnly
                    className="w-full px-3 py-2.5 text-sm bg-gray-100 border border-gray-400 rounded focus:outline-none"
                  />
                </div>
                
                {userToDeactivate.UserTypeID === 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-300">
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                      SELECCIONAR TIPO DE USUARIO PARA REACTIVAR
                    </label>
                    <select
                      value={reactivateUserType}
                      onChange={(e) => setReactivateUserType(Number(e.target.value))}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5]"
                      required
                      disabled={deactivateLoading}
                    >
                      <option value="0">Seleccione un tipo</option>
                      {userTypes
                        .filter(t => t.UserTypeID !== 0)
                        .map((t) => (
                          <option key={t.UserTypeID} value={t.UserTypeID}>
                            {t.Type}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mr-2 flex-shrink-0" />
                  <p className="text-xs text-gray-600 leading-5">
                    {userToDeactivate.UserTypeID === 0 
                      ? <><strong>Información:</strong> Al reactivar el usuario, se le asignará el tipo de usuario seleccionado y podrá acceder al sistema nuevamente.</>
                      : <><strong>Información:</strong> Al dar de baja al usuario, ya no podrá acceder al sistema. Los datos del usuario se mantendrán en el sistema.</>
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 pt-4 border-t border-gray-300 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeactivateModal}
                disabled={deactivateLoading}
                className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap"
              >
                CANCELAR
              </button>
              <button
                onClick={handleDeactivate}
                disabled={deactivateLoading || (userToDeactivate.UserTypeID === 0 && reactivateUserType === 0)}
                className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap"
              >
                {deactivateLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    PROCESANDO...
                  </>
                ) : userToDeactivate.UserTypeID === 0 ? (
                  'REACTIVAR'
                ) : (
                  'DAR DE BAJA'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR - Estilo actualizado */}
      {showDeleteModal && userToDelete && (
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
                ¿Está seguro que desea eliminar este usuario? Esta acción no se puede deshacer.
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              {deleteError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 animate-fade-in">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                    <p className="text-sm font-medium text-gray-600 leading-5">
                      {deleteError}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                    EMPLEADO
                  </label>
                  <input
                    type="text"
                    value={userToDelete.EmployeeName || ''}
                    readOnly
                    className="w-full px-3 py-2.5 text-sm bg-gray-100 border border-gray-400 rounded focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                    USUARIO
                  </label>
                  <input
                    type="text"
                    value={userToDelete.UserName}
                    readOnly
                    className="w-full px-3 py-2.5 text-sm bg-gray-100 border border-gray-400 rounded focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                    TIPO
                  </label>
                  <input
                    type="text"
                    value={userToDelete.UserTypeID === 0 ? 'DADO DE BAJA' : userToDelete.UserType}
                    readOnly
                    className="w-full px-3 py-2.5 text-sm bg-gray-100 border border-gray-400 rounded focus:outline-none"
                  />
                </div>
              </div>
              
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mr-2 flex-shrink-0" />
                  <p className="text-xs text-gray-600 leading-5">
                    <strong>Advertencia:</strong> Esta acción eliminará permanentemente al usuario del sistema. 
                    El empleado podrá volver a tener un usuario asignado en el futuro.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 pt-4 border-t border-gray-300 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteLoading}
                className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap"
              >
                CANCELAR
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center whitespace-nowrap"
              >
                {deleteLoading ? (
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
                <h1 className="text-xl font-bold text-white tracking-tight">GESTIÓN DE USUARIOS</h1>
                <p className="text-sm text-gray-200 mt-1">
                  Administre los usuarios del sistema basados en empleados
                </p>
              </div>
            </div>

            {/* MENSAJES DE ÉXITO - AHORA FUERA DEL MODAL */}
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

            {dataError && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 animate-fade-in">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <p className="text-sm font-medium text-gray-600 leading-5">
                    {dataError}
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
                    placeholder="Buscar por nombre, ID o correo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
              
              <button
                onClick={openCreate}
                className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap"
              >
                NUEVO USUARIO
              </button>
            </div>

            {/* TABLA DE USUARIOS */}
            <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">ID</th>
                      <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">NOMBRE DE EMPLEADO</th>
                      <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">NOMBRE DE USUARIO</th>
                      <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">CORREO</th>
                      <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">TIPO DE USUARIO</th>
                      <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300 text-center">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataLoading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a6ea5] mb-2"></div>
                            <p className="text-gray-600">Cargando usuarios...</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <AlertCircle className="h-8 w-8 text-gray-400 mb-3" />
                            <p className="text-sm font-medium text-gray-600 mt-2 leading-5">
                              {searchQuery ? 'No se encontraron usuarios que coincidan con la búsqueda' : 'No hay usuarios registrados'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.SystemUserID} className="hover:bg-gray-50 transition-colors border-b border-gray-300">
                          <td className="py-3 px-4 text-sm text-gray-800 font-medium">EMP{u.EmployeeID.toString().padStart(3, '0')}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{u.EmployeeName}</td>
                          <td className="py-3 px-4 text-sm text-gray-800 font-mono">{u.UserName}</td>
                          <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">{u.EmployeeEmail}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap ${getUserTypeColor(u.UserTypeID)}`}>
                              {u.UserTypeID === 0 ? 'DADO DE BAJA' : u.UserType}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEdit(u)}
                                disabled={u.UserTypeID === 0}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Editar usuario"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openDeactivate(u)}
                                disabled={u.SystemUserID === user?.SystemUserID}
                                className={`p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                  u.UserTypeID === 0 
                                    ? 'text-green-600 hover:bg-green-50' 
                                    : 'text-gray-600 hover:bg-gray-50'
                                }`}
                                title={u.UserTypeID === 0 ? "Reactivar usuario" : "Dar de baja usuario"}
                              >
                                {u.UserTypeID === 0 ? (
                                  <UserX className="h-4 w-4" />
                                ) : (
                                  <UserMinus className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => openDelete(u)}
                                disabled={u.SystemUserID === user?.SystemUserID}
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
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER - Fixed */}
      <Footer />

      {/* Estilos globales para animaciones y layout */}
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
        
        textarea {
          resize: none;
        }
      `}</style>
    </div>
  );
}
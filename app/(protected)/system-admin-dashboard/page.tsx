'use client';
import React, { useState, useMemo } from 'react';
import AppHeader from '@/components/header/1/1';
import { User, Lock, AlertTriangle, X, Search, RefreshCw, Edit2, Trash2 } from 'lucide-react';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/1';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { useUserData } from '@/hooks/useUserData';

type UserData = {
  SystemUserID: number;
  UserName: string;
  UserTypeID: number;
  UserType: string;
  FirstName: string;
  LastName: string;
  MiddleName: string;
  Email: string;
};

type UserType = {
  UserTypeID: number;
  Type: string;
};

const emptyForm = {
  UserName: '',
  Password: '',
  UserTypeID: 0,
  FirstName: '',
  LastName: '',
  MiddleName: '',
  Email: '',
};

const getUserTypeColor = (userTypeID: number) => {
  switch (userTypeID) {
    case 1: 
      return 'bg-blue-200 text-blue-900 border border-blue-400';
    case 2: 
      return 'bg-green-200 text-green-900 border border-green-400';
    case 3: 
      return 'bg-purple-200 text-purple-900 border border-purple-400';
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

// Función para generar dos números aleatorios
const generateRandomNumbers = (): string => {
  return Math.floor(10 + Math.random() * 90).toString();
};

// Función para generar una letra minúscula aleatoria
const generateRandomLetter = (): string => {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  return letters[Math.floor(Math.random() * letters.length)];
};

// Función para generar un signo aleatorio
const generateRandomSymbol = (): string => {
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  return symbols[Math.floor(Math.random() * symbols.length)];
};

// Función para obtener solo el primer nombre
const getFirstNameOnly = (fullName: string): string => {
  const names = fullName.trim().split(' ');
  return names[0];
};

// Función para generar el nombre de usuario automáticamente
const generateUsername = (firstName: string, lastName: string, middleName: string): string => {
  const firstOnly = getFirstNameOnly(firstName);
  const firstInitial = firstOnly.charAt(0).toUpperCase();
  const lastInitial = lastName.charAt(0).toUpperCase();
  const surname = middleName || lastName;
  const randomNumbers = generateRandomNumbers().substring(0, 2);
  const randomLetter = generateRandomLetter();
  
  return `${firstInitial}${lastInitial}${surname}${randomNumbers}${randomLetter}`;
};

// Función para generar la contraseña automáticamente
const generatePassword = (firstName: string, lastName: string, middleName: string): string => {
  const firstOnly = getFirstNameOnly(firstName);
  const secondPart = lastName;
  const randomNumbers = generateRandomNumbers();
  const randomSymbol = generateRandomSymbol();
  const randomLetter = generateRandomLetter();
  
  return `${firstOnly}.${secondPart}.${randomNumbers}${randomSymbol}${randomLetter}`;
};

export default function SystemAdminDashboard() {
  // Usar hooks personalizados
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();
  const { 
    users, 
    userTypes, 
    dataLoading, 
    error: dataError,
    fetchUsers,
    refreshData 
  } = useUserData();

  const [formData, setFormData] = useState<any>(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);

  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedCredentials, setGeneratedCredentials] = useState<{username: string, password: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [newGeneratedPassword, setNewGeneratedPassword] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);
    
    if (editingUser) return;
    
    if (name === 'FirstName' || name === 'LastName' || name === 'MiddleName') {
      if (newFormData.FirstName && newFormData.LastName) {
        const username = generateUsername(
          newFormData.FirstName,
          newFormData.LastName,
          newFormData.MiddleName
        );
        const password = generatePassword(
          newFormData.FirstName,
          newFormData.LastName,
          newFormData.MiddleName
        );
        
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
    setSuccess(null);
  };

  const openEdit = (u: UserData) => {
    setEditingUser(u);
    setFormData({
      UserName: u.UserName,
      Password: '',
      UserTypeID: u.UserTypeID,
      FirstName: u.FirstName,
      LastName: u.LastName,
      MiddleName: u.MiddleName,
      Email: u.Email,
    });
    setGeneratedCredentials(null);
    setShowPasswordField(false);
    setNewGeneratedPassword('');
    setShowModal(true);
    setError(null);
    setSuccess(null);
  };

  const openDelete = (u: UserData) => {
    setUserToDelete(u);
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
    setDeleteError(null);
    setDeleteLoading(false);
  };

  const generateNewPassword = () => {
    if (!formData.FirstName || !formData.LastName) {
      setError('Por favor complete primero el nombre y apellido para generar una nueva contraseña');
      return;
    }

    const newPassword = generatePassword(
      formData.FirstName,
      formData.LastName,
      formData.MiddleName
    );
    
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
    setSuccess(null);

    try {
      let submitData = { ...formData };
      
      if (!editingUser) {
        if (!generatedCredentials) {
          throw new Error('Por favor complete los campos de nombre para generar las credenciales');
        }
        
        submitData.UserName = generatedCredentials.username;
        submitData.Password = generatedCredentials.password;
      } else {
        if (newGeneratedPassword) {
          submitData.Password = newGeneratedPassword;
        }
        
        if (!submitData.Password) {
          const { Password, ...dataWithoutPassword } = submitData;
          submitData = dataWithoutPassword;
        }
      }

      const url = editingUser
        ? `/api/system-admin-dashboard/crud-users/put-delete/${editingUser.SystemUserID}`
        : `/api/system-admin-dashboard/crud-users/get-post`;

      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar el usuario');
      }

      setSuccess(editingUser ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
      
      // Refrescar datos
      await refreshData();

      setTimeout(() => {
        setShowModal(false);
        setSuccess(null);
        setGeneratedCredentials(null);
        setNewGeneratedPassword('');
        setShowPasswordField(false);
      }, 1500);

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
      const res = await fetch(`/api/system-admin-dashboard/crud-users/put-delete/${userToDelete.SystemUserID}`, { 
        method: 'DELETE' 
      });
      
      if (res.ok) {
        // Refrescar datos usando el hook
        await refreshData();
        closeDeleteModal();
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar el usuario');
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Error al eliminar el usuario');
      console.error('Delete error:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filtrar usuarios basado en la búsqueda
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;

    const query = searchQuery.toLowerCase().trim();
    return users.filter(user => 
      user.FirstName.toLowerCase().includes(query) ||
      user.LastName.toLowerCase().includes(query) ||
      user.MiddleName.toLowerCase().includes(query) ||
      user.UserName.toLowerCase().includes(query) ||
      user.Email.toLowerCase().includes(query) ||
      user.UserType.toLowerCase().includes(query) ||
      `${user.FirstName} ${user.LastName} ${user.MiddleName}`.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

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
        title="PANEL DE CONTROL DEL SISTEMA"
      />

      {/* CONTENT */}
      <main className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5] w-full">
              <h1 className="text-xl font-bold text-white tracking-tight">GESTIÓN DE USUARIOS</h1>
              <p className="text-sm text-gray-200 mt-1">
                Administre los usuarios del sistema y sus permisos
              </p>
            </div>
          </div>
          
          {/* Contenedor para barra de búsqueda y botón */}
          <div className="bg-white p-4 rounded-lg shadow border border-gray-100 mb-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
              {/* BARRA DE BÚSQUEDA */}
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-300" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5] bg-white placeholder-gray-500 leading-5"
                  placeholder="Buscar usuarios..."
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="h-4 w-4 text-gray-500 hover:text-gray-700" />
                  </button>
                )}
              </div>

              {/* BOTÓN CREAR USUARIO */}
              <button
                onClick={openCreate}
                className="inline-flex items-center justify-center px-4 py-2.5 bg-[#3a6ea5] border border-[#3a6ea5] rounded font-bold text-white hover:bg-[#2a4a75] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow hover:shadow-md text-sm w-full sm:w-auto"
              >
                CREAR USUARIO
              </button>
            </div>

            {/* Mostrar errores de datos */}
            {dataError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-sm text-red-700 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {dataError}
                </p>
              </div>
            )}

            {/* Contador de resultados */}
            {searchQuery && (
              <div className="mt-4">
                <p className="text-xs text-gray-600 bg-gray-100 p-2 rounded border border-gray-300">
                  Mostrando <span className="font-bold">{filteredUsers.length}</span> de <span className="font-bold">{users.length}</span> usuarios
                  {filteredUsers.length === 0 && ' - No se encontraron resultados'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* TABLE */}
        {dataLoading ? (
          <div className="bg-white rounded-lg shadow border border-gray-300 p-8 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a6ea5] mx-auto"></div>
              <p className="mt-4 text-gray-700 font-medium">Cargando usuarios...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-200">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-300">
                      Nombre de Usuario
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-300">
                      Nombre Completo
                    </th>
                    <th scope="col" className="hidden md:table-cell px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-300">
                      Correo
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-300">
                      Tipo de Usuario
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-300">
                  {filteredUsers.map((u, index) => (
                    <tr 
                      key={u.SystemUserID} 
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 border-b border-gray-300`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap border-r border-gray-300">
                        <div className="flex items-center">
                          <div className="text-sm text-gray-600 truncate max-w-[200px] flex items-center">
                            {u.UserName}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-r border-gray-300">
                        <div className="text-sm text-gray-600 truncate max-w-[200px] flex items-center">
                          {u.FirstName} {' '}
                          {u.LastName} {' '}
                          {u.MiddleName} 
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap border-r border-gray-300">
                        <div className="text-sm text-gray-600 truncate max-w-[200px] flex items-center">
                          {u.Email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-r border-gray-300">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap ${getUserTypeColor(u.UserTypeID)}`}>
                          {u.UserType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openEdit(u)}
                            className="inline-flex items-center px-3 py-1.5 bg-yellow-100 text-yellow-900 border border-yellow-400 rounded hover:bg-yellow-200 transition-colors text-sm font-medium shadow-sm"
                            aria-label="Editar usuario"
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Editar
                          </button>
                          <button
                            onClick={() => openDelete(u)}
                            className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-900 border border-red-400 rounded hover:bg-red-200 transition-colors text-sm font-medium shadow-sm"
                            aria-label="Eliminar usuario"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <Footer/>
      </main>

      {/* MODAL DE CREACIÓN/EDICIÓN */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/30">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-lg border border-gray-300 max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-1">
              {/* Modal Header */}
              <div className="px-6 pt-4 pb-3 border-b-2 border-gray-300 bg-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 tracking-tight">
                        {editingUser ? 'EDITAR USUARIO' : 'CREAR NUEVO USUARIO'}
                      </h3>
                      <p className="mt-0.5 text-sm text-gray-700">
                        {editingUser ? 'Modifique los datos del usuario' : 'Complete los campos para crear un nuevo usuario'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="text-gray-600 hover:text-gray-900 transition-colors bg-gray-300 hover:bg-gray-400 rounded p-1 border border-gray-500"
                    aria-label="Cerrar modal"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="px-6 pb-4 pt-4">
                {error && (
                  <div className="mb-4 p-3 bg-red-100 border-1 border-red-300 rounded text-red-900 text-sm font-medium">
                    <div className="flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      {error}
                    </div>
                  </div>
                )}
                
                {success && (
                  <div className="mb-4 p-3 bg-green-100 border-1 border-green-300 rounded text-green-900 text-sm font-medium">
                    <div className="flex items-center">
                      <div className="h-4 w-4 bg-green-500 rounded-full mr-2"></div>
                      {success}
                    </div>
                  </div>
                )}

                {/* Mostrar credenciales generadas */}
                {!editingUser && generatedCredentials && (
                  <div className="mb-6 p-4 bg-blue-50 border-1 border-blue-300 rounded-lg">
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                      <Lock className="h-4 w-4 mr-2 text-blue-700" />
                      CREDENCIALES GENERADAS
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
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
                            className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none font-mono font-bold"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
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
                            className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none font-mono font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mostrar nueva contraseña generada */}
                {editingUser && newGeneratedPassword && (
                  <div className="mb-6 p-4 bg-yellow-50 border-1 border-yellow-300 rounded-lg">
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                      <RefreshCw className="h-4 w-4 mr-2 text-yellow-700" />
                      NUEVA CONTRASEÑA GENERADA
                    </h4>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
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
                          className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none font-mono font-bold"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-700 font-medium">
                      <strong>Nota:</strong> Esta contraseña se asignará al usuario al guardar los cambios.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nombre */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      NOMBRE
                    </label>
                    <input
                      type="text"
                      name="FirstName"
                      value={formData.FirstName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      placeholder="Ingrese el nombre"
                      required
                    />
                  </div>

                  {/* Apellido Paterno */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      APELLIDO PATERNO
                    </label>
                    <input
                      type="text"
                      name="LastName"
                      value={formData.LastName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      placeholder="Ingrese el apellido paterno"
                      required
                    />
                  </div>

                  {/* Apellido Materno */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      APELLIDO MATERNO
                    </label>
                    <input
                      type="text"
                      name="MiddleName"
                      value={formData.MiddleName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      placeholder="Ingrese el apellido materno"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      CORREO ELECTRÓNICO
                    </label>
                    <input
                      type="email"
                      name="Email"
                      value={formData.Email}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      placeholder="correo@ejemplo.com"
                      required
                    />
                  </div>

                  {/* Usuario */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      USUARIO
                    </label>
                    <input
                      type="text"
                      name="UserName"
                      value={formData.UserName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      placeholder="Se generará automáticamente"
                      readOnly={!editingUser}
                      required
                    />
                  </div>

                  {/* Contraseña para edición */}
                  {editingUser && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-gray-700 uppercase">
                          CONTRASEÑA
                        </label>
                        <button
                          type="button"
                          onClick={generateNewPassword}
                          className="inline-flex items-center justify-center px-3 py-1.5 text-xs bg-[#3a6ea5] text-white rounded hover:bg-[#2a4a75] transition-colors border border-[#3a6ea5] font-bold"
                        >
                          <RefreshCw className="h-3 w-3 mr-2" />
                          GENERAR NUEVA
                        </button>
                      </div>
                      <div className="space-y-2">
                        <input
                          type={showPasswordField ? "text" : "password"}
                          name="Password"
                          value={formData.Password}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Dejar vacío para mantener la contraseña actual"
                        />
                        {formData.Password && (
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="showPassword"
                              checked={showPasswordField}
                              onChange={() => setShowPasswordField(!showPasswordField)}
                              className="h-4 w-4 text-[#3a6ea5] focus:ring-[#3a6ea5] border border-gray-400 rounded"
                            />
                            <label htmlFor="showPassword" className="ml-2 text-xs text-gray-700 font-medium">
                              Mostrar contraseña
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tipo de Usuario */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                      TIPO DE USUARIO
                    </label>
                    <select
                      name="UserTypeID"
                      value={formData.UserTypeID}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                      required
                    >
                      <option value="">Seleccione un tipo</option>
                      {userTypes.map((t) => (
                        <option key={t.UserTypeID} value={t.UserTypeID}>
                          {t.Type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-gray-200 rounded-b-lg border-t-2 border-gray-300">
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setGeneratedCredentials(null);
                      setNewGeneratedPassword('');
                      setShowPasswordField(false);
                    }}
                    className="px-5 py-2.5 text-sm font-bold text-gray-900 bg-gray-300 border border-gray-400 rounded hover:bg-gray-400 focus:outline-none transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 bg-[#3a6ea5] border border-[#3a6ea5] rounded font-bold text-white hover:bg-[#2a4a75] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                        GUARDANDO...
                      </>
                    ) : editingUser ? (
                      'ACTUALIZAR USUARIO'
                    ) : (
                      'CREAR USUARIO'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/30">
          <div className="bg-white w-full max-w-md rounded-lg shadow-lg border-2 border-gray-400">
            <div className="space-y-1">
              {/* Header*/}
              <div className="px-6 pt-4 pb-3 rounded-t-lg border-b-1 border-gray-300 bg-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 tracking-tight">
                        CONFIRMAR ELIMINACIÓN
                      </h3>
                      <p className="mt-0.5 text-sm text-gray-700">
                        Esta acción no se puede deshacer
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closeDeleteModal}
                    className="text-gray-600 hover:text-gray-900 transition-colors bg-gray-300 hover:bg-gray-400 rounded p-1 border border-gray-500"
                    aria-label="Cerrar modal"
                    disabled={deleteLoading}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 pb-4 pt-4">
                {deleteError && (
                  <div className="mb-4 p-3 bg-red-100 border-2 border-red-400 rounded text-red-900 text-sm font-medium">
                    <div className="flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      {deleteError}
                    </div>
                  </div>
                )}
                
                <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg">
                  <p className="text-sm font-bold text-red-900 mb-3">
                    ¿Está seguro de eliminar al siguiente usuario?
                  </p>
                  <div className="space-y-3 text-sm text-gray-900">
                    <div className="flex items-center bg-white p-2 rounded border border-gray-400">
                      <span className="font-bold w-24">Usuario:</span>
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded border border-gray-300 ml-2">{userToDelete.UserName}</span>
                    </div>
                    <div className="flex items-center bg-white p-2 rounded border border-gray-400">
                      <span className="font-bold w-24">Nombre:</span>
                      <span className="ml-2">{userToDelete.FirstName} {userToDelete.LastName} {userToDelete.MiddleName}</span>
                    </div>
                    <div className="flex items-center bg-white p-2 rounded border border-gray-400">
                      <span className="font-bold w-24">Tipo:</span>
                      <span className={`inline-flex items-center px-3 py-1 rounded text-xs font-bold ml-2 ${getUserTypeColor(userToDelete.UserTypeID)}`}>
                        {userToDelete.UserType}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-yellow-700 mt-0.5 mr-3 flex-shrink-0" />
                    <p className="text-sm text-yellow-900 font-medium">
                      <strong>Advertencia:</strong> Esta acción eliminará permanentemente al usuario del sistema. 
                      Todos los datos asociados al usuario serán eliminados y no podrán recuperarse.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-200 rounded-b-lg border-t-2 border-gray-300">
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    disabled={deleteLoading}
                    className="px-5 py-2.5 text-sm font-bold text-gray-900 bg-gray-300 border border-gray-400 rounded hover:bg-gray-400 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    className="px-5 py-2.5 bg-red-600 border border-red-600 rounded font-bold text-white hover:bg-red-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    {deleteLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                        ELIMINANDO...
                      </>
                    ) : (
                      'ELIMINAR USUARIO'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
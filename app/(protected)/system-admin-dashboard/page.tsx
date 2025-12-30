'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import SessionTimer from '@/components/SessionTimer';
import AppHeader from '@/components/AppHeader';
import { User, Lock, Edit, Trash2, Plus, AlertTriangle, X, Search, RefreshCw } from 'lucide-react';

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
      return 'bg-blue-100 text-blue-800';
    case 2: 
      return 'bg-green-100 text-green-800';
    case 3: 
      return 'bg-purple-100 text-purple-800';
    case 4: 
      return 'bg-yellow-100 text-yellow-800';
    case 5: 
      return 'bg-gray-100 text-gray-800';
    case 6: 
      return 'bg-indigo-100 text-indigo-800';
    case 7: 
      return 'bg-pink-100 text-pink-800';
    case 8: 
      return 'bg-orange-100 text-orange-800';
    case 9: 
      return 'bg-teal-100 text-teal-800';
    case 10: 
      return 'bg-cyan-100 text-cyan-800';
    case 11: 
      return 'bg-lime-100 text-lime-800';
    case 12: 
      return 'bg-fuchsia-100 text-fuchsia-800';
    default:
      return 'bg-blue-100 text-blue-800';
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
  // Divide el nombre por espacios y toma solo el primer elemento
  const names = fullName.trim().split(' ');
  return names[0];
};

// Función para generar el nombre de usuario automáticamente - CORREGIDO
const generateUsername = (firstName: string, lastName: string, middleName: string): string => {
  // Obtener solo el primer nombre
  const firstOnly = getFirstNameOnly(firstName);
  const firstInitial = firstOnly.charAt(0).toUpperCase();
  const lastInitial = lastName.charAt(0).toUpperCase();
  // CORRECCIÓN: Usar el apellido completo en lugar de solo los primeros 4 caracteres
  const surname = middleName || lastName;
  const randomNumbers = generateRandomNumbers().substring(0, 2);
  const randomLetter = generateRandomLetter();
  
  return `${firstInitial}${lastInitial}${surname}${randomNumbers}${randomLetter}`;
};

// Función para generar la contraseña automáticamente
const generatePassword = (firstName: string, lastName: string, middleName: string): string => {
  // Obtener solo el primer nombre
  const firstOnly = getFirstNameOnly(firstName);
  const secondPart = lastName;
  const randomNumbers = generateRandomNumbers();
  const randomSymbol = generateRandomSymbol();
  const randomLetter = generateRandomLetter();
  
  return `${firstOnly}.${secondPart}.${randomNumbers}${randomSymbol}${randomLetter}`;
};

export default function SystemAdminDashboard() {
  const router = useRouter();

  const [user, setUser] = useState<UserData | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
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

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) return router.push('/');

    const parsedUser = JSON.parse(userData);
    if (parsedUser.UserTypeID !== 1) return router.push('/');

    setUser(parsedUser);
    fetchUserTypes();
    fetchUsers();
  }, [router]);

  const fetchUserTypes = async () => {
    try {
      const res = await fetch('/api/user-types');
      if (res.ok) {
        const data = await res.json();
        setUserTypes(data);
      }
    } catch (error) {
      console.error('Error fetching user types:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('sessionExpiresAt');
    router.push('/');
  };

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
        // Si estamos editando y hay una nueva contraseña generada
        if (newGeneratedPassword) {
          submitData.Password = newGeneratedPassword;
        }
        
        // Si no hay contraseña (ni nueva ni existente), eliminamos el campo
        if (!submitData.Password) {
          const { Password, ...dataWithoutPassword } = submitData;
          submitData = dataWithoutPassword;
        }
      }

      const url = editingUser
        ? `/api/users/${editingUser.SystemUserID}`
        : `/api/users`;

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
      await fetchUsers();

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
      const res = await fetch(`/api/users/${userToDelete.SystemUserID}`, { method: 'DELETE' });
      
      if (res.ok) {
        await fetchUsers();
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

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2358a2] mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SessionTimer />

      {/* HEADER */}
      <AppHeader 
        title="Panel de Control del Sistema"
      />

      {/* CONTENT */}
      <main className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-sm sm:text-base font-medium text-gray-700 mb-1 sm:mb-2 tracking-wide uppercase">Gestión de Usuarios</h1>
              <p className="text-xs sm:text-sm text-gray-600">
                Administre los usuarios del sistema y sus permisos
              </p>
            </div>
            
            {/* Contenedor para barra de búsqueda y botón */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              {/* BARRA DE BÚSQUEDA */}
              <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 sm:py-3 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-[#2358a2] focus:border-[#2358a2] text-xs sm:text-sm h-full"
                  placeholder="Buscar usuarios..."
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>

              {/* BOTÓN CREAR USUARIO */}
              <button
                onClick={openCreate}
                className="inline-flex items-center justify-center px-3 py-2 sm:px-4 sm:py-2.5 bg-[#2358a2] border border-transparent rounded-md font-medium text-white hover:bg-[#1d4a8a] focus:outline-none focus:ring-offset-2 focus:ring-[#2358a2] transition-colors text-xs sm:text-base whitespace-nowrap"
              >
                CREAR USUARIO
              </button>
            </div>
          </div>

          {/* Contador de resultados */}
          {searchQuery && (
            <div className="mt-4">
              <p className="text-xs text-gray-500">
                Mostrando {filteredUsers.length} de {users.length} usuarios
                {filteredUsers.length === 0 && ' - No se encontraron resultados'}
              </p>
            </div>
          )}
        </div>

        {/* TABLE */}
        <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="text-xs sm:text-sm font-medium text-gray-700 px-3 sm:px-6 py-2 sm:py-3.5 tracking-wide uppercase text-left align-middle whitespace-nowrap">
                    Nombre de Usuario
                  </th>
                  <th scope="col" className="text-xs sm:text-sm font-medium text-gray-700 px-3 sm:px-6 py-2 sm:py-3.5 tracking-wide uppercase text-left align-middle whitespace-nowrap">
                    Nombre Completo
                  </th>
                  <th scope="col" className="hidden md:table-cell text-xs sm:text-sm font-medium text-gray-700 px-3 sm:px-6 py-2 sm:py-3.5 tracking-wide uppercase text-left align-middle whitespace-nowrap">
                    Correo
                  </th>
                  <th scope="col" className="text-xs sm:text-sm font-medium text-gray-700 px-3 sm:px-6 py-2 sm:py-3.5 tracking-wide uppercase text-left align-middle whitespace-nowrap">
                    Tipo de Usuario
                  </th>
                  <th scope="col" className="text-xs sm:text-sm font-medium text-gray-700 px-3 sm:px-6 py-2 sm:py-3.5 tracking-wide uppercase text-left align-middle whitespace-nowrap">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((u) => (
                  <tr key={u.SystemUserID} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 sm:px-6 py-2 sm:py-4 align-middle">
                      <div className="text-xs sm:text-sm text-gray-600 font-medium">
                        {u.UserName}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 align-middle">
                      <div className="text-xs sm:text-sm text-gray-600">
                        <span className="block sm:inline">{u.FirstName}</span>{' '}
                        <span className="block sm:inline">{u.LastName}</span>
                        {u.MiddleName && (
                          <span className="block sm:inline"> {u.MiddleName}</span>
                        )}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-3 sm:px-6 py-2 sm:py-4 align-middle">
                      <div className="text-xs sm:text-sm text-gray-600 truncate max-w-[200px]">{u.Email}</div>
                    </td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 align-middle">
                      <span className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getUserTypeColor(u.UserTypeID)}`}>
                        {u.UserType}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-2 sm:py-4 align-middle">
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <button
                          onClick={() => openEdit(u)}
                          className="inline-flex items-center text-[#2358a2] hover:text-[#1d4a8a] transition-colors text-xs sm:text-sm"
                          aria-label="Editar usuario"
                        >
                          <span className="hidden sm:inline">Editar</span>
                        </button>
                        <button
                          onClick={() => openDelete(u)}
                          className="inline-flex items-center text-red-600 hover:text-red-800 transition-colors text-xs sm:text-sm"
                          aria-label="Eliminar usuario"
                        >
                          <span className="hidden sm:inline">Eliminar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 sm:py-12 px-4">
              <div className="text-gray-400 mb-3 sm:mb-4">
                <User className="h-8 w-8 sm:h-12 sm:w-12 mx-auto" />
              </div>
              <p className="text-gray-500 text-sm sm:text-base">
                {searchQuery ? 'No se encontraron usuarios que coincidan con la búsqueda' : 'No hay usuarios registrados'}
              </p>
              {!searchQuery && (
                <button
                  onClick={openCreate}
                  className="mt-3 sm:mt-4 inline-flex items-center justify-center px-3 py-2 sm:px-4 sm:py-2 bg-[#2358a2] border border-transparent rounded-md font-medium text-white hover:bg-[#1d4a8a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2358a2] transition-colors text-sm sm:text-base"
                >
                  Crear primer usuario
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* MODAL DE CREACIÓN/EDICIÓN */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur bg-black/10">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-xl max-h-[90vh] overflow-y-auto m-2">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {/* Modal Header */}
              <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div>
                      <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 tracking-wide uppercase">
                        {editingUser ? 'Editar Usuario' : 'Crear Usuario'}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600">
                        {editingUser ? 'Edite los campos del usuario' : 'Complete los campos para generar credenciales automáticamente'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-500 transition-colors"
                    aria-label="Cerrar modal"
                  >
                    <span className="sr-only">Cerrar</span>
                    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                {error && (
                  <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs sm:text-sm">
                    {error}
                  </div>
                )}
                
                {success && (
                  <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-green-50 border border-green-200 rounded text-green-700 text-xs sm:text-sm">
                    {success}
                  </div>
                )}

                {/* Mostrar credenciales generadas para creación */}
                {!editingUser && generatedCredentials && (
                  <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-xs sm:text-sm font-medium text-blue-800 mb-2">CREDENCIALES GENERADAS</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <p className="text-xs text-blue-600 mb-1">USUARIO:</p>
                        <div className="flex items-center space-x-2">
                          <User className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                          <code className="text-xs sm:text-sm font-mono bg-white px-2 py-1.5 sm:px-3 sm:py-2 rounded border border-blue-200 text-blue-700 w-full overflow-x-auto">
                            {generatedCredentials.username}
                          </code>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 mb-1">CONTRASEÑA:</p>
                        <div className="flex items-center space-x-2">
                          <Lock className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                          <code className="text-xs sm:text-sm font-mono bg-white px-2 py-1.5 sm:px-3 sm:py-2 rounded border border-blue-200 text-blue-700 w-full overflow-x-auto">
                            {generatedCredentials.password}
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mostrar nueva contraseña generada para edición */}
                {editingUser && newGeneratedPassword && (
                  <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="text-xs sm:text-sm font-medium text-green-800 mb-2">NUEVA CONTRASEÑA GENERADA</h4>
                    <div>
                      <p className="text-xs text-green-600 mb-1">CONTRASEÑA:</p>
                      <div className="flex items-center space-x-2">
                        <Lock className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                        <code className="text-xs sm:text-sm font-mono bg-white px-2 py-1.5 sm:px-3 sm:py-2 rounded border border-green-200 text-green-700 w-full overflow-x-auto">
                          {newGeneratedPassword}
                        </code>
                      </div>
                    </div>
                    <p className="text-xs text-green-600 mt-2">
                      <strong>Nota:</strong> Esta contraseña se asignará al usuario al guardar los cambios.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {/* Nombre */}
                  <div className="col-span-full sm:col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 tracking-wide uppercase">
                      NOMBRE
                    </label>
                    <input
                      type="text"
                      name="FirstName"
                      value={formData.FirstName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 sm:py-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#2358a2] focus:ring-0 text-xs sm:text-sm"
                      placeholder="Ingrese el nombre"
                      required
                    />
                  </div>

                  {/* Apellido Paterno */}
                  <div className="col-span-full sm:col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 tracking-wide uppercase">
                      APELLIDO PATERNO
                    </label>
                    <input
                      type="text"
                      name="LastName"
                      value={formData.LastName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 sm:py-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#2358a2] focus:ring-0 text-xs sm:text-sm"
                      placeholder="Ingrese el apellido paterno"
                      required
                    />
                  </div>

                  {/* Apellido Materno */}
                  <div className="col-span-full sm:col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 tracking-wide uppercase">
                      APELLIDO MATERNO
                    </label>
                    <input
                      type="text"
                      name="MiddleName"
                      value={formData.MiddleName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 sm:py-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#2358a2] focus:ring-0 text-xs sm:text-sm"
                      placeholder="Ingrese el apellido materno"
                    />
                  </div>

                  {/* Email */}
                  <div className="col-span-full sm:col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 tracking-wide uppercase">
                      CORREO ELECTRÓNICO
                    </label>
                    <input
                      type="email"
                      name="Email"
                      value={formData.Email}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 sm:py-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#2358a2] focus:ring-0 text-xs sm:text-sm"
                      placeholder="correo@ejemplo.com"
                      required
                    />
                  </div>

                  {/* Usuario */}
                  <div className="col-span-full sm:col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 tracking-wide uppercase">
                      USUARIO
                    </label>
                    <input
                      type="text"
                      name="UserName"
                      value={formData.UserName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 sm:py-2.5 bg-gray-50 border border-gray-300 rounded focus:outline-none focus:border-[#2358a2] focus:ring-0 text-xs sm:text-sm"
                      placeholder="Se generará automáticamente"
                      readOnly={!editingUser}
                      required
                    />
                  </div>

                  {/* Contraseña para edición */}
                  {editingUser && (
                    <div className="col-span-full sm:col-span-1">
                      <div className="flex justify-between items-center mb-1 sm:mb-2">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 tracking-wide uppercase">
                          CONTRASEÑA
                        </label>
                        <button
                          type="button"
                          onClick={generateNewPassword}
                          className="inline-flex items-center justify-center px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm bg-[#2358a2] text-white rounded hover:bg-[#1d4a8a] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2358a2]"
                        >
                          <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                          GENERAR NUEVA
                        </button>
                      </div>
                      <div className="space-y-2">
                        <input
                          type={showPasswordField ? "text" : "password"}
                          name="Password"
                          value={formData.Password}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 sm:py-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#2358a2] focus:ring-0 font-mono text-xs sm:text-sm"
                          placeholder="Dejar vacío para mantener la contraseña actual"
                        />
                        {formData.Password && (
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="showPassword"
                              checked={showPasswordField}
                              onChange={() => setShowPasswordField(!showPasswordField)}
                              className="h-4 w-4 text-[#2358a2] focus:ring-[#2358a2] border-gray-300 rounded"
                            />
                            <label htmlFor="showPassword" className="ml-2 text-xs text-gray-600">
                              Mostrar contraseña
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tipo de Usuario */}
                  <div className="col-span-full sm:col-span-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 tracking-wide uppercase">
                      TIPO DE USUARIO
                    </label>
                    <select
                      name="UserTypeID"
                      value={formData.UserTypeID}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 sm:py-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#2358a2] focus:ring-0 text-xs sm:text-sm"
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
              <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 rounded-b-lg border-t border-gray-200">
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-2 sm:gap-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setGeneratedCredentials(null);
                      setNewGeneratedPassword('');
                      setShowPasswordField(false);
                    }}
                    className="px-3 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-50 transition-colors w-full sm:w-auto"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center px-3 py-2 sm:px-4 sm:py-2 bg-[#2358a2] border border-transparent rounded-md font-medium text-white hover:bg-[#1d4a8a] focus:outline-none focus:ring-offset-2 focus:ring-[#2358a2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm w-full sm:w-auto"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-2"></div>
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
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur bg-black/10">
          <div className="bg-white w-full max-w-md rounded-lg shadow-xl m-2">
            <div className="p-4 sm:p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-medium text-gray-900 tracking-wide uppercase">
                      CONFIRMAR ELIMINACIÓN
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500">
                      Esta acción no se puede deshacer
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeDeleteModal}
                  className="text-gray-400 hover:text-gray-500 transition-colors"
                  aria-label="Cerrar modal"
                  disabled={deleteLoading}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="mb-6">
                {deleteError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs sm:text-sm">
                    {deleteError}
                  </div>
                )}
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-red-800 mb-2">
                    ¿Está seguro de eliminar al siguiente usuario?
                  </p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex">
                      <span className="font-medium w-24">Usuario:</span>
                      <span className="font-mono">{userToDelete.UserName}</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-24">Nombre:</span>
                      <span>{userToDelete.FirstName} {userToDelete.LastName} {userToDelete.MiddleName}</span>
                    </div>
                    <div className="flex">
                      <span className="font-medium w-24">Tipo:</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getUserTypeColor(userToDelete.UserTypeID)}`}>
                        {userToDelete.UserType}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                    <p className="text-xs text-yellow-700">
                      <strong>Advertencia:</strong> Esta acción eliminará permanentemente al usuario del sistema. 
                      Todos los datos asociados al usuario serán eliminados y no podrán recuperarse.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-2 sm:gap-0">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={deleteLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-gray-50 focus:ring-offset-2 focus:ring-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="inline-flex items-center justify-center px-4 py-2 bg-red-600 border border-transparent rounded-md font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-offset-2 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  {deleteLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ELIMINANDO...
                    </>
                  ) : (
                    <>
                      ELIMINAR USUARIO
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
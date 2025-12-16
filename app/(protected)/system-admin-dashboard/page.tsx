'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  SystemUserID: number;
  UserName: string;
  UserTypeID: number;
  UserType: string;
};

type UserType = {
  UserTypeID: number;
  Type: string;
};

export default function SystemAdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null); 
  const router = useRouter();

  const [formData, setFormData] = useState({
    UserName: '',
    Password: '',
    UserTypeID: '',
    FirstName: '',
    LastName: '',
    MiddleName: '',
    Email: ''
  });

  useEffect(() => {
    // Verificar si hay usuario autenticado
    const userData = localStorage.getItem('user');
    
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    
    // Verificar tipo de usuario
    if (parsedUser.UserTypeID !== 1) {
      router.push('/login');
      return;
    }

    setUser(parsedUser);
    fetchUserTypes();
  }, [router]);

  const fetchUserTypes = async () => {
    try {
      const response = await fetch('/api/user-types');
      if (response.ok) {
        const data = await response.json();
        setUserTypes(data);
      }
    } catch (error) {
      console.error('Error fetching user types:', error);
  } 
};

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear usuario');
      }

      setSuccess('Usuario creado exitosamente');
      setFormData({
        UserName: '',
        Password: '',
        UserTypeID: '',
        FirstName: '',
        LastName: '',
        MiddleName: '',
        Email: ''
      });

      setTimeout(() => {
        setShowCreateModal(false);
        setSuccess(null);
      }, 2000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2358a2]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Panel de Administrador del Sistema</h1>
              <p className="text-gray-600">Bienvenido, {user.UserName}</p>
            </div>
            <div className='flex gap-4'>
              <button
              onClick={() => setShowCreateModal(true)}
              className='px-4 py-2 bg-[#2358a2] text-white rounded hover:bg-[#1d4a8a] transition-colors'
              >
                Crear Nuevo Usuario
              </button>
               <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Cerrar Sesión
            </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Funciones de Administrador</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <h3 className="font-medium text-lg mb-2">Gestión de Usuarios</h3>
              <p className="text-gray-600">Administrar todos los usuarios del sistema</p>
            </div>
            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <h3 className="font-medium text-lg mb-2">Configuración del Sistema</h3>
              <p className="text-gray-600">Ajustes generales de la aplicación</p>
            </div>
            <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <h3 className="font-medium text-lg mb-2">Reportes</h3>
              <p className="text-gray-600">Generar reportes del sistema</p>
            </div>
          </div>
        </div>
      </main>

      {/*Modal para crear usuario */}
      {showCreateModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto'>
            <div className='p-6'>
              <div className='flex justify-between items-center mb-6'>
                <h2 className='text-xl font-bold text-gray-900'> Crear Nuevo Usuario</h2>
                <button
                onClick={() => setShowCreateModal(false)}
                className='text-gray-400 hover:text-gray-600'
                > 
                  ✕
                </button>
              </div>
              {error && (
                <div className='mb-4 p-3 bg-red-100 text-red-700 rounded'>
                  {error}
                </div>
              )}

              {success && (
                <div className='mb-4 p-3 bg-green-100 text-green-700 rounded'>
                  {success}
                </div>
              )}

              <form onSubmit={handleCreateUser}>
                <div className='space-y-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Nombre de usuario *
                    </label>
                    <input
                    type='text'
                    name='UserName'
                    value={formData.UserName}
                    onChange={handleInputChange}
                    required
                    className='w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#2358a2]'
                    />
                  </div>

                  <div>
                    <label className='bloc text-sm font-medium text-gray-700 mb-1'>
                      Contraseña *
                    </label>
                    <input
                    type='password'
                    name='Password'
                    value={formData.Password}
                    onChange={handleInputChange}
                    required
                    className='w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#2358a2]'
                    />
                  </div>

                  <div>
                    <label className='bloc text-sm font-medium text-gray-700 mb-1'>
                      Tipo de Usuario *
                    </label>
                    <select
                    name='UserTypeID'
                    value={formData.UserTypeID}
                    onChange={handleInputChange}
                    required
                    className='w-full px-3 py-2 border border-gray-300 runded focus:outline-none focus:ring-2 fous:ring-[#2358a2]'
                    >
                      <option value="">Selecciona tipo</option>
                      {userTypes.map(type => (
                        <option key={type.UserTypeID} value={type.UserTypeID}>
                          {type.Type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Nombre *
                    </label>
                    <input
                    type='text'
                    name='FirstName'
                    value={formData.FirstName}
                    onChange={handleInputChange}
                    required
                    className='w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#2358a2]'
                    />
                  </div>

                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Apellido *
                    </label>
                    <input
                    type='text'
                    name='LastName'
                    value={formData.LastName}
                    onChange={handleInputChange}
                    required
                    className='w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#2358a2]'
                    />
                  </div>

                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Apellido *
                    </label>
                    <input
                    type='text'
                    name='MiddleName'
                    value={formData.MiddleName}
                    onChange={handleInputChange}
                    required
                    className='w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#2358a2]'
                    />
                  </div>

                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Email *
                    </label>
                    <input
                    type='email'
                    name='Email'
                    value={formData.Email}
                    onChange={handleInputChange}
                    required
                    className='w-full px-3 py-2 border border-gray-300 reunded focus:outline-none focus:ring-2 focus:ring-[#2358a2]'
                    />
                  </div>
                </div>

                <div className='mt-6 flex justify-end gap-3'>
                  <button
                  type='button'
                  onClick={() => setShowCreateModal(false)}
                  className='px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors'
                  disabled={loading}
                  >
                    Cancelar
                  </button>
                  <button
                  type='submit'
                  disabled={loading}
                  className='px-4 py-2 bg-[#2358a2] text-white rounded hover:bg-[#1d4a8a] transition-color disabled:opacity-50'
                  >
                    {loading ? 'Creando ...' : 'Crear Usuario'}
                  </button>

                </div>

              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
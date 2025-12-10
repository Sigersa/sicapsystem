'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Lock, User } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

type LoginForm = {
  username: string;
  password: string;
};

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error en la autenticación');
      }

      if (result.success) {
        // Guardar datos de usuario en localStorage
        localStorage.setItem('user', JSON.stringify(result.user));
        
        // Redirigir según el tipo de usuario
        router.push(result.redirectTo);
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center space-x-3 mb-8">
            <div className="w-10 h-10 rounded-md flex items-center justify-center overflow-hidden">
              <Image 
                src="/1.png" 
                alt="Corporate Systems Logo" 
                width={36}
                height={36}
                className="object-contain p-1" 
              />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800 tracking-tight">SIGERSA<span className="font-light">INNOVACIONES</span></h1>
              <p className="text-xs text-gray-600 tracking-widest">INNOVANDO HACIA EL FUTURO</p>
            </div>
          </div>
          
          <h2 className="text-lg font-light text-gray-800 mb-2">SICAP</h2>
          <p className="text-gray-600 text-sm">
            Ingrese sus credenciales corporativas 
          </p>
        </div>

        {/* Mostrar error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Username Field */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2 tracking-wide uppercase">
              IDENTIFICACIÓN DE USUARIO
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-500" />
              </div>
              <input
                type="text"
                {...register('username', { required: 'Usuario es requerido' })}
                className="w-full pl-10 pr-3 py-3 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#2358a2] focus:ring-0"
                placeholder="Ingrese su usuario"
              />
            </div>
            {errors.username && (
              <p className="mt-1 text-xs text-red-600">{errors.username.message}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2 tracking-wide uppercase">
              CREDENCIAL DE ACCESO
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-500" />
              </div>
              <input
                type="password"
                {...register('password', { required: 'Contraseña es requerida' })}
                className="w-full pl-10 pr-3 py-3 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#2358a2] focus:ring-0 font-mono"
                placeholder="••••••••••••"
              />
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          {/* Botón */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#2358a2] text-white py-3.5 px-4 rounded font-medium hover:bg-[#1d4a8a] focus:outline-none focus:ring-1 focus:ring-[#2358a2] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                VERIFICANDO CREDENCIALES...
              </div>
            ) : (
              'ACCEDER'
            )}
          </button>

        </form>

        {/* Footer */}
        <div className="mt-12 text-center space-y-4">
          <p className="text-xs text-gray-500 tracking-wide">
            © 2025 Sigersa Innovaciones S.A. de C.V. Todos los derechos reservados.
          </p>
        </div>

      </div>
    </div>
  );
}
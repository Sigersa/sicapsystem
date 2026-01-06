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

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginForm>({
    defaultValues: {
      username: '',
      password: ''
    }
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', 
        body: JSON.stringify({
          username: data.username.trim(),
          password: data.password
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error en la autenticación');
      }

      if (!result.success) {
        throw new Error('Respuesta inválida del servidor');
      }

      router.push(result.redirectTo);

    } catch (err: any) {
      setError(
        err.message || 'Error al iniciar sesión. Verifique sus credenciales.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xs">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-10 h-10 rounded-md flex items-center justify-center overflow-hidden">
              <Image
                src="/1.png"
                alt="Corporate Systems Logo"
                width={36}
                height={36}
                className="object-contain p-1"
                priority
              />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800 tracking-tight">
                SIGERSA<span className="font-light">INNOVACIONES</span>
              </h1>
              <p className="text-xs text-gray-600 tracking-widest">
                INNOVANDO HACIA EL FUTURO
              </p>
            </div>
          </div>

          <h2 className="text-base font-light text-gray-800 mb-2">SICAP</h2>
          <p className="text-gray-600 text-xs">
            Ingrese sus credenciales corporativas
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="w-full mb-4 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* Usuario */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase">
              Identificación de usuario
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-gray-500" />
              </div>
              <input
                type="text"
                {...register('username', {
                  required: 'Usuario es requerido'
                })}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#2358a2]"
                placeholder="Ingrese su usuario"
                autoComplete="username"
              />
            </div>
            {errors.username && (
              <p className="mt-1 text-xs text-red-600">
                {errors.username.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase">
              Credencial de acceso
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-gray-500" />
              </div>
              <input
                type="password"
                {...register('password', {
                  required: 'Contraseña es requerida'
                })}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-[#2358a2]"
                placeholder="••••••••••••"
                autoComplete="current-password"
              />
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Botón */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#2358a2] text-white py-2.5 rounded font-medium hover:bg-[#1d4a8a] disabled:opacity-50"
          >
            {isLoading ? 'VERIFICANDO…' : 'ACCEDER'}
          </button>

        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            © 2025 Sigersa Innovaciones S.A. de C.V.
          </p>
          <p className="text-xs text-gray-400">
            Versión 1.0.0
          </p>
        </div>

      </div>
    </div>
  );
}

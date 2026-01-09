'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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

export const useSessionManager = () => {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        setError(null);
        const res = await fetch('/api/auth/validate-session', {
          credentials: 'include'
        });

        if (!res.ok) {
          router.replace('/');
          return;
        }

        const data = await res.json();

        if (!data?.valid || !data?.user) {
          router.replace('/');
          return;
        }

        if (data.role !== 1) {
          router.replace('/unauthorized');
          return;
        }

        setUser({
          SystemUserID: data.user.SystemUserID,
          UserName: data.user.UserName,
          UserTypeID: data.role,
          UserType: '',
          FirstName: '',
          LastName: '',
          MiddleName: '',
          Email: ''
        });

        setError(null);
      } catch (error) {
        console.error('Session check error:', error);
        setError('Error al verificar la sesión');
        router.replace('/');
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, [router]);

  return { user, loading, error };
};
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const useInactivityManager = () => {
  const router = useRouter();

  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;
    let lastRenew = 0;

    const RENEW_INTERVAL = 60 * 1000; 
    const INACTIVITY_LIMIT = 15 * 60 * 1000; 

    const renewSession = async () => {
      const now = Date.now();

      if (now - lastRenew < RENEW_INTERVAL) return;

      lastRenew = now;

      try {
        const res = await fetch('/api/auth/validate-session', {
          credentials: 'include',
        });

        if (!res.ok) {
          router.replace('/');
          return;
        }

        const data = await res.json();

        if (!data?.valid) {
          router.replace('/');
        }
      } catch (error) {
        console.error('Session renew error:', error);
        router.replace('/');
      }
    };

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);

      inactivityTimer = setTimeout(() => {
        router.replace('/');
      }, INACTIVITY_LIMIT);
    };

    const handleActivity = () => {
      resetInactivityTimer();
      renewSession();
    };

    // Eventos para detectar actividad
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'input'];

    events.forEach(event =>
      window.addEventListener(event, handleActivity)
    );

    // Iniciar el timer
    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(event =>
        window.removeEventListener(event, handleActivity)
      );
    };
  }, [router]);
};
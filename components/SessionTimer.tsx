'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";

const SESSION_DURATION = 15 * 60 * 1000;

export default function SessionTimer(){
    const router = useRouter();
    const [timeLeft, setTimeLeft] = useState(SESSION_DURATION);

    useEffect(() => {
        const expiresAt = Date.now() + SESSION_DURATION;
        localStorage.setItem('sessionExpiresAt', expiresAt.toString());

        const interval = setInterval(() => {
            const storedexpiresAt = localStorage.getItem('sessionExpiresAt');

            if (!storedexpiresAt ) {
                router.push('/');
                return;
            }

            const remaining = Number(storedexpiresAt) - Date.now();

            if (remaining <= 0) {
                localStorage.removeItem('user');
                localStorage.removeItem('sessionExpiresAt');
                clearInterval(interval);
                router.push('/');
            } else {
                setTimeLeft(remaining);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [router]);

    const minutes = Math.floor(timeLeft / 1000 / 60);
    const seconds = Math.floor((timeLeft / 1000) % 60);

    return (
        <div className="fixed bottom-4 right-4 bg-white shadow-lg border rounded-lg px-4 py-2 flex items-center gap-2 text-sm text-gray-700 z-50">
            <Clock className="w-4 h-4 text-[#2358a2]" />
            <span className="font-medium">
                Sesión expira en:
            </span>
            <span className="font-mono text-[#2358a2]">
                {String(minutes).padStart(2, '0')}:
                {String(seconds).padStart(2, '0')}
            </span>
        </div>
    );
}
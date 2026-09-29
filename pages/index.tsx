import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getDefaultRoute } from '@/lib/utils/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('easy_batiment_token') : null;

    const checkAuthentication = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (response.ok) {
          const user = await response.json();
          router.replace(getDefaultRoute(user.permissions || []));
        } else {
          router.replace('/login');
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de la session :', error);
        router.replace('/login');
      }
    };

    checkAuthentication();
  }, [router]);

  return (
    <div
      className="d-flex justify-content-center align-items-center"
      style={{ minHeight: '100vh' }}
    >
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Chargement...</span>
      </div>
    </div>
  );
}

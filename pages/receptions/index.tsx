import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Table, Button, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Reception {
  _id: string;
  code: string;
  commande?: { code: string };
  chantier?: { code: string };
  dateReception: string;
  recuPar?: { firstName: string; lastName: string };
}

export default function Receptions() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [receptions, setReceptions] = useState<Reception[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const canCreate =
    user?.permissions?.includes('admin.all') || user?.permissions?.includes('reception.create') || false;

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    const token = localStorage.getItem('easy_batiment_token');
    if (token) {
      fetch('/api/receptions', { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Erreur');
          if (!Array.isArray(json)) throw new Error('Format invalide');
          setReceptions(json);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les réceptions'))
        .finally(() => setLoaded(true));
    }
  }, [isAuthenticated, loading, router]);

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Réceptions</h1>
        <div className="d-flex gap-2">
          <PrintButton />
          {canCreate && (
            <Link href="/receptions/new" passHref>
              <Button variant="primary">Nouvelle réception</Button>
            </Link>
          )}
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {!loaded && !error ? (
        <Spinner animation="border" />
      ) : !receptions.length ? (
        <Alert variant="info">Aucune réception enregistrée.</Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Code</th>
              <th>Commande</th>
              <th>Chantier</th>
              <th>Date</th>
              <th>Reçu par</th>
            </tr>
          </thead>
          <tbody>
            {receptions.map((r) => (
              <tr key={r._id}>
                <td>{r.code}</td>
                <td>{r.commande?.code}</td>
                <td>{r.chantier?.code}</td>
                <td>{new Date(r.dateReception).toLocaleDateString('fr-FR')}</td>
                <td>{r.recuPar?.firstName} {r.recuPar?.lastName}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Layout>
  );
}

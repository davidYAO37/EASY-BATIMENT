import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Table, Button, Badge, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Rapport {
  _id: string;
  chantier?: { code: string; nom: string };
  activite: string;
  date: string;
  createdBy?: { firstName: string; lastName: string };
  isRead?: boolean;
}

export default function Rapports() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [rapports, setRapports] = useState<Rapport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const canCreate =
    user?.permissions?.includes('admin.all') || user?.permissions?.includes('rapport.create') || false;

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    const token = localStorage.getItem('easy_batiment_token');
    if (token) {
      fetch('/api/rapports', { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Erreur');
          if (!Array.isArray(json)) throw new Error('Format invalide');
          setRapports(json);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les rapports'))
        .finally(() => setLoaded(true));
    }
  }, [isAuthenticated, loading, router]);

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Rapports chantier</h1>
        <div className="d-flex gap-2">
          <PrintButton />
          {canCreate && (
            <Link href="/rapports/new" passHref>
              <Button variant="primary">Nouveau rapport</Button>
            </Link>
          )}
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {!loaded && !error ? (
        <Spinner animation="border" />
      ) : !rapports.length ? (
        <Alert variant="info">Aucun rapport enregistré.</Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Chantier</th>
              <th>Date</th>
              <th>Activité</th>
              <th>Auteur</th>
              <th>Lu</th>
              <th className="d-print-none">Impression</th>
            </tr>
          </thead>
          <tbody>
            {rapports.map((r) => (
              <tr key={r._id}>
                <td>{r.chantier?.code}</td>
                <td>{new Date(r.date).toLocaleDateString('fr-FR')}</td>
                <td>{r.activite}</td>
                <td>{r.createdBy?.firstName} {r.createdBy?.lastName}</td>
                <td>
                  <Badge bg={r.isRead ? 'success' : 'danger'}>{r.isRead ? 'Oui' : 'Non'}</Badge>
                </td>
                <td className="d-print-none">
                  <Button
                    as="a"
                    href={`/rapports/${r._id}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    variant="outline-primary"
                  >
                    Imprimer
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Layout>
  );
}

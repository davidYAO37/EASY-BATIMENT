import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Table, Form, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface AuditLog {
  _id: string;
  user?: { firstName: string; lastName: string };
  action: string;
  targetType: string;
  targetCode?: string;
  createdAt: string;
}

export default function Audit() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [targetType, setTargetType] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    const token = localStorage.getItem('easy_batiment_token');
    if (token) {
      const url = targetType ? `/api/audit?targetType=${targetType}` : '/api/audit';
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Erreur');
          if (!Array.isArray(json)) throw new Error('Format invalide');
          setLogs(json);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger le journal'))
        .finally(() => setLoaded(true));
    }
  }, [isAuthenticated, loading, router, targetType]);

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Journal d&apos;audit</h1>
        <PrintButton />
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <Form.Group className="mb-3" controlId="targetType">
        <Form.Label>Filtrer par type</Form.Label>
        <Form.Select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
          <option value="">Tous</option>
          <option value="Chantier">Chantier</option>
          <option value="DemandeAchat">Demande d&apos;achat</option>
          <option value="Commande">Commande</option>
          <option value="Paiement">Paiement</option>
          <option value="Reception">Réception</option>
          <option value="MouvementStock">Stock</option>
          <option value="User">Utilisateur</option>
        </Form.Select>
      </Form.Group>
      {!loaded && !error ? (
        <Spinner animation="border" />
      ) : !logs.length ? (
        <Alert variant="info">Aucune entrée dans le journal.</Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Date</th>
              <th>Utilisateur</th>
              <th>Action</th>
              <th>Objet</th>
              <th>Code</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l._id}>
                <td>{new Date(l.createdAt).toLocaleString('fr-FR')}</td>
                <td>{l.user ? `${l.user.firstName} ${l.user.lastName}` : 'Système'}</td>
                <td>{l.action}</td>
                <td>{l.targetType}</td>
                <td>{l.targetCode || '—'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Layout>
  );
}

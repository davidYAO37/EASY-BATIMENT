import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Table, Badge, Alert, Button, Row, Col, Card } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Demande {
  _id: string;
  code: string;
  chantier: { code: string; nom: string } | null;
  statut: string;
  urgence: string;
  createdBy?: { _id?: string; firstName: string; lastName: string };
  createdAt: string;
}

export default function DemandesAchat() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [error, setError] = useState('');

  const isAdmin = user?.permissions?.includes('admin.all') || false;
  const isRB = user?.roleCode === 'RECEPTION_BUREAU';
  const canCreate = user?.permissions?.includes('demandeAchat.create') || false;
  const canUpdate = user?.permissions?.includes('demandeAchat.update') || false;
  const canDelete = user?.permissions?.includes('demandeAchat.delete') || false;

  function isOwner(d: Demande) {
    return String(d.createdBy?._id || '') === user?.id;
  }

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    const token = localStorage.getItem('easy_batiment_token');
    if (token) {
      fetch('/api/demandes-achat', { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Erreur');
          if (!Array.isArray(json)) throw new Error('Format invalide');
          setDemandes(json);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les demandes'));
    }
  }, [isAuthenticated, loading, router]);

  async function handleDelete(demandeId: string) {
    if (!confirm('Supprimer cette demande ?')) return;
    try {
      const token = localStorage.getItem('easy_batiment_token');
      const res = await fetch(`/api/demandes-achat/${demandeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Erreur');
      }
      setDemandes((prev) => prev.filter((d) => d._id !== demandeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function doAction(demandeId: string, action: string) {
    try {
      const token = localStorage.getItem('easy_batiment_token');
      const res = await fetch(`/api/demandes-achat/${demandeId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setDemandes((prev) =>
        prev.map((d) => (d._id === demandeId ? { ...d, statut: data.statut } : d))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  const urgenceColor: Record<string, string> = {
    Basse: 'info',
    Normale: 'secondary',
    Haute: 'warning',
    Critique: 'danger',
  };

  const statutColor: Record<string, string> = {
    CREATION: 'light',
    SOUMIS: 'info',
    RECU_RB: 'primary',
    EN_VALIDATION_ADMIN: 'warning',
    COMMANDE_PARTIELLE: 'info',
    FINANCE_AUTORISEE: 'success',
    REFUSE: 'danger',
    DEMANDE_MODIF: 'secondary',
  };

  const statutLabel: Record<string, string> = {
    COMMANDE_PARTIELLE: 'Commande partielle',
  };

  const aReceptionner = demandes.filter((d) => d.statut === 'SOUMIS').length;
  const aTransmettre = demandes.filter((d) => d.statut === 'RECU_RB').length;

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Demandes d&apos;achat</h1>
        <div className="d-flex gap-2">
          <PrintButton />
          {canCreate && (
            <Button variant="primary" onClick={() => router.push('/demandes-achat/new')}>
              Nouvelle demande
            </Button>
          )}
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}

      {canUpdate && (
        <Row className="g-3 mb-4">
          <Col md={6}>
            <Card className="text-center h-100">
              <Card.Body>
                <Card.Title className="display-6">{aReceptionner}</Card.Title>
                <Card.Text>Demandes à réceptionner</Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="text-center h-100">
              <Card.Body>
                <Card.Title className="display-6">{aTransmettre}</Card.Title>
                <Card.Text>Demandes à transmettre à l&apos;administrateur</Card.Text>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {!demandes.length && !error ? (
        <p>Aucune demande d&apos;achat.</p>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Code</th>
              <th>Chantier</th>
              <th>Urgence</th>
              <th>Statut</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {demandes.map((d) => (
              <tr key={d._id}>
                <td>{d.code}</td>
                <td>{d.chantier ? `${d.chantier.code} - ${d.chantier.nom}` : '—'}</td>
                <td>
                  <Badge bg={urgenceColor[d.urgence] || 'secondary'}>{d.urgence}</Badge>
                </td>
                <td>
                  <Badge bg={statutColor[d.statut] || 'secondary'}>{statutLabel[d.statut] || d.statut}</Badge>
                </td>
                <td>{new Date(d.createdAt).toLocaleDateString('fr-FR')}</td>
                <td className="d-print-none">
                  <div className="d-flex gap-2 flex-wrap">
                    <Button variant="outline-primary" size="sm" onClick={() => router.push(`/demandes-achat/${d._id}`)}>
                      Voir
                    </Button>
                    {isRB && d.statut === 'SOUMIS' && (
                      <Button variant="success" size="sm" onClick={() => doAction(d._id, 'RECEVOIR')}>
                        Réceptionner
                      </Button>
                    )}
                    {isRB && d.statut === 'RECU_RB' && (
                      <Button variant="warning" size="sm" onClick={() => doAction(d._id, 'TRANSMETTRE_ADMIN')}>
                        Transmettre à l&apos;admin
                      </Button>
                    )}
                    {canUpdate && (isOwner(d) || isAdmin) && ['CREATION', 'SOUMIS', 'DEMANDE_MODIF'].includes(d.statut) && (
                      <Button variant="outline-secondary" size="sm" onClick={() => router.push(`/demandes-achat/${d._id}`)}>
                        Modifier
                      </Button>
                    )}
                    {canDelete && (isOwner(d) || isAdmin) && ['CREATION', 'SOUMIS', 'DEMANDE_MODIF'].includes(d.statut) && (
                      <Button variant="outline-danger" size="sm" onClick={() => handleDelete(d._id)}>
                        Supprimer
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Layout>
  );
}

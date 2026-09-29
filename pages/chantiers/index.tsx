import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Table, Button, Badge, Alert, Spinner, Modal, Form } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Chantier {
  _id: string;
  code: string;
  nom: string;
  client: string;
  localisation: string;
  statut: string;
  budgetPrevisionnel: number;
}

export default function Chantiers() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editChantier, setEditChantier] = useState<Chantier | null>(null);

  const hasPerm = (perm: string) =>
    user?.permissions?.includes('admin.all') || user?.permissions?.includes(perm);
  const canCreate = hasPerm('chantier.create');
  const canUpdate = hasPerm('chantier.update');
  const canDelete = hasPerm('chantier.delete');

  const token = typeof window !== 'undefined' ? localStorage.getItem('easy_batiment_token') : null;

  const load = React.useCallback(() => {
    if (!token) return;
    fetch('/api/chantiers', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur');
        if (!Array.isArray(json)) throw new Error('Format invalide');
        setChantiers(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les chantiers'))
      .finally(() => setLoaded(true));
  }, [token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    load();
  }, [isAuthenticated, loading, router, load]);

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce chantier ?')) return;
    try {
      const res = await fetch(`/api/chantiers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Erreur');
      }
      setSuccess('Chantier supprimé');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editChantier) return;
    try {
      const res = await fetch(`/api/chantiers/${editChantier._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          nom: editChantier.nom,
          client: editChantier.client,
          localisation: editChantier.localisation,
          budgetPrevisionnel: Number(editChantier.budgetPrevisionnel),
          statut: editChantier.statut,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur');
      setSuccess('Chantier modifié');
      setEditChantier(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  const statusColor: Record<string, string> = {
    Préparation: 'info',
    'En cours': 'success',
    Suspendu: 'warning',
    Terminé: 'secondary',
  };

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Chantiers</h1>
        <div className="d-flex gap-2">
          <PrintButton />
          {canCreate && (
            <Link href="/chantiers/new" passHref>
              <Button variant="primary">Nouveau chantier</Button>
            </Link>
          )}
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      {!loaded && !error ? (
        <Spinner animation="border" />
      ) : !chantiers.length ? (
        <Alert variant="info">Aucun chantier enregistré.</Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Client</th>
              <th>Localisation</th>
              <th>Budget</th>
              <th>Statut</th>
              <th className="d-print-none">Actions</th>
            </tr>
          </thead>
          <tbody>
            {chantiers.map((c) => (
              <tr key={c._id}>
                <td>{c.code}</td>
                <td>{c.nom}</td>
                <td>{c.client}</td>
                <td>{c.localisation}</td>
                <td>{c.budgetPrevisionnel.toLocaleString()} FCFA</td>
                <td>
                  <Badge bg={statusColor[c.statut] || 'secondary'}>{c.statut}</Badge>
                </td>
                <td className="d-print-none">
                  <div className="d-flex gap-2 flex-wrap">
                    {canUpdate && (
                      <Button variant="outline-primary" size="sm" onClick={() => setEditChantier(c)}>
                        Modifier
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="outline-danger" size="sm" onClick={() => handleDelete(c._id)}>
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

      <Modal show={!!editChantier} onHide={() => setEditChantier(null)} centered>
        <Form onSubmit={handleSave}>
          <Modal.Header closeButton>
            <Modal.Title>Modifier le chantier</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Nom</Form.Label>
              <Form.Control
                value={editChantier?.nom || ''}
                onChange={(e) => setEditChantier((prev) => (prev ? { ...prev, nom: e.target.value } : null))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Client</Form.Label>
              <Form.Control
                value={editChantier?.client || ''}
                onChange={(e) => setEditChantier((prev) => (prev ? { ...prev, client: e.target.value } : null))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Localisation</Form.Label>
              <Form.Control
                value={editChantier?.localisation || ''}
                onChange={(e) => setEditChantier((prev) => (prev ? { ...prev, localisation: e.target.value } : null))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Budget prévisionnel</Form.Label>
              <Form.Control
                type="number"
                value={editChantier?.budgetPrevisionnel || 0}
                onChange={(e) => setEditChantier((prev) => (prev ? { ...prev, budgetPrevisionnel: Number(e.target.value) } : null))}
                required
                min={0}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Statut</Form.Label>
              <Form.Select
                value={editChantier?.statut || 'Préparation'}
                onChange={(e) => setEditChantier((prev) => (prev ? { ...prev, statut: e.target.value } : null))}
              >
                <option value="Préparation">Préparation</option>
                <option value="En cours">En cours</option>
                <option value="Suspendu">Suspendu</option>
                <option value="Terminé">Terminé</option>
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setEditChantier(null)}>Annuler</Button>
            <Button variant="primary" type="submit">Enregistrer</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Layout>
  );
}

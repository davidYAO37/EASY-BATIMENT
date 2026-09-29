import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Table, Button, Alert, Spinner, Modal, Form } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Fournisseur {
  _id: string;
  nom: string;
  contact: string;
  phone: string;
  email?: string;
}

export default function Fournisseurs() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editFournisseur, setEditFournisseur] = useState<Fournisseur | null>(null);

  const hasPerm = (perm: string) =>
    user?.permissions?.includes('admin.all') || user?.permissions?.includes(perm);
  const canUpdate = hasPerm('fournisseur.update');
  const canDelete = hasPerm('fournisseur.delete');

  const token = typeof window !== 'undefined' ? localStorage.getItem('easy_batiment_token') : null;

  const load = React.useCallback(() => {
    if (!token) return;
    fetch('/api/fournisseurs', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur');
        if (!Array.isArray(json)) throw new Error('Format invalide');
        setFournisseurs(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les fournisseurs'))
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
    if (!confirm('Supprimer ce fournisseur ?')) return;
    try {
      const res = await fetch(`/api/fournisseurs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Erreur');
      }
      setSuccess('Fournisseur supprimé');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editFournisseur) return;
    try {
      const res = await fetch(`/api/fournisseurs/${editFournisseur._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          nom: editFournisseur.nom,
          contact: editFournisseur.contact,
          phone: editFournisseur.phone,
          email: editFournisseur.email || '',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur');
      setSuccess('Fournisseur modifié');
      setEditFournisseur(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Fournisseurs</h1>
        <div className="d-flex gap-2">
          <PrintButton />
          <Link href="/fournisseurs/new" passHref>
            <Button variant="primary">Nouveau fournisseur</Button>
          </Link>
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      {!loaded && !error ? (
        <Spinner animation="border" />
      ) : !fournisseurs.length ? (
        <Alert variant="info">Aucun fournisseur enregistré.</Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Contact</th>
              <th>Téléphone</th>
              <th>Email</th>
              <th className="d-print-none">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fournisseurs.map((f) => (
              <tr key={f._id}>
                <td>{f.nom}</td>
                <td>{f.contact}</td>
                <td>{f.phone}</td>
                <td>{f.email || '—'}</td>
                <td className="d-print-none">
                  <div className="d-flex gap-2 flex-wrap">
                    {canUpdate && (
                      <Button variant="outline-primary" size="sm" onClick={() => setEditFournisseur(f)}>
                        Modifier
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="outline-danger" size="sm" onClick={() => handleDelete(f._id)}>
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

      <Modal show={!!editFournisseur} onHide={() => setEditFournisseur(null)} centered>
        <Form onSubmit={handleSave}>
          <Modal.Header closeButton>
            <Modal.Title>Modifier le fournisseur</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Nom</Form.Label>
              <Form.Control
                value={editFournisseur?.nom || ''}
                onChange={(e) => setEditFournisseur((prev) => (prev ? { ...prev, nom: e.target.value } : null))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Contact</Form.Label>
              <Form.Control
                value={editFournisseur?.contact || ''}
                onChange={(e) => setEditFournisseur((prev) => (prev ? { ...prev, contact: e.target.value } : null))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Téléphone</Form.Label>
              <Form.Control
                value={editFournisseur?.phone || ''}
                onChange={(e) => setEditFournisseur((prev) => (prev ? { ...prev, phone: e.target.value } : null))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                value={editFournisseur?.email || ''}
                onChange={(e) => setEditFournisseur((prev) => (prev ? { ...prev, email: e.target.value } : null))}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setEditFournisseur(null)}>Annuler</Button>
            <Button variant="primary" type="submit">Enregistrer</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Layout>
  );
}

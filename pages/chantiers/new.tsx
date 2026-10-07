import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Form, Button, Card, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Role {
  _id: string;
  name: string;
  code: string;
}

interface User {
  _id: string;
  fullName?: string;
  firstName: string;
  lastName: string;
  email: string;
  active?: boolean;
  role?: Role | string;
}

export default function NewChantier() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canCreate = user?.permissions?.includes('admin.all') || user?.permissions?.includes('chantier.create');

  const [form, setForm] = useState({
    nom: '',
    client: '',
    localisation: '',
    chefChantier: '',
    receptionnisteBureau: '',
    receptionnisteChantier: '',
    budgetPrevisionnel: '',
    dateDebut: '',
    datePrevisionnelleFin: '',
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!loading && isAuthenticated && !canCreate) {
      router.push('/chantiers');
      return;
    }

    const token = localStorage.getItem('easy_batiment_token');
    if (token) {
      fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Impossible de charger les utilisateurs');
          if (!Array.isArray(json)) throw new Error('Format invalide');
          setUsers(json.filter((u: User) => u.active));
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les utilisateurs'));
    }
  }, [isAuthenticated, loading, router, canCreate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const token = localStorage.getItem('easy_batiment_token');
      const res = await fetch('/api/chantiers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          budgetPrevisionnel: parseFloat(form.budgetPrevisionnel),
          dateDebut: new Date(form.dateDebut).toISOString(),
          datePrevisionnelleFin: new Date(form.datePrevisionnelleFin).toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      router.push('/chantiers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Nouveau chantier</h1>
        <PrintButton />
      </div>
      <Card>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="nom">
              <Form.Label>Nom du chantier</Form.Label>
              <Form.Control
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="client">
              <Form.Label>Client</Form.Label>
              <Form.Control
                value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="localisation">
              <Form.Label>Localisation</Form.Label>
              <Form.Control
                value={form.localisation}
                onChange={(e) => setForm({ ...form, localisation: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="chefChantier">
              <Form.Label>Chef chantier</Form.Label>
              <Form.Select
                value={form.chefChantier}
                onChange={(e) => setForm({ ...form, chefChantier: e.target.value })}
                required
              >
                <option value="">Choisir un chef chantier...</option>
                {users
                  .filter((u) => (typeof u.role === 'object' ? u.role?.code : u.role) === 'CHEF_CHANTIER')
                  .map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.fullName || `${u.firstName} ${u.lastName}`} ({u.email})
                    </option>
                  ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3" controlId="receptionnisteBureau">
              <Form.Label>Réceptionniste bureau</Form.Label>
              <Form.Select
                value={form.receptionnisteBureau}
                onChange={(e) => setForm({ ...form, receptionnisteBureau: e.target.value })}
                required
              >
                <option value="">Choisir un réceptionniste bureau...</option>
                {users
                  .filter((u) => (typeof u.role === 'object' ? u.role?.code : u.role) === 'RECEPTION_BUREAU')
                  .map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.fullName || `${u.firstName} ${u.lastName}`} ({u.email})
                    </option>
                  ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3" controlId="receptionnisteChantier">
              <Form.Label>Réceptionniste chantier</Form.Label>
              <Form.Select
                value={form.receptionnisteChantier}
                onChange={(e) => setForm({ ...form, receptionnisteChantier: e.target.value })}
                required
              >
                <option value="">Choisir un réceptionniste chantier...</option>
                {users
                  .filter((u) => (typeof u.role === 'object' ? u.role?.code : u.role) === 'RECEPTION_CHANTIER')
                  .map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.fullName || `${u.firstName} ${u.lastName}`} ({u.email})
                    </option>
                  ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3" controlId="budgetPrevisionnel">
              <Form.Label>Budget prévisionnel (FCFA)</Form.Label>
              <Form.Control
                type="number"
                value={form.budgetPrevisionnel}
                onChange={(e) => setForm({ ...form, budgetPrevisionnel: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="dateDebut">
              <Form.Label>Date de début</Form.Label>
              <Form.Control
                type="date"
                value={form.dateDebut}
                onChange={(e) => setForm({ ...form, dateDebut: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="datePrevisionnelleFin">
              <Form.Label>Date prévisionnelle de fin</Form.Label>
              <Form.Control
                type="date"
                value={form.datePrevisionnelleFin}
                onChange={(e) => setForm({ ...form, datePrevisionnelleFin: e.target.value })}
                required
              />
            </Form.Group>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Créer le chantier'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Layout>
  );
}

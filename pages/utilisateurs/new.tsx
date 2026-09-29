import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Form, Button, Card, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Role {
  _id: string;
  name: string;
}

export default function NewUtilisateur() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    roleName: '',
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!loading && user && !user.permissions?.includes('utilisateur.create')) {
      router.push('/utilisateurs');
      return;
    }
    const token = localStorage.getItem('easy_batiment_token');
    if (token) {
      fetch('/api/roles', { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Erreur');
          if (!Array.isArray(json)) throw new Error('Format invalide');
          setRoles(json);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les rôles'));
    }
  }, [isAuthenticated, loading, router, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const token = localStorage.getItem('easy_batiment_token');
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      router.push('/utilisateurs');
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
        <h1 className="mb-0">Nouvel utilisateur</h1>
        <PrintButton />
      </div>
      <Card>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="firstName">
              <Form.Label>Prénom</Form.Label>
              <Form.Control value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="lastName">
              <Form.Label>Nom</Form.Label>
              <Form.Control value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="email">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="phone">
              <Form.Label>Téléphone</Form.Label>
              <Form.Control value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="role">
              <Form.Label>Rôle</Form.Label>
              <Form.Select value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value })} required>
                <option value="">Choisir...</option>
                {roles.map((r) => (
                  <option key={r._id} value={r.name}>{r.name}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3" controlId="password">
              <Form.Label>Mot de passe</Form.Label>
              <Form.Control type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </Form.Group>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Créer'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Layout>
  );
}

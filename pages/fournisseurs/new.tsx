import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Form, Button, Card, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

export default function NewFournisseur() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    nom: '',
    contact: '',
    phone: '',
    email: '',
    adresse: '',
  });

  const canCreate = user?.permissions?.includes('admin.all') || user?.permissions?.includes('fournisseur.create');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const token = localStorage.getItem('easy_batiment_token');
      const res = await fetch('/api/fournisseurs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      router.push('/fournisseurs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  if (!canCreate) {
    return (
      <Layout>
        <Alert variant="warning" className="mt-4">
          Vous n&apos;avez pas la permission de créer un fournisseur.
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Nouveau fournisseur</h1>
        <PrintButton />
      </div>
      <Card>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="nom">
              <Form.Label>Nom</Form.Label>
              <Form.Control value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="contact">
              <Form.Label>Contact</Form.Label>
              <Form.Control value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="phone">
              <Form.Label>Téléphone</Form.Label>
              <Form.Control value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="email">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="adresse">
              <Form.Label>Adresse</Form.Label>
              <Form.Control value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
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

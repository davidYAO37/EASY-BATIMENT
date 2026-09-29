import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Form, Button, Card, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Chantier {
  _id: string;
  code: string;
  nom: string;
}

export default function NewRapport() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const canCreate = user?.permissions?.includes('admin.all') || user?.permissions?.includes('rapport.create');
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    chantier: '',
    date: '',
    activite: '',
    travauxRealises: '',
    personnelPresent: '',
    materielUtilise: '',
    difficultes: '',
    incidents: '',
    besoins: '',
    observations: '',
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!loading && isAuthenticated && !canCreate) {
      router.push('/rapports');
      return;
    }
    const token = localStorage.getItem('easy_batiment_token');
    if (token) {
      fetch('/api/chantiers', { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Erreur');
          if (!Array.isArray(json)) throw new Error('Format invalide');
          setChantiers(json);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les chantiers'));
    }
  }, [isAuthenticated, loading, router, canCreate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const token = localStorage.getItem('easy_batiment_token');
      const res = await fetch('/api/rapports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          date: form.date ? new Date(form.date).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      router.push('/rapports');
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
        <h1 className="mb-0">Nouveau rapport chantier</h1>
        <PrintButton />
      </div>
      <Card>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="chantier">
              <Form.Label>Chantier</Form.Label>
              <Form.Select value={form.chantier} onChange={(e) => setForm({ ...form, chantier: e.target.value })} required>
                <option value="">Choisir...</option>
                {chantiers.map((c) => (
                  <option key={c._id} value={c._id}>{c.code} - {c.nom}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3" controlId="date">
              <Form.Label>Date</Form.Label>
              <Form.Control type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="activite">
              <Form.Label>Activité</Form.Label>
              <Form.Control value={form.activite} onChange={(e) => setForm({ ...form, activite: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="travauxRealises">
              <Form.Label>Travaux réalisés</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.travauxRealises} onChange={(e) => setForm({ ...form, travauxRealises: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="personnelPresent">
              <Form.Label>Personnel présent</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.personnelPresent} onChange={(e) => setForm({ ...form, personnelPresent: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="materielUtilise">
              <Form.Label>Matériel utilisé</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.materielUtilise} onChange={(e) => setForm({ ...form, materielUtilise: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="difficultes">
              <Form.Label>Difficultés</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.difficultes} onChange={(e) => setForm({ ...form, difficultes: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="incidents">
              <Form.Label>Incidents</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.incidents} onChange={(e) => setForm({ ...form, incidents: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="besoins">
              <Form.Label>Besoins</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.besoins} onChange={(e) => setForm({ ...form, besoins: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="observations">
              <Form.Label>Observations</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
            </Form.Group>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Enregistrer'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Layout>
  );
}

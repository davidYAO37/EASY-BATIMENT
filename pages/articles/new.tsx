import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Form, Button, Card, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';
import { UNITE_GROUPS, CATEGORY_GROUPS } from '@/lib/articleOptions';

const AUTRE = '__autre__';

export default function NewArticle() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ nom: '' });
  const [uniteSel, setUniteSel] = useState('');
  const [uniteLibre, setUniteLibre] = useState('');
  const [catSel, setCatSel] = useState('');
  const [catLibre, setCatLibre] = useState('');

  const canCreate = user?.permissions?.includes('admin.all') || user?.permissions?.includes('article.create');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const token = localStorage.getItem('easy_batiment_token');
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nom: form.nom,
          unite: uniteSel === AUTRE ? uniteLibre.trim() : uniteSel,
          categorie: catSel === AUTRE ? catLibre.trim() : catSel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      router.push('/articles');
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
          Vous n&apos;avez pas la permission de créer un article.
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Nouvel article</h1>
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
            <Form.Group className="mb-3" controlId="unite">
              <Form.Label>Unité</Form.Label>
              <Form.Select value={uniteSel} onChange={(e) => setUniteSel(e.target.value)} required>
                <option value="">Choisir...</option>
                {UNITE_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </optgroup>
                ))}
                <option value={AUTRE}>Autre (saisir)</option>
              </Form.Select>
              {uniteSel === AUTRE && (
                <Form.Control
                  className="mt-2"
                  value={uniteLibre}
                  onChange={(e) => setUniteLibre(e.target.value)}
                  placeholder="Ex. : Palette, Camion..."
                  required
                />
              )}
            </Form.Group>
            <Form.Group className="mb-3" controlId="categorie">
              <Form.Label>Catégorie</Form.Label>
              <Form.Select value={catSel} onChange={(e) => setCatSel(e.target.value)}>
                <option value="">Choisir...</option>
                {CATEGORY_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </optgroup>
                ))}
                <option value={AUTRE}>Autre (saisir)</option>
              </Form.Select>
              {catSel === AUTRE && (
                <Form.Control
                  className="mt-2"
                  value={catLibre}
                  onChange={(e) => setCatLibre(e.target.value)}
                  placeholder="Ex. : Outillage, Location..."
                  required
                />
              )}
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

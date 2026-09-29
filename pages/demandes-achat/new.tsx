import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Form, Button, Card, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Chantier { _id: string; code: string; nom: string; }
interface Article { _id: string; nom: string; unite: string; }
interface Fournisseur { _id: string; nom: string; }

interface Ligne {
  article: string;
  quantite: string;
  prixEstimatif: string;
  observation: string;
}

export default function NewDemandeAchat() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canCreate = user?.permissions?.includes('admin.all') || user?.permissions?.includes('demandeAchat.create') || false;
  const canReadFournisseurs = user?.permissions?.includes('fournisseur.read') || false;

  const [form, setForm] = useState({
    chantier: '',
    fournisseurSouhaite: '',
    fournisseur: '',
    urgence: 'Normale',
    dateSouhaitee: '',
    observation: '',
  });

  const [lignes, setLignes] = useState<Ligne[]>([{ article: '', quantite: '1', prixEstimatif: '0', observation: '' }]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!loading && isAuthenticated && !canCreate) {
      router.push('/demandes-achat');
      return;
    }
    const token = localStorage.getItem('easy_batiment_token');
    if (!token) return;

    const endpoints: [string, string, (data: unknown[]) => void][] = [
      ['/api/chantiers', 'chantiers', (data) => setChantiers(data as Chantier[])],
      ['/api/articles', 'articles', (data) => setArticles(data as Article[])],
    ];

    if (canReadFournisseurs) {
      endpoints.push(['/api/fournisseurs', 'fournisseurs', (data) => setFournisseurs(data as Fournisseur[])]);
    }

    Promise.all(
      endpoints.map(([url]) =>
        fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      )
    )
      .then(async (responses) => {
        for (let i = 0; i < responses.length; i++) {
          const res = responses[i];
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || `Erreur ${endpoints[i][1]}`);
          if (!Array.isArray(json)) throw new Error(`Format invalide ${endpoints[i][1]}`);
          endpoints[i][2](json);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'));
  }, [isAuthenticated, loading, router, canReadFournisseurs, canCreate]);

  function addLigne() {
    setLignes([...lignes, { article: '', quantite: '1', prixEstimatif: '0', observation: '' }]);
  }

  function updateLigne(idx: number, field: keyof Ligne, value: string) {
    const copy = [...lignes];
    copy[idx][field] = value;
    setLignes(copy);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const token = localStorage.getItem('easy_batiment_token');
      const payload = {
        ...form,
        dateSouhaitee: form.dateSouhaitee ? new Date(form.dateSouhaitee).toISOString() : undefined,
        articles: lignes.map((l) => ({
          article: l.article,
          quantite: parseInt(l.quantite, 10),
          prixEstimatif: parseFloat(l.prixEstimatif),
          observation: l.observation,
        })),
      };
      const res = await fetch('/api/demandes-achat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      router.push('/demandes-achat');
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
        <h1 className="mb-0">Nouvelle demande d&apos;achat</h1>
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
            <Form.Group className="mb-3" controlId="fournisseurSouhaite">
              <Form.Label>Fournisseur souhaité</Form.Label>
              <Form.Control value={form.fournisseurSouhaite} onChange={(e) => setForm({ ...form, fournisseurSouhaite: e.target.value })} />
            </Form.Group>
            {canReadFournisseurs && (
              <Form.Group className="mb-3" controlId="fournisseur">
                <Form.Label>Fournisseur (catalogue)</Form.Label>
                <Form.Select value={form.fournisseur} onChange={(e) => setForm({ ...form, fournisseur: e.target.value })}>
                  <option value="">Choisir...</option>
                  {fournisseurs.map((f) => (
                    <option key={f._id} value={f._id}>{f.nom}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}
            <Form.Group className="mb-3" controlId="urgence">
              <Form.Label>Urgence</Form.Label>
              <Form.Select value={form.urgence} onChange={(e) => setForm({ ...form, urgence: e.target.value })}>
                <option>Basse</option>
                <option>Normale</option>
                <option>Haute</option>
                <option>Critique</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3" controlId="dateSouhaitee">
              <Form.Label>Date souhaitée</Form.Label>
              <Form.Control type="date" value={form.dateSouhaitee} onChange={(e) => setForm({ ...form, dateSouhaitee: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="observation">
              <Form.Label>Observation</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.observation} onChange={(e) => setForm({ ...form, observation: e.target.value })} />
            </Form.Group>

            <h5 className="mt-4">Articles</h5>
            <Row className="g-2 mb-2 fw-bold text-muted small">
              <Col md={4}>Article</Col>
              <Col md={2}>Quantité</Col>
              <Col md={3}>Prix unitaire estimé (FCFA)</Col>
              <Col md={3}>Observation</Col>
            </Row>
            {lignes.map((l, idx) => (
              <Row key={idx} className="g-2 mb-2 align-items-end">
                <Col md={4}>
                  <Form.Select value={l.article} onChange={(e) => updateLigne(idx, 'article', e.target.value)} required>
                    <option value="">Article...</option>
                    {articles.map((a) => (
                      <option key={a._id} value={a._id}>{a.nom} ({a.unite})</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={2}>
                  <Form.Control type="number" value={l.quantite} onChange={(e) => updateLigne(idx, 'quantite', e.target.value)} placeholder="Qté" required />
                </Col>
                <Col md={3}>
                  <Form.Control type="number" value={l.prixEstimatif} onChange={(e) => updateLigne(idx, 'prixEstimatif', e.target.value)} placeholder="Prix unitaire" required />
                </Col>
                <Col md={3}>
                  <Form.Control value={l.observation} onChange={(e) => updateLigne(idx, 'observation', e.target.value)} placeholder="Observation" />
                </Col>
              </Row>
            ))}
            <Button variant="secondary" onClick={addLigne} className="mb-3">Ajouter un article</Button>

            <div>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? <Spinner size="sm" /> : 'Soumettre la demande'}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Layout>
  );
}

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Form, Button, Card, Alert, Spinner, Table, Row, Col } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';
import { MdDelete } from 'react-icons/md';

interface Chantier {
  _id: string;
  code: string;
  nom: string;
}

interface Article {
  _id: string;
  nom: string;
  unite: string;
}

interface InventoryLine {
  article: string;
  stockTheorique: number;
  stockReel: string;
  motif: string;
  reference: string;
}

interface StockItem {
  article: string;
  entree: number;
  sortie: number;
  stock: number;
}

export default function NewRapport() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const canCreate = user?.permissions?.includes('admin.all') || user?.permissions?.includes('rapport.create');
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
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
  const [mouvements, setMouvements] = useState<InventoryLine[]>([]);
  const [stock, setStock] = useState<Record<string, StockItem>>({});

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
      Promise.all([
        fetch('/api/chantiers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/articles', { headers: { Authorization: `Bearer ${token}` } }),
      ])
        .then(async ([r1, r2]) => {
          const c = await r1.json();
          const a = await r2.json();
          if (!r1.ok) throw new Error(c.error || 'Erreur');
          if (!r2.ok) throw new Error(a.error || 'Erreur');
          if (!Array.isArray(c) || !Array.isArray(a)) throw new Error('Format invalide');
          setChantiers(c);
          setArticles(a);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les données'));
    }
  }, [isAuthenticated, loading, router, canCreate]);

  useEffect(() => {
    if (!form.chantier) return;
    const token = localStorage.getItem('easy_batiment_token');
    fetch(`/api/stock?chantier=${form.chantier}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur');
        if (!Array.isArray(json)) throw new Error('Format invalide');
        const map: Record<string, StockItem> = {};
        for (const s of json) {
          if (s.article) map[s.article] = s;
        }
        setStock(map);
        // Pré-remplissage automatique de l'inventaire avec les articles en stock
        setMouvements(
          json.map((s: StockItem) => ({
            article: s.article,
            stockTheorique: s.stock,
            stockReel: '',
            motif: 'Consommation chantier',
            reference: '',
          }))
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger le stock'));
  }, [form.chantier]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const token = localStorage.getItem('easy_batiment_token');
      const validMouvements = mouvements
        .filter((m) => m.article && m.stockReel.trim() !== '')
        .map((m) => {
          const reel = parseFloat(m.stockReel);
          const ecart = reel - m.stockTheorique;
          return {
            article: m.article,
            type: ecart >= 0 ? 'Entrée' : ('Sortie' as const),
            quantite: Math.abs(ecart),
            motif: m.motif || 'Ajustement inventaire',
            reference: m.reference,
            stockTheorique: m.stockTheorique,
            stockReel: reel,
          };
        })
        .filter((m) => m.quantite > 0);

      const res = await fetch('/api/rapports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          date: form.date ? new Date(form.date).toISOString() : undefined,
          mouvements: validMouvements,
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

      {error && <Alert variant="danger">{error}</Alert>}

      <Form onSubmit={handleSubmit}>
        {/* ─── Identification ─── */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Header className="bg-primary text-white fw-semibold">Identification</Card.Header>
          <Card.Body>
            <Row>
              <Col md={8} className="mb-3 mb-md-0">
                <Form.Group controlId="chantier">
                  <Form.Label>Chantier <span className="text-danger">*</span></Form.Label>
                  <Form.Select value={form.chantier} onChange={(e) => setForm({ ...form, chantier: e.target.value })} required>
                    <option value="">Sélectionner un chantier...</option>
                    {chantiers.map((c) => (
                      <option key={c._id} value={c._id}>{c.code} - {c.nom}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group controlId="date">
                  <Form.Label>Date <span className="text-muted small">(optionnel)</span></Form.Label>
                  <Form.Control type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* ─── Activité et suivi ─── */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Header className="bg-primary text-white fw-semibold">Activité et suivi du jour</Card.Header>
          <Card.Body>
            <Form.Group className="mb-3" controlId="activite">
              <Form.Label>Activité <span className="text-danger">*</span></Form.Label>
              <Form.Control placeholder="Ex. Bétonnage dalle RDC" value={form.activite} onChange={(e) => setForm({ ...form, activite: e.target.value })} required />
            </Form.Group>
            <Row>
              <Col md={6} className="mb-3">
                <Form.Group controlId="travauxRealises">
                  <Form.Label>Travaux réalisés <span className="text-danger">*</span></Form.Label>
                  <Form.Control as="textarea" rows={3} placeholder="Décrivez les travaux effectués" value={form.travauxRealises} onChange={(e) => setForm({ ...form, travauxRealises: e.target.value })} required />
                </Form.Group>
              </Col>
              <Col md={6} className="mb-3">
                <Form.Group controlId="personnelPresent">
                  <Form.Label>Personnel présent <span className="text-danger">*</span></Form.Label>
                  <Form.Control as="textarea" rows={3} placeholder="Liste des personnes présentes" value={form.personnelPresent} onChange={(e) => setForm({ ...form, personnelPresent: e.target.value })} required />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group controlId="materielUtilise">
              <Form.Label>Matériel utilisé <span className="text-danger">*</span></Form.Label>
              <Form.Control as="textarea" rows={2} placeholder="Engins, outillages, équipements utilisés" value={form.materielUtilise} onChange={(e) => setForm({ ...form, materielUtilise: e.target.value })} required />
            </Form.Group>
          </Card.Body>
        </Card>

        {/* ─── Points de vigilance ─── */}
        <Card className="shadow-sm border-0 mb-4">
          <Card.Header className="bg-warning text-dark fw-semibold">Points de vigilance <span className="fw-normal small">(optionnels)</span></Card.Header>
          <Card.Body>
            <Row>
              <Col md={6} className="mb-3">
                <Form.Group controlId="difficultes">
                  <Form.Label>Difficultés</Form.Label>
                  <Form.Control as="textarea" rows={2} placeholder="Problèmes rencontrés" value={form.difficultes} onChange={(e) => setForm({ ...form, difficultes: e.target.value })} />
                </Form.Group>
              </Col>
              <Col md={6} className="mb-3">
                <Form.Group controlId="incidents">
                  <Form.Label>Incidents</Form.Label>
                  <Form.Control as="textarea" rows={2} placeholder="Accidents, sécurité, anomalies" value={form.incidents} onChange={(e) => setForm({ ...form, incidents: e.target.value })} />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6} className="mb-3">
                <Form.Group controlId="besoins">
                  <Form.Label>Besoins</Form.Label>
                  <Form.Control as="textarea" rows={2} placeholder="Matériaux, main-d'œuvre, équipements manquants" value={form.besoins} onChange={(e) => setForm({ ...form, besoins: e.target.value })} />
                </Form.Group>
              </Col>
              <Col md={6} className="mb-3">
                <Form.Group controlId="observations">
                  <Form.Label>Observations</Form.Label>
                  <Form.Control as="textarea" rows={2} placeholder="Remarques complémentaires" value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* ─── Inventaire ─── */}
        <Card className="shadow-sm border-0 mb-4">
              <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <span>Constat d&apos;inventaire du chantier</span>
                <div className="d-flex gap-2">
                  <Button
                    variant="outline-warning"
                    size="sm"
                    onClick={() =>
                      setMouvements((prev) =>
                        prev.map((m) => ({
                          ...m,
                          stockReel: '0',
                          motif: m.motif || 'Clôture inventaire',
                        }))
                      )
                    }
                    disabled={mouvements.length === 0}
                  >
                    Tout à zéro
                  </Button>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() =>
                      setMouvements((prev) => [
                        ...prev,
                        { article: '', stockTheorique: 0, stockReel: '', motif: 'Inventaire', reference: '' },
                      ])
                    }
                  >
                    Ajouter une ligne
                  </Button>
                </div>
              </Card.Header>
              <Card.Body>
                <p className="text-muted small">
                  Saisissez le <strong>stock réel constaté</strong> pour chaque article. L&apos;écart avec le stock théorique génère automatiquement une entrée ou une sortie.
                </p>
                {mouvements.length === 0 ? (
                  <p className="text-muted mb-0">Aucun article en stock pour ce chantier.</p>
                ) : (
                  <Table bordered responsive size="sm">
                    <thead>
                      <tr>
                        <th>Article <span className="text-danger">*</span></th>
                        <th style={{ width: 70 }}>Unité</th>
                        <th style={{ width: 90 }}>Stock théo.</th>
                        <th style={{ width: 100 }}>Stock réel <span className="text-danger">*</span></th>
                        <th style={{ width: 80 }}>Écart</th>
                        <th style={{ minWidth: 140 }}>Motif <span className="text-danger">*</span></th>
                        <th style={{ minWidth: 100 }}>Réf.</th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mouvements.map((m, i) => {
                        const reel = m.stockReel.trim() === '' ? null : parseFloat(m.stockReel);
                        const ecart = reel === null ? null : reel - m.stockTheorique;
                        return (
                          <tr key={i}>
                            <td>
                              <Form.Select
                                value={m.article}
                                onChange={(e) => {
                                  const next = [...mouvements];
                                  const id = e.target.value;
                                  next[i].article = id;
                                  next[i].stockTheorique = id ? (stock[id]?.stock ?? 0) : 0;
                                  setMouvements(next);
                                }}
                                required
                              >
                                <option value="">Choisir...</option>
                                {articles.map((a) => (
                                  <option key={a._id} value={a._id}>{a.nom} ({a.unite})</option>
                                ))}
                              </Form.Select>
                            </td>
                            <td className="text-muted small text-center">
                              {articles.find((a) => a._id === m.article)?.unite || '-'}
                            </td>
                            <td className="text-center">
                              {m.stockTheorique}
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                min={0}
                                step="any"
                                value={m.stockReel}
                                onChange={(e) => {
                                  const next = [...mouvements];
                                  next[i].stockReel = e.target.value;
                                  setMouvements(next);
                                }}
                                placeholder="Qté"
                                required
                              />
                            </td>
                            <td className="text-center">
                              {reel === null ? (
                                '-'
                              ) : (
                                <span className={ecart && ecart > 0 ? 'text-success' : ecart && ecart < 0 ? 'text-danger' : 'text-muted'}>
                                  {ecart && ecart > 0 ? `+${ecart}` : ecart}
                                </span>
                              )}
                            </td>
                            <td>
                              <Form.Control
                                value={m.motif}
                                onChange={(e) => {
                                  const next = [...mouvements];
                                  next[i].motif = e.target.value;
                                  setMouvements(next);
                                }}
                                placeholder="Motif"
                                required
                              />
                            </td>
                            <td>
                              <Form.Control
                                value={m.reference}
                                onChange={(e) => {
                                  const next = [...mouvements];
                                  next[i].reference = e.target.value;
                                  setMouvements(next);
                                }}
                                placeholder="Réf."
                              />
                            </td>
                            <td>
                              <Button variant="link" className="text-danger p-0" onClick={() => setMouvements((prev) => prev.filter((_, idx) => idx !== i))}>
                                <MdDelete />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                )}
              </Card.Body>
            </Card>

            <div className="d-flex justify-content-end gap-2">
              <Button variant="outline-secondary" onClick={() => router.push('/rapports')} disabled={submitting}>
                Annuler
              </Button>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? <Spinner size="sm" /> : 'Enregistrer le rapport'}
              </Button>
            </div>
          </Form>
    </Layout>
  );
}

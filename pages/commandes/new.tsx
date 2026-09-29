import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Form, Button, Card, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Demande {
  _id: string;
  code: string;
  statut: string;
  articles: {
    article: { _id: string; nom: string; unite: string };
    quantite: number;
    prixEstimatif: number;
    commande?: unknown;
  }[];
  fournisseur?: { _id: string; nom: string };
}

interface Ligne {
  article: string;
  quantite: string;
  prixUnitaire: string;
}

export default function NewCommande() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const canCreate = user?.permissions?.includes('admin.all') || user?.permissions?.includes('commande.create');
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [demandeId, setDemandeId] = useState('');
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [form, setForm] = useState({
    modePaiement: '',
    dateCommande: '',
    datePrevueLivraison: '',
    bonCommande: '',
    facture: '',
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!loading && isAuthenticated && !canCreate) {
      router.push('/commandes');
      return;
    }
    const token = localStorage.getItem('easy_batiment_token');
    if (token) {
      fetch('/api/demandes-achat', { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Erreur');
          if (!Array.isArray(json)) throw new Error('Format invalide');
          setDemandes(
            (json as Demande[]).filter(
              (d) =>
                (d.statut === 'FINANCE_AUTORISEE' || d.statut === 'COMMANDE_PARTIELLE') &&
                (d.articles || []).some((a) => !a.commande)
            )
          );
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les demandes'));
    }
  }, [isAuthenticated, loading, router, canCreate]);

  function selectDemande(id: string) {
    setDemandeId(id);
    const d = demandes.find((x) => x._id === id);
    if (d) {
      setLignes(
        d.articles
          .filter((a) => !a.commande)
          .map((a) => ({
            article: a.article._id,
            quantite: a.quantite.toString(),
            prixUnitaire: a.prixEstimatif.toString(),
          }))
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const token = localStorage.getItem('easy_batiment_token');
      const res = await fetch('/api/commandes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          demandeAchat: demandeId,
          fournisseur: demandes.find((d) => d._id === demandeId)?.fournisseur?._id,
          articles: lignes.map((l) => ({
            article: l.article,
            quantite: parseInt(l.quantite, 10),
            prixUnitaire: parseFloat(l.prixUnitaire),
          })),
          ...form,
          dateCommande: new Date(form.dateCommande).toISOString(),
          datePrevueLivraison: form.datePrevueLivraison ? new Date(form.datePrevueLivraison).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      router.push('/commandes');
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
        <h1 className="mb-0">Nouvelle commande</h1>
        <PrintButton />
      </div>
      <Card>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="demande">
              <Form.Label>Demande d&apos;achat</Form.Label>
              <Form.Select value={demandeId} onChange={(e) => selectDemande(e.target.value)} required>
                <option value="">Choisir...</option>
                {demandes.map((d) => (
                  <option key={d._id} value={d._id}>{d.code}</option>
                ))}
              </Form.Select>
            </Form.Group>
            {lignes.length > 0 && (
              <Row className="g-2 mb-2 fw-bold text-muted small">
                <Col md={4}>Article / Quantité</Col>
                <Col md={4}>Prix unitaire (FCFA)</Col>
              </Row>
            )}
            {lignes.map((l, idx) => {
              const article = demandes.find((d) => d._id === demandeId)?.articles.find((a) => a.article._id === l.article)?.article;
              return (
                <Row key={idx} className="g-2 mb-2 align-items-end">
                  <Col md={4}>
                    <Form.Label>{article?.nom} ({article?.unite})</Form.Label>
                    <Form.Control value={l.quantite} onChange={(e) => {
                      const copy = [...lignes]; copy[idx].quantite = e.target.value; setLignes(copy);
                    }} required />
                  </Col>
                  <Col md={4}>
                    <Form.Control value={l.prixUnitaire} onChange={(e) => {
                      const copy = [...lignes]; copy[idx].prixUnitaire = e.target.value; setLignes(copy);
                    }} required />
                  </Col>
                </Row>
              );
            })}
            <Form.Group className="mb-3" controlId="modePaiement">
              <Form.Label>Mode de paiement</Form.Label>
              <Form.Control value={form.modePaiement} onChange={(e) => setForm({ ...form, modePaiement: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="dateCommande">
              <Form.Label>Date de commande</Form.Label>
              <Form.Control type="date" value={form.dateCommande} onChange={(e) => setForm({ ...form, dateCommande: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="datePrevueLivraison">
              <Form.Label>Date prévue de livraison</Form.Label>
              <Form.Control type="date" value={form.datePrevueLivraison} onChange={(e) => setForm({ ...form, datePrevueLivraison: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="bonCommande">
              <Form.Label>Bon de commande (URL)</Form.Label>
              <Form.Control value={form.bonCommande} onChange={(e) => setForm({ ...form, bonCommande: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="facture">
              <Form.Label>Facture (URL)</Form.Label>
              <Form.Control value={form.facture} onChange={(e) => setForm({ ...form, facture: e.target.value })} />
            </Form.Group>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Créer la commande'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Layout>
  );
}

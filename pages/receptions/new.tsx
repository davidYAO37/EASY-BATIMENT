import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Form, Button, Card, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Commande {
  _id: string;
  code: string;
  statut: string;
  articles: { article: { _id: string; nom: string; unite: string }; quantite: number }[];
}

interface LigneRecu {
  article: string;
  recu: string;
  etat: string;
  commentaire: string;
}

export default function NewReception() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const canCreate = user?.permissions?.includes('admin.all') || user?.permissions?.includes('reception.create');
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commandeId, setCommandeId] = useState('');
  const [lignes, setLignes] = useState<LigneRecu[]>([]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!loading && isAuthenticated && !canCreate) {
      router.push('/receptions');
      return;
    }
    const token = localStorage.getItem('easy_batiment_token');
    if (token) {
      fetch('/api/commandes', { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Erreur');
          if (!Array.isArray(json)) throw new Error('Format invalide');
          setCommandes(json.filter((c) => c.statut === 'COMMANDE_FOURNISSEUR' || c.statut === 'LIVRAISON'));
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les commandes'));
    }
  }, [isAuthenticated, loading, router, canCreate]);

  function selectCommande(id: string) {
    setCommandeId(id);
    const c = commandes.find((x) => x._id === id);
    if (c) {
      setLignes(c.articles.map((a) => ({ article: a.article._id, recu: a.quantite.toString(), etat: 'Conforme', commentaire: '' })));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const token = localStorage.getItem('easy_batiment_token');
      const res = await fetch('/api/receptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          commande: commandeId,
          lignes: lignes.map((l) => ({
            ...l,
            recu: parseInt(l.recu, 10),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      router.push('/receptions');
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
        <h1 className="mb-0">Nouvelle réception</h1>
        <PrintButton />
      </div>
      <Card>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="commande">
              <Form.Label>Commande</Form.Label>
              <Form.Select value={commandeId} onChange={(e) => selectCommande(e.target.value)} required>
                <option value="">Choisir...</option>
                {commandes.map((c) => (
                  <option key={c._id} value={c._id}>{c.code}</option>
                ))}
              </Form.Select>
            </Form.Group>
            {lignes.length > 0 && (
              <Row className="g-2 mb-2 fw-bold text-muted small">
                <Col md={3}>Article / Quantité reçue</Col>
                <Col md={3}>État</Col>
                <Col md={6}>Commentaire</Col>
              </Row>
            )}
            {lignes.map((l, idx) => {
              const article = commandes.find((c) => c._id === commandeId)?.articles.find((a) => a.article._id === l.article)?.article;
              return (
                <Row key={idx} className="g-2 mb-2 align-items-end">
                  <Col md={3}>
                    <Form.Label>{article?.nom}</Form.Label>
                    <Form.Control value={l.recu} onChange={(e) => { const copy = [...lignes]; copy[idx].recu = e.target.value; setLignes(copy); }} required />
                  </Col>
                  <Col md={3}>
                    <Form.Select value={l.etat} onChange={(e) => { const copy = [...lignes]; copy[idx].etat = e.target.value; setLignes(copy); }}>
                      <option>Conforme</option>
                      <option>Manquant</option>
                      <option>Endommagé</option>
                      <option>Non conforme</option>
                      <option>Livraison partielle</option>
                      <option>Autre</option>
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <Form.Control value={l.commentaire} onChange={(e) => { const copy = [...lignes]; copy[idx].commentaire = e.target.value; setLignes(copy); }} />
                  </Col>
                </Row>
              );
            })}
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Enregistrer la réception'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Layout>
  );
}

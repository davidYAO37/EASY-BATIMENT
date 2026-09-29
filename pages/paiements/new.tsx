import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Form, Button, Card, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';
import { ReceiptUpload } from '@/components/Receipt';

interface Decaissement {
  _id: string;
  code: string;
  montant: number;
  statut: string;
  commande?: { _id: string; code: string; statut: string };
  chantier?: { code: string; nom: string };
  beneficiaire?: string;
  utilisateurReceptionnaire?: { _id: string; firstName: string; lastName: string };
}

export default function NewPaiement() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [decaissements, setDecaissements] = useState<Decaissement[] | null>(null);

  const canCreate = user?.permissions?.includes('admin.all') || user?.permissions?.includes('paiement.create');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    decaissement: '',
    montant: '',
    modePaiement: 'Espèces',
    datePaiement: '',
    recuPhysique: '',
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!loading && isAuthenticated && !canCreate) {
      router.push('/paiements');
      return;
    }
    const token = localStorage.getItem('easy_batiment_token');
    if (!token || !router.isReady) return;
    fetch('/api/decaissements', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur');
        const isAdmin = user?.permissions?.includes('admin.all');
        const payables = (json as Decaissement[]).filter(
          (d) =>
            ['Autorisé', 'Remis'].includes(d.statut) &&
            d.commande?.statut === 'RECEPTION_RC' &&
            (isAdmin || d.utilisateurReceptionnaire?._id === user?.id)
        );
        setDecaissements(payables);
        const pre = payables.find((d) => d._id === router.query.decaissement);
        if (pre) setForm((f) => ({ ...f, decaissement: pre._id, montant: pre.montant.toString() }));
      })
      .catch(() => setError('Impossible de charger les décaissements'));
  }, [isAuthenticated, loading, router, router.isReady, user, canCreate]);

  function selectDecaissement(id: string) {
    const d = decaissements?.find((x) => x._id === id);
    setForm({ ...form, decaissement: id, montant: d ? d.montant.toString() : '' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const token = localStorage.getItem('easy_batiment_token');
      const res = await fetch('/api/paiements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          montant: parseFloat(form.montant),
          datePaiement: form.datePaiement ? new Date(form.datePaiement).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      router.push('/paiements');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setSubmitting(false);
    }
  }

  const selected = decaissements?.find((d) => d._id === form.decaissement);
  const ecart = selected && form.montant ? parseFloat(form.montant) - selected.montant : 0;

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Nouveau paiement</h1>
        <PrintButton />
      </div>
      <Card>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          {decaissements === null && !error && <Spinner animation="border" />}
          {decaissements?.length === 0 && (
            <Alert variant="info">
              Aucun décaissement à payer. L&apos;administrateur doit d&apos;abord autoriser les fonds pour une commande réceptionnée.
            </Alert>
          )}
          {!!decaissements?.length && (
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3" controlId="decaissement">
                <Form.Label>Décaissement autorisé</Form.Label>
                <Form.Select value={form.decaissement} onChange={(e) => selectDecaissement(e.target.value)} required>
                  <option value="">Choisir un décaissement...</option>
                  {decaissements.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.code} — {d.montant.toLocaleString()} FCFA — Commande {d.commande?.code} — {d.chantier?.code}
                    </option>
                  ))}
                </Form.Select>
                {selected && (
                  <Form.Text className="text-muted">
                    Commande <strong>{selected.commande?.code}</strong> — chantier <strong>{selected.chantier?.code}</strong> — bénéficiaire{' '}
                    <strong>{selected.beneficiaire}</strong>
                    {selected.utilisateurReceptionnaire && user?.id !== selected.utilisateurReceptionnaire._id && (
                      <> — fonds remis à <strong>{selected.utilisateurReceptionnaire.firstName} {selected.utilisateurReceptionnaire.lastName}</strong></>
                    )}
                  </Form.Text>
                )}
              </Form.Group>

              <Row className="g-3">
                <Col md={6}>
                  <Form.Group className="mb-3" controlId="montant">
                    <Form.Label>Montant payé (FCFA)</Form.Label>
                    <Form.Control type="number" min={0} value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} required />
                    {selected && (
                      <Form.Text className={ecart !== 0 ? 'text-danger fw-bold' : 'text-muted'}>
                        Montant autorisé : {selected.montant.toLocaleString()} FCFA
                        {ecart !== 0 && ` — écart de ${ecart.toLocaleString()} FCFA (sera signalé en anomalie)`}
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3" controlId="modePaiement">
                    <Form.Label>Mode de paiement</Form.Label>
                    <Form.Select value={form.modePaiement} onChange={(e) => setForm({ ...form, modePaiement: e.target.value })} required>
                      <option>Espèces</option>
                      <option>Chèque</option>
                      <option>Virement</option>
                      <option>Mobile Money</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3" controlId="datePaiement">
                <Form.Label>Date de paiement</Form.Label>
                <Form.Control type="date" value={form.datePaiement} onChange={(e) => setForm({ ...form, datePaiement: e.target.value })} />
              </Form.Group>

              <ReceiptUpload
                controlId="recuPhysique"
                label="Photo du reçu physique remis par le fournisseur"
                value={form.recuPhysique}
                onChange={(v) => setForm({ ...form, recuPhysique: v })}
              />
              <Form.Text className="d-block mb-3 text-muted">
                Si le reçu n&apos;est pas encore disponible, vous pourrez le transmettre plus tard depuis la liste des paiements.
              </Form.Text>

              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? <Spinner size="sm" /> : 'Enregistrer le paiement'}
              </Button>
            </Form>
          )}
        </Card.Body>
      </Card>
    </Layout>
  );
}

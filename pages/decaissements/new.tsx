import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Form, Button, Card, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Commande {
  _id: string;
  code: string;
  statut: string;
  montant: number;
  chantier?: { code: string; nom: string; receptionnisteChantier?: string };
  fournisseur?: { nom: string };
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  active?: boolean;
  role?: { name: string; code?: string };
}

export default function NewDecaissement() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const canCreate = user?.permissions?.includes('admin.all') || user?.permissions?.includes('decaissement.create');
  const [commandes, setCommandes] = useState<Commande[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ commande: '', montant: '', beneficiaire: '', motif: '', utilisateurReceptionnaire: '' });

  function preparer(c: Commande | undefined) {
    if (!c) return setForm((f) => ({ ...f, commande: '' }));
    setForm((f) => ({
      ...f,
      commande: c._id,
      montant: c.montant.toString(),
      beneficiaire: c.fournisseur?.nom || f.beneficiaire,
      motif: f.motif || `Paiement fournisseur — commande ${c.code}`,
      utilisateurReceptionnaire: c.chantier?.receptionnisteChantier || f.utilisateurReceptionnaire,
    }));
  }

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!loading && isAuthenticated && !canCreate) {
      router.push('/decaissements');
      return;
    }
    const token = localStorage.getItem('easy_batiment_token');
    if (!token || !router.isReady) return;
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([fetch('/api/commandes', { headers }), fetch('/api/users', { headers }), fetch('/api/decaissements', { headers })])
      .then(async ([r1, r2, r3]) => {
        const [c, u, d] = await Promise.all([r1.json(), r2.json(), r3.json()]);
        if (!r1.ok) throw new Error(c.error || 'Impossible de charger les commandes');
        if (!r2.ok) throw new Error(u.error || 'Impossible de charger les utilisateurs');
        if (!r3.ok) throw new Error(d.error || 'Impossible de charger les décaissements');
        const dejaAutorisees = new Set((d as { commande?: { _id: string } }[]).map((x) => x.commande?._id));
        const eligibles = (c as Commande[]).filter((x) => x.statut === 'RECEPTION_RC' && !dejaAutorisees.has(x._id));
        setCommandes(eligibles);
        setUsers(u);
        preparer(eligibles.find((x) => x._id === router.query.commande));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'));
  }, [isAuthenticated, loading, router, router.isReady, canCreate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const token = localStorage.getItem('easy_batiment_token');
      const res = await fetch('/api/decaissements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, montant: parseFloat(form.montant) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      router.push('/decaissements');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setSubmitting(false);
    }
  }

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Autoriser des fonds (décaissement)</h1>
        <PrintButton />
      </div>
      <Card>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          {commandes === null && !error && <Spinner animation="border" />}
          {commandes?.length === 0 && (
            <Alert variant="info">Aucune commande réceptionnée en attente d&apos;autorisation de fonds.</Alert>
          )}
          {!!commandes?.length && (
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3" controlId="commande">
                <Form.Label>Commande réceptionnée</Form.Label>
                <Form.Select value={form.commande} onChange={(e) => preparer(commandes.find((c) => c._id === e.target.value))} required>
                  <option value="">Choisir...</option>
                  {commandes.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.code} — {c.chantier?.code} — {c.fournisseur?.nom} — {c.montant.toLocaleString()} FCFA
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">Un seul décaissement par commande. Il sera consommé par un paiement unique.</Form.Text>
              </Form.Group>
              <Form.Group className="mb-3" controlId="montant">
                <Form.Label>Montant (FCFA)</Form.Label>
                <Form.Control type="number" value={form.montant} readOnly disabled className="bg-light" />
                <Form.Text className="text-muted">Montant repris automatiquement de la commande.</Form.Text>
              </Form.Group>
              <Form.Group className="mb-3" controlId="beneficiaire">
                <Form.Label>Bénéficiaire</Form.Label>
                <Form.Control value={form.beneficiaire} readOnly disabled className="bg-light" />
                <Form.Text className="text-muted">Fournisseur de la commande.</Form.Text>
              </Form.Group>
              <Form.Group className="mb-3" controlId="motif">
                <Form.Label>Motif</Form.Label>
                <Form.Control as="textarea" rows={2} value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} required />
              </Form.Group>
              <Form.Group className="mb-3" controlId="receptionnaire">
                <Form.Label>Fonds remis à (réceptionniste chantier)</Form.Label>
                <Form.Select value={form.utilisateurReceptionnaire} onChange={(e) => setForm({ ...form, utilisateurReceptionnaire: e.target.value })} required>
                  <option value="">Choisir...</option>
                  {users
                    .filter((u) => u.role?.code === 'RECEPTION_CHANTIER' && u.active !== false)
                    .map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                </Form.Select>
              </Form.Group>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? <Spinner size="sm" /> : 'Autoriser'}
              </Button>
            </Form>
          )}
        </Card.Body>
      </Card>
    </Layout>
  );
}

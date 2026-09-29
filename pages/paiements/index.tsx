import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Table, Button, Badge, Alert, Spinner, Modal } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';
import { ReceiptUpload } from '@/components/Receipt';

interface Paiement {
  _id: string;
  code: string;
  montant: number;
  commande?: { _id: string; code: string; statut: string };
  fournisseur?: { nom: string };
  chantier?: { code: string };
  statut: string;
  datePaiement: string;
  recuPhysiqueDate?: string;
  effectuePar?: { firstName: string; lastName: string };
}

const statutColor: Record<string, string> = {
  Effectué: 'primary',
  Contrôlé: 'success',
  Anomalie: 'danger',
};

export default function Paiements() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [paiements, setPaiements] = useState<Paiement[] | null>(null);
  const [error, setError] = useState('');
  const [cible, setCible] = useState<Paiement | null>(null);
  const [recu, setRecu] = useState('');
  const [saving, setSaving] = useState(false);

  const perms = user?.permissions || [];
  const canPay = perms.includes('admin.all') || perms.includes('paiement.create');

  const load = useCallback(() => {
    const token = localStorage.getItem('easy_batiment_token');
    if (!token) return;
    fetch('/api/paiements', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur');
        if (!Array.isArray(json)) throw new Error('Format invalide');
        setPaiements(json);
      })
      .catch(() => setError('Impossible de charger les paiements'));
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) load();
  }, [isAuthenticated, loading, router, load]);

  async function transmettreRecu() {
    if (!cible || !recu) return;
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('easy_batiment_token');
      const res = await fetch(`/api/paiements/${cible._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recuPhysique: recu }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setCible(null);
      setRecu('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  const sansRecu = (paiements || []).filter((p) => !p.recuPhysiqueDate && p.statut === 'Effectué').length;

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Paiements</h1>
        <div className="d-flex gap-2">
          <PrintButton />
          {canPay && (
            <Link href="/paiements/new" passHref>
              <Button variant="primary">Nouveau paiement</Button>
            </Link>
          )}
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {sansRecu > 0 && canPay && (
        <Alert variant="warning">
          {sansRecu} paiement(s) sans reçu physique : transmettez-les pour permettre le contrôle administrateur.
        </Alert>
      )}
      {paiements === null && !error ? (
        <Spinner animation="border" />
      ) : !paiements?.length ? (
        <Alert variant="info">Aucun paiement enregistré.</Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Code</th>
              <th>Commande</th>
              <th>Chantier</th>
              <th>Fournisseur</th>
              <th>Montant</th>
              <th>Date</th>
              <th>Payé par</th>
              <th>Reçu physique</th>
              <th>Statut</th>
              <th className="d-print-none">Impression</th>
            </tr>
          </thead>
          <tbody>
            {paiements.map((p) => (
              <tr key={p._id}>
                <td>{p.code}</td>
                <td>{p.commande ? <Link href={`/commandes/${p.commande._id}`}>{p.commande.code}</Link> : '—'}</td>
                <td>{p.chantier?.code}</td>
                <td>{p.fournisseur?.nom}</td>
                <td>{p.montant.toLocaleString()} FCFA</td>
                <td>{new Date(p.datePaiement).toLocaleDateString('fr-FR')}</td>
                <td>{p.effectuePar ? `${p.effectuePar.firstName} ${p.effectuePar.lastName}` : '—'}</td>
                <td>
                  {p.recuPhysiqueDate ? (
                    <Badge bg="success">Transmis</Badge>
                  ) : canPay && p.statut === 'Effectué' ? (
                    <Button size="sm" variant="warning" onClick={() => setCible(p)}>
                      Transmettre
                    </Button>
                  ) : (
                    <Badge bg="secondary">Manquant</Badge>
                  )}
                </td>
                <td>
                  <Badge bg={statutColor[p.statut] || 'secondary'}>{p.statut}</Badge>
                </td>
                <td className="d-print-none">
                  <Button
                    as="a"
                    href={`/paiements/${p._id}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    variant="outline-primary"
                  >
                    Reçu
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal show={!!cible} onHide={() => { setCible(null); setRecu(''); }} centered>
        <Modal.Header closeButton>
          <Modal.Title>Reçu physique — {cible?.code}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ReceiptUpload controlId="recuPhysiqueModal" label="Photo du reçu physique" value={recu} onChange={setRecu} required />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setCible(null); setRecu(''); }}>
            Annuler
          </Button>
          <Button variant="primary" onClick={transmettreRecu} disabled={!recu || saving}>
            {saving ? <Spinner size="sm" /> : "Transmettre à l'administrateur"}
          </Button>
        </Modal.Footer>
      </Modal>
    </Layout>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Table, Button, Badge, Alert, Spinner, Form } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Commande {
  _id: string;
  code: string;
  demandeAchat?: { code: string };
  chantier?: { code: string };
  fournisseur?: { nom: string };
  montant: number;
  statut: string;
  dateCommande: string;
  recuFournisseurDate?: string;
}

const statutColor: Record<string, string> = {
  COMMANDE_FOURNISSEUR: 'info',
  LIVRAISON: 'warning',
  RECEPTION_RC: 'primary',
  PAIEMENT: 'secondary',
  JUSTIFICATIFS: 'warning',
  CONTROLE_ADMIN: 'warning',
  CLOTURE: 'success',
  ANOMALIE: 'danger',
};

const RB_STATUTS = ['COMMANDE_FOURNISSEUR', 'LIVRAISON', 'RECEPTION_RC', 'PAIEMENT'];

export default function Commandes() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [commandes, setCommandes] = useState<Commande[] | null>(null);
  const [error, setError] = useState('');
  const [filtre, setFiltre] = useState('');

  const queryFiltre = useMemo(() => {
    if (router.isReady && typeof router.query.filtre === 'string') return router.query.filtre;
    return '';
  }, [router.isReady, router.query.filtre]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    const token = localStorage.getItem('easy_batiment_token');
    if (token) {
      fetch('/api/commandes', { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Erreur');
          if (!Array.isArray(json)) throw new Error('Format invalide');
          setCommandes(json);
          if (queryFiltre) setFiltre(queryFiltre);
        })
        .catch(() => setError('Impossible de charger les commandes'));
    }
  }, [isAuthenticated, loading, router, queryFiltre]);

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  const perms = user?.permissions || [];
  const canRecu = perms.includes('admin.all') || perms.includes('commande.update');
  const canCreate = perms.includes('admin.all') || perms.includes('commande.create');
  const canDelete = perms.includes('admin.all') || perms.includes('commande.delete');
  const token = typeof window !== 'undefined' ? localStorage.getItem('easy_batiment_token') : null;

  async function handleDelete(commandeId: string) {
    if (!confirm('Supprimer cette commande ?')) return;
    try {
      const res = await fetch(`/api/commandes/${commandeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Erreur');
      }
      setCommandes((prev) => (prev ? prev.filter((c) => c._id !== commandeId) : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }
  const liste = (commandes || []).filter((c) => {
    if (filtre === 'recu') return RB_STATUTS.includes(c.statut) && !c.recuFournisseurDate;
    if (filtre) return c.statut === filtre;
    return true;
  });

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Commandes</h1>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <PrintButton />
          {canCreate && (
            <Link href="/commandes/new" passHref>
              <Button variant="primary" size="sm">Nouvelle commande</Button>
            </Link>
          )}
          <Form.Select style={{ maxWidth: 320 }} value={filtre} onChange={(e) => setFiltre(e.target.value)}>
          <option value="">Toutes les commandes</option>
          {canRecu && <option value="recu">Reçu fournisseur à transmettre</option>}
          {Object.keys(statutColor).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Form.Select>
        </div>
      </div>
      <p className="text-muted small">
        Les commandes sont générées automatiquement à la validation d&apos;une demande par l&apos;administrateur. La commande est ensuite passée au fournisseur par téléphone ou bon imprimé.
      </p>
      {error && <Alert variant="danger">{error}</Alert>}
      {commandes === null && !error ? (
        <Spinner animation="border" />
      ) : !liste.length ? (
        <Alert variant="info">Aucune commande.</Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Code</th>
              <th>Demande</th>
              <th>Chantier</th>
              <th>Fournisseur</th>
              <th>Montant</th>
              <th>Date</th>
              <th>Reçu fournisseur</th>
              <th>Statut</th>
              <th className="text-end d-print-none">Actions</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((c) => (
              <tr key={c._id}>
                <td>{c.code}</td>
                <td>{c.demandeAchat?.code}</td>
                <td>{c.chantier?.code}</td>
                <td>{c.fournisseur?.nom}</td>
                <td>{c.montant.toLocaleString()} FCFA</td>
                <td>{new Date(c.dateCommande).toLocaleDateString('fr-FR')}</td>
                <td>
                  <Badge bg={c.recuFournisseurDate ? 'success' : 'secondary'}>{c.recuFournisseurDate ? 'Transmis' : 'En attente'}</Badge>
                </td>
                <td>
                  <Badge bg={statutColor[c.statut] || 'secondary'}>{c.statut}</Badge>
                </td>
                <td className="text-end d-print-none">
                  <div className="d-flex gap-2 justify-content-end flex-wrap">
                    <Button variant="outline-primary" size="sm" onClick={() => router.push(`/commandes/${c._id}`)}>
                      Voir
                    </Button>
                    {canDelete && c.statut === 'COMMANDE_FOURNISSEUR' && (
                      <Button variant="outline-danger" size="sm" onClick={() => handleDelete(c._id)}>
                        Supprimer
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Layout>
  );
}

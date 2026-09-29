import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Table, Button, Badge, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Decaissement {
  _id: string;
  code: string;
  montant: number;
  commande?: { _id: string; code: string; statut: string };
  chantier?: { code: string };
  beneficiaire: string;
  statut: string;
  date: string;
  utilisateurAutorisateur?: { firstName: string; lastName: string };
  utilisateurReceptionnaire?: { _id: string; firstName: string; lastName: string };
}

const statutColor: Record<string, string> = { Autorisé: 'warning', Remis: 'info', Payé: 'success' };

export default function Decaissements() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [decaissements, setDecaissements] = useState<Decaissement[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    const token = localStorage.getItem('easy_batiment_token');
    if (token) {
      fetch('/api/decaissements', { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Erreur');
          if (!Array.isArray(json)) throw new Error('Format invalide');
          setDecaissements(json);
        })
        .catch(() => setError('Impossible de charger les décaissements'));
    }
  }, [isAuthenticated, loading, router]);

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  const perms = user?.permissions || [];
  const isAdmin = perms.includes('admin.all');
  const canCreate = isAdmin || perms.includes('decaissement.create');
  const canPay = isAdmin || perms.includes('paiement.create');

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Décaissements</h1>
        <div className="d-flex gap-2">
          <PrintButton />
          {canCreate && (
            <Link href="/decaissements/new" passHref>
              <Button variant="primary">Autoriser des fonds</Button>
            </Link>
          )}
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {decaissements === null && !error ? (
        <Spinner animation="border" />
      ) : !decaissements?.length ? (
        <Alert variant="info">Aucun décaissement.</Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Code</th>
              <th>Commande</th>
              <th>Chantier</th>
              <th>Montant</th>
              <th>Bénéficiaire</th>
              <th>Autorisé par</th>
              <th>Remis à</th>
              <th>Statut</th>
              <th className="text-end">Action</th>
            </tr>
          </thead>
          <tbody>
            {decaissements.map((d) => {
              const payable =
                canPay &&
                d.statut !== 'Payé' &&
                d.commande?.statut === 'RECEPTION_RC' &&
                (isAdmin || d.utilisateurReceptionnaire?._id === user?.id);
              return (
                <tr key={d._id}>
                  <td>{d.code}</td>
                  <td>{d.commande ? <Link href={`/commandes/${d.commande._id}`}>{d.commande.code}</Link> : '—'}</td>
                  <td>{d.chantier?.code}</td>
                  <td>{d.montant.toLocaleString()} FCFA</td>
                  <td>{d.beneficiaire}</td>
                  <td>{d.utilisateurAutorisateur ? `${d.utilisateurAutorisateur.firstName} ${d.utilisateurAutorisateur.lastName}` : '—'}</td>
                  <td>{d.utilisateurReceptionnaire ? `${d.utilisateurReceptionnaire.firstName} ${d.utilisateurReceptionnaire.lastName}` : '—'}</td>
                  <td>
                    <Badge bg={statutColor[d.statut] || 'secondary'}>{d.statut}</Badge>
                  </td>
                  <td className="text-end">
                    {payable && (
                      <Button size="sm" variant="danger" onClick={() => router.push(`/paiements/new?decaissement=${d._id}`)}>
                        Payer
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Layout>
  );
}

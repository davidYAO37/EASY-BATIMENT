import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Table, Row, Col, Badge } from 'react-bootstrap';
import PrintLayout from '@/components/print/PrintLayout';

interface Paiement {
  code: string;
  datePaiement: string;
  montant: number;
  modePaiement: string;
  statut: string;
  chantier?: { code: string; nom: string };
  commande?: { code: string };
  fournisseur?: { nom: string };
  effectuePar?: { firstName: string; lastName: string };
  recuPhysiqueDate?: string;
}

export default function PaiementPrintPage() {
  const router = useRouter();
  const { id } = router.query;
  const [paiement, setPaiement] = useState<Paiement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('easy_batiment_token');
    fetch(`/api/paiements/${id}`, { headers: { Authorization: `Bearer ${token || ''}` } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur');
        setPaiement(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <PrintLayout title={`Reçu de paiement ${paiement?.code || ''}`} loading={loading} error={error}>
      {paiement && (
        <>
          <header className="text-center border-bottom pb-3 mb-4">
            <h1 className="h3 mb-1">Reçu de paiement</h1>
            <p className="text-muted mb-0">{paiement.code}</p>
            <Badge bg="success" className="mt-2 fs-6">
              {paiement.statut}
            </Badge>
          </header>

          <Row className="mb-4">
            <Col md={6} className="mb-3">
              <h5 className="text-uppercase text-muted small fw-bold">Payeur</h5>
              <p className="mb-0 fw-semibold">
                {paiement.effectuePar ? `${paiement.effectuePar.firstName} ${paiement.effectuePar.lastName}` : '—'}
              </p>
            </Col>
            <Col md={6} className="mb-3">
              <h5 className="text-uppercase text-muted small fw-bold">Bénéficiaire</h5>
              <p className="mb-0 fw-semibold">{paiement.fournisseur?.nom || '—'}</p>
            </Col>
          </Row>

          <Table bordered className="mb-4">
            <tbody>
              <tr>
                <th>Date de paiement</th>
                <td>{new Date(paiement.datePaiement).toLocaleDateString('fr-FR')}</td>
              </tr>
              <tr>
                <th>Mode de paiement</th>
                <td>{paiement.modePaiement}</td>
              </tr>
              <tr>
                <th>Commande</th>
                <td>{paiement.commande?.code || '—'}</td>
              </tr>
              <tr>
                <th>Chantier</th>
                <td>{paiement.chantier ? `${paiement.chantier.code} - ${paiement.chantier.nom}` : '—'}</td>
              </tr>
              <tr>
                <th>Montant</th>
                <td className="fw-bold">{paiement.montant.toLocaleString()} FCFA</td>
              </tr>
              <tr>
                <th>Reçu physique transmis le</th>
                <td>{paiement.recuPhysiqueDate ? new Date(paiement.recuPhysiqueDate).toLocaleDateString('fr-FR') : '—'}</td>
              </tr>
            </tbody>
          </Table>

          <div className="text-center mt-5 pt-4">
            <p className="small mb-5">Signature du réceptionniste chantier</p>
            <div className="border-top mx-auto" style={{ width: '60%' }} />
          </div>
        </>
      )}
    </PrintLayout>
  );
}

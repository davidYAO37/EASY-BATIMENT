import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Table, Row, Col, Badge } from 'react-bootstrap';
import PrintLayout from '@/components/print/PrintLayout';

interface Article {
  article?: { nom: string; unite: string };
  designation?: string;
  quantite: number;
  prixUnitaire: number;
  total: number;
}

interface Commande {
  code: string;
  dateCommande: string;
  statut: string;
  montant: number;
  modePaiement: string;
  chantier?: { code: string; nom: string; localisation?: string };
  fournisseur?: { nom: string; contact?: string; phone?: string };
  demandeAchat?: { code: string };
  articles: Article[];
}

export default function CommandePrintPage() {
  const router = useRouter();
  const { id } = router.query;
  const [commande, setCommande] = useState<Commande | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('easy_batiment_token');
    fetch(`/api/commandes/${id}`, { headers: { Authorization: `Bearer ${token || ''}` } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur');
        setCommande(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, [id]);

  const total = commande?.articles.reduce((acc, a) => acc + (a.total || a.quantite * a.prixUnitaire), 0) ?? 0;

  return (
    <PrintLayout title={`Bon de commande ${commande?.code || ''}`} loading={loading} error={error}>
      {commande && (
        <>
          <header className="d-flex justify-content-between align-items-start border-bottom pb-3 mb-4">
            <div>
              <h1 className="h3 mb-1">Bon de commande</h1>
              <p className="mb-0 text-muted">{commande.code}</p>
            </div>
            <Badge bg="secondary" className="fs-6">
              {commande.statut}
            </Badge>
          </header>

          <Row className="mb-4">
            <Col md={6} className="mb-3">
              <h5 className="text-uppercase text-muted small fw-bold">Fournisseur</h5>
              <p className="mb-1 fw-semibold">{commande.fournisseur?.nom || '—'}</p>
              <p className="mb-1 small">{commande.fournisseur?.contact || ''}</p>
              <p className="mb-0 small">{commande.fournisseur?.phone || ''}</p>
            </Col>
            <Col md={6} className="mb-3">
              <h5 className="text-uppercase text-muted small fw-bold">Chantier</h5>
              <p className="mb-1 fw-semibold">{commande.chantier?.nom || '—'}</p>
              <p className="mb-1 small">Code : {commande.chantier?.code || '—'}</p>
              <p className="mb-0 small">{commande.chantier?.localisation || ''}</p>
            </Col>
          </Row>

          <Row className="mb-4">
            <Col md={6} className="mb-3">
              <p className="mb-1 small">
                <strong>Date de commande :</strong>{' '}
                {new Date(commande.dateCommande).toLocaleDateString('fr-FR')}
              </p>
              <p className="mb-0 small">
                <strong>Mode de paiement :</strong> {commande.modePaiement}
              </p>
            </Col>
            <Col md={6} className="mb-3">
              <p className="mb-0 small">
                <strong>Demande d&apos;achat :</strong> {commande.demandeAchat?.code || '—'}
              </p>
            </Col>
          </Row>

          <h5 className="text-uppercase text-muted small fw-bold mb-3">Articles</h5>
          <Table bordered responsive className="mb-4">
            <thead>
              <tr>
                <th>#</th>
                <th>Article</th>
                <th>Qté</th>
                <th>Prix unitaire</th>
                <th className="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              {commande.articles.map((a, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>{a.article?.nom || a.designation || '—'}</td>
                  <td>
                    {a.quantite} {a.article?.unite || ''}
                  </td>
                  <td>{a.prixUnitaire.toLocaleString()} FCFA</td>
                  <td className="text-end">{a.total.toLocaleString()} FCFA</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={4} className="text-end">
                  Total
                </th>
                <th className="text-end">{total.toLocaleString()} FCFA</th>
              </tr>
            </tfoot>
          </Table>

          <Row className="mt-5 pt-5">
            <Col xs={6} className="text-center">
              <p className="mb-5 small">Signature du responsable</p>
              <div className="border-top mx-auto" style={{ width: '80%' }} />
            </Col>
            <Col xs={6} className="text-center">
              <p className="mb-5 small">Signature fournisseur</p>
              <div className="border-top mx-auto" style={{ width: '80%' }} />
            </Col>
          </Row>
        </>
      )}
    </PrintLayout>
  );
}

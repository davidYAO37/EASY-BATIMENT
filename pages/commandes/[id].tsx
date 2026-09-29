import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Card, Badge, Button, Form, Alert, Spinner, ListGroup, Row, Col } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';
import { ReceiptUpload, ReceiptPreview } from '@/components/Receipt';

interface Personne {
  firstName: string;
  lastName: string;
}

interface CommandeDetail {
  _id: string;
  code: string;
  statut: string;
  montant: number;
  dateCommande: string;
  datePrevueLivraison?: string;
  modePaiement: string;
  chantier?: { code: string; nom: string };
  fournisseur?: { _id: string; nom: string; contact?: string; phone?: string };
  demandeAchat?: { _id: string; code: string };
  articles: { article?: { nom: string; unite: string }; quantite: number; prixUnitaire: number; total: number }[];
  createdBy?: Personne;
  recuFournisseur?: string;
  recuFournisseurDate?: string;
  recuFournisseurPar?: Personne;
  decaissement?: {
    code: string;
    montant: number;
    statut: string;
    utilisateurAutorisateur?: Personne;
    utilisateurReceptionnaire?: Personne;
  } | null;
  paiements?: {
    _id: string;
    code: string;
    montant: number;
    datePaiement: string;
    modePaiement: string;
    recuFournisseur?: string;
    recuPhysique?: string;
    statut: string;
    effectuePar?: Personne;
  }[];
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

const statutLabel: Record<string, string> = {
  COMMANDE_FOURNISSEUR: 'Commandée chez le fournisseur',
  LIVRAISON: 'En livraison',
  RECEPTION_RC: 'Réceptionnée — en attente de paiement',
  PAIEMENT: 'Payée — justificatifs attendus',
  JUSTIFICATIFS: 'Justificatifs complets — à contrôler',
  CONTROLE_ADMIN: 'En contrôle',
  CLOTURE: 'Clôturée',
  ANOMALIE: 'Anomalie',
};

const RB_STATUTS = ['COMMANDE_FOURNISSEUR', 'LIVRAISON', 'RECEPTION_RC', 'PAIEMENT'];

const nom = (p?: Personne) => (p ? `${p.firstName} ${p.lastName}` : '—');

export default function CommandeDetailPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [commande, setCommande] = useState<CommandeDetail | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [recuFournisseur, setRecuFournisseur] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const permissions = user?.permissions || [];
  const isAdmin = permissions.includes('admin.all');
  const canUploadRecuFournisseur = isAdmin || permissions.includes('commande.update');

  const load = useCallback(() => {
    if (!id) return;
    const token = localStorage.getItem('easy_batiment_token');
    fetch(`/api/commandes/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur');
        setCommande(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger la commande'));
  }, [id]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) load();
  }, [isAuthenticated, loading, router, load]);

  async function post(url: string, body: unknown, message: string) {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const token = localStorage.getItem('easy_batiment_token');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setSuccess(message);
      load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      return false;
    } finally {
      setActionLoading(false);
    }
  }

  async function envoyerRecuFournisseur() {
    if (await post(`/api/commandes/${id}/recu-fournisseur`, { recuFournisseur }, 'Reçu fournisseur transmis à l’administrateur')) {
      setRecuFournisseur('');
    }
  }

  async function doControl(action: 'VALIDER' | 'ANOMALIE') {
    if (await post(`/api/commandes/${id}/controle`, { action, commentaire }, action === 'VALIDER' ? 'Dépense clôturée' : 'Anomalie enregistrée')) {
      setCommentaire('');
    }
  }

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  if (!commande) {
    return <Layout>{error ? <Alert variant="danger">{error}</Alert> : <Spinner animation="border" />}</Layout>;
  }

  const paiement = commande.paiements?.[0];
  const recuF = commande.recuFournisseur || paiement?.recuFournisseur;
  const ecart = paiement ? paiement.montant - commande.montant : 0;
  const checks = [
    { label: 'Reçu fournisseur transmis (RB)', ok: Boolean(recuF) },
    { label: 'Reçu physique transmis (RC)', ok: Boolean(paiement?.recuPhysique) },
    { label: `Montant payé = montant commande${paiement && ecart !== 0 ? ` (écart ${ecart.toLocaleString()} FCFA)` : ''}`, ok: Boolean(paiement) && ecart === 0 },
  ];
  const conforme = checks.every((c) => c.ok);
  const showControl = isAdmin && ['JUSTIFICATIFS', 'CONTROLE_ADMIN'].includes(commande.statut);
  const showRecuFournisseur = canUploadRecuFournisseur && RB_STATUTS.includes(commande.statut);

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Commande {commande.code}</h1>
        <div className="d-flex gap-2 flex-wrap">
          <PrintButton />
          <Button
            as="a"
            href={`/commandes/${commande._id}/print`}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline-primary"
            size="sm"
          >
            Bon de commande
          </Button>
          <Button variant="outline-secondary" size="sm" onClick={() => router.back()}>
            Retour
          </Button>
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Row className="g-4">
        <Col lg={8}>
          <Card className="mb-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
                <div>
                  <Card.Title className="mb-1">
                    {commande.chantier?.code} — {commande.chantier?.nom}
                  </Card.Title>
                  <Card.Subtitle className="text-muted">
                    Fournisseur : {commande.fournisseur?.nom} {commande.fournisseur?.phone && `(${commande.fournisseur.phone})`}
                  </Card.Subtitle>
                </div>
                <Badge bg={statutColor[commande.statut] || 'secondary'} className="fs-6">
                  {statutLabel[commande.statut] || commande.statut}
                </Badge>
              </div>

              <Row>
                <Col md={6}>
                  <p className="mb-1"><strong>Demande :</strong>{' '}
                    {commande.demandeAchat ? <Link href={`/demandes-achat/${commande.demandeAchat._id}`}>{commande.demandeAchat.code}</Link> : '—'}
                  </p>
                  <p className="mb-1"><strong>Montant :</strong> {commande.montant.toLocaleString()} FCFA</p>
                  <p className="mb-1"><strong>Mode de paiement :</strong> {commande.modePaiement}</p>
                </Col>
                <Col md={6}>
                  <p className="mb-1"><strong>Date de commande :</strong> {new Date(commande.dateCommande).toLocaleDateString('fr-FR')}</p>
                  {commande.datePrevueLivraison && (
                    <p className="mb-1"><strong>Livraison prévue :</strong> {new Date(commande.datePrevueLivraison).toLocaleDateString('fr-FR')}</p>
                  )}
                  <p className="mb-1"><strong>Générée par :</strong> {nom(commande.createdBy)}</p>
                </Col>
              </Row>

              <h5 className="mt-4">Articles</h5>
              <ListGroup variant="flush">
                {commande.articles.map((l, i) => (
                  <ListGroup.Item key={i} className="d-flex justify-content-between flex-wrap">
                    <span>{l.article?.nom} — {l.quantite} {l.article?.unite}</span>
                    <span>{l.prixUnitaire.toLocaleString()} FCFA × {l.quantite} = {l.total.toLocaleString()} FCFA</span>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header>Finances</Card.Header>
            <Card.Body>
              {commande.decaissement ? (
                <p className="mb-2">
                  <strong>Décaissement {commande.decaissement.code}</strong> — {commande.decaissement.montant.toLocaleString()} FCFA{' '}
                  <Badge bg={commande.decaissement.statut === 'Payé' ? 'success' : 'warning'}>{commande.decaissement.statut}</Badge>
                  <br />
                  <span className="text-muted small">
                    Autorisé par {nom(commande.decaissement.utilisateurAutorisateur)} — remis à {nom(commande.decaissement.utilisateurReceptionnaire)}
                  </span>
                </p>
              ) : commande.statut === 'RECEPTION_RC' ? (
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <span className="text-muted">Aucun décaissement autorisé : le RC ne peut pas encore payer.</span>
                  {isAdmin && (
                    <Link href={`/decaissements/new?commande=${commande._id}`} passHref>
                      <Button variant="danger" size="sm">Autoriser les fonds</Button>
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-muted mb-0">Aucun décaissement.</p>
              )}
              {paiement && (
                <p className="mb-0 mt-2">
                  <strong>Paiement {paiement.code}</strong> — {paiement.montant.toLocaleString()} FCFA ({paiement.modePaiement}) le{' '}
                  {new Date(paiement.datePaiement).toLocaleDateString('fr-FR')} par {nom(paiement.effectuePar)}
                </p>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="mb-4">
            <Card.Header>Justificatifs</Card.Header>
            <ListGroup variant="flush">
              <ListGroup.Item>
                <div className="fw-bold mb-1">Reçu fournisseur (RB)</div>
                <ReceiptPreview src={recuF} alt="Reçu fournisseur" />
                {commande.recuFournisseurDate && (
                  <div className="text-muted small mt-1">
                    Transmis le {new Date(commande.recuFournisseurDate).toLocaleString('fr-FR')} par {nom(commande.recuFournisseurPar)}
                  </div>
                )}
              </ListGroup.Item>
              <ListGroup.Item>
                <div className="fw-bold mb-1">Reçu physique (RC)</div>
                <ReceiptPreview src={paiement?.recuPhysique} alt="Reçu physique" />
              </ListGroup.Item>
            </ListGroup>
          </Card>

          {showRecuFournisseur && (
            <Card className="mb-4 border-info">
              <Card.Header>{recuF ? 'Remplacer le reçu fournisseur' : 'Transmettre le reçu fournisseur'}</Card.Header>
              <Card.Body>
                <ReceiptUpload
                  controlId="recuFournisseur"
                  label="Image du reçu envoyée par le fournisseur"
                  value={recuFournisseur}
                  onChange={setRecuFournisseur}
                />
                <Button variant="info" onClick={envoyerRecuFournisseur} disabled={!recuFournisseur || actionLoading}>
                  {actionLoading ? <Spinner size="sm" /> : "Transmettre à l'administrateur"}
                </Button>
              </Card.Body>
            </Card>
          )}

          {showControl && (
            <Card className={conforme ? 'border-success' : 'border-danger'}>
              <Card.Header>Contrôle administrateur</Card.Header>
              <Card.Body>
                <ListGroup variant="flush" className="mb-3">
                  {checks.map((c) => (
                    <ListGroup.Item key={c.label} className="d-flex justify-content-between px-0">
                      <span className="small">{c.label}</span>
                      <Badge bg={c.ok ? 'success' : 'danger'}>{c.ok ? 'OK' : 'Non'}</Badge>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
                <Form.Group className="mb-3" controlId="commentaire">
                  <Form.Label>Commentaire</Form.Label>
                  <Form.Control as="textarea" rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
                </Form.Group>
                <div className="d-flex gap-2 flex-wrap">
                  <Button variant="success" onClick={() => doControl('VALIDER')} disabled={actionLoading || !conforme}>
                    {actionLoading ? <Spinner size="sm" /> : 'Valider la clôture'}
                  </Button>
                  <Button variant="danger" onClick={() => doControl('ANOMALIE')} disabled={actionLoading || !commentaire.trim()}>
                    {actionLoading ? <Spinner size="sm" /> : 'Marquer anomalie'}
                  </Button>
                </div>
                {!commentaire.trim() && <Form.Text className="text-muted">Un commentaire est requis pour signaler une anomalie.</Form.Text>}
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Layout>
  );
}

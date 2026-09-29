import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Card, Badge, Button, Form, Alert, Spinner, ListGroup, Row, Col } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Article { _id: string; nom: string; unite: string; }
interface Fournisseur { _id: string; nom: string; }

interface DemandeDetail {
  _id: string;
  code: string;
  statut: string;
  urgence: string;
  observation?: string;
  chantier?: { code: string; nom: string };
  fournisseur?: { _id: string; nom: string } | null;
  fournisseurSouhaite?: string;
  articles: {
    article: { _id?: string; nom: string; unite: string };
    quantite: number;
    prixEstimatif: number;
    observation?: string;
    priorite?: boolean;
    commande?: { _id: string; code: string } | string | null;
  }[];
  createdBy?: { _id?: string; firstName: string; lastName: string };
  createdAt: string;
  dateSouhaitee?: string;
}

interface EditArticle {
  article: { _id?: string; nom: string; unite: string } | string;
  quantite: number;
  prixEstimatif: number;
  observation?: string;
  priorite?: boolean;
  commande?: { _id: string; code: string } | string | null;
}

interface EditForm {
  fournisseur?: { _id: string; nom: string } | string | null;
  fournisseurSouhaite?: string;
  urgence: string;
  observation?: string;
  dateSouhaitee?: string;
  articles: EditArticle[];
}

export default function DemandeAchatDetail() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [demande, setDemande] = useState<DemandeDetail | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [fournisseur, setFournisseur] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({ urgence: 'Normale', articles: [] });

  const [selection, setSelection] = useState<number[]>([]);

  const isAdmin = user?.permissions?.includes('admin.all') || false;
  const isRB = user?.roleCode === 'RECEPTION_BUREAU';
  const isOwner = String(demande?.createdBy?._id || '') === user?.id;
  const preRecu = ['CREATION', 'SOUMIS', 'DEMANDE_MODIF'].includes(demande?.statut || '');
  const commandable = ['RECU_RB', 'COMMANDE_PARTIELLE', 'EN_VALIDATION_ADMIN'].includes(demande?.statut || '');
  const canUpdate = isAdmin || user?.permissions?.includes('demandeAchat.update') || false;
  const canValidate = isAdmin || user?.permissions?.includes('demandeAchat.validate') || false;
  const canDelete = isAdmin || user?.permissions?.includes('demandeAchat.delete') || false;
  const canCommande = isAdmin || user?.permissions?.includes('commande.create') || false;
  const canEdit =
    (canValidate && demande?.statut === 'EN_VALIDATION_ADMIN') ||
    (isOwner && preRecu && canUpdate) ||
    (canUpdate && ['RECU_RB', 'COMMANDE_PARTIELLE'].includes(demande?.statut || ''));
  const canDeleteDemand = (isOwner || isAdmin) && preRecu && canDelete;
  const lignesRestantes = (demande?.articles || []).filter((l) => !l.commande).length;

  const token = typeof window !== 'undefined' ? localStorage.getItem('easy_batiment_token') : null;

  function syncSelection(d: DemandeDetail) {
    setSelection(
      (d.articles || [])
        .map((l, i) => (l.priorite && !l.commande ? i : -1))
        .filter((i) => i >= 0)
    );
  }

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    fetch(`/api/demandes-achat/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur');
        const d = { ...json, articles: json.articles || [] };
        setDemande(d);
        setFournisseur(d.fournisseur?._id || '');
        setEditForm(d);
        syncSelection(d);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger la demande'));

    fetch('/api/articles', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((json) => { if (Array.isArray(json)) setArticles(json); })
      .catch(() => {});

    if (canEdit || (canCommande && commandable)) {
      fetch('/api/fournisseurs', { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Erreur');
          if (Array.isArray(json)) setFournisseurs(json);
        })
        .catch(() => {});
    }
  }, [id, isAuthenticated, token, canEdit, canCommande, commandable]);

  async function doAction(action: string, lignes?: number[]) {
    setActionLoading(action);
    setError('');
    setSuccess('');
    try {
      const body: Record<string, unknown> = { action, commentaire };
      if ((action === 'VALIDER' || action === 'COMMANDER') && !demande?.fournisseur?._id) {
        body.fournisseur = fournisseur;
      }
      if (action === 'COMMANDER' && lignes?.length) {
        body.lignes = lignes;
      }
      const res = await fetch(`/api/demandes-achat/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setCommentaire('');
      setSuccess(`Demande ${data.code} validée. ${data.commande ? `Commande ${data.commande} générée automatiquement.` : ''}`);
      const refreshed = await fetch(`/api/demandes-achat/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
      const d = { ...refreshed, articles: refreshed.articles || [] };
      setDemande(d);
      setEditForm(d);
      setFournisseur(d.fournisseur?._id || '');
      syncSelection(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setActionLoading('');
    }
  }

  async function handleSave() {
    setActionLoading('save');
    setError('');
    setSuccess('');
    try {
      const payload: Record<string, unknown> = {
        fournisseur: (editForm.fournisseur && typeof editForm.fournisseur === 'object' ? editForm.fournisseur._id : editForm.fournisseur) || fournisseur || undefined,
        fournisseurSouhaite: editForm.fournisseurSouhaite,
        urgence: editForm.urgence,
        observation: editForm.observation,
        dateSouhaitee: editForm.dateSouhaitee ? new Date(editForm.dateSouhaitee).toISOString() : undefined,
        articles: (editForm.articles || []).map((l: EditArticle) => ({
          article: typeof l.article === 'string' ? l.article : l.article._id,
          quantite: Number(l.quantite),
          prixEstimatif: Number(l.prixEstimatif),
          observation: l.observation || '',
          priorite: !!l.priorite,
        })),
      };
      const res = await fetch(`/api/demandes-achat/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setSuccess('Demande modifiée avec succès.');
      setIsEditing(false);
      const d = { ...data, articles: data.articles || [] };
      setDemande(d);
      setEditForm(d);
      setFournisseur(d.fournisseur?._id || '');
      syncSelection(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setActionLoading('');
    }
  }

  async function savePriorites() {
    if (!demande) return;
    setActionLoading('priorites');
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/demandes-achat/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          articles: (demande.articles || []).map((l, i) => ({
            article: l.article._id,
            quantite: l.quantite,
            prixEstimatif: l.prixEstimatif,
            observation: l.observation || '',
            priorite: selection.includes(i),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setSuccess('Priorités enregistrées.');
      const d = { ...data, articles: data.articles || [] };
      setDemande(d);
      setEditForm(d);
      syncSelection(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setActionLoading('');
    }
  }

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  if (!demande) return (
    <Layout>
      {error ? <Alert variant="danger">{error}</Alert> : <Spinner animation="border" />}
    </Layout>
  );

  const actions: Record<string, string[]> = {
    SOUMIS: ['RECEVOIR'],
    RECU_RB: ['TRANSMETTRE_ADMIN', 'COMMANDER'],
    COMMANDE_PARTIELLE: ['COMMANDER', 'VALIDER'],
    EN_VALIDATION_ADMIN: ['VALIDER', 'COMMANDER', 'REFUSER', 'DEMANDER_MODIFICATION'],
    DEMANDE_MODIF: ['SOUMETTRE'],
  };

  const actionLabels: Record<string, string> = {
    RECEVOIR: 'Réceptionner le bon',
    TRANSMETTRE_ADMIN: 'Transmettre à l&apos;administrateur',
    COMMANDER: 'Générer la commande des lignes cochées',
    VALIDER: 'Commander toutes les lignes restantes',
    REFUSER: 'Refuser',
    DEMANDER_MODIFICATION: 'Demander modification',
    SOUMETTRE: 'Resoumettre',
  };

  const statutColor: Record<string, string> = {
    CREATION: 'light', SOUMIS: 'info', RECU_RB: 'primary',
    EN_VALIDATION_ADMIN: 'warning', FINANCE_AUTORISEE: 'success', REFUSE: 'danger',
    DEMANDE_MODIF: 'secondary', COMMANDE_PARTIELLE: 'info',
  };

  const statutLabel: Record<string, string> = { COMMANDE_PARTIELLE: 'Commande partielle' };

  const enValidation = demande.statut === 'EN_VALIDATION_ADMIN';
  const besoinFournisseur = commandable && !demande.fournisseur?._id;
  const showFournisseur = besoinFournisseur && (canCommande || canValidate);

  function updateLigne(idx: number, field: keyof EditArticle, value: string) {
    const lignes = [...(editForm.articles || [])];
    if (field === 'article') {
      const a = articles.find((x) => x._id === value);
      lignes[idx].article = a || value;
    } else if (field === 'quantite' || field === 'prixEstimatif') {
      lignes[idx][field] = Number(value);
    } else if (field === 'observation') {
      lignes[idx][field] = value;
    }
    setEditForm({ ...editForm, articles: lignes });
  }

  function addLigne() {
    const lignes = [...(editForm.articles || []), { article: '', quantite: 1, prixEstimatif: 0, observation: '' }];
    setEditForm({ ...editForm, articles: lignes });
  }

  function removeLigne(idx: number) {
    const lignes = [...(editForm.articles || [])];
    lignes.splice(idx, 1);
    setEditForm({ ...editForm, articles: lignes });
  }

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Demande {demande.code}</h1>
        <PrintButton />
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      <Card className="mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between">
            <div>
              <Card.Title>Chantier : {demande.chantier?.code} - {demande.chantier?.nom}</Card.Title>
              <Card.Subtitle className="mb-2 text-muted">
                Créé par {demande.createdBy?.firstName} {demande.createdBy?.lastName} le {new Date(demande.createdAt).toLocaleString('fr-FR')}
              </Card.Subtitle>
            </div>
            <Badge bg={statutColor[demande.statut] || 'secondary'} className="fs-6">
              {statutLabel[demande.statut] || demande.statut}
            </Badge>
          </div>

          {isEditing ? (
            <Row className="mt-3 g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Fournisseur du catalogue</Form.Label>
                  <Form.Select value={fournisseur} onChange={(e) => { setFournisseur(e.target.value); setEditForm({ ...editForm, fournisseur: e.target.value }); }}>
                    <option value="">Choisir...</option>
                    {fournisseurs.map((f) => (
                      <option key={f._id} value={f._id}>{f.nom}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Fournisseur souhaité (libre)</Form.Label>
                  <Form.Control value={editForm.fournisseurSouhaite || ''} onChange={(e) => setEditForm({ ...editForm, fournisseurSouhaite: e.target.value })} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Urgence</Form.Label>
                  <Form.Select value={editForm.urgence} onChange={(e) => setEditForm({ ...editForm, urgence: e.target.value })}>
                    <option>Basse</option>
                    <option>Normale</option>
                    <option>Haute</option>
                    <option>Critique</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Date souhaitée</Form.Label>
                  <Form.Control type="date" value={editForm.dateSouhaitee ? new Date(editForm.dateSouhaitee).toISOString().split('T')[0] : ''} onChange={(e) => setEditForm({ ...editForm, dateSouhaitee: e.target.value })} />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Observation</Form.Label>
                  <Form.Control as="textarea" rows={2} value={editForm.observation || ''} onChange={(e) => setEditForm({ ...editForm, observation: e.target.value })} />
                </Form.Group>
              </Col>
            </Row>
          ) : (
            <Row className="mt-3">
              <Col md={6}>
                <p><strong>Urgence :</strong> {demande.urgence}</p>
                <p><strong>Observation :</strong> {demande.observation || '—'}</p>
              </Col>
              <Col md={6}>
                <p><strong>Fournisseur :</strong> {demande.fournisseur?.nom || demande.fournisseurSouhaite || '—'}</p>
                <p><strong>Montant estimé :</strong> {(demande.articles || []).reduce((acc, l) => acc + l.quantite * l.prixEstimatif, 0).toLocaleString()} FCFA</p>
              </Col>
            </Row>
          )}

          <h5 className="mt-4">Articles</h5>
          {isEditing ? (
            <>
              <Row className="g-2 mb-2 fw-bold text-muted small">
                <Col md={4}>Article</Col>
                <Col md={2}>Quantité</Col>
                <Col md={2}>Prix unit. estimé (FCFA)</Col>
                <Col md={3}>Observation</Col>
                <Col md={1} />
              </Row>
              {(editForm.articles || []).map((l: EditArticle, i: number) =>
                l.commande ? (
                  <Row key={i} className="g-2 mb-2 align-items-center bg-light rounded">
                    <Col md={4}>
                      <Form.Control plaintext readOnly defaultValue={typeof l.article === 'string' ? l.article : `${l.article.nom} (${l.article.unite})`} />
                    </Col>
                    <Col md={2}><Form.Control plaintext readOnly defaultValue={l.quantite} /></Col>
                    <Col md={2}><Form.Control plaintext readOnly defaultValue={l.prixEstimatif} /></Col>
                    <Col md={3}><Form.Control plaintext readOnly defaultValue={l.observation || ''} /></Col>
                    <Col md={1}>
                      <Badge bg="success">
                        {typeof l.commande === 'object' ? l.commande.code : 'Commandée'}
                      </Badge>
                    </Col>
                  </Row>
                ) : (
                  <Row key={i} className="g-2 mb-2 align-items-end">
                    <Col md={4}>
                      <Form.Select value={typeof l.article === 'string' ? l.article : l.article._id} onChange={(e) => updateLigne(i, 'article', e.target.value)}>
                        <option value="">Article...</option>
                        {articles.map((a) => (
                          <option key={a._id} value={a._id}>{a.nom} ({a.unite})</option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col md={2}>
                      <Form.Control type="number" value={l.quantite} onChange={(e) => updateLigne(i, 'quantite', e.target.value)} placeholder="Qté" />
                    </Col>
                    <Col md={2}>
                      <Form.Control type="number" value={l.prixEstimatif} onChange={(e) => updateLigne(i, 'prixEstimatif', e.target.value)} placeholder="Prix" />
                    </Col>
                    <Col md={3}>
                      <Form.Control value={l.observation || ''} onChange={(e) => updateLigne(i, 'observation', e.target.value)} placeholder="Observation" />
                    </Col>
                    <Col md={1}>
                      <Button variant="outline-danger" size="sm" onClick={() => removeLigne(i)}>X</Button>
                    </Col>
                  </Row>
                )
              )}
              <Button variant="secondary" size="sm" onClick={addLigne} className="mb-3">Ajouter un article</Button>
            </>
          ) : (
            <ListGroup variant="flush">
              {(demande.articles || []).map((l, i) => {
                const commandeObj = l.commande && typeof l.commande === 'object' ? l.commande : null;
                return (
                  <ListGroup.Item key={i} className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <span className="d-flex align-items-center gap-2">
                      {commandable && !l.commande && canCommande && (
                        <Form.Check
                          aria-label="Sélectionner pour la commande"
                          checked={selection.includes(i)}
                          onChange={(e) =>
                            setSelection(
                              e.target.checked ? [...selection, i] : selection.filter((x) => x !== i)
                            )
                          }
                        />
                      )}
                      <span>{l.article.nom} — {l.quantite} {l.article.unite}</span>
                      {l.priorite && !l.commande && <Badge bg="warning" text="dark">Prioritaire</Badge>}
                    </span>
                    <span className="d-flex align-items-center gap-2">
                      <span>{l.prixEstimatif.toLocaleString()} FCFA / unité</span>
                      {l.commande && (
                        <Link href={`/commandes/${commandeObj?._id || l.commande}`} passHref legacyBehavior>
                          <Badge as="a" bg="success" className="text-decoration-none">
                            Commandée {commandeObj?.code || ''}
                          </Badge>
                        </Link>
                      )}
                    </span>
                  </ListGroup.Item>
                );
              })}
            </ListGroup>
          )}
        </Card.Body>
      </Card>

      {actions[demande.statut] && (
        <Card>
          <Card.Body>
            {showFournisseur && (
              <Form.Group className="mb-3" controlId="fournisseur">
                <Form.Label>Fournisseur du catalogue (obligatoire pour générer la commande)</Form.Label>
                <Form.Select value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} required>
                  <option value="">Choisir...</option>
                  {fournisseurs.map((f) => (
                    <option key={f._id} value={f._id}>{f.nom}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}

            {canEdit && !isEditing && (
              <div className="mb-3">
                <Button variant="outline-secondary" onClick={() => setIsEditing(true)}>
                  {enValidation ? 'Modifier la demande avant validation' : 'Modifier la demande'}
                </Button>
              </div>
            )}

            {canDeleteDemand && !isEditing && (
              <div className="mb-3">
                <Button variant="outline-danger" onClick={async () => {
                  if (!confirm('Supprimer cette demande ?')) return;
                  setActionLoading('delete');
                  try {
                    const token = typeof window !== 'undefined' ? localStorage.getItem('easy_batiment_token') : null;
                    const res = await fetch(`/api/demandes-achat/${id}`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token || ''}` },
                    });
                    if (!res.ok) {
                      const json = await res.json().catch(() => ({}));
                      throw new Error(json.error || 'Erreur');
                    }
                    router.push('/demandes-achat');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Erreur');
                  } finally {
                    setActionLoading('');
                  }
                }} disabled={!!actionLoading}>
                  {actionLoading === 'delete' ? <Spinner size="sm" /> : 'Supprimer la demande'}
                </Button>
              </div>
            )}

            {isEditing && (
              <div className="d-flex gap-2 mb-3">
                <Button variant="success" onClick={handleSave} disabled={actionLoading === 'save'}>
                  {actionLoading === 'save' ? <Spinner size="sm" /> : 'Enregistrer les modifications'}
                </Button>
                <Button variant="outline-secondary" onClick={() => { setIsEditing(false); setEditForm(demande); }}>
                  Annuler
                </Button>
              </div>
            )}

            {!isEditing && (
              <>
                <Form.Group className="mb-3" controlId="commentaire">
                  <Form.Label>Commentaire</Form.Label>
                  <Form.Control as="textarea" rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
                </Form.Group>
                <div className="d-flex gap-2 flex-wrap">
                  {demande.statut === 'SOUMIS' && isRB && (
                    <Button variant="primary" onClick={() => doAction('RECEVOIR')} disabled={!!actionLoading}>
                      {actionLoading === 'RECEVOIR' ? <Spinner size="sm" /> : actionLabels.RECEVOIR}
                    </Button>
                  )}
                  {demande.statut === 'RECU_RB' && isRB && (
                    <Button variant="primary" onClick={() => doAction('TRANSMETTRE_ADMIN')} disabled={!!actionLoading}>
                      {actionLoading === 'TRANSMETTRE_ADMIN' ? <Spinner size="sm" /> : actionLabels.TRANSMETTRE_ADMIN}
                    </Button>
                  )}
                  {commandable && canUpdate && lignesRestantes > 0 && (
                    <Button variant="outline-primary" onClick={savePriorites} disabled={!!actionLoading}>
                      {actionLoading === 'priorites' ? <Spinner size="sm" /> : 'Enregistrer les priorités'}
                    </Button>
                  )}
                  {commandable && canCommande && selection.length > 0 && (
                    <Button
                      variant="primary"
                      onClick={() => doAction('COMMANDER', selection)}
                      disabled={!!actionLoading || (besoinFournisseur && !fournisseur)}
                    >
                      {actionLoading === 'COMMANDER' ? <Spinner size="sm" /> : `${actionLabels.COMMANDER} (${selection.length})`}
                    </Button>
                  )}
                  {(demande.statut === 'EN_VALIDATION_ADMIN' || demande.statut === 'COMMANDE_PARTIELLE') && canValidate && (
                    <>
                      <Button variant="success" onClick={() => doAction('VALIDER')} disabled={!!actionLoading || (besoinFournisseur && !fournisseur)}>
                        {actionLoading === 'VALIDER' ? <Spinner size="sm" /> : actionLabels.VALIDER}
                      </Button>
                      {demande.statut === 'EN_VALIDATION_ADMIN' && (
                        <>
                          <Button variant="danger" onClick={() => doAction('REFUSER')} disabled={!!actionLoading}>
                            {actionLoading === 'REFUSER' ? <Spinner size="sm" /> : actionLabels.REFUSER}
                          </Button>
                          <Button variant="warning" onClick={() => doAction('DEMANDER_MODIFICATION')} disabled={!!actionLoading}>
                            {actionLoading === 'DEMANDER_MODIFICATION' ? <Spinner size="sm" /> : actionLabels.DEMANDER_MODIFICATION}
                          </Button>
                        </>
                      )}
                    </>
                  )}
                  {(demande.statut === 'CREATION' || demande.statut === 'DEMANDE_MODIF') && (isOwner || isAdmin) && (
                    <Button variant="primary" onClick={() => doAction('SOUMETTRE')} disabled={!!actionLoading}>
                      {actionLoading === 'SOUMETTRE' ? <Spinner size="sm" /> : actionLabels.SOUMETTRE}
                    </Button>
                  )}
                </div>
              </>
            )}
          </Card.Body>
        </Card>
      )}
    </Layout>
  );
}

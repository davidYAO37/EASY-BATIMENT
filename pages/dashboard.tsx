import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Row, Col, Card, ListGroup, Badge, Alert, Spinner, Button, Table } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Ref {
  _id: string;
  code: string;
}

interface CommandeRow extends Ref {
  montant: number;
  statut: string;
  chantier?: { code: string };
  fournisseur?: { nom: string };
  recuFournisseurDate?: string;
  montantPaye?: number;
  ecart?: number | null;
  recuFournisseur?: boolean;
  recuPhysique?: boolean;
}

interface DashboardData {
  chantiersActifs: number;
  commandesEnAttente: number;
  commandesValidees: number;
  livraisonsAttendues: number;
  depensesDuMois: number;
  anomalies: number;
  rapportsNonLus: number;
  alertes: {
    validationRequise: number;
    livraisonsPartielles: number;
    justificatifsEcarts: number;
    rapportsNonLus: number;
  };
  files: {
    demandesAValider: (Ref & { urgence: string; montant: number; chantier?: { code: string } })[];
    commandesADecaisser: CommandeRow[];
    commandesAControler: CommandeRow[];
    justificatifsManquants: CommandeRow[];
  };
}

interface DecaissementRow extends Ref {
  montant: number;
  statut: string;
  commande?: Ref & { statut: string };
  chantier?: { code: string };
  utilisateurReceptionnaire?: { _id: string };
}

interface RoleAction {
  path: string;
  label: string;
  description: string;
  color: string;
  count?: number;
}

interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

function QueueCard<T extends { _id: string }>({
  title,
  color,
  rows,
  columns,
  action,
}: {
  title: string;
  color: string;
  rows: T[];
  columns: Column<T>[];
  action: { label: string; onClick: (row: T) => void };
}) {
  if (!rows.length) return null;
  return (
    <Card className={`mb-4 border-${color}`}>
      <Card.Header className={`fw-bold text-${color} d-flex justify-content-between`}>
        <span>{title}</span>
        <Badge bg={color} pill>{rows.length}</Badge>
      </Card.Header>
      <Table striped hover responsive className="mb-0 align-middle">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.header}>{c.header}</th>
            ))}
            <th className="text-end">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id}>
              {columns.map((c) => (
                <td key={c.header}>{c.render(row)}</td>
              ))}
              <td className="text-end">
                <Button variant={color} size="sm" onClick={() => action.onClick(row)}>
                  {action.label}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function ActionTiles({ actions, onOpen }: { actions: RoleAction[]; onOpen: (path: string) => void }) {
  return (
    <Row className="g-3 mb-4">
      {actions.map((action) => (
        <Col md={6} key={action.label}>
          <Card className={`h-100 border-${action.color}`} onClick={() => onOpen(action.path)} style={{ cursor: 'pointer' }}>
            <Card.Body className="d-flex flex-column justify-content-between">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <Card.Title className={`text-${action.color} h5`}>{action.label}</Card.Title>
                  <Card.Text className="text-muted small">{action.description}</Card.Text>
                </div>
                {action.count !== undefined && (
                  <Badge bg={action.count > 0 ? action.color : 'secondary'} pill className="fs-6">
                    {action.count}
                  </Badge>
                )}
              </div>
              <Button variant={`outline-${action.color}`} size="sm" className="mt-3">
                Accéder
              </Button>
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>
  );
}

const fcfa = (n?: number) => `${(n ?? 0).toLocaleString()} FCFA`;
const commandeCols: Column<CommandeRow>[] = [
  { header: 'Code', render: (c) => c.code },
  { header: 'Chantier', render: (c) => c.chantier?.code },
  { header: 'Fournisseur', render: (c) => c.fournisseur?.nom },
  { header: 'Montant', render: (c) => fcfa(c.montant) },
];

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erreur');
  return json;
}

export default function Dashboard() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [commandes, setCommandes] = useState<CommandeRow[]>([]);
  const [demandes, setDemandes] = useState<{ statut: string }[]>([]);
  const [decaissements, setDecaissements] = useState<DecaissementRow[]>([]);
  const [paiements, setPaiements] = useState<{ _id: string; statut: string; recuPhysiqueDate?: string }[]>([]);
  const [error, setError] = useState('');

  const permissions = user?.permissions || [];
  const isAdmin = permissions.includes('admin.all');
  const roleCode = user?.roleCode;

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    const token = localStorage.getItem('easy_batiment_token');
    if (!token || !isAuthenticated) return;
    const perms = user?.permissions || [];
    const fail = (err: unknown) => setError(err instanceof Error ? err.message : 'Impossible de charger le tableau de bord');

    if (perms.includes('admin.all')) {
      fetchJson<DashboardData>('/api/dashboard', token).then(setData).catch(fail);
      return;
    }
    if (perms.includes('commande.read')) fetchJson<CommandeRow[]>('/api/commandes', token).then(setCommandes).catch(fail);
    if (perms.includes('demandeAchat.read')) fetchJson<{ statut: string }[]>('/api/demandes-achat', token).then(setDemandes).catch(fail);
    if (perms.includes('decaissement.read')) fetchJson<DecaissementRow[]>('/api/decaissements', token).then(setDecaissements).catch(fail);
    if (perms.includes('paiement.read')) fetchJson<typeof paiements>('/api/paiements', token).then(setPaiements).catch(fail);
  }, [isAuthenticated, loading, router, user]);

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  const go = (path: string) => router.push(path);

  // Réceptionniste chantier
  const commandesALivrer = commandes.filter((c) => ['COMMANDE_FOURNISSEUR', 'LIVRAISON'].includes(c.statut));
  const decaissementsAPayer = decaissements.filter(
    (d) => d.statut !== 'Payé' && d.commande?.statut === 'RECEPTION_RC' && d.utilisateurReceptionnaire?._id === user?.id
  );
  const commandesDecaissees = new Set(decaissements.map((d) => d.commande?._id));
  const enAttenteFonds = commandes.filter((c) => c.statut === 'RECEPTION_RC' && !commandesDecaissees.has(c._id));
  const recusPhysiquesManquants = paiements.filter((p) => p.statut === 'Effectué' && !p.recuPhysiqueDate);

  // Réceptionniste bureau
  const recusFournisseurManquants = commandes.filter(
    (c) => ['COMMANDE_FOURNISSEUR', 'LIVRAISON', 'RECEPTION_RC', 'PAIEMENT'].includes(c.statut) && !c.recuFournisseurDate
  );

  const roleActions: Record<string, { title: string; actions: RoleAction[] }> = {
    CHEF_CHANTIER: {
      title: 'Espace Chef Chantier',
      actions: [
        { path: '/demandes-achat/new', label: 'Nouvelle demande', description: 'Saisir un bon de commande pour un chantier', color: 'primary' },
        {
          path: '/demandes-achat',
          label: 'Mes demandes',
          description: 'Suivre l’avancement',
          color: 'info',
          count: demandes.filter((d) => !['REFUSE', 'FINANCE_AUTORISEE'].includes(d.statut)).length,
        },
        { path: '/commandes', label: 'Commandes', description: 'Consulter les commandes de mes chantiers', color: 'secondary', count: commandes.length },
        { path: '/rapports/new', label: 'Rapport', description: 'Transmettre un rapport', color: 'success' },
      ],
    },
    RECEPTION_BUREAU: {
      title: 'Espace Réceptionniste Bureau',
      actions: [
        { path: '/demandes-achat', label: 'Bons à réceptionner', description: 'Réceptionner et contrôler', color: 'warning', count: demandes.filter((d) => d.statut === 'SOUMIS').length },
        { path: '/demandes-achat', label: 'Bons à transmettre', description: 'Envoyer à l’administrateur', color: 'primary', count: demandes.filter((d) => d.statut === 'RECU_RB').length },
        { path: '/commandes?filtre=recu', label: 'Reçus fournisseurs à transmettre', description: 'Joindre l’image envoyée par le fournisseur', color: 'danger', count: recusFournisseurManquants.length },
        { path: '/commandes?filtre=COMMANDE_FOURNISSEUR', label: 'Commandes à passer', description: 'À transmettre au fournisseur (téléphone / bon imprimé)', color: 'info', count: commandes.filter((c) => c.statut === 'COMMANDE_FOURNISSEUR').length },
      ],
    },
    RECEPTION_CHANTIER: {
      title: 'Espace Réceptionniste Chantier',
      actions: [
        { path: '/receptions/new', label: 'Commandes à réceptionner', description: 'Contrôler les livraisons', color: 'warning', count: commandesALivrer.length },
        { path: '/stock', label: 'Stock', description: 'Entrées, sorties, inventaire', color: 'info' },
        { path: '/paiements/new', label: 'Paiements à effectuer', description: 'Payer avec les fonds autorisés', color: 'danger', count: decaissementsAPayer.length },
        { path: '/paiements', label: 'Reçus physiques à transmettre', description: 'Photo du reçu remis par le fournisseur', color: 'secondary', count: recusPhysiquesManquants.length },
        { path: '/rapports/new', label: 'Rapport', description: 'Rapport de chantier', color: 'success' },
      ],
    },
  };

  const roleContent = roleCode ? roleActions[roleCode] : undefined;

  return (
    <Layout>
      <div className="page-header d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h1 className="mb-1">Tableau de bord</h1>
          <p className="text-muted mb-0">
            Bienvenue, <strong>{user?.fullName}</strong>. {isAdmin ? 'Espace Administration' : roleContent?.title}
          </p>
        </div>
        <PrintButton label="Imprimer le tableau de bord" />
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {!isAdmin && roleContent && <ActionTiles actions={roleContent.actions} onOpen={go} />}

      {roleCode === 'RECEPTION_CHANTIER' && (
        <>
          <QueueCard
            title="Commandes à réceptionner"
            color="warning"
            rows={commandesALivrer}
            columns={commandeCols}
            action={{ label: 'Réceptionner', onClick: () => go('/receptions/new') }}
          />
          <QueueCard
            title="Paiements à effectuer"
            color="danger"
            rows={decaissementsAPayer}
            columns={[
              { header: 'Décaissement', render: (d) => d.code },
              { header: 'Commande', render: (d) => d.commande?.code },
              { header: 'Chantier', render: (d) => d.chantier?.code },
              { header: 'Montant autorisé', render: (d) => fcfa(d.montant) },
            ]}
            action={{ label: 'Payer', onClick: (d) => go(`/paiements/new?decaissement=${d._id}`) }}
          />
          {enAttenteFonds.length > 0 && (
            <Alert variant="light" className="border">
              {enAttenteFonds.length} commande(s) réceptionnée(s) en attente d’autorisation des fonds par l’administrateur :{' '}
              {enAttenteFonds.map((c) => c.code).join(', ')}
            </Alert>
          )}
        </>
      )}

      {roleCode === 'RECEPTION_BUREAU' && (
        <QueueCard
          title="Reçus fournisseurs à transmettre"
          color="danger"
          rows={recusFournisseurManquants}
          columns={commandeCols}
          action={{ label: 'Joindre', onClick: (c) => go(`/commandes/${c._id}`) }}
        />
      )}

      {isAdmin && (
        <>
          {!data && !error && <Spinner animation="border" />}
          {data && (
            <>
              <Row className="g-3 mb-4">
                {[
                  { label: 'Chantiers actifs', value: data.chantiersActifs },
                  { label: 'Demandes en cours', value: data.commandesEnAttente },
                  { label: 'Commandes en cours', value: data.commandesValidees },
                  { label: 'Livraisons attendues', value: data.livraisonsAttendues },
                  { label: 'Dépenses du mois', value: fcfa(data.depensesDuMois) },
                  { label: 'Anomalies', value: data.anomalies, color: data.anomalies ? 'danger' : undefined },
                  { label: 'Rapports non lus', value: data.rapportsNonLus },
                  { label: 'Livraisons partielles', value: data.alertes.livraisonsPartielles, color: data.alertes.livraisonsPartielles ? 'warning' : undefined },
                ].map((k) => (
                  <Col md={3} sm={6} key={k.label}>
                    <Card className={`text-center h-100 ${k.color ? `border-${k.color}` : ''}`}>
                      <Card.Body>
                        <Card.Title className={k.color ? `text-${k.color}` : ''}>{k.value}</Card.Title>
                        <Card.Text className="text-muted small">{k.label}</Card.Text>
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>

              <QueueCard
                title="Demandes à valider"
                color="primary"
                rows={data.files.demandesAValider}
                columns={[
                  { header: 'Code', render: (d) => d.code },
                  { header: 'Chantier', render: (d) => d.chantier?.code },
                  { header: 'Urgence', render: (d) => <Badge bg={['Haute', 'Critique'].includes(d.urgence) ? 'danger' : 'secondary'}>{d.urgence}</Badge> },
                  { header: 'Montant estimé', render: (d) => fcfa(d.montant) },
                ]}
                action={{ label: 'Examiner', onClick: (d) => go(`/demandes-achat/${d._id}`) }}
              />
              <QueueCard
                title="Fonds à autoriser (commandes réceptionnées)"
                color="danger"
                rows={data.files.commandesADecaisser}
                columns={commandeCols}
                action={{ label: 'Autoriser', onClick: (c) => go(`/decaissements/new?commande=${c._id}`) }}
              />
              <QueueCard
                title="Reçus à contrôler"
                color="success"
                rows={data.files.commandesAControler}
                columns={[
                  ...commandeCols,
                  {
                    header: 'Écart',
                    render: (c) =>
                      c.ecart ? <Badge bg="danger">{fcfa(c.ecart)}</Badge> : <Badge bg="success">Aucun</Badge>,
                  },
                ]}
                action={{ label: 'Contrôler', onClick: (c) => go(`/commandes/${c._id}`) }}
              />
              <QueueCard
                title="Payées — justificatifs attendus"
                color="secondary"
                rows={data.files.justificatifsManquants}
                columns={[
                  ...commandeCols,
                  { header: 'Reçu RB', render: (c) => <Badge bg={c.recuFournisseur ? 'success' : 'secondary'}>{c.recuFournisseur ? 'Oui' : 'Non'}</Badge> },
                  { header: 'Reçu RC', render: (c) => <Badge bg={c.recuPhysique ? 'success' : 'secondary'}>{c.recuPhysique ? 'Oui' : 'Non'}</Badge> },
                ]}
                action={{ label: 'Voir', onClick: (c) => go(`/commandes/${c._id}`) }}
              />

              <Card>
                <Card.Header>Alertes</Card.Header>
                <ListGroup variant="flush">
                  <ListGroup.Item className="d-flex justify-content-between align-items-center">
                    Demandes nécessitant votre validation
                    <Badge bg="danger" pill>{data.alertes.validationRequise}</Badge>
                  </ListGroup.Item>
                  <ListGroup.Item className="d-flex justify-content-between align-items-center">
                    Justificatifs avec écart de montant
                    <Badge bg="warning" pill>{data.alertes.justificatifsEcarts}</Badge>
                  </ListGroup.Item>
                  <ListGroup.Item action onClick={() => go('/rapports')} className="d-flex justify-content-between align-items-center">
                    Rapports non consultés
                    <Badge bg="info" pill>{data.alertes.rapportsNonLus}</Badge>
                  </ListGroup.Item>
                </ListGroup>
              </Card>
            </>
          )}
        </>
      )}
    </Layout>
  );
}

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Row, Col, Table, Button, Badge, Alert } from 'react-bootstrap';
import { MdEdit, MdDelete } from 'react-icons/md';
import { useAuth } from '@/contexts/AuthContext';
import PrintLayout from '@/components/print/PrintLayout';

interface InventoryLine {
  _id: string;
  article: { _id: string; nom: string; unite: string } | null;
  type: 'Entrée' | 'Sortie' | 'Transfert';
  quantite: number;
  motif: string;
  reference?: string;
  stockTheorique?: number;
  stockReel?: number;
}

interface Rapport {
  _id: string;
  date: string;
  activite: string;
  travauxRealises: string;
  personnelPresent: string;
  materielUtilise: string;
  difficultes?: string;
  incidents?: string;
  besoins?: string;
  observations?: string;
  photos: { type: string; url: string; legende?: string }[];
  mouvements?: InventoryLine[];
  chantier?: { code: string; nom: string; localisation?: string };
  createdBy?: { _id: string; firstName: string; lastName: string };
  luPar?: string[];
  createdAt: string;
}

export default function RapportPrintPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isAuthor = rapport?.createdBy?._id === user?.id;
  const isUnread = !rapport?.luPar || rapport.luPar.length === 0;
  const modifiable = isAuthor && isUnread;

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('easy_batiment_token');
    fetch(`/api/rapports/${id}`, { headers: { Authorization: `Bearer ${token || ''}` } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur');
        setRapport(json as Rapport);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!confirm('Supprimer ce rapport ? Cette action est irréversible.')) return;
    if (!id || Array.isArray(id)) return;
    setDeleting(true);
    setError('');
    const token = localStorage.getItem('easy_batiment_token');
    try {
      const res = await fetch(`/api/rapports/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur');
      }
      setSuccess('Rapport supprimé');
      setTimeout(() => router.push('/rapports'), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setDeleting(false);
    }
  }

  function handleEdit() {
    if (!id || Array.isArray(id)) return;
    router.push(`/rapports?edit=${id}`);
  }

  const section = (label: string, value?: string) =>
    value ? (
      <div className="mb-3">
        <h6 className="text-uppercase text-muted small fw-bold">{label}</h6>
        <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
          {value}
        </p>
      </div>
    ) : null;

  return (
    <PrintLayout title={`Rapport de chantier ${rapport?.chantier?.code || ''}`} loading={loading} error={error}>
      {rapport && (
        <>
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}

          <header className="border-bottom pb-3 mb-4 d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <h1 className="h3 mb-1">Rapport de chantier</h1>
              <p className="text-muted mb-0">
                {rapport.chantier ? `${rapport.chantier.code} - ${rapport.chantier.nom}` : 'Chantier non renseigné'}
              </p>
            </div>
            <div className="d-flex flex-column align-items-end gap-2">
              <div className="d-flex gap-2 d-print-none">
                <Button variant="outline-warning" size="sm" onClick={handleEdit} disabled={!modifiable || deleting}>
                  <MdEdit className="me-1" /> Modifier
                </Button>
                <Button variant="outline-danger" size="sm" onClick={handleDelete} disabled={!modifiable || deleting}>
                  <MdDelete className="me-1" /> Supprimer
                </Button>
              </div>
              <Badge bg={isUnread ? 'danger' : 'success'}>
                {isUnread ? 'Non lu' : 'Lu'}
              </Badge>
              {!modifiable && (
                <span className="text-muted small" style={{ maxWidth: 260, textAlign: 'right' }}>
                  Ce rapport ne peut être modifié ou supprimé que par l&apos;auteur tant qu&apos;il n&apos;est pas lu.
                </span>
              )}
            </div>
          </header>

          <Row className="mb-4">
            <Col md={6} className="mb-3">
              <p className="mb-1 small">
                <strong>Date du rapport :</strong> {new Date(rapport.date).toLocaleDateString('fr-FR')}
              </p>
              <p className="mb-0 small">
                <strong>Rédigé par :</strong>{' '}
                {rapport.createdBy ? `${rapport.createdBy.firstName} ${rapport.createdBy.lastName}` : '—'}
              </p>
            </Col>
            <Col md={6} className="mb-3">
              <p className="mb-0 small">
                <strong>Localisation :</strong> {rapport.chantier?.localisation || '—'}
              </p>
            </Col>
          </Row>

          {section('Activité', rapport.activite)}
          {section('Travaux réalisés', rapport.travauxRealises)}
          {section('Personnel présent', rapport.personnelPresent)}
          {section('Matériel utilisé', rapport.materielUtilise)}
          {section('Difficultés rencontrées', rapport.difficultes)}
          {section('Incidents', rapport.incidents)}
          {section('Besoins', rapport.besoins)}
          {section('Observations', rapport.observations)}

          {rapport.mouvements && rapport.mouvements.length > 0 && (
            <>
              <h5 className="text-uppercase text-muted small fw-bold mb-3">Constat d&apos;inventaire</h5>
              <Table bordered responsive className="mb-4" size="sm">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Unité</th>
                    <th>Stock théo.</th>
                    <th>Stock réel</th>
                    <th>Écart</th>
                    <th>Mouvement</th>
                    <th>Qté</th>
                    <th>Motif</th>
                    <th>Réf.</th>
                  </tr>
                </thead>
                <tbody>
                  {rapport.mouvements.map((m, idx) => {
                    const ecart = m.stockReel !== undefined && m.stockTheorique !== undefined ? m.stockReel - m.stockTheorique : 0;
                    return (
                      <tr key={idx}>
                        <td>{m.article?.nom || 'Inconnu'}</td>
                        <td>{m.article?.unite || '-'}</td>
                        <td>{m.stockTheorique ?? '-'}</td>
                        <td>{m.stockReel ?? '-'}</td>
                        <td className={ecart > 0 ? 'text-success' : ecart < 0 ? 'text-danger' : ''}>{ecart > 0 ? `+${ecart}` : ecart}</td>
                        <td>{m.type}</td>
                        <td>{m.quantite}</td>
                        <td>{m.motif}</td>
                        <td>{m.reference || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </>
          )}

          {rapport.photos.length > 0 && (
            <>
              <h5 className="text-uppercase text-muted small fw-bold mb-3">Photos</h5>
              <Table bordered responsive className="mb-4">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Légende</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {rapport.photos.map((p, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>{p.legende || '—'}</td>
                      <td>{p.type}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}

          <div className="text-center mt-5 pt-4">
            <p className="small mb-5">Signature du rédacteur</p>
            <div className="border-top mx-auto" style={{ width: '60%' }} />
          </div>
        </>
      )}
    </PrintLayout>
  );
}

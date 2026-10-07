import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Table, Button, Badge, Alert, Spinner, Modal, Form } from 'react-bootstrap';
import { MdEdit, MdDelete } from 'react-icons/md';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Rapport {
  _id: string;
  chantier?: { code: string; nom: string };
  activite: string;
  date: string;
  createdBy?: { _id: string; firstName: string; lastName: string };
  isRead?: boolean;
  modifiable?: boolean;
}

interface EditForm {
  activite: string;
  travauxRealises: string;
  personnelPresent: string;
  materielUtilise: string;
  difficultes: string;
  incidents: string;
  besoins: string;
  observations: string;
  date: string;
}

export default function Rapports() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [rapports, setRapports] = useState<Rapport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<Rapport | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    activite: '',
    travauxRealises: '',
    personnelPresent: '',
    materielUtilise: '',
    difficultes: '',
    incidents: '',
    besoins: '',
    observations: '',
    date: '',
  });
  const [saving, setSaving] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('easy_batiment_token') : null;

  const canCreate =
    typeof window !== 'undefined' &&
    JSON.parse(localStorage.getItem('easy_batiment_user') || '{}')?.permissions?.includes('rapport.create');

  async function load() {
    if (!token) return;
    setLoaded(false);
    try {
      const res = await fetch('/api/rapports', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur');
      if (!Array.isArray(json)) throw new Error('Format invalide');
      setRapports(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les rapports');
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!loaded || !router.query.edit || !rapports.length) return;
    const editId = Array.isArray(router.query.edit) ? router.query.edit[0] : router.query.edit;
    const rapport = rapports.find((r) => r._id === editId);
    if (rapport && !editing) {
      openEdit(rapport);
      router.replace('/rapports', undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, router.query.edit, rapports]);

  function openEdit(r: Rapport) {
    setEditing(r);
    setEditForm({
      activite: r.activite || '',
      travauxRealises: (r as unknown as { travauxRealises?: string }).travauxRealises || '',
      personnelPresent: (r as unknown as { personnelPresent?: string }).personnelPresent || '',
      materielUtilise: (r as unknown as { materielUtilise?: string }).materielUtilise || '',
      difficultes: (r as unknown as { difficultes?: string }).difficultes || '',
      incidents: (r as unknown as { incidents?: string }).incidents || '',
      besoins: (r as unknown as { besoins?: string }).besoins || '',
      observations: (r as unknown as { observations?: string }).observations || '',
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : '',
    });
    setShowEdit(true);
    setError('');
    setSuccess('');
  }

  function closeEdit() {
    setShowEdit(false);
    setEditing(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !token) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/rapports/${editing._id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setSuccess('Rapport modifié');
      closeEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r: Rapport) {
    if (!confirm('Supprimer ce rapport ? Cette action est irréversible.')) return;
    if (!token) return;
    try {
      const res = await fetch(`/api/rapports/${r._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur');
      }
      setSuccess('Rapport supprimé');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  function updateField<K extends keyof EditForm>(field: K, value: EditForm[K]) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Rapports chantier</h1>
        <div className="d-flex gap-2">
          <PrintButton />
          {canCreate && (
            <Link href="/rapports/new" passHref>
              <Button variant="primary">Nouveau rapport</Button>
            </Link>
          )}
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      {!loaded && !error ? (
        <Spinner animation="border" />
      ) : !rapports.length ? (
        <Alert variant="info">Aucun rapport enregistré.</Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Chantier</th>
              <th>Date</th>
              <th>Activité</th>
              <th>Auteur</th>
              <th>Lu</th>
              <th className="d-print-none">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rapports.map((r) => (
              <tr key={r._id}>
                <td>{r.chantier?.code}</td>
                <td>{new Date(r.date).toLocaleDateString('fr-FR')}</td>
                <td>{r.activite}</td>
                <td>{r.createdBy?.firstName} {r.createdBy?.lastName}</td>
                <td>
                  <Badge bg={r.isRead ? 'success' : 'danger'}>{r.isRead ? 'Oui' : 'Non'}</Badge>
                </td>
                <td className="d-print-none">
                  <div className="d-flex flex-wrap gap-2">
                    <Button
                      as="a"
                      href={`/rapports/${r._id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline-primary"
                    >
                      Imprimer
                    </Button>
                    {r.modifiable && (
                      <>
                        <Button variant="outline-warning" size="sm" onClick={() => openEdit(r)}>
                          <MdEdit />
                        </Button>
                        <Button variant="outline-danger" size="sm" onClick={() => handleDelete(r)}>
                          <MdDelete />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal show={showEdit} onHide={closeEdit} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Modifier le rapport</Modal.Title>
        </Modal.Header>
        <Form onSubmit={saveEdit}>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form.Group className="mb-3" controlId="editDate">
              <Form.Label>Date</Form.Label>
              <Form.Control type="date" value={editForm.date} onChange={(e) => updateField('date', e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="editActivite">
              <Form.Label>Activité</Form.Label>
              <Form.Control value={editForm.activite} onChange={(e) => updateField('activite', e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="editTravaux">
              <Form.Label>Travaux réalisés</Form.Label>
              <Form.Control as="textarea" rows={2} value={editForm.travauxRealises} onChange={(e) => updateField('travauxRealises', e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="editPersonnel">
              <Form.Label>Personnel présent</Form.Label>
              <Form.Control as="textarea" rows={2} value={editForm.personnelPresent} onChange={(e) => updateField('personnelPresent', e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="editMateriel">
              <Form.Label>Matériel utilisé</Form.Label>
              <Form.Control as="textarea" rows={2} value={editForm.materielUtilise} onChange={(e) => updateField('materielUtilise', e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="editDifficultes">
              <Form.Label>Difficultés</Form.Label>
              <Form.Control as="textarea" rows={2} value={editForm.difficultes} onChange={(e) => updateField('difficultes', e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="editIncidents">
              <Form.Label>Incidents</Form.Label>
              <Form.Control as="textarea" rows={2} value={editForm.incidents} onChange={(e) => updateField('incidents', e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="editBesoins">
              <Form.Label>Besoins</Form.Label>
              <Form.Control as="textarea" rows={2} value={editForm.besoins} onChange={(e) => updateField('besoins', e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3" controlId="editObservations">
              <Form.Label>Observations</Form.Label>
              <Form.Control as="textarea" rows={2} value={editForm.observations} onChange={(e) => updateField('observations', e.target.value)} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={closeEdit} disabled={saving}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? <Spinner size="sm" /> : 'Enregistrer'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Layout>
  );
}

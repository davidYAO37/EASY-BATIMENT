import React, { useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';
import {
  Table,
  Button,
  Form,
  Card,
  Alert,
  Spinner,
  Row,
  Col,
  Badge,
} from 'react-bootstrap';

interface IRole {
  _id: string;
  code: string;
  name: string;
  description: string;
  permissions: string[];
  isActive: boolean;
}

export default function RolesPage() {
  const { token, user } = useAuth();
  const [roles, setRoles] = useState<IRole[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [selected, setSelected] = useState<IRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    permissions: [] as string[],
    isActive: true,
  });

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch('/api/roles', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/permissions', { headers: { Authorization: `Bearer ${token}` } }),
    ])
      .then(async ([r1, r2]) => {
        const data1 = await r1.json();
        const data2 = await r2.json();
        if (!r1.ok) throw new Error(data1.error || 'Erreur');
        if (!r2.ok) throw new Error(data2.error || 'Erreur');
        if (!Array.isArray(data1) || !Array.isArray(data2)) throw new Error('Format invalide');
        setRoles(data1);
        setPermissions(data2);
      })
      .catch(() => setError('Impossible de charger les données'))
      .finally(() => setLoading(false));
  }, [token]);

  function selectRole(role: IRole) {
    setSelected(role);
    setForm({
      name: role.name,
      code: role.code,
      description: role.description,
      permissions: role.permissions,
      isActive: role.isActive,
    });
    setError('');
    setSuccess('');
  }

  function newRole() {
    setSelected(null);
    setForm({ name: '', code: '', description: '', permissions: [], isActive: true });
    setError('');
    setSuccess('');
  }

  function togglePermission(permission: string) {
    const next = form.permissions.includes(permission)
      ? form.permissions.filter((p) => p !== permission)
      : [...form.permissions, permission];
    applyPermissions(next);
  }

  function toggleGroup(group: string[]) {
    const allChecked = group.every((p) => form.permissions.includes(p));
    const next = allChecked
      ? form.permissions.filter((p) => !group.includes(p))
      : [...new Set([...form.permissions, ...group])];
    applyPermissions(next);
  }

  // Rôle existant : enregistrement immédiat à chaque cochage/décochage.
  // Nouveau rôle : mise à jour locale, persistée au bouton Enregistrer.
  function applyPermissions(next: string[]) {
    setForm((prev) => ({ ...prev, permissions: next }));
    if (!selected) return;
    setSaving(true);
    setError('');
    setSuccess('');
    fetch(`/api/roles/${selected._id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, permissions: next }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Erreur');
        }
        setRoles((prev) => prev.map((r) => (r._id === selected._id ? { ...r, permissions: next } : r)));
        setSelected((prev) => (prev ? { ...prev, permissions: next } : prev));
        setSuccess('Permissions enregistrées');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setSaving(false));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const url = selected ? `/api/roles/${selected._id}` : '/api/roles';
      const method = selected ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur');
      }

      setSuccess(selected ? 'Rôle modifié' : 'Rôle créé');
      const refreshed = await fetch('/api/roles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRoles(await refreshed.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    if (!confirm('Réinitialiser tous les rôles avec les permissions par défaut ? Les personnalisations seront écrasées.')) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/seed', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setSuccess('Rôles réinitialisés aux valeurs par défaut');
      const refreshed = await fetch('/api/roles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = await refreshed.json();
      setRoles(list);
      if (selected) {
        const updated = list.find((r: IRole) => r._id === selected._id);
        if (updated) selectRole(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm('Supprimer ce rôle ?')) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${selected._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erreur');
      setSuccess('Rôle supprimé');
      newRole();
      const refreshed = await fetch('/api/roles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRoles(await refreshed.json());
    } catch {
      setError('Impossible de supprimer');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="d-flex justify-content-center mt-5">
          <Spinner animation="border" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Rôles et permissions</h1>
        <div className="d-flex gap-2">
          <PrintButton />
          {user?.permissions?.includes('admin.all') && (
            <Button variant="outline-secondary" onClick={resetDefaults} disabled={saving}>
              Rôles par défaut
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Row>
        <Col md={4}>
          <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>Rôles</span>
              <Button variant="primary" size="sm" onClick={newRole}>
                Nouveau
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <Table hover responsive className="mb-0">
                <tbody>
                  {roles.map((r) => (
                    <tr
                      key={r._id}
                      onClick={() => selectRole(r)}
                      style={{ cursor: 'pointer' }}
                      className={selected?._id === r._id ? 'table-active' : ''}
                    >
                      <td>
                        {r.name} <small className="text-muted">({r.code})</small>
                        {r.isActive === false && (
                          <Badge bg="secondary" className="ms-2">Inactif</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        <Col md={8}>
          <Card>
            <Card.Header>{selected ? 'Modifier le rôle' : 'Nouveau rôle'}</Card.Header>
            <Card.Body>
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Code</Form.Label>
                      <Form.Control
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                        disabled={!!selected}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Nom</Form.Label>
                      <Form.Control
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="switch"
                    label="Actif"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                </Form.Group>

                <h6 className="mt-4">
                  Permissions {saving && <Spinner size="sm" />}
                </h6>
                {Object.entries(
                  permissions.reduce<Record<string, string[]>>((acc, p) => {
                    const resource = p.split('.')[0];
                    (acc[resource] ??= []).push(p);
                    return acc;
                  }, {})
                ).map(([resource, group]) => {
                  const allChecked = group.every((p) => form.permissions.includes(p));
                  const someChecked = !allChecked && group.some((p) => form.permissions.includes(p));
                  return (
                    <Card key={resource} className="mb-2">
                      <Card.Header className="py-2 d-flex align-items-center gap-2">
                        <Form.Check
                          type="switch"
                          id={`group-${resource}`}
                          label={<strong className="text-capitalize">{resource}</strong>}
                          checked={allChecked}
                          ref={(el) => {
                            if (el) (el as HTMLInputElement).indeterminate = someChecked;
                          }}
                          onChange={() => toggleGroup(group)}
                          className="mb-0"
                        />
                        <small className="text-muted">
                          {group.filter((p) => form.permissions.includes(p)).length}/{group.length}
                        </small>
                      </Card.Header>
                      <Card.Body className="py-2">
                        <Row>
                          {group.map((p) => (
                            <Col md={4} key={p}>
                              <Form.Check
                                type="checkbox"
                                id={`perm-${p}`}
                                label={p}
                                checked={form.permissions.includes(p)}
                                onChange={() => togglePermission(p)}
                                disabled={saving}
                                className="mb-1"
                              />
                            </Col>
                          ))}
                        </Row>
                      </Card.Body>
                    </Card>
                  );
                })}

                <div className="mt-4 d-flex gap-2">
                  <Button variant="primary" type="submit" disabled={saving}>
                    {saving ? <Spinner size="sm" /> : 'Enregistrer'}
                  </Button>
                  {selected && (
                    <Button variant="danger" onClick={handleDelete} disabled={saving}>
                      Supprimer
                    </Button>
                  )}
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Layout>
  );
}

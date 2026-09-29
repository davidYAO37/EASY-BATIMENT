import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Table, Button, Alert, Modal, Form } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Role {
  _id: string;
  name: string;
}

interface UserItem {
  _id: string;
  fullName?: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: Role;
  active: boolean;
}

export default function Utilisateurs() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editUser, setEditUser] = useState<UserItem | null>(null);

  const currentUserId = user?.id;
  const hasPerm = (perm: string) =>
    user?.permissions?.includes('admin.all') || user?.permissions?.includes(perm);
  const canCreate = hasPerm('utilisateur.create');
  const canUpdate = hasPerm('utilisateur.update');
  const canDelete = hasPerm('utilisateur.delete');

  const activeUsers = users.filter((u) => u.active);
  const inactiveUsers = users.filter((u) => !u.active);

  const token = typeof window !== 'undefined' ? localStorage.getItem('easy_batiment_token') : null;

  const loadUsers = React.useCallback(() => {
    if (!token) return;
    fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur');
        if (!Array.isArray(json)) throw new Error('Format invalide');
        setUsers(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les utilisateurs'));
  }, [token]);

  const loadRoles = React.useCallback(() => {
    if (!token || !canUpdate) return;
    fetch('/api/roles', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur');
        if (Array.isArray(json)) setRoles(json);
      })
      .catch(() => {});
  }, [token, canUpdate]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    loadUsers();
    loadRoles();
  }, [isAuthenticated, loading, router, loadUsers, loadRoles]);

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Erreur');
      }
      setSuccess('Utilisateur supprimé');
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function toggleActive(u: UserItem) {
    if (!canUpdate) return;
    try {
      const res = await fetch(`/api/users/${u._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ active: !u.active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur');
      setSuccess(`Utilisateur ${json.active ? 'activé' : 'désactivé'}`);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function handleSaveRole(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    try {
      const res = await fetch(`/api/users/${editUser._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ role: editUser.role?._id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur');
      setSuccess('Rôle modifié');
      setEditUser(null);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Utilisateurs</h1>
        <div className="d-flex gap-2">
          <PrintButton />
          {canCreate && (
            <Link href="/utilisateurs/new" passHref>
              <Button variant="primary">Nouvel utilisateur</Button>
            </Link>
          )}
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      {!users.length && !error ? (
        <p>Aucun utilisateur.</p>
      ) : (
        <>
          <h4 className="mb-3 mt-4">Utilisateurs actifs</h4>
          <Table striped bordered hover responsive className="mb-5">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th className="d-print-none">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeUsers.map((u) => (
                <tr key={u._id}>
                  <td>{u.fullName || `${u.firstName} ${u.lastName}`}</td>
                  <td>{u.email}</td>
                  <td>{u.role?.name}</td>
                  <td className="d-print-none">
                    <div className="d-flex gap-2 flex-wrap">
                      {canUpdate && (
                        <Button variant="outline-primary" size="sm" onClick={() => setEditUser(u)}>
                          Rôle
                        </Button>
                      )}
                      {canUpdate && u._id !== currentUserId && (
                        <Button variant="warning" size="sm" onClick={() => toggleActive(u)}>
                          Désactiver
                        </Button>
                      )}
                      {canDelete && u._id !== currentUserId && (
                        <Button variant="outline-danger" size="sm" onClick={() => handleDelete(u._id)}>
                          Supprimer
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <h4 className="mb-3">Utilisateurs désactivés</h4>
          {inactiveUsers.length === 0 ? (
            <p className="text-muted">Aucun utilisateur désactivé.</p>
          ) : (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th className="d-print-none">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inactiveUsers.map((u) => (
                  <tr key={u._id} className="table-secondary">
                    <td>{u.fullName || `${u.firstName} ${u.lastName}`}</td>
                    <td>{u.email}</td>
                    <td>{u.role?.name}</td>
                    <td className="d-print-none">
                      <div className="d-flex gap-2 flex-wrap">
                        {canUpdate && (
                          <Button variant="success" size="sm" onClick={() => toggleActive(u)}>
                            Réactiver
                          </Button>
                        )}
                        {canDelete && u._id !== currentUserId && (
                          <Button variant="outline-danger" size="sm" onClick={() => handleDelete(u._id)}>
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
        </>
      )}

      <Modal show={!!editUser} onHide={() => setEditUser(null)} centered>
        <Form onSubmit={handleSaveRole}>
          <Modal.Header closeButton>
            <Modal.Title>Modifier le rôle</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group>
              <Form.Label>Rôle</Form.Label>
              <Form.Select
                value={editUser?.role?._id || ''}
                onChange={(e) => setEditUser((prev) => (prev ? { ...prev, role: roles.find((r) => r._id === e.target.value) || prev.role } : null))}
                required
              >
                {roles.map((r) => (
                  <option key={r._id} value={r._id}>{r.name}</option>
                ))}
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setEditUser(null)}>Annuler</Button>
            <Button variant="primary" type="submit">Enregistrer</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Layout>
  );
}
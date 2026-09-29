import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Table, Button, Alert, Spinner, Modal, Form } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';
import { UNITES, CATEGORIES, UNITE_GROUPS, CATEGORY_GROUPS } from '@/lib/articleOptions';

const AUTRE = '__autre__';

interface Article {
  _id: string;
  nom: string;
  unite: string;
  categorie?: string;
}

export default function Articles() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editArticle, setEditArticle] = useState<Article | null>(null);

  const hasPerm = (perm: string) =>
    user?.permissions?.includes('admin.all') || user?.permissions?.includes(perm);
  const canUpdate = hasPerm('article.update');
  const canDelete = hasPerm('article.delete');

  const token = typeof window !== 'undefined' ? localStorage.getItem('easy_batiment_token') : null;

  const load = React.useCallback(() => {
    if (!token) return;
    fetch('/api/articles', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur');
        if (!Array.isArray(json)) throw new Error('Format invalide');
        setArticles(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les articles'))
      .finally(() => setLoaded(true));
  }, [token]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    load();
  }, [isAuthenticated, loading, router, load]);

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet article ?')) return;
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Erreur');
      }
      setSuccess('Article supprimé');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editArticle) return;
    try {
      const res = await fetch(`/api/articles/${editArticle._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          nom: editArticle.nom,
          unite: editArticle.unite,
          categorie: editArticle.categorie,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur');
      setSuccess('Article modifié');
      setEditArticle(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Articles</h1>
        <div className="d-flex gap-2">
          <PrintButton />
          <Link href="/articles/new" passHref>
            <Button variant="primary">Nouvel article</Button>
          </Link>
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      {!loaded && !error ? (
        <Spinner animation="border" />
      ) : !articles.length ? (
        <Alert variant="info">Aucun article enregistré.</Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Unité</th>
              <th>Catégorie</th>
              <th className="d-print-none">Actions</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => (
              <tr key={a._id}>
                <td>{a.nom}</td>
                <td>{a.unite}</td>
                <td>{a.categorie || '—'}</td>
                <td className="d-print-none">
                  <div className="d-flex gap-2 flex-wrap">
                    {canUpdate && (
                      <Button variant="outline-primary" size="sm" onClick={() => setEditArticle(a)}>
                        Modifier
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="outline-danger" size="sm" onClick={() => handleDelete(a._id)}>
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

      <Modal show={!!editArticle} onHide={() => setEditArticle(null)} centered>
        <Form onSubmit={handleSave}>
          <Modal.Header closeButton>
            <Modal.Title>Modifier l&apos;article</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Nom</Form.Label>
              <Form.Control
                value={editArticle?.nom || ''}
                onChange={(e) => setEditArticle((prev) => (prev ? { ...prev, nom: e.target.value } : null))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Unité</Form.Label>
              <Form.Select
                value={editArticle && !UNITES.includes(editArticle.unite) ? AUTRE : editArticle?.unite || ''}
                onChange={(e) =>
                  setEditArticle((prev) =>
                    prev ? { ...prev, unite: e.target.value === AUTRE ? '' : e.target.value } : null
                  )
                }
                required
              >
                <option value="">Choisir...</option>
                {UNITE_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map((u) => <option key={u} value={u}>{u}</option>)}
                  </optgroup>
                ))}
                <option value={AUTRE}>Autre (saisir)</option>
              </Form.Select>
              {editArticle && !UNITES.includes(editArticle.unite) && (
                <Form.Control
                  className="mt-2"
                  value={editArticle.unite}
                  onChange={(e) => setEditArticle((prev) => (prev ? { ...prev, unite: e.target.value } : null))}
                  placeholder="Ex. : Palette, Camion..."
                  required
                />
              )}
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Catégorie</Form.Label>
              <Form.Select
                value={editArticle?.categorie && !CATEGORIES.includes(editArticle.categorie) ? AUTRE : editArticle?.categorie || ''}
                onChange={(e) =>
                  setEditArticle((prev) =>
                    prev ? { ...prev, categorie: e.target.value === AUTRE ? '' : e.target.value } : null
                  )
                }
              >
                <option value="">Choisir...</option>
                {CATEGORY_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map((c) => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                ))}
                <option value={AUTRE}>Autre (saisir)</option>
              </Form.Select>
              {editArticle?.categorie !== undefined && editArticle !== null && !CATEGORIES.includes(editArticle.categorie) && (
                <Form.Control
                  className="mt-2"
                  value={editArticle.categorie}
                  onChange={(e) => setEditArticle((prev) => (prev ? { ...prev, categorie: e.target.value } : null))}
                  placeholder="Ex. : Outillage, Location..."
                />
              )}
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setEditArticle(null)}>Annuler</Button>
            <Button variant="primary" type="submit">Enregistrer</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Layout>
  );
}

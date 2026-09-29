import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Table, Form, Alert } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import PrintButton from '@/components/PrintButton';

interface Chantier {
  _id: string;
  code: string;
  nom: string;
}

interface StockItem {
  article: string;
  entree: number;
  sortie: number;
  stock: number;
}

interface Article {
  _id: string;
  nom: string;
  unite: string;
}

export default function Stock() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [chantier, setChantier] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    const token = localStorage.getItem('easy_batiment_token');
    if (token) {
      Promise.all([
        fetch('/api/chantiers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/articles', { headers: { Authorization: `Bearer ${token}` } }),
      ])
        .then(async ([r1, r2]) => {
          const c = await r1.json();
          const a = await r2.json();
          if (!r1.ok) throw new Error(c.error || 'Impossible de charger les chantiers');
          if (!r2.ok) throw new Error(a.error || 'Impossible de charger les articles');
          if (!Array.isArray(c) || !Array.isArray(a)) throw new Error('Format de données invalide');
          setChantiers(c);
          setArticles(a);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'));
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!chantier) return;
    const token = localStorage.getItem('easy_batiment_token');
    fetch(`/api/stock?chantier=${chantier}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur');
        if (!Array.isArray(json)) throw new Error('Format de données invalide');
        setStock(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'));
  }, [chantier]);

  if (loading || !isAuthenticated) return <Layout requireAuth={false} />;

  function getArticleName(id: string) {
    return articles.find((a) => a._id === id)?.nom || id;
  }

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
        <h1 className="mb-0">Stock chantier</h1>
        <PrintButton />
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <Form.Group className="mb-3" controlId="chantier">
        <Form.Label>Chantier</Form.Label>
        <Form.Select value={chantier} onChange={(e) => setChantier(e.target.value)}>
          <option value="">Choisir un chantier...</option>
          {chantiers.map((c) => (
            <option key={c._id} value={c._id}>{c.code} - {c.nom}</option>
          ))}
        </Form.Select>
      </Form.Group>
      {!chantier ? (
        <p>Sélectionnez un chantier pour afficher le stock.</p>
      ) : !stock.length ? (
        <p>Aucun mouvement de stock pour ce chantier.</p>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Article</th>
              <th>Entrée</th>
              <th>Sortie</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((s) => (
              <tr key={s.article}>
                <td>{getArticleName(s.article)}</td>
                <td>{s.entree}</td>
                <td>{s.sortie}</td>
                <td className={s.stock < 0 ? 'text-danger fw-bold' : ''}>{s.stock}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Layout>
  );
}

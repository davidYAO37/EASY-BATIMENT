import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Row, Col, Table } from 'react-bootstrap';
import PrintLayout from '@/components/print/PrintLayout';

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
  chantier?: { code: string; nom: string; localisation?: string };
  createdBy?: { firstName: string; lastName: string };
  createdAt: string;
}

export default function RapportPrintPage() {
  const router = useRouter();
  const { id } = router.query;
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('easy_batiment_token');
    fetch(`/api/rapports/${id}`, { headers: { Authorization: `Bearer ${token || ''}` } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur');
        setRapport(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, [id]);

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
          <header className="border-bottom pb-3 mb-4">
            <h1 className="h3 mb-1">Rapport de chantier</h1>
            <p className="text-muted mb-0">
              {rapport.chantier ? `${rapport.chantier.code} - ${rapport.chantier.nom}` : 'Chantier non renseigné'}
            </p>
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

import React, { useEffect } from 'react';
import Head from 'next/head';
import { Container, Spinner } from 'react-bootstrap';

interface PrintLayoutProps {
  title: string;
  loading?: boolean;
  error?: string;
  children: React.ReactNode;
}

export default function PrintLayout({ title, loading, error, children }: PrintLayoutProps) {
  useEffect(() => {
    if (loading || error) return;
    const timer = setTimeout(() => window.print(), 600);
    return () => clearTimeout(timer);
  }, [loading, error]);

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Container className="print-sheet py-4">
        {loading ? (
          <div className="d-flex justify-content-center align-items-center vh-100">
            <Spinner animation="border" />
          </div>
        ) : error ? (
          <div className="alert alert-danger">{error}</div>
        ) : (
          children
        )}
      </Container>
    </>
  );
}

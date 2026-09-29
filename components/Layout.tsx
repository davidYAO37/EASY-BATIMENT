import React from 'react';
import { Container, Spinner } from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from './Navbar';

interface LayoutProps {
  children?: React.ReactNode;
  requireAuth?: boolean;
}

export default function Layout({ children, requireAuth = true }: LayoutProps) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" />
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return null;
  }

  return (
    <>
      <Navbar />
      <div className="print-header d-none">
        <h1>Easy Bâtiment</h1>
        <p>Document généré le {new Date().toLocaleDateString('fr-FR')}</p>
      </div>
      <Container className="pb-5">{children}</Container>
    </>
  );
}

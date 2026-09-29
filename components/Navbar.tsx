import React from 'react';
import { useRouter } from 'next/router';
import {
  Navbar as BSNavbar,
  Container,
  Nav,
  NavDropdown,
  Button,
  Badge,
} from 'react-bootstrap';
import { useAuth } from '@/contexts/AuthContext';
import { BsBuilding, BsClipboardData } from 'react-icons/bs';

export default function Navbar() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  function navigate(path: string) {
    router.push(path);
  }

  const active = (path: string) => router.pathname === path || router.pathname.startsWith(`${path}/`);

  const perms = user?.permissions || [];
  const has = (permission: string) => perms.includes('admin.all') || perms.includes(permission);
  const hasAny = (permissions: string[]) =>
    perms.includes('admin.all') || permissions.some((p) => perms.includes(p));

  return (
    <BSNavbar bg="white" expand="lg" className="shadow-sm mb-4 border-bottom">
      <Container>
        <BSNavbar.Brand
          onClick={() => navigate('/')}
          className="fw-bold text-primary d-flex align-items-center gap-2"
          style={{ cursor: 'pointer' }}
        >
          <BsBuilding size={28} />
          Easy Bâtiment
        </BSNavbar.Brand>
        <BSNavbar.Toggle />
        <BSNavbar.Collapse id="main-nav">
          {isAuthenticated ? (
            <>
              <Nav className="me-auto" variant="pills">
                {has('dashboard.read') && (
                  <Nav.Link
                    onClick={() => navigate('/dashboard')}
                    active={active('/dashboard')}
                    className="fw-medium"
                  >
                    <BsClipboardData className="me-1" />
                    Tableau de bord
                  </Nav.Link>
                )}

                {has('chantier.read') && (
                  <Nav.Link onClick={() => navigate('/chantiers')} active={active('/chantiers')}>
                    Chantiers
                  </Nav.Link>
                )}

                {hasAny([
                  'demandeAchat.read',
                  'commande.create',
                  'fournisseur.read',
                ]) && (
                  <NavDropdown
                    title="Achats"
                    id="nav-achats"
                    active={
                      active('/demandes-achat') ||
                      active('/commandes') ||
                      active('/articles') ||
                      active('/fournisseurs')
                    }
                  >
                    {has('demandeAchat.read') && (
                      <NavDropdown.Item onClick={() => navigate('/demandes-achat')}>
                        Demandes d&apos;achat
                      </NavDropdown.Item>
                    )}
                    {has('commande.read') && (
                      <NavDropdown.Item onClick={() => navigate('/commandes')}>
                        Commandes
                      </NavDropdown.Item>
                    )}
                    {(has('article.read') || has('fournisseur.read')) && <NavDropdown.Divider />}
                    {has('article.read') && (
                      <NavDropdown.Item onClick={() => navigate('/articles')}>
                        Articles
                      </NavDropdown.Item>
                    )}
                    {has('fournisseur.read') && (
                      <NavDropdown.Item onClick={() => navigate('/fournisseurs')}>
                        Fournisseurs
                      </NavDropdown.Item>
                    )}
                  </NavDropdown>
                )}

                {hasAny(['reception.read', 'stock.read']) && (
                  <NavDropdown
                    title="Logistique"
                    id="nav-logistique"
                    active={active('/receptions') || active('/stock')}
                  >
                    {has('reception.read') && (
                      <NavDropdown.Item onClick={() => navigate('/receptions')}>
                        Réceptions
                      </NavDropdown.Item>
                    )}
                    {has('stock.read') && (
                      <NavDropdown.Item onClick={() => navigate('/stock')}>
                        Stock chantier
                      </NavDropdown.Item>
                    )}
                  </NavDropdown>
                )}

                {hasAny(['decaissement.read', 'paiement.read']) && (
                  <NavDropdown
                    title="Finance"
                    id="nav-finance"
                    active={active('/decaissements') || active('/paiements')}
                  >
                    {has('decaissement.read') && (
                      <NavDropdown.Item onClick={() => navigate('/decaissements')}>
                        Décaissements
                      </NavDropdown.Item>
                    )}
                    {has('paiement.read') && (
                      <NavDropdown.Item onClick={() => navigate('/paiements')}>
                        Paiements
                      </NavDropdown.Item>
                    )}
                  </NavDropdown>
                )}

                {has('rapport.read') && (
                  <Nav.Link onClick={() => navigate('/rapports')} active={active('/rapports')}>
                    Rapports
                  </Nav.Link>
                )}

                {hasAny(['utilisateur.read', 'role.read', 'audit.read']) && (
                  <NavDropdown
                    title="Administration"
                    id="nav-admin"
                    active={active('/utilisateurs') || active('/audit') || active('/roles')}
                  >
                    {has('utilisateur.read') && (
                      <NavDropdown.Item onClick={() => navigate('/utilisateurs')}>
                        Utilisateurs
                      </NavDropdown.Item>
                    )}
                    {has('role.read') && (
                      <NavDropdown.Item onClick={() => navigate('/roles')}>
                        Rôles
                      </NavDropdown.Item>
                    )}
                    {has('audit.read') && (
                      <NavDropdown.Item onClick={() => navigate('/audit')}>
                        Journal d&apos;audit
                      </NavDropdown.Item>
                    )}
                  </NavDropdown>
                )}
              </Nav>

              <Nav className="ms-auto align-items-center gap-3">
                <div className="d-flex align-items-center gap-2">
                  <Badge bg="light" text="dark" className="border">
                    {user?.role}
                  </Badge>
                  <span className="fw-medium text-secondary">{user?.fullName}</span>
                </div>
                <Button variant="outline-danger" size="sm" onClick={handleLogout}>
                  Déconnexion
                </Button>
              </Nav>
            </>
          ) : (
            <Nav className="ms-auto">
              <Button variant="primary" size="sm" onClick={() => navigate('/login')}>
                Connexion
              </Button>
            </Nav>
          )}
        </BSNavbar.Collapse>
      </Container>
    </BSNavbar>
  );
}

import React from 'react';
import { Button } from 'react-bootstrap';
import { FaPrint } from 'react-icons/fa';

interface PrintButtonProps {
  label?: string;
  className?: string;
  variant?: string;
}

export default function PrintButton({
  label = 'Imprimer',
  className = '',
  variant = 'outline-secondary',
}: PrintButtonProps) {
  if (typeof window === 'undefined') return null;
  return (
    <Button
      variant={variant}
      size="sm"
      className={`d-print-none ${className}`}
      onClick={() => window.print()}
      aria-label="Imprimer cette page"
    >
      <FaPrint className="me-1" />
      {label}
    </Button>
  );
}

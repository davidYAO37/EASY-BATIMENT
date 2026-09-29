import React from 'react';
import PrintButton from './PrintButton';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="page-header d-flex flex-wrap justify-content-between align-items-start gap-3">
      <div>
        <h1 className="mb-1">{title}</h1>
        {subtitle && <p className="text-muted mb-0">{subtitle}</p>}
      </div>
      <div className="d-flex align-items-center gap-2">
        {children}
        <PrintButton />
      </div>
    </div>
  );
}

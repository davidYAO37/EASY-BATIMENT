import React, { useState } from 'react';
import { Form, Image, Modal, Button, Spinner } from 'react-bootstrap';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.75;

async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Image illisible'));
    el.src = dataUrl;
  });
  const ratio = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * ratio);
  canvas.height = Math.round(img.height * ratio);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

interface UploadProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  controlId: string;
}

/** Sélection d'une photo de reçu (appareil photo sur mobile), compressée côté navigateur. */
export function ReceiptUpload({ label, value, onChange, required, controlId }: UploadProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Seules les images sont acceptées');
      return;
    }
    setBusy(true);
    try {
      onChange(await compressImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Form.Group className="mb-3" controlId={controlId}>
      <Form.Label>{label}</Form.Label>
      <Form.Control type="file" accept="image/*" capture="environment" onChange={handleFile} required={required && !value} />
      {busy && <Spinner size="sm" className="mt-2" />}
      {error && <Form.Text className="text-danger">{error}</Form.Text>}
      {value && (
        <div className="mt-2 d-flex align-items-center gap-2">
          <ReceiptPreview src={value} alt={label} />
          <Button variant="link" size="sm" className="text-danger" onClick={() => onChange('')}>
            Retirer
          </Button>
        </div>
      )}
    </Form.Group>
  );
}

/** Miniature cliquable d'un reçu (image ou ancienne URL). */
export function ReceiptPreview({ src, alt }: { src?: string; alt: string }) {
  const [show, setShow] = useState(false);
  if (!src) return <span className="text-muted small">Non transmis</span>;
  if (/^https?:\/\//.test(src)) {
    return (
      <a href={src} target="_blank" rel="noreferrer noopener">
        Voir
      </a>
    );
  }
  if (!src.startsWith('data:image/')) return <span className="small">Réf. : {src}</span>;
  return (
    <>
      <Image src={src} alt={alt} thumbnail style={{ maxHeight: 90, cursor: 'zoom-in' }} onClick={() => setShow(true)} />
      <Modal show={show} onHide={() => setShow(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{alt}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <Image src={src} alt={alt} fluid />
        </Modal.Body>
      </Modal>
    </>
  );
}

import React from 'react';
import './PdfModal.css';

function PdfModal({ pdfUrl, onClose }) {
  if (!pdfUrl) return null;

  return (
    <div className="pdf-modal" onClick={onClose}>
      <div className="pdf-close-wrapper" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="pdf-content" onClick={(e) => e.stopPropagation()}>
        <iframe src={pdfUrl} width="100%" height="100%" title="PDF Viewer" />
      </div>
    </div>
  );
}

export default PdfModal;

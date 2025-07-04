import React, { useEffect, useState } from 'react';
import './PdfModal.css';

function PdfModal({ pdfUrl, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pdfUrl) return;

    setLoading(true);
    setBlobUrl(null);

    // Fetch the PDF as a blob and create an object URL
    fetch(pdfUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch PDF');
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });

    // Cleanup the blob URL when modal closes or pdfUrl changes
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [pdfUrl]);

  if (!pdfUrl) return null;

  return (
    <div className="pdf-modal" onClick={onClose}>
      <div className="pdf-close-wrapper" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="pdf-content" onClick={(e) => e.stopPropagation()}>
        {loading && <div className="loading-message">Loading PDF...</div>}
        {!loading && blobUrl && (
          <iframe
            src={blobUrl}
            width="100%"
            height="100%"
            title="PDF Viewer"
            frameBorder="0"
          />
        )}
      </div>
    </div>
  );
}

export default PdfModal;

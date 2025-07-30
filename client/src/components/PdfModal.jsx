import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';
import './PdfModal.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function PdfModal({ pdfUrl, onClose }) {
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef(null);
  const canvasRefs = useRef([]);

  useEffect(() => {
    if (!pdfUrl) return;

    const loadPdf = async () => {
      setLoading(true);
      try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        console.error('PDF loading error:', err);
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      if (pdfDoc) {
        pdfDoc.destroy();
      }
    };
  }, [pdfUrl]);

  // Measure container width on mount and resize
  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    return () => window.removeEventListener('resize', updateContainerWidth);
  }, []);

  // Render all pages when PDF doc or dimensions change
  useEffect(() => {
    if (!pdfDoc || !containerWidth || containerWidth <= 0) return;

    const renderPages = async () => {
      try {
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale });
          const canvas = canvasRefs.current[pageNum - 1];
          if (!canvas) continue;
          
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
        }
      } catch (err) {
        console.error('Page render error:', err);
      }
    };

    renderPages();
  }, [pdfDoc, scale, containerWidth]);

  // Calculate optimal scale for page width
  const zoomToPageWidth = async () => {
    if (!pdfDoc || !containerWidth || containerWidth <= 0) return;
    
    try {
      const page = await pdfDoc.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const newScale = (containerWidth - 40) / viewport.width; // 40px padding
      setScale(Math.max(0.5, Math.min(newScale, 3)));
    } catch (err) {
      console.error('Zoom error:', err);
    }
  };

  // Calculate optimal scale for page fit
  const zoomToPageFit = async () => {
    if (!pdfDoc || !containerRef.current) return;
    
    try {
      const page = await pdfDoc.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const containerHeight = containerRef.current.clientHeight;
      
      const widthScale = (containerWidth - 40) / viewport.width;
      const heightScale = (containerHeight - 100) / viewport.height; // 100px for controls
      
      setScale(Math.max(0.5, Math.min(Math.min(widthScale, heightScale), 3)));
    } catch (err) {
      console.error('Zoom error:', err);
    }
  };

  const zoomIn = () => setScale(s => Math.min(s + 0.2, 3));
  const zoomOut = () => setScale(s => Math.max(0.5, s - 0.2));

  if (!pdfUrl) return null;

  return (
    <div className="pdf-modal" onClick={onClose}>
      <div className="pdf-close-wrapper" onClick={e => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div 
        className="pdf-content" 
        onClick={e => e.stopPropagation()}
        ref={containerRef}
      >
        {loading ? (
          <div className="loading-message">Loading PDF...</div>
        ) : (
          <>
            <div className="pdf-pages-container">
              {Array.from({ length: numPages }, (_, i) => (
                <div key={i} className="pdf-page-wrapper">
                  <canvas ref={el => canvasRefs.current[i] = el} />
                  <div className="page-number">Page {i + 1}</div>
                </div>
              ))}
            </div>
            
            <div className="pdf-controls">
              <div className="zoom-controls-group">
                <button onClick={zoomToPageWidth}>Page Width</button>
                <button onClick={zoomToPageFit}>Page Fit</button>
              </div>
              
              <div className="zoom-controls-group">
                <button onClick={zoomOut} aria-label="Zoom out">-</button>
                <span>{Math.round(scale * 100)}%</span>
                <button onClick={zoomIn} aria-label="Zoom in">+</button>
              </div>
              
              <div className="page-info">
                {numPages} page{numPages !== 1 ? 's' : ''}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PdfModal;
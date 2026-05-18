import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';
import './PdfModal.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function PdfModal({ pdfUrl, onClose }) {
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [minScale, setMinScale] = useState(0.1);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef(null);
  const canvasRefs = useRef([]);
  const renderTasks = useRef([]);
  const pdfDocRef = useRef(null);
  const isPinching = useRef(false);
  const touchState = useRef({
    initialDistance: 0,
    initialScale: 1,
    lastScale: 1
  });

  // Load PDF document
  useEffect(() => {
    if (!pdfUrl) return;

    const loadPdf = async () => {
      setLoading(true);
      setError(false);
      try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        pdfDocRef.current = pdf;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        console.error('PDF loading error:', err);
        setLoading(false);
        setError(true);
      }
    };

    loadPdf();

    return () => {
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [pdfUrl]);

  // Clean up render tasks when PDF doc changes
  useEffect(() => {
    return () => {
      if (renderTasks.current) {
        renderTasks.current.forEach(task => {
          if (task && !task.done) task.cancel();
        });
        renderTasks.current = [];
      }
    };
  }, [pdfDoc]);

  // Measure container width on mount and resize
  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateContainerWidth();
    const resizeObserver = new ResizeObserver(updateContainerWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Auto-fit to page width once PDF and container are both ready; also compute minScale
  useEffect(() => {
    if (!pdfDoc || !containerWidth || containerWidth <= 0) return;

    const autoFit = async () => {
      try {
        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        // Minimum scale = whatever makes the page just fit inside the container width
        const fitScale = (containerWidth - 40) / viewport.width;
        setMinScale(Math.min(fitScale, 0.1));
        setScale(Math.min(fitScale, 3));
      } catch (err) {
        console.error('Auto-fit error:', err);
      }
    };

    autoFit();
    // Only run once when first ready — not on every scale change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, containerWidth]);

  // Render PDF pages
  useEffect(() => {
    if (!pdfDoc || !containerWidth || containerWidth <= 0) return;

    let mounted = true;
    const currentTasks = [];
    const dpr = window.devicePixelRatio || 1;

    const renderPages = async () => {
      try {
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          if (!mounted) break;

          const pageIndex = pageNum - 1;
          const page = await pdfDoc.getPage(pageNum);
          if (!mounted) return;

          const viewport = page.getViewport({ scale });
          const canvas = canvasRefs.current[pageIndex];
          if (!canvas) continue;

          // Render at device pixel ratio for sharp text on high-DPI screens
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;

          const context = canvas.getContext('2d');
          context.scale(dpr, dpr);

          // Cancel previous task if exists
          if (renderTasks.current[pageIndex]) {
            renderTasks.current[pageIndex].cancel();
          }

          const task = page.render({
            canvasContext: context,
            viewport: viewport
          });

          renderTasks.current[pageIndex] = task;
          currentTasks.push(task);

          try {
            await task.promise;
          } catch (err) {
            if (err.name !== 'RenderingCancelledException') {
              throw err;
            }
          }
        }
      } catch (err) {
        if (mounted) console.error('Page render error:', err);
      }
    };

    renderPages();

    return () => {
      mounted = false;
      currentTasks.forEach(task => {
        if (!task.done) task.cancel();
      });
    };
  }, [pdfDoc, scale, containerWidth, numPages]);

  // Handle touch events for pinch-to-zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
        isPinching.current = true;
        container.style.touchAction = 'none';
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        touchState.current = {
          initialDistance: distance,
          initialScale: scale,
          lastScale: scale
        };
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );

        if (touchState.current.initialDistance > 0) {
          const scaleChange = currentDistance / touchState.current.initialDistance;
          let newScale = touchState.current.initialScale * scaleChange;

          newScale = 0.7 * newScale + 0.3 * touchState.current.lastScale;
          newScale = Math.max(minScale, Math.min(newScale, 3));

          setScale(newScale);
          touchState.current.lastScale = newScale;
        }
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length < 2) {
        isPinching.current = false;
        container.style.touchAction = '';
        touchState.current.initialDistance = 0;
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [scale]);

  // Zoom functions
  const zoomToPageWidth = async () => {
    if (!pdfDoc || !containerWidth || containerWidth <= 0) return;

    try {
      const page = await pdfDoc.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const newScale = (containerWidth - 40) / viewport.width;
      setScale(Math.max(minScale, Math.min(newScale, 3)));
    } catch (err) {
      console.error('Zoom error:', err);
    }
  };

  const zoomToPageFit = async () => {
    if (!pdfDoc || !containerRef.current) return;

    try {
      const page = await pdfDoc.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const containerHeight = containerRef.current.clientHeight;

      const widthScale = (containerWidth - 40) / viewport.width;
      const heightScale = (containerHeight - 100) / viewport.height;

      setScale(Math.max(minScale, Math.min(Math.min(widthScale, heightScale), 3)));
    } catch (err) {
      console.error('Zoom error:', err);
    }
  };

  const zoomIn = () => setScale(s => Math.min(s + 0.2, 3));
  const zoomOut = () => setScale(s => Math.max(minScale, s - 0.2));

  if (!pdfUrl) return null;

  return (
    <div className="pdf-modal" onClick={onClose}>
      <div
        className="pdf-content"
        onClick={e => e.stopPropagation()}
        ref={containerRef}
      >
        <button className="close-button" onClick={onClose} aria-label="Stäng">×</button>

        {loading && (
          <div className="loading-message">Laddar PDF...</div>
        )}

        {error && (
          <div className="error-message">
            <p>Kunde inte ladda PDF-filen.</p>
            <a href={pdfUrl} download className="download-link">Ladda ner PDF</a>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="pdf-pages-container">
              <div className="pdf-pages-inner">
                {Array.from({ length: numPages }, (_, i) => (
                  <div key={i} className="pdf-page-wrapper">
                    <canvas ref={el => canvasRefs.current[i] = el} />
                    <div className="page-number">Sida {i + 1}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pdf-controls">
              <div className="zoom-controls-group">
                <button onClick={zoomToPageWidth} title="Anpassa till sidbredd"><i className="fas fa-arrows-alt-h"></i></button>
                <button onClick={zoomToPageFit} title="Hela sidan"><i className="fas fa-expand"></i></button>
              </div>

              <div className="zoom-controls-group">
                <button onClick={zoomOut} title="Zooma ut"><i className="fas fa-search-minus"></i></button>
                <span>{Math.round(scale * 100)}%</span>
                <button onClick={zoomIn} title="Zooma in"><i className="fas fa-search-plus"></i></button>
              </div>

              <div className="page-info">
                {numPages} sida{numPages !== 1 ? 'r' : ''}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PdfModal;

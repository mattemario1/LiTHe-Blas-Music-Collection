import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './LyricsModal.css';

function LyricsModal({ lyricsUrl, onClose }) {
  const [markdown, setMarkdown] = useState('');

  useEffect(() => {
    if (lyricsUrl) {
      fetch(lyricsUrl)
        .then((res) => res.text())
        .then(setMarkdown)
        .catch((err) => {
          console.error('Failed to load lyrics:', err);
          setMarkdown('# Error loading lyrics');
        });
    }
  }, [lyricsUrl]);

  if (!lyricsUrl) return null;

  return (
    <div className="lyrics-modal" onClick={onClose}>
      <div className="lyrics-close-wrapper" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="lyrics-content" onClick={(e) => e.stopPropagation()}>
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}

export default LyricsModal;

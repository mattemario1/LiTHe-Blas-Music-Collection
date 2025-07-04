import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import './LyricsModal.css';

function LyricsModal({ lyricsUrl, onClose }) {
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lyricsUrl) return;

    setLoading(true);
    fetch(lyricsUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch lyrics');
        return res.text();
      })
      .then((text) => {
        setMarkdown(text);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setMarkdown('Failed to load lyrics.');
        setLoading(false);
      });
  }, [lyricsUrl]);

  if (!lyricsUrl) return null;

  return (
    <div className="lyrics-modal" onClick={onClose}>
      <div className="lyrics-close-wrapper" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="lyrics-content" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div className="loading-message">Loading lyrics...</div>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkBreaks]}>
            {markdown}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

export default LyricsModal;

import { useState } from 'react';
import './VideoModal.css';

function VideoModal({ videoUrl, onClose }) {
  const [failed, setFailed] = useState(false);

  if (!videoUrl) return null;

  return (
    <div className="video-modal" onClick={onClose}>
      <div className="video-close-wrapper" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="video-content" onClick={(e) => e.stopPropagation()}>
        {failed ? (
          <div className="video-unsupported">
            <p>Det gick inte att spela upp videon.</p>
            <a className="video-download-btn" href={videoUrl} download>
              <i className="fas fa-download"></i> Ladda ner video
            </a>
          </div>
        ) : (
          <video
            src={videoUrl}
            controls
            autoPlay
            onError={() => setFailed(true)}
          />
        )}
      </div>
    </div>
  );
}

export default VideoModal;

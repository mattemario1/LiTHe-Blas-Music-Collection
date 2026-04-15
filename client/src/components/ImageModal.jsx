import React from 'react';
import './ImageModal.css';

function ImageModal({ imageUrl, onClose }) {
  if (!imageUrl) return null;

  return (
    <div className="image-modal" onClick={onClose}>
      <div className="image-close-wrapper" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="image-content" onClick={(e) => e.stopPropagation()}>
        <img src={imageUrl} alt="Bild" />
      </div>
    </div>
  );
}

export default ImageModal;

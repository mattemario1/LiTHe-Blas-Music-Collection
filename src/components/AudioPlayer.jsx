import React, { useRef, useEffect } from 'react';
import './AudioPlayer.css';

const AudioPlayer = ({ audioUrl, onClose }) => {
  const audioRef = useRef(null);

  const skipTime = (seconds) => {
    if (audioRef.current) {
      audioRef.current.currentTime += seconds;
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  };

  const adjustVolume = (delta) => {
    if (audioRef.current) {
      let newVolume = audioRef.current.volume + delta;
      newVolume = Math.max(0, Math.min(1, newVolume)); // Clamp between 0 and 1
      audioRef.current.volume = newVolume;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!audioRef.current) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowRight':
          skipTime(5);
          break;
        case 'ArrowLeft':
          skipTime(-5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          adjustVolume(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          adjustVolume(-0.1);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!audioUrl) return null;

  return (
    <div className="audio-player-container">
      <audio ref={audioRef} controls autoPlay src={audioUrl} className="audio-element" />
      
      <button className="skip-button" onClick={() => skipTime(-5)}>
        <i className="fas fa-undo-alt"></i> 5s
      </button>

      <button className="skip-button" onClick={() => skipTime(5)}>
        5s <i className="fas fa-redo-alt"></i>
      </button>

      <button className="close-button" onClick={onClose}>
        ✖
      </button>
    </div>
  );
};

export default AudioPlayer;

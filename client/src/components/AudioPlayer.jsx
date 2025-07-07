import React, { useState, useEffect } from 'react';
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
import './AudioPlayer.css';

const CustomAudioPlayer = ({ audioUrl, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
  }, [audioUrl]);

  if (!audioUrl) return null;

  return (
    <div className="audio-player-container">
      <div className="loading-bar-wrapper">
        {isLoading && (
          <div className="loading-bar">
            <div className="loading-progress"></div>
          </div>
        )}
      </div>
      <div className="audio-player-inner">
        <AudioPlayer
          src={audioUrl}
          autoPlayAfterSrcChange={true}
          showJumpControls={false}
          onLoadedData={() => setIsLoading(false)}
          autoPlay
        />
        <button className="close-button" onClick={onClose}>
          ✖
        </button>
      </div>
    </div>
  );
};

export default CustomAudioPlayer;

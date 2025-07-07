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
      <button className="close-button" onClick={onClose}>✖</button>
      {isLoading && (
        <div className="loading-bar">
          <div className="loading-progress"></div>
        </div>
      )}
      <AudioPlayer
        src={audioUrl}
        autoPlayAfterSrcChange={true}
        showJumpControls={false}
        onLoadedData={() => setIsLoading(false)}
        autoPlay
      />
    </div>
  );
};

export default CustomAudioPlayer;

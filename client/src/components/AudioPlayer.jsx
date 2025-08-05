import React, { useState, useEffect, useRef } from 'react';
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
import './AudioPlayer.css';

const CustomAudioPlayer = ({ 
  audioUrl, 
  songName = 'Unknown Song', 
  songAlbum = 'Unknown Album',
  songDate = null,
  onClose 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [needsScrolling, setNeedsScrolling] = useState(false);
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const animationRef = useRef(null);
  const [scrollKey, setScrollKey] = useState(0); // new key to force remount

  const formatDateMessage = () => {
    if (songDate) {
      return ` (${songDate})`;
    }
    return '';
  };

  const baseMessage = `${songName} - ${songAlbum}${formatDateMessage()}`;
  const statusMessage = isLoading 
    ? `Loading: ${baseMessage}`
    : `Now Playing: ${baseMessage}`;

  // Check if text needs scrolling
  useEffect(() => {
    const checkScrolling = () => {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const textWidth = textRef.current.scrollWidth;
        
        const shouldScroll = textWidth > containerWidth;
        setNeedsScrolling(shouldScroll);
        
        if (shouldScroll) {
          containerRef.current.style.setProperty(
            '--scroll-container-width', 
            `${containerWidth}px`
          );
        }

        // force key update to reset animation
        setScrollKey(prev => prev + 1);
      }
    };

    checkScrolling();

    const handleResize = () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = requestAnimationFrame(checkScrolling);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [statusMessage]);

  useEffect(() => {
    setIsLoading(true);
  }, [audioUrl]);

  if (!audioUrl) return null;

  return (
    <div className="audio-player-container">
      <button className="close-button" onClick={onClose}>✖</button>
      <div 
        ref={containerRef} 
        className={`status-message ${needsScrolling ? 'scrolling' : ''}`}
      >
        <div className="status-text-container">
          <span 
            key={scrollKey} // force React to remount this span
            ref={textRef} 
            className="status-text"
          >
            {statusMessage}
          </span>
        </div>
      </div>
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

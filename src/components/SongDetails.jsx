import React from 'react';
import './SongDetails.css';

function ExpandableBoxList({ title, items, labelKey, dateKey, type, onPlayAudio }) {
  const [selectedIndex, setSelectedIndex] = React.useState(null);

  const handleClick = (index) => {
    setSelectedIndex(index === selectedIndex ? null : index);
  };

  return (
    <div className="section">
      <h3>{title}</h3>
      <div className="box-list">
        {items.map((item, index) => (
          <React.Fragment key={index}>
            <div
              className={`info-box ${selectedIndex === index ? 'selected' : ''}`}
              onClick={() => handleClick(index)}
            >
              <div className="info-main">
                <strong>{item[labelKey]}</strong>
                <div>{item[dateKey]}</div>
              </div>
              <div className="file-actions horizontal">
                <button
                  className="action-button download"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Download:', item.file);
                  }}
                >
                  <i className="fas fa-download"></i> Download
                </button>
                {type === 'recording' ? (
                  <button
                    className="action-button play"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayAudio?.(item.file);
                    }}
                  >
                    <i className="fas fa-play"></i> Play Music
                  </button>
                ) : type === 'sheet' ? (
                  <button
                    className="action-button pdf"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Show PDF:', item.file);
                    }}
                  >
                    <i className="fas fa-file-pdf"></i> Show PDF
                  </button>
                ) : null}
              </div>
            </div>
            {selectedIndex === index && (
              <div className="details-inline">
                <p>{item.description}</p>
                <p><strong>Tags:</strong> {item.tags?.join(', ') || 'None'}</p>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function SongDetails({ song, onPlayAudio }) {
  if (!song) {
    return <div className="song-details empty">Select a song to see details.</div>;
  }

  return (
    <div className="song-details">
      <h2>{song.name}</h2>
      <p className="description">{song.description}</p>
      <div className="meta">
        <span><strong>Type:</strong> {song.type}</span>
        <span><strong>Status:</strong> {song.status}</span>
      </div>
      <ExpandableBoxList
        title="🎧 Recordings"
        items={song.recordings}
        labelKey="album"
        dateKey="date"
        type="recording"
        onPlayAudio={onPlayAudio}
      />
      <ExpandableBoxList
        title="🎼 Sheet Music"
        items={song.sheetMusic}
        labelKey="instrument"
        dateKey="date"
        type="sheet"
      />
    </div>
  );
}

export default SongDetails;

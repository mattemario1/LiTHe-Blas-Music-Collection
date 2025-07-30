// SongDetails.jsx
import React, { useState } from 'react';
import './SongDetails.css';
import PdfModal from './PdfModal';
import LyricsModal from './LyricsModal';
import SongEditor from './SongEditor';

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
};

function ExpandableBoxList({
  title,
  items,
  labelKey,
  dateKey,
  type,
  onPlayAudio,
  onShowPdf,
  onShowLyrics
}) {
  const [expandedCollections, setExpandedCollections] = useState({});
  const [expandedItems, setExpandedItems] = useState({});

  const toggleCollection = (index) => {
    setExpandedCollections(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const toggleItem = (key) => {
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleActionClick = (e, item, validator, action, errorMsg) => {
    e.stopPropagation();
    if (!validator(item)) {
      alert(errorMsg);
      return;
    }
    action(item);  // Pass the entire item
  };

  const renderActions = (item) => {
    const duration = formatDuration(item.duration);

    return (
      <div className="file-actions horizontal">
        <a
          className="action-button download"
          href={item.file_path ? `/file/${item.file_path}` : "#"}
          download
          onClick={(e) => {
            e.stopPropagation();
            if (!item.file_path) {
              alert("No file available for download.");
              e.preventDefault();
            }
          }}
        >
          <i className="fas fa-download"></i> Download
        </a>

        {type === 'recording' && (
          <div className="play-action-container">
            <button
              className="action-button play"
              onClick={(e) =>
                handleActionClick(
                  e,
                  item,
                  i => i.file_path && typeof i.file_path === 'string',
                  onPlayAudio,
                  "Invalid or missing audio file."
                )
              }
            >
              <i className="fas fa-play"></i> Play Music
            </button>
            {duration && (
              <span className="duration-badge">{duration}</span>
            )}
          </div>
        )}

        {type === 'sheet' && (
          <button
            className="action-button pdf"
            onClick={(e) =>
              handleActionClick(
                e,
                item.file_path,
                f => typeof f === 'string',
                onShowPdf,
                "Invalid or missing PDF file."
              )
            }
          >
            <i className="fas fa-file-pdf"></i> Show PDF
          </button>
        )}

        {type === 'lyrics' && (
          <button
            className="action-button lyrics"
            onClick={(e) =>
              handleActionClick(
                e,
                item.file_path,
                f => typeof f === 'string',
                onShowLyrics,
                "Invalid or missing lyrics file."
              )
            }
          >
            <i className="fas fa-file-alt"></i> Show Lyrics
          </button>
        )}
      </div>
    );
  };

  const renderItem = (item, key, isExpanded) => (
    <div key={key} className="info-box" onClick={() => toggleItem(key)}>
      <div className="info-main">
        <strong>{item.name || item[labelKey]}</strong>
        <div>{item[dateKey]}</div>
      </div>
      {renderActions(item)}
      {isExpanded && (
        <div className="details-inline">
          <p>{item.description}</p>
        </div>
      )}
    </div>
  );

  const collectionItems = items.filter(item => Array.isArray(item.parts));
  const ungroupedItems = items.filter(item => !Array.isArray(item.parts));

  return (
    <div className="section">
      <h3>{title}</h3>
      {collectionItems.map((collection, collectionIndex) => (
        <div key={`collection-${collectionIndex}`} className="collection-block">
          <div className="collection-header" onClick={() => toggleCollection(collectionIndex)}>
            <strong>{collection.name ?? 'Collection'}</strong>
            <p>{collection.description}</p>
          </div>
          {expandedCollections[collectionIndex] && (
            <div className="box-list">
              {collection.parts.map((item, itemIndex) => {
                const key = `c-${collectionIndex}-${itemIndex}`;
                return renderItem(item, key, expandedItems[key]);
              })}
            </div>
          )}
        </div>
      ))}
      {ungroupedItems.length > 0 && (
        <div className="collection-block">
          <div className="box-list">
            {ungroupedItems.map((item, itemIndex) => {
              const key = `u-${itemIndex}`;
              return renderItem(item, key, expandedItems[key]);
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SongDetails({ song, onPlayAudio, onUpdateSong, songs, setSongs, onBack }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [lyricsUrl, setLyricsUrl] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const handlePlayAudio = async (item) => {
    try {
      onPlayAudio(
        `/file/${item.file_path}`,
        song.name,
        item.album || 'Unknown Album',
        item.date
      );
    } catch (err) {
      alert("Failed to play audio.");
    }
  };

  const handleShowPdf = async (filePath) => {
    try {
      const url = `/file/${filePath}`;
      setPdfUrl(url);
    } catch (err) {
      alert("Failed to load PDF.");
    }
  };

  const handleShowLyrics = async (filePath) => {
    try {
      const url = `/file/${filePath}`;
      setLyricsUrl(url);
    } catch (err) {
      alert("Failed to load lyrics.");
    }
  };

  if (isEditing) {
    return (
      <SongEditor
        song={song}
        onSave={(updatedSong) => {
          onUpdateSong(updatedSong);
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
        songs={songs}
        setSongs={setSongs}
      />
    );
  }

  return (
    <div className="song-details">
      <button onClick={onBack} className="back-button-mobile">
        <i className="fas fa-arrow-left"></i> Back to List
      </button>

      <h2>{song.name}</h2>
      <p className="description">{song.description}</p>
      <div className="meta">
        <span><strong>Type:</strong> {song.type}</span>
        <span><strong>Status:</strong> {song.status}</span>
      </div>
      <button onClick={() => setIsEditing(true)}>Edit</button>

      <ExpandableBoxList
        title="🎧 Recordings"
        items={song.recordings}
        labelKey="album"
        dateKey="date"
        type="recording"
        onPlayAudio={handlePlayAudio}
      />

      <ExpandableBoxList
        title="🎼 Sheet Music"
        items={song.sheetMusic}
        labelKey="instrument"
        dateKey="date"
        type="sheet"
        onShowPdf={handleShowPdf}
      />

      <ExpandableBoxList
        title="📝 Lyrics"
        items={song.lyrics}
        labelKey="name"
        dateKey="date"
        type="lyrics"
        onShowLyrics={handleShowLyrics}
      />

      <ExpandableBoxList
        title="📁 Other Files"
        items={song.otherFiles || []}
        labelKey="name"
        dateKey="date"
        type="other"
      />

      {pdfUrl && <PdfModal pdfUrl={pdfUrl} onClose={() => setPdfUrl(null)} />}
      {lyricsUrl && <LyricsModal lyricsUrl={lyricsUrl} onClose={() => setLyricsUrl(null)} />}
    </div>
  );
}

export default SongDetails;
// SongDetails.jsx
import React, { useState } from 'react';
import './SongDetails.css';
import PdfModal from './PdfModal';
import LyricsModal from './LyricsModal';
import SongEditor from './SongEditor';

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

  const handleActionClick = (e, file, validator, action, errorMsg) => {
    e.stopPropagation();
    if (!file || !validator(file)) {
      alert(errorMsg);
      return;
    }
    action(file);
  };

  const renderActions = (item) => {
    const file = item.file;

    return (
      <div className="file-actions horizontal">
        <a
          className="action-button download"
          href={file || "#"}
          download
          onClick={(e) => {
            e.stopPropagation();
            if (!file) {
              alert("No file available for download.");
              e.preventDefault();
            }
          }}
        >
          <i className="fas fa-download"></i> Download
        </a>

        {type === 'recording' && (
          <button
            className="action-button play"
            onClick={(e) =>
              handleActionClick(
                e,
                file,
                f => /\.(mp3|wav|ogg)$/i.test(f),
                onPlayAudio,
                "Invalid or missing audio file."
              )
            }
          >
            <i className="fas fa-play"></i> Play Music
          </button>
        )}

        {type === 'sheet' && (
          <button
            className="action-button pdf"
            onClick={(e) =>
              handleActionClick(
                e,
                file,
                f => f.toLowerCase().endsWith('.pdf'),
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
                file,
                f => /\.(txt|md)$/i.test(f),
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
          <p><strong>Tags:</strong> {item.tags?.join(', ') || 'None'}</p>
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
            <strong>{collection.collection ?? 'Collection'}</strong>
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

function SongDetails({ song, onPlayAudio, onUpdateSong }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [lyricsUrl, setLyricsUrl] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  if (!song) {
    return <div className="song-details empty">Select a song to see details.</div>;
  }

  if (isEditing) {
    return (
      <SongEditor
        song={song}
        onSave={(updatedSong) => {
          onUpdateSong(updatedSong);
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className="song-details">
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
        onPlayAudio={onPlayAudio}
      />

      <ExpandableBoxList
        title="🎼 Sheet Music"
        items={song.sheetMusic}
        labelKey="instrument"
        dateKey="date"
        type="sheet"
        onShowPdf={setPdfUrl}
      />

      <ExpandableBoxList
        title="📝 Lyrics"
        items={song.lyrics}
        labelKey="name"
        dateKey="date"
        type="lyrics"
        onShowLyrics={setLyricsUrl}
      />

      {pdfUrl && <PdfModal pdfUrl={pdfUrl} onClose={() => setPdfUrl(null)} />}
      {lyricsUrl && <LyricsModal lyricsUrl={lyricsUrl} onClose={() => setLyricsUrl(null)} />}
    </div>
  );
}

export default SongDetails;

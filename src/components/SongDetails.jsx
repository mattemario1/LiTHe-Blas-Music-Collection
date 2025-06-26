import React from 'react';
import './SongDetails.css';
import PdfModal from './PdfModal';

function ExpandableBoxList({
  title,
  items,
  labelKey,
  dateKey,
  type,
  onPlayAudio,
  onShowPdf
}) {
  const [expandedCollections, setExpandedCollections] = React.useState({});
  const [expandedItems, setExpandedItems] = React.useState({});

  const toggleCollection = (index) => {
    setExpandedCollections(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const toggleItem = (key) => {
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderItem = (item, key, isExpanded) => (
    <div key={key} className="info-box" onClick={() => toggleItem(key)}>
      <div className="info-main">
        <strong>{item.name || item[labelKey]}</strong>
        <div>{item[dateKey]}</div>
      </div>
      <div className="file-actions horizontal">
        <a className="action-button download" href={item.file} download onClick={(e) => e.stopPropagation()}>
          <i className="fas fa-download"></i> Download
        </a>
        {type === 'recording' && (
          <button className="action-button play" onClick={(e) => { e.stopPropagation(); onPlayAudio?.(item.file); }}>
            <i className="fas fa-play"></i> Play Music
          </button>
        )}
        {type === 'sheet' && (
          <button className="action-button pdf" onClick={(e) => { e.stopPropagation(); onShowPdf?.(item.file); }}>
            <i className="fas fa-file-pdf"></i> Show PDF
          </button>
        )}
      </div>
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

function SongDetails({ song, onPlayAudio }) {
  const [pdfUrl, setPdfUrl] = React.useState(null);

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
        onShowPdf={setPdfUrl}
      />
      <PdfModal pdfUrl={pdfUrl} onClose={() => setPdfUrl(null)} />
    </div>
  );
}

export default SongDetails;

import React from 'react';
import './SongDetails.css';

function ExpandableBoxList({
  title,
  items,
  labelKey,
  dateKey,
  type,
  onPlayAudio,
  onShowPdf
}) {
  const [expandedGroups, setExpandedGroups] = React.useState({});
  const [expandedItems, setExpandedItems] = React.useState({});

  const toggleGroup = (index) => {
    setExpandedGroups(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const toggleItem = (key) => {
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const groupedItems = items.filter(item => Array.isArray(item.parts));
  const ungroupedItems = items.filter(item => !Array.isArray(item.parts));

  return (
    <div className="section">
      <h3>{title}</h3>

      {/* Grouped Items */}
      {groupedItems.map((group, groupIndex) => (
        <div key={`group-${groupIndex}`} className="arrangement-block">
          <div className="arrangement-header" onClick={() => toggleGroup(groupIndex)}>
            <strong>{group.arrangement || group.group || 'Group'}</strong>
            <p>{group.description}</p>
          </div>
          {expandedGroups[groupIndex] && (
            <div className="box-list">
              {group.parts.map((item, itemIndex) => {
                const key = `g-${groupIndex}-${itemIndex}`;
                const isExpanded = expandedItems[key];
                return (
                  <div key={key} className="info-box" onClick={() => toggleItem(key)}>
                    <div className="info-main">
                      <strong>{item.name || item[labelKey]}</strong>
                      <div>{item[dateKey]}</div>
                    </div>
                    <div className="file-actions horizontal">
                      <a className="action-button download" href={item.file} download onClick={(e) => e.stopPropagation()}>
                        <i className="fas fa-download"></i> Download
                      </a>
                      {type === 'recording' ? (
                        <button className="action-button play" onClick={(e) => { e.stopPropagation(); onPlayAudio?.(item.file); }}>
                          <i className="fas fa-play"></i> Play Music
                        </button>
                      ) : type === 'sheet' ? (
                        <button className="action-button pdf" onClick={(e) => { e.stopPropagation(); onShowPdf?.(item.file); }}>
                          <i className="fas fa-file-pdf"></i> Show PDF
                        </button>
                      ) : null}
                    </div>
                    {isExpanded && (
                      <div className="details-inline">
                        <p>{item.description}</p>
                        <p><strong>Tags:</strong> {item.tags?.join(', ') || 'None'}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* Ungrouped Items */}
      {ungroupedItems.length > 0 && (
        <div className="arrangement-block">
          <div className="box-list">
            {ungroupedItems.map((item, itemIndex) => {
              const key = `u-${itemIndex}`;
              const isExpanded = expandedItems[key];
              return (
                <div key={key} className="info-box" onClick={() => toggleItem(key)}>
                  <div className="info-main">
                    <strong>{item.name || item[labelKey]}</strong>
                    <div>{item[dateKey]}</div>
                  </div>
                  <div className="file-actions horizontal">
                    <a className="action-button download" href={item.file} download onClick={(e) => e.stopPropagation()}>
                      <i className="fas fa-download"></i> Download
                    </a>
                    {type === 'recording' ? (
                      <button className="action-button play" onClick={(e) => { e.stopPropagation(); onPlayAudio?.(item.file); }}>
                        <i className="fas fa-play"></i> Play Music
                      </button>
                    ) : type === 'sheet' ? (
                      <button className="action-button pdf" onClick={(e) => { e.stopPropagation(); onShowPdf?.(item.file); }}>
                        <i className="fas fa-file-pdf"></i> Show PDF
                      </button>
                    ) : null}
                  </div>
                  {isExpanded && (
                    <div className="details-inline">
                      <p>{item.description}</p>
                      <p><strong>Tags:</strong> {item.tags?.join(', ') || 'None'}</p>
                    </div>
                  )}
                </div>
              );
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
      {pdfUrl && (
        <div className="pdf-modal" onClick={() => setPdfUrl(null)}>
          <div className="pdf-close-wrapper" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={() => setPdfUrl(null)}>×</button>
          </div>
          <div className="pdf-content" onClick={(e) => e.stopPropagation()}>
            <iframe src={pdfUrl} width="100%" height="100%" title="PDF Viewer" />
          </div>
        </div>
      )}
    </div>
  );
}

export default SongDetails;

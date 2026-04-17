// SongDetails.jsx
import { useState, useRef, useEffect } from 'react';
import './SongDetails.css';
import PdfModal from './PdfModal';
import LyricsModal from './LyricsModal';
import ImageModal from './ImageModal';
import VideoModal from './VideoModal';
import SongEditor from './SongEditor';
import { useAuth } from '../context/AuthContext';

const URL_REGEX = /https?:\/\/[^\s]+/g;

const linkify = (text) => {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  const matches = text.match(URL_REGEX) || [];
  return parts.flatMap((part, i) =>
    i < matches.length
      ? [part, <a key={i} href={matches[i]} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{matches[i]}</a>]
      : [part]
  );
};

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
};

const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'ogv', 'mov', 'mkv', 'avi', 'wmv', 'flv', 'm4v']);
const PDF_EXTS = new Set(['pdf']);
const TEXT_EXTS = new Set(['txt', 'md']);
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp']);

const getExt = (filePath) => {
  if (!filePath) return '';
  const parts = filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

function ItemBox({ item, labelKey, dateKey, isExpanded, onToggle, renderActions }) {
  const nameRef = useRef(null);
  const [nameTruncated, setNameTruncated] = useState(false);

  useEffect(() => {
    if (!isExpanded) {
      const el = nameRef.current;
      if (el) setNameTruncated(el.scrollWidth > el.clientWidth);
    }
  });

  const hasDescription = item.description && item.description.trim().length > 0;
  const canExpand = hasDescription || nameTruncated;

  return (
    <div className={`info-box ${isExpanded ? 'selected' : ''} ${!canExpand ? 'no-expand' : ''}`}>
      <div
        className="info-clickable"
        onClick={() => canExpand && onToggle()}
        style={{ cursor: canExpand ? 'pointer' : 'default' }}
      >
        <div className="info-main">
          <strong className="asset-name" ref={nameRef}>{item[labelKey] || item.name}</strong>
          {!isExpanded && hasDescription && (
            <div className="truncated-description">
              {linkify(item.description)}
            </div>
          )}
          {!isExpanded && canExpand && <span className="expand-hint">▾</span>}
          {isExpanded && canExpand && <span className="expand-hint">▴</span>}
          <div className="asset-date">{item[dateKey]}</div>
        </div>
        {renderActions(item)}
      </div>
      {isExpanded && hasDescription && (
        <div className="details-inline">
          <p>{linkify(item.description)}</p>
        </div>
      )}
    </div>
  );
}

function ExpandableBoxList({
  title,
  items,
  labelKey,
  dateKey,
  onPlayAudio,
  onShowPdf,
  onShowLyrics,
  onShowImage,
  onShowVideo
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
    action(item);
  };

  const renderActions = (item) => {
    const duration = formatDuration(item.duration);
    const ext = getExt(item.file_path);
    const isAudio = AUDIO_EXTS.has(ext);
    const isVideo = VIDEO_EXTS.has(ext);
    const isPdf = PDF_EXTS.has(ext);
    const isText = TEXT_EXTS.has(ext);
    const isImage = IMAGE_EXTS.has(ext);

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
          <i className="fas fa-download"></i> Ladda ner
        </a>

        {isAudio && (
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
              <i className="fas fa-play"></i> Spela Musik
            </button>
            {duration && (
              <span className="duration-badge">{duration}</span>
            )}
          </div>
        )}

        {isPdf && (
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
            <i className="fas fa-file-pdf"></i> Visa PDF
          </button>
        )}

        {isText && (
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
            <i className="fas fa-file-alt"></i> Visa Text
          </button>
        )}

        {isImage && (
          <button
            className="action-button image"
            onClick={(e) =>
              handleActionClick(
                e,
                item.file_path,
                f => typeof f === 'string',
                onShowImage,
                "Invalid or missing image file."
              )
            }
          >
            <i className="fas fa-image"></i> Visa Bild
          </button>
        )}

        {isVideo && (
          <div className="play-action-container">
            <button
              className="action-button video"
              onClick={(e) =>
                handleActionClick(
                  e,
                  item.file_path,
                  f => typeof f === 'string',
                  onShowVideo,
                  "Invalid or missing video file."
                )
              }
            >
              <i className="fas fa-film"></i> Visa Video
            </button>
            {duration && (
              <span className="duration-badge">{duration}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderItem = (item, key, isExpanded) => (
    <ItemBox
      key={key}
      item={item}
      labelKey={labelKey}
      dateKey={dateKey}
      isExpanded={isExpanded}
      onToggle={() => toggleItem(key)}
      renderActions={renderActions}
    />
  );

  // Sort collections alphabetically by name
  const sortedCollections = [...items.filter(item => Array.isArray(item.parts))]
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Sort ungrouped items alphabetically by their labelKey value
  const sortedUngrouped = [...items.filter(item => !Array.isArray(item.parts))]
    .sort((a, b) => (a[labelKey] || '').localeCompare(b[labelKey] || ''));

  // Sort items within each collection alphabetically by their labelKey value
  const collectionsWithSortedParts = sortedCollections.map(collection => ({
    ...collection,
    parts: [...collection.parts].sort((a, b) => 
      (a[labelKey] || '').localeCompare(b[labelKey] || '')
    )
  }));

  const [isSectionOpen, setIsSectionOpen] = useState(true);

  return (
    <div className={`section${isSectionOpen ? '' : ' section-collapsed'}`}>
      <h3 className="section-header" onClick={() => setIsSectionOpen(prev => !prev)}>
        {title}
        <span className="section-toggle">{isSectionOpen ? '▲' : '▼'}</span>
      </h3>
      {isSectionOpen && (
        <div className="section-content">
          {collectionsWithSortedParts.map((collection, collectionIndex) => (
            <div key={`collection-${collectionIndex}`} className="collection-block">
              <div className="collection-header" onClick={() => toggleCollection(collectionIndex)}>
                <strong>{collection.name ?? 'Collection'}</strong>
                <p>{linkify(collection.description)}</p>
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
          {sortedUngrouped.length > 0 && (
            <div className="collection-block">
              <div className="box-list">
                {sortedUngrouped.map((item, itemIndex) => {
                  const key = `u-${itemIndex}`;
                  return renderItem(item, key, expandedItems[key]);
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SongDetails({ song, onPlayAudio, onUpdateSong, songs, setSongs, onBack }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [lyricsUrl, setLyricsUrl] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const { isAdmin } = useAuth();

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

  const handleShowImage = (filePath) => {
    setImageUrl(`/file/${filePath}`);
  };

  const handleShowVideo = (filePath) => {
    setVideoUrl(`/file/${filePath}`);
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

      <h2>{song.name}</h2>
      <p className="description">{linkify(song.description)}</p>
      <div className="meta">
        <span><strong>Typ:</strong> {song.type}</span>
        <span><strong>Status:</strong> {song.status}</span>
      </div>
      {isAdmin && <button onClick={() => setIsEditing(true)}>Edit</button>}

      <ExpandableBoxList
        title="🎧 Inspelningar"
        items={song.recordings}
        labelKey="album"
        dateKey="date"
        onPlayAudio={handlePlayAudio}
        onShowPdf={handleShowPdf}
        onShowLyrics={handleShowLyrics}
        onShowImage={handleShowImage}
        onShowVideo={handleShowVideo}
      />

      <ExpandableBoxList
        title="🎼 Noter"
        items={song.sheetMusic}
        labelKey="instrument"
        dateKey="date"
        onPlayAudio={handlePlayAudio}
        onShowPdf={handleShowPdf}
        onShowLyrics={handleShowLyrics}
        onShowImage={handleShowImage}
        onShowVideo={handleShowVideo}
      />

      <ExpandableBoxList
        title="📝 Text"
        items={song.lyrics}
        labelKey="name"
        dateKey="date"
        onPlayAudio={handlePlayAudio}
        onShowPdf={handleShowPdf}
        onShowLyrics={handleShowLyrics}
        onShowImage={handleShowImage}
        onShowVideo={handleShowVideo}
      />

      <ExpandableBoxList
        title="💃 Dans"
        items={song.danceFiles || []}
        labelKey="name"
        dateKey="date"
        onPlayAudio={handlePlayAudio}
        onShowPdf={handleShowPdf}
        onShowLyrics={handleShowLyrics}
        onShowImage={handleShowImage}
        onShowVideo={handleShowVideo}
      />

      <ExpandableBoxList
        title="📁 Andra Filer"
        items={song.otherFiles || []}
        labelKey="name"
        dateKey="date"
        onPlayAudio={handlePlayAudio}
        onShowPdf={handleShowPdf}
        onShowLyrics={handleShowLyrics}
        onShowImage={handleShowImage}
        onShowVideo={handleShowVideo}
      />

      {pdfUrl && <PdfModal pdfUrl={pdfUrl} onClose={() => setPdfUrl(null)} />}
      {lyricsUrl && <LyricsModal lyricsUrl={lyricsUrl} onClose={() => setLyricsUrl(null)} />}
      {imageUrl && <ImageModal imageUrl={imageUrl} onClose={() => setImageUrl(null)} />}
      {videoUrl && <VideoModal videoUrl={videoUrl} onClose={() => setVideoUrl(null)} />}
    </div>
  );
}

export default SongDetails;
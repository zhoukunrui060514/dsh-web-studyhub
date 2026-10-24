import React from 'react';
import { createPortal } from 'react-dom';
import { ui, useUiLanguage } from './i18n.js';
import { Dialog } from './components/index.js';
import { safeStudyImage, studyAssetId } from './study-media.js';
import { useSciencePreferences } from './SciencePreferences.jsx';
import { AppContext } from './app/app-context.js';

export default function StudyImage({ src, alt, interactive }) {
  const app = React.useContext(AppContext), assetId = studyAssetId(src);
  const call = app?.core?.call;
  const identity = JSON.stringify([app?.data?.root, src]);
  const [resource, setResource] = React.useState(null);
  React.useEffect(() => {
    if (!assetId || !call) return;
    let live = true, url;
    call('materials.book.asset.get', { assetId }).then(result => {
      if (!live) return;
      const bytes = Uint8Array.from(atob(result.dataBase64), ch => ch.charCodeAt(0));
      url = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
      setResource({ identity, url });
    }, () => { if (live) setResource({ identity, error: true }); });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [assetId, identity, call]);
  const preferences = useSciencePreferences();
  interactive = interactive && preferences.imageEnlarge;
  useUiLanguage();
  const [failed, setFailed] = React.useState(false), [open, setOpen] = React.useState(false);
  const safe = assetId ? resource?.identity === identity ? resource.url : null : safeStudyImage(src);
  React.useEffect(() => { setFailed(false); setOpen(false); }, [identity]);
  const stop = event => event.stopPropagation();
  const unavailable = ui('图片不可用');
  if (assetId && app?.core?.call && resource?.identity !== identity) return <span className="md-image-fallback" role="status">{ui('正在读取图片…')}</span>;
  if (!safe || failed) return <span className="md-image-fallback" role="img" aria-label={alt ? alt + ': ' + unavailable : unavailable}>
    {alt && <span className="md-image-caption">{alt}</span>}<span>{unavailable}</span>
  </span>;
  const image = <img src={safe} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => { setFailed(true); setOpen(false); }} />;
  const host = typeof document === 'undefined' ? null : document.querySelector('.study-app') || document.body;
  const caption = alt && preferences.imageCaptions && <span className="md-image-caption">{alt}</span>;
  return <span className={'md-image' + (interactive ? '' : ' md-image-static')}>
    {interactive ? <button type="button" className="md-image-open" aria-label={`${ui('放大图片')}${alt ? ': ' + alt : ''}`} onClick={event => { stop(event); setOpen(true); }} onKeyDown={stop}>
      {image}<span className="md-image-info">{caption}<span className="md-image-action" aria-hidden="true">{ui('放大查看')}</span></span>
    </button> : <>{image}{caption}</>}
    {/* The dialog is portalled out of the text, and its events must not reach the card or row the image sits in. */}
    {open && host && createPortal(<span style={{ display: 'contents' }} onClick={stop} onKeyDown={stop}>
      <Dialog title={alt || ui('图片预览')} size="media" onClose={() => setOpen(false)}>
        <div className="md-image-dialog-canvas"><img src={safe} alt={alt} referrerPolicy="no-referrer" onError={() => { setFailed(true); setOpen(false); }} /></div>
      </Dialog>
    </span>, host)}
  </span>;
}

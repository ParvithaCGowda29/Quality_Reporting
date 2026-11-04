// Add files popup: an Uppy Dashboard in our own modal, with Choose folder / Bulk upload / Zip upload tabs.
// No upload endpoint is connected (no tus/XHR plugin installed), so files are only collected in the browser: the footer
// says so and nothing is shown as "uploaded". Email inbox and SharePoint watch are shown disabled (not built yet).
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Uppy from '@uppy/core'
import Dashboard from '@uppy/react/dashboard'
import { useUppyState } from '@uppy/react'
import '@uppy/core/css/style.min.css'
import '@uppy/dashboard/css/style.min.css'
import { useUi } from '../lib/store'
import { Icon } from './ui'
import './upload.css'

export const uppy = new Uppy({ autoProceed: false })
export const useFileCount = () => useUppyState(uppy, s => Object.keys(s.files).length)

const TABS = [
  { id: 'folder', label: 'Choose folder', icon: 'folder', select: 'folders' as const, drop: 'Drop a folder here or %{browseFolders}' },
  { id: 'bulk', label: 'Bulk upload', icon: 'files', select: 'files' as const, drop: 'Drop files here or %{browseFiles}' },
  { id: 'zip', label: 'Zip upload', icon: 'zip', select: 'files' as const, drop: 'Drop a .zip here or %{browseFiles}' },
]

export function UploadDialog({ onClose }: { onClose: () => void }) {
  const theme = useUi(s => s.theme)
  const [tab, setTab] = useState(0)
  const n = useFileCount()
  const box = useRef<HTMLDivElement>(null)
  const t = TABS[tab]

  useEffect(() => {
    uppy.setOptions({ restrictions: t.id === 'zip' ? { allowedFileTypes: ['.zip'], maxNumberOfFiles: 1 } : {} })
  }, [t.id])
  useEffect(() => {
    const from = document.activeElement as HTMLElement | null
    box.current?.focus()
    return () => from?.focus?.()
  }, [])

  return createPortal(
    <div className="up-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={box} className="up-dialog" role="dialog" aria-modal="true" aria-labelledby="up-title" tabIndex={-1}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}>
        <header className="up-head">
          <h2 id="up-title">Add files</h2>
          <button type="button" className="icon-btn sm" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
        </header>
        <div className="up-tabs" role="tablist" aria-label="How to add files">
          {TABS.map((x, i) => (
            <button key={x.id} type="button" role="tab" aria-selected={tab === i} className={`up-tab${tab === i ? ' on' : ''}`} onClick={() => setTab(i)}>
              <Icon name={x.icon} size={14} />{x.label}
            </button>
          ))}
        </div>
        <div className="up-dash">
          <Dashboard uppy={uppy} width="100%" height={300} theme={theme} hideUploadButton disableStatusBar proudlyDisplayPoweredByUppy={false}
            fileManagerSelectionType={t.select} showRemoveButtonAfterComplete note="Drawings, SOPs, client emails, Excel - any project document"
            locale={{ strings: { dropPasteFolders: TABS[0].drop, dropPasteFiles: t.drop, dropPasteBoth: t.drop } }} />
        </div>
        <div className="up-pull">
          <span>Pull from</span>
          <button type="button" disabled title="Coming soon"><Icon name="note" size={13} />Email inbox</button>
          <button type="button" disabled title="Coming soon"><Icon name="folder" size={13} />SharePoint watch</button>
        </div>
        <footer className="up-foot">
          <span className="up-count" aria-live="polite">{n ? `${n} file${n === 1 ? '' : 's'} selected · not uploaded yet (no storage connected)` : 'No files selected'}</span>
          <button type="button" className="up-done" disabled={!n} onClick={onClose}>Done ({n} file{n === 1 ? '' : 's'})</button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

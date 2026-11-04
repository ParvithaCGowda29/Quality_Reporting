// BuLLMaps Assistant (middle pane), on assistant-ui primitives with a local runtime. It owns the router: it takes the
// request (typed or a voice note), asks ONE short clarifying question when something is missing, reads the plan back
// and hard-stops for approval (skills/router.ts). Nothing here publishes or spends.
// Chat layout: ChatGPT-style thread. Empty = Orb + greeting + composer + starter chips; then accent user bubbles
// (editable; edit + resend regenerates), replies beside a "B" avatar with an always-visible action bar, streamed with Stop.
// "+" attaches files to the chat only.
import './assistant.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActionBarMorePrimitive, ActionBarPrimitive, AssistantRuntimeProvider, AttachmentPrimitive, AuiIf, ComposerPrimitive, MessagePartPrimitive, MessagePrimitive, ThreadPrimitive, WebSpeechSynthesisAdapter, useAuiState, useLocalRuntime, type AttachmentAdapter, type ChatModelAdapter } from '@assistant-ui/react'
import { createDictation, fmtClock, stopDictation, useDictate } from './dictation'
import { setUi, useUi } from '../lib/store'
import { sendToRouter, useTask } from '../skills/task'
import { Icon, Tip, fmtBytes } from './ui'
import Orb from './reactbits/Orb'

/** Empty-state chips: shown until the first message, then gone. */
export const STARTER_CHIPS = ['Draft the PFD for part 1801EA300070N', 'Draft the PFMEA failure modes and ratings', 'Start an 8D for the INDIC complaint', 'What data is still missing for the PFMEA?']
const HELPER = 'Nothing publishes or spends without your approval.'
const attachmentReply = (names: string[]) => `I can't open ${names.length === 1 ? names[0] : `${names.length} files`} yet. Tell me what's in it, or what you'd like done with it.`

const dictation = createDictation()
const speech = typeof speechSynthesis !== 'undefined' ? new WebSpeechSynthesisAdapter() : undefined
// Chat attachments stay in the thread; nothing is uploaded.
const chatFiles: AttachmentAdapter = {
  accept: '*',
  async add({ file }) { return { id: crypto.randomUUID(), type: 'file', name: file.name, contentType: file.type, file, status: { type: 'requires-action', reason: 'composer-send' } } },
  async send(a) { return { ...a, status: { type: 'complete' }, content: [] } },
  async remove() {},
}
// ponytail: no feedback service; thumbs live on the message only (assistant-ui metadata). Wire submit when one exists.
const feedback = { submit: () => {} }

export function AssistantPane() {
  const collapsed = useUi(s => s.shell.assistant)
  const note = useTask(s => s.note)
  const fresh = useTask(s => s.fresh)
  // The adapter is created once (stable runtime); every turn goes through the router.
  const adapter = useMemo<ChatModelAdapter>(() => ({
    // The reply streams in (blinking cursor); Stop aborts it and keeps what has arrived.
    async *run({ messages, abortSignal }) {
      const last = messages[messages.length - 1]
      const text = (last?.content.map(p => (p.type === 'text' ? p.text : '')).join(' ') ?? '').trim()
      const files = last?.role === 'user' ? last.attachments.map(a => a.name) : []
      const full = files.length && !text ? attachmentReply(files) : sendToRouter(text)
      for (let i = 4; ; i += 4) {
        if (abortSignal.aborted) return
        yield { content: [{ type: 'text', text: full.slice(0, i) }] }
        if (i >= full.length) return
        await new Promise(r => setTimeout(r, 16))
      }
    },
  }), [])
  const runtime = useLocalRuntime(adapter, { adapters: { attachments: chatFiles, feedback, ...(dictation && { dictation }), ...(speech && { speech }) } })
  // Approve / Cancel in Results & edits answer in the thread, once per action.
  const posted = useRef(0)
  useEffect(() => {
    if (!note || note.id === posted.current) return
    posted.current = note.id
    void runtime.thread.append({ role: 'assistant', content: [{ type: 'text', text: note.text }] })
  }, [note, runtime])
  // + Task: a fresh thread (the Orb returns) and the composer focused.
  const seen = useRef(fresh)
  useEffect(() => {
    if (fresh === seen.current) return
    seen.current = fresh
    runtime.thread.reset()
    requestAnimationFrame(() => document.getElementById('as-input')?.focus())
  }, [fresh, runtime])
  const toggle = () => setUi(s => ({ shell: { ...s.shell, assistant: !s.shell.assistant } }))

  // Hidden by the person only; the runtime provider stays mounted, so the thread keeps its messages.
  if (collapsed) return (
    <AssistantRuntimeProvider runtime={runtime}>
      <aside className="shell-pane shell-rail" aria-label="BuLLMaps Assistant">
        <button className="rail-show" onClick={toggle} aria-expanded={false} aria-label="Show assistant">
          <Icon name="panel-right" size={16} /><span>Show assistant</span>
        </button>
      </aside>
    </AssistantRuntimeProvider>
  )
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <aside className="shell-pane assist" aria-labelledby="assist-title">
        <header className="shell-head">
          <h2 id="assist-title"><Icon name="sparkle" size={13} />BuLLMaps Assistant</h2>
          <button className="btn btn-ghost sm as-hide" onClick={toggle} aria-expanded aria-label="Hide assistant"><Icon name="panel-left" size={14} />Hide assistant</button>
        </header>
        <ThreadBody />
      </aside>
    </AssistantRuntimeProvider>
  )
}

/** Empty: the greeting with the composer and starter chips centred. Otherwise the thread, then the composer. */
function ThreadBody() {
  const empty = useAuiState(s => s.thread.messages.length === 0)
  // The first message: the idle Orb and greeting fade out over the conversation as it fades in (~300ms, no snap).
  const [leaving, setLeaving] = useState(false)
  const wasEmpty = useRef(empty)
  useEffect(() => { if (wasEmpty.current && !empty) setLeaving(true); wasEmpty.current = empty }, [empty])
  useEffect(() => { if (!leaving) return; const t = setTimeout(() => setLeaving(false), 300); return () => clearTimeout(t) }, [leaving])
  return (
    <ThreadPrimitive.Root className="as-thread">
      {/* Files dropped on the pane attach to the chat, like "+". */}
      <ComposerPrimitive.AttachmentDropzone className="as-dropzone">
        {empty ? <div className="as-empty">
          <IdleOrb />
          <h3 className="as-hello">How can I help you today?</h3>
          <p className="as-sub">Tell me what you need - type it or send a voice note.</p>
          <Composer chips={STARTER_CHIPS} />
        </div> : <>
          {leaving && <div className="as-empty as-empty-ghost" aria-hidden><IdleOrb paused /><h3 className="as-hello">How can I help you today?</h3></div>}
          <ThreadPrimitive.Viewport className={`as-viewport${leaving ? ' as-fade-in' : ''}`}>
            <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage, EditComposer }} />
          </ThreadPrimitive.Viewport>
          <Composer chips={[]} />
        </>}
      </ComposerPrimitive.AttachmentDropzone>
    </ThreadPrimitive.Root>
  )
}

// Style-guide blues only: the accent, a light tint of it (the swirl blends these two, so it must differ enough to read),
// and a shadow tone. The Orb parses colour strings, not CSS vars.
const ORB = { light: { colors: ['#3D66DB', '#A9BFF5', '#C5D0E1'], background: '#FFFFFF' }, dark: { colors: ['#5B83F2', '#9DB6F7', '#142540'], background: '#101E32' } }
/** The idle-assistant Orb above the greeting: slow, low hover lean, dimmed (in CSS: its own opacity greys a light background). */
function IdleOrb({ paused }: { paused?: boolean }) {
  const o = ORB[useUi(s => s.theme)]
  return <div className="as-orb" aria-hidden><Orb colors={o.colors} backgroundColor={o.background} speed={1.05} hoverIntensity={0.3} glow={0.8}
    size={1} rotateOnHover={false} clickPulse={false} intro={!paused} paused={paused} /></div>
}

/** Attachment cards, the rounded composer (+ · input · mic · Send / Stop), then the suggestion chips. */
function Composer({ chips }: { chips: string[] }) {
  return <div className="as-compose">
    <AuiIf condition={s => s.composer.attachments.length > 0}>
      <div className="as-files"><ComposerPrimitive.Attachments components={{ Attachment: ChatFile }} /></div>
    </AuiIf>
    {dictation && <DictatePill />}
    <ComposerPrimitive.Root className="as-composer">
      <Tip text="Attach a file">
        <ComposerPrimitive.AddAttachment className="as-attach" aria-label="Attach a file"><Icon name="tb-plus" size={18} /></ComposerPrimitive.AddAttachment>
      </Tip>
      <label className="sr-only" htmlFor="as-input">Message the BuLLMaps Assistant</label>
      <div className="as-field">
        <ComposerPrimitive.Input id="as-input" className="as-input" rows={1} placeholder="Ask or instruct the assistant..." />
        {dictation && <DictateListening />}
      </div>
      <DictateControls />
      <AuiIf condition={s => !s.thread.isRunning}>
        <ComposerPrimitive.Send className="as-send" aria-label="Send message"><Icon name="tb-send" size={16} /></ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={s => s.thread.isRunning}>
        <ComposerPrimitive.Cancel className="as-send as-stop" aria-label="Stop generating"><Icon name="tb-player-stop-filled" size={14} /></ComposerPrimitive.Cancel>
      </AuiIf>
    </ComposerPrimitive.Root>
    {dictation && <DictateNote />}
    {chips.length > 0 && <div className="as-sugs" aria-label="Suggestions">
      {chips.map(c => <ThreadPrimitive.Suggestion key={c} className="as-sug" prompt={c} send>{c}</ThreadPrimitive.Suggestion>)}
    </div>}
  </div>
}

function ChatFile() {
  const a = useAuiState(s => s.attachment)
  return <AttachmentPrimitive.Root className="as-file">
    <Icon name="tb-file-text" size={22} />
    <span className="as-file-meta"><strong><AttachmentPrimitive.Name /></strong>{a.file && <span>{fmtBytes(a.file.size)}</span>}</span>
    <AttachmentPrimitive.Remove className="as-file-x" aria-label={`Remove ${a.name}`}><Icon name="tb-x" size={14} /></AttachmentPrimitive.Remove>
  </AttachmentPrimitive.Root>
}
function SentFile() {
  const name = useAuiState(s => s.attachment.name)
  return <span className="as-sent-file"><Icon name="tb-file-text" size={14} />{name}</span>
}

// ---- Voice notes: Idle · Requesting · Listening · Transcribing · Draft ready · Microphone blocked · Error (dictation.ts) ----
function DictatePill() {
  const d = useDictate()
  if (d.phase !== 'transcribing') return null
  return <div className="as-dict-pill-row" aria-live="polite">
    <span className="as-dict-pill"><Icon name="tb-loader" size={12} spin />Transcribing…</span>
  </div>
}
function DictateControls() {
  const d = useDictate()
  // Escape stops a recording (the transcript stays as an editable draft), or cancels a pending microphone request.
  useEffect(() => {
    if (d.phase !== 'listening' && d.phase !== 'requesting') return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); stopDictation() } }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [d.phase])
  // ponytail: no speech recognition in this browser = a stub mic that says so; wire a recorder + upload adapter later.
  if (!dictation) return <button type="button" className="as-dictate" aria-label="Voice note" data-tip="Voice notes are not available in this browser yet" aria-disabled>
    <Icon name="tb-microphone" size={16} /></button>
  if (d.phase === 'transcribing') return <button type="button" className="as-dictate busy" disabled aria-label="Transcribing"><Icon name="tb-loader" size={16} spin /></button>
  if (d.phase === 'requesting') return <button type="button" className="as-dictate rec req" disabled aria-label="Requesting microphone...">
    <Icon name="tb-loader" size={16} spin /></button>
  if (d.phase === 'listening') return <ComposerPrimitive.StopDictation className="as-dictate rec" aria-label="Stop recording">
    <span className="as-eq" aria-hidden>{[0, 1, 2, 3, 4].map(i => <i key={i} />)}</span>
  </ComposerPrimitive.StopDictation>
  return <ComposerPrimitive.Dictate className="as-dictate" aria-label="Voice note" aria-describedby={d.blocked ? 'as-dict-note' : undefined} data-tip="Voice note">
    <Icon name="tb-microphone" size={16} /></ComposerPrimitive.Dictate>
}
/** While the microphone is requested the input says so; while listening, "Listening... speak now" with the timer. */
function DictateListening() {
  const d = useDictate()
  const [, tick] = useState(0)
  useEffect(() => { if (d.phase !== 'listening') return; const t = setInterval(() => tick(n => n + 1), 500); return () => clearInterval(t) }, [d.phase])
  if (d.phase === 'requesting') return <div className="as-listen"><span className="as-listen-text" role="status">Requesting microphone...</span></div>
  if (d.phase !== 'listening') return null
  return <div className="as-listen">
    <span className="as-listen-text" role="status">Listening... speak now</span>
    <span className="as-timer" aria-label="Recording time">{fmtClock(Date.now() - d.startedAt)}</span>
  </div>
}
function DictateNote() {
  const d = useDictate()
  if (d.phase !== 'idle') return null
  if (d.blocked) return <p className="as-dict-note" id="as-dict-note" role="status">Microphone blocked - allow access to send voice notes</p>
  if (d.error) return <p className="as-dict-note" role="status">{d.error}</p>
  return null
}

function UserMessage() {
  return <MessagePrimitive.Root className="as-urow">
    <MessagePrimitive.Attachments components={{ Attachment: SentFile }} />
    <div className="as-uline">
      <ActionBarPrimitive.Root className="as-uedit">
        <ActionBarPrimitive.Edit className="as-ibtn" aria-label="Edit message"><Icon name="tb-pencil" size={15} /></ActionBarPrimitive.Edit>
      </ActionBarPrimitive.Root>
      <div className="as-msg as-user"><MessagePrimitive.Parts /></div>
    </div>
  </MessagePrimitive.Root>
}
/** Edit and resend: the bubble becomes an editable box; Send regenerates the reply that followed it. */
function EditComposer() {
  return <ComposerPrimitive.Root className="as-edit">
    <ComposerPrimitive.Input className="as-edit-input" aria-label="Edit message" autoFocus />
    <div className="as-edit-actions">
      <ComposerPrimitive.Cancel className="as-pill">Cancel</ComposerPrimitive.Cancel>
      <ComposerPrimitive.Send className="as-pill primary">Send</ComposerPrimitive.Send>
    </div>
  </ComposerPrimitive.Root>
}
/** Reply text with a blinking caret while it streams (assistant-ui's in-progress slot). */
const ReplyText = () => <p><MessagePartPrimitive.Text /><MessagePartPrimitive.InProgress><span className="as-caret" aria-hidden /></MessagePartPrimitive.InProgress></p>
const Generating = () => <span className="as-gen" role="status"><span className="as-dots" aria-hidden><i /><i /><i /></span>Assistant is generating...</span>
/** Always visible (not on hover): copy, thumbs up / down, more. No regenerate: the router keeps state, so a rerun would answer twice. */
function ReplyActions() {
  return <ActionBarPrimitive.Root className="as-actions" autohide="never">
    <ActionBarPrimitive.Copy className="as-ibtn" aria-label="Copy">
      <AuiIf condition={s => s.message.isCopied}><Icon name="tb-check" size={16} /></AuiIf>
      <AuiIf condition={s => !s.message.isCopied}><Icon name="tb-copy" size={16} /></AuiIf>
    </ActionBarPrimitive.Copy>
    <ActionBarPrimitive.FeedbackPositive className="as-ibtn" aria-label="Good reply"><Icon name="tb-thumb-up" size={16} /></ActionBarPrimitive.FeedbackPositive>
    <ActionBarPrimitive.FeedbackNegative className="as-ibtn" aria-label="Bad reply"><Icon name="tb-thumb-down" size={16} /></ActionBarPrimitive.FeedbackNegative>
    <ActionBarMorePrimitive.Root>
      <ActionBarMorePrimitive.Trigger className="as-ibtn" aria-label="More actions"><Icon name="tb-dots" size={16} /></ActionBarMorePrimitive.Trigger>
      <ActionBarMorePrimitive.Content className="as-more" align="start" sideOffset={4}>
        {speech && <ActionBarMorePrimitive.Item asChild><ActionBarPrimitive.Speak className="as-more-item">Read aloud</ActionBarPrimitive.Speak></ActionBarMorePrimitive.Item>}
        <ActionBarMorePrimitive.Item asChild><ActionBarPrimitive.ExportMarkdown className="as-more-item">Download as Markdown</ActionBarPrimitive.ExportMarkdown></ActionBarMorePrimitive.Item>
      </ActionBarMorePrimitive.Content>
    </ActionBarMorePrimitive.Root>
  </ActionBarPrimitive.Root>
}
function AssistantMessage() {
  const status = useAuiState(({ message }) => message.status?.type)
  const empty = useAuiState(({ message }) => !message.content.some(p => p.type === 'text' && p.text))
  const isLast = useAuiState(({ message }) => message.isLast)
  const running = status === 'running'
  const avatar = <span className="as-avatar" aria-hidden>B</span>
  if (running && empty) return <MessagePrimitive.Root className="as-arow">{avatar}<div className="as-abody"><Generating /></div></MessagePrimitive.Root>
  return <MessagePrimitive.Root className="as-arow">{avatar}<div className="as-abody">
    <div className="as-msg as-bot"><MessagePrimitive.Parts components={{ Text: ReplyText }} /></div>
    {running ? <Generating /> : <ReplyActions />}
    {isLast && !running && <p className="as-helper">{HELPER}</p>}
  </div></MessagePrimitive.Root>
}

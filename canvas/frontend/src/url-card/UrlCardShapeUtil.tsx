import { type KeyboardEvent, type ReactNode, useState } from 'react'
import {
  BaseBoxShapeUtil,
  type Editor,
  HTMLContainer,
  Rectangle2d,
  stopEventPropagation,
  T,
  type TLResizeInfo,
  type TLShape,
  type TLShapeId,
  resizeBox,
  useEditor,
  useIsEditing,
} from 'tldraw'
import { api, type PrChecks, type PrState, type UnfurlResult } from '../api'

export const URL_CARD_TYPE = 'url-card'

export interface UrlCardPr {
  owner: string
  repo: string
  number: number
  state: PrState | null
  author: string | null
  // Optional so cards saved before this field existed still pass validation; the next refresh fills it in.
  approved?: boolean
  // Optional for the same reason as `approved`.
  checks?: PrChecks | null
}

export interface UrlCardProps {
  w: number
  h: number
  url: string
  status: 'empty' | 'loading' | 'ready'
  kind: 'link' | 'github_pr'
  title: string | null
  // User-set title for link cards; overrides the unfurled `title`. Optional so older saved cards still validate.
  customTitle?: string
  pr: UrlCardPr | null
}

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    [URL_CARD_TYPE]: UrlCardProps
  }
}

export type UrlCardShape = TLShape<typeof URL_CARD_TYPE>

const SIZES = {
  empty: { w: 340, h: 56 },
  link: { w: 320, h: 64 },
  github_pr: { w: 360, h: 92 },
}

export function defaultUrlCardSize(kind: keyof typeof SIZES) {
  return SIZES[kind]
}


export function applyUnfurl(result: UnfurlResult): Partial<UrlCardProps> {
  return {
    status: 'ready',
    kind: result.kind,
    title: result.title,
    pr: result.kind === 'github_pr' ? result.pr : null,
  }
}

export async function postUrl(editor: Editor, id: TLShapeId, url: string) {
  editor.updateShape<UrlCardShape>({
    id,
    type: URL_CARD_TYPE,
    props: { url, status: 'loading', title: null, pr: null, kind: 'link', ...SIZES.link },
  })
  let props: Partial<UrlCardProps>
  try {
    props = applyUnfurl(await api.unfurl(url))
  } catch {
    props = { status: 'ready', kind: 'link', title: null, pr: null }
  }
  if (!editor.getShape(id)) return
  editor.updateShape<UrlCardShape>({
    id,
    type: URL_CARD_TYPE,
    // PR cards always show the PR's own title, so a custom title from an earlier link would just be stale.
    props: { ...props, ...SIZES[props.kind ?? 'link'], ...(props.kind === 'github_pr' && { customTitle: undefined }) },
  })
}

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const u = new URL(withScheme)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export class UrlCardShapeUtil extends BaseBoxShapeUtil<UrlCardShape> {
  static override type = URL_CARD_TYPE
  static override props = {
    w: T.number,
    h: T.number,
    url: T.string,
    status: T.literalEnum('empty', 'loading', 'ready'),
    kind: T.literalEnum('link', 'github_pr'),
    title: T.string.nullable(),
    customTitle: T.string.optional(),
    pr: T.object({
      owner: T.string,
      repo: T.string,
      number: T.number,
      state: T.literalEnum('open', 'draft', 'queued', 'merged', 'closed').nullable(),
      author: T.string.nullable(),
      approved: T.boolean.optional(),
      checks: T.literalEnum('passing', 'failing', 'pending').nullable().optional(),
    }).nullable(),
  }

  override getDefaultProps(): UrlCardProps {
    return { ...SIZES.empty, url: '', status: 'empty', kind: 'link', title: null, pr: null }
  }

  override canEdit() {
    return true
  }

  override getGeometry(shape: UrlCardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override onResize(shape: UrlCardShape, info: TLResizeInfo<UrlCardShape>) {
    return resizeBox(shape, info, { minWidth: 200, minHeight: 48 })
  }

  override onEditEnd(shape: UrlCardShape) {
    if (!shape.props.url) this.editor.deleteShape(shape.id)
  }

  override component(shape: UrlCardShape) {
    return <UrlCard shape={shape} />
  }

  override getIndicatorPath(shape: UrlCardShape) {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 10)
    return path
  }
}

function UrlCard({ shape }: { shape: UrlCardShape }) {
  const isEditing = useIsEditing(shape.id)
  const { url, status, kind } = shape.props

  return (
    <HTMLContainer className="url-card-container">
      {isEditing || status === 'empty' ? (
        <UrlInput shape={shape} />
      ) : status === 'loading' ? (
        <div className="url-card url-card-link">
          <span className="url-card-spinner" />
          <span className="url-card-muted url-card-ellipsis">Fetching {hostname(url)}…</span>
        </div>
      ) : kind === 'github_pr' && shape.props.pr ? (
        <PrCard url={url} title={shape.props.title} pr={shape.props.pr} />
      ) : (
        <LinkCard url={url} title={shape.props.customTitle ?? shape.props.title} />
      )}
    </HTMLContainer>
  )
}

function UrlInput({ shape }: { shape: UrlCardShape }) {
  const editor = useEditor()
  const [value, setValue] = useState(shape.props.url)
  const [titleValue, setTitleValue] = useState(shape.props.customTitle ?? '')
  const [invalid, setInvalid] = useState(false)
  const canEditTitle = shape.props.status === 'ready' && shape.props.kind === 'link'

  const finishEditing = () => {
    editor.setEditingShape(null)
    editor.setCurrentTool('select.idle')
  }

  const submit = () => {
    const url = normalizeUrl(value)
    if (!url) {
      setInvalid(true)
      return
    }
    // postUrl sets the URL synchronously, so onEditEnd (fired by finishEditing) won't treat the card as empty.
    const unchanged = url === shape.props.url
    // Blank means "use the unfurled title".
    const customTitle = titleValue.trim() || undefined
    const titleChanged = canEditTitle && customTitle !== shape.props.customTitle
    // For a brand-new card, fold the post into the creation step so one undo removes it.
    if (shape.props.url && (!unchanged || titleChanged)) editor.markHistoryStoppingPoint('edit url card')
    if (!unchanged) void postUrl(editor, shape.id, url)
    if (titleChanged) editor.updateShape<UrlCardShape>({ id: shape.id, type: URL_CARD_TYPE, props: { customTitle } })
    finishEditing()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (e.key === 'Escape') finishEditing()
  }

  const urlRow = (
    <>
      <input
        autoFocus={!canEditTitle}
        type="text"
        placeholder="Paste a URL and press Enter"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setInvalid(false)
        }}
        onKeyDown={onKeyDown}
        onPointerDown={stopEventPropagation}
      />
      <button type="submit" onPointerDown={stopEventPropagation}>
        Post
      </button>
    </>
  )

  return (
    <form
      className={`url-card url-card-input ${canEditTitle ? 'is-stacked' : ''} ${invalid ? 'is-invalid' : ''}`}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {canEditTitle ? (
        <>
          <input
            autoFocus
            type="text"
            aria-label="Title"
            placeholder={shape.props.title ?? 'Title'}
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onKeyDown={onKeyDown}
            onPointerDown={stopEventPropagation}
          />
          <div className="url-card-input-row">{urlRow}</div>
        </>
      ) : (
        urlRow
      )}
    </form>
  )
}

// Only the title is a live link; the rest of the card stays a normal tldraw shape
// surface so it can be selected and dragged.
function TitleLink({ url, className, children }: { url: string; className?: string; children: ReactNode }) {
  return (
    <a
      className={`url-card-title ${className ?? ''}`}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      draggable={false}
      // Keep tldraw from capturing the pointer, which would swallow the native click.
      onPointerDown={stopEventPropagation}
    >
      {children}
    </a>
  )
}

function LinkCard({ url, title }: { url: string; title: string | null }) {
  return (
    <div className="url-card url-card-link" title={url}>
      <LinkIcon />
      <div className="url-card-text">
        <TitleLink url={url} className="url-card-ellipsis">
          {title ?? url}
        </TitleLink>
        {title && <span className="url-card-muted url-card-ellipsis">{hostname(url)}</span>}
      </div>
    </div>
  )
}

const PR_STATE_LABELS: Record<PrState, string> = {
  open: 'Open',
  draft: 'Draft',
  queued: 'Queued',
  merged: 'Merged',
  closed: 'Closed',
}

const PR_CHECKS_LABELS: Record<PrChecks, string> = {
  passing: '✓ Checks',
  failing: '✗ Checks',
  pending: '● Checks',
}

function PrCard({ url, title, pr }: { url: string; title: string | null; pr: UrlCardPr }) {
  const isOpen = pr.state === 'open' || pr.state === 'draft' || pr.state === 'queued'
  return (
    <div className="url-card url-card-pr" title={url}>
      <div className="url-card-pr-header">
        <GitHubMark />
        <span className="url-card-muted url-card-ellipsis">
          {pr.owner}/{pr.repo} #{pr.number}
        </span>
        {isOpen && pr.checks && (
          <span className={`pr-badge pr-badge-checks-${pr.checks}`}>{PR_CHECKS_LABELS[pr.checks]}</span>
        )}
        {pr.approved && isOpen && <span className="pr-badge pr-badge-approved">✓ Approved</span>}
        {pr.state && <span className={`pr-badge pr-badge-${pr.state}`}>{PR_STATE_LABELS[pr.state]}</span>}
      </div>
      <TitleLink url={url} className="url-card-pr-title">
        {title ?? `Pull request #${pr.number}`}
      </TitleLink>
      {pr.author && <div className="url-card-muted small">by {pr.author}</div>}
    </div>
  )
}

function LinkIcon() {
  return (
    <svg className="url-card-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
      />
    </svg>
  )
}

function GitHubMark() {
  return (
    <svg className="github-mark" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  )
}

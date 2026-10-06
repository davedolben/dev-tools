import type { Editor, TLShapePartial } from 'tldraw'
import { api, type UnfurlResult } from '../api'
import { applyUnfurl, URL_CARD_TYPE, type UrlCardShape } from './UrlCardShapeUtil'

export const PR_REFRESH_INTERVAL_MS = 60_000
export const PR_UNFOCUSED_REFRESH_INTERVAL_MS = 10 * 60_000

/** How often PR cards currently refresh, or null while the page is hidden and refreshing is paused. */
export function getPrRefreshIntervalMs(): number | null {
  if (document.hidden) return null
  // A visible but unfocused page is e.g. a window on screen behind another app, so it can go slower.
  return document.hasFocus() ? PR_REFRESH_INTERVAL_MS : PR_UNFOCUSED_REFRESH_INTERVAL_MS
}

function getPrCards(editor: Editor): UrlCardShape[] {
  // Every page, not just the current one, so switching pages never shows stale statuses.
  // Merged is terminal, so those are skipped. Closed isn't, since a closed PR can be reopened.
  return editor.store
    .allRecords()
    .filter(
      (r): r is UrlCardShape =>
        r.typeName === 'shape' &&
        r.type === URL_CARD_TYPE &&
        r.props.kind === 'github_pr' &&
        r.props.status === 'ready' &&
        r.props.pr?.state !== 'merged',
    )
}

/** Re-fetches every GitHub PR card on the canvas. Resolves true if at least one lookup succeeded. */
async function refreshPrCards(editor: Editor): Promise<boolean> {
  const cards = getPrCards(editor)
  const urls = [...new Set(cards.map((c) => c.props.url))]
  if (!urls.length) return false

  const results = new Map<string, UnfurlResult>()
  await Promise.all(
    urls.map((url) =>
      api.unfurl(url).then(
        (r) => results.set(url, r),
        () => {},
      ),
    ),
  )

  const updates: TLShapePartial<UrlCardShape>[] = []
  // Re-read the cards: they may have been edited or deleted while the requests were in flight.
  for (const card of getPrCards(editor)) {
    const result = results.get(card.props.url)
    if (!result) continue
    const next = applyUnfurl(result)
    const changed = next.title !== card.props.title || JSON.stringify(next.pr) !== JSON.stringify(card.props.pr)
    // Skipping no-op updates keeps an idle canvas from autosaving every minute.
    if (changed) updates.push({ id: card.id, type: URL_CARD_TYPE, props: next })
  }
  if (updates.length) {
    // A background refresh shouldn't show up as a step in the user's undo history.
    editor.run(() => editor.updateShapes(updates), { history: 'ignore' })
  }
  return results.size > 0
}

/**
 * Refreshes PR cards now and then every getPrRefreshIntervalMs() while the page is visible (and
 * immediately on becoming visible or focused again if a refresh is overdue). `onRefreshed` receives
 * the time of each successful refresh, or null when the canvas has no PR cards.
 */
export function startPrAutoRefresh(editor: Editor, onRefreshed: (at: Date | null) => void) {
  let lastRefresh = 0
  // Separate from lastRefresh so failed lookups in an unfocused page don't retry every tick.
  let lastAttempt = 0
  let inFlight = false
  let disposed = false

  const refresh = async () => {
    if (inFlight || document.hidden) return
    inFlight = true
    lastAttempt = Date.now()
    try {
      const ok = await refreshPrCards(editor)
      if (disposed) return
      if (ok) {
        lastRefresh = Date.now()
        onRefreshed(new Date(lastRefresh))
      } else if (!getPrCards(editor).length) {
        onRefreshed(null)
      }
    } finally {
      inFlight = false
    }
  }

  // Ticks at the fastest cadence and skips until the current one has elapsed, so a focus change
  // takes effect without rescheduling the timer.
  const onTick = () => {
    const intervalMs = getPrRefreshIntervalMs()
    // The slack keeps a timer that fires a hair early from skipping a whole extra tick.
    if (intervalMs !== null && Date.now() - lastAttempt >= intervalMs - 1000) void refresh()
  }

  const onResume = () => {
    if (!document.hidden && Date.now() - lastRefresh >= PR_REFRESH_INTERVAL_MS) void refresh()
  }

  void refresh()
  const interval = window.setInterval(onTick, PR_REFRESH_INTERVAL_MS)
  document.addEventListener('visibilitychange', onResume)
  window.addEventListener('focus', onResume)
  return () => {
    disposed = true
    window.clearInterval(interval)
    document.removeEventListener('visibilitychange', onResume)
    window.removeEventListener('focus', onResume)
  }
}

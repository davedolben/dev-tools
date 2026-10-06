export interface CanvasSummary {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Canvas extends CanvasSummary {
  snapshot: unknown | null
}

export type PrState = 'open' | 'draft' | 'queued' | 'merged' | 'closed'

export type PrChecks = 'passing' | 'failing' | 'pending'

export type UnfurlResult =
  | { kind: 'link'; title: string | null }
  | {
      kind: 'github_pr'
      title: string | null
      pr: {
        owner: string
        repo: string
        number: number
        state: PrState | null
        author: string | null
        approved: boolean
        checks: PrChecks | null
      }
    }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  })
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status}`)
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const api = {
  listCanvases: () => request<CanvasSummary[]>('/api/canvases'),
  getCanvas: (id: string) => request<Canvas>(`/api/canvases/${id}`),
  createCanvas: (name?: string) =>
    request<CanvasSummary>('/api/canvases', { method: 'POST', body: JSON.stringify(name ? { name } : {}) }),
  renameCanvas: (id: string, name: string) =>
    request<CanvasSummary>(`/api/canvases/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteCanvas: (id: string) => request<void>(`/api/canvases/${id}`, { method: 'DELETE' }),
  // keepalive lets the final save complete even if the page is being unloaded.
  saveSnapshot: (id: string, snapshot: unknown, keepalive = false) =>
    request<void>(`/api/canvases/${id}/snapshot`, { method: 'PUT', body: JSON.stringify(snapshot), keepalive }),
  unfurl: (url: string) => request<UnfurlResult>(`/api/unfurl?url=${encodeURIComponent(url)}`),
}

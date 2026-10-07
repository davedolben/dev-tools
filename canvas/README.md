# Canvases

A tldraw canvas editor with a FastAPI + SQLite backend.

## Run

```sh
# Terminal 1: backend on :8000 (creates backend/canvas.db on first start)
cd backend && uv run uvicorn app:app --reload --port 8000

# Terminal 2: frontend on :5173 (proxies /api to the backend)
cd frontend && npm install && npm run dev
```

Open http://localhost:5173.

### Single server

Build the frontend, and the backend serves it alongside the API on one port:

```sh
cd frontend && npm install && npm run build
cd ../backend && uv run uvicorn app:app --port 8000
```

Open http://localhost:8000. The backend serves the frontend only when `frontend/dist` exists; rebuild after frontend changes. Dev mode still works either way, since Vite serves its own copy on :5173. Set `CANVAS_DB` to use a database file other than `backend/canvas.db`.

## URL cards

Pick the link tool (first toolbar button, or press `U`), click the canvas, paste a URL, and press Enter. Pasting a URL straight onto the canvas also creates a card.

- Click a card to open the link in a new tab. Drag to move it. Double-click to change the URL.
- GitHub PR URLs render as a card with the PR title, number, author, and status (Open, Draft, Queued, Merged, Closed). While a canvas is open and the tab is visible, every PR card refreshes every 60 seconds; the top bar shows when that last happened.
- The backend uses `GITHUB_TOKEN` / `GH_TOKEN` for GitHub API calls, falling back to `gh auth token`. With a token it uses the GraphQL API, which is the only place GitHub exposes merge queue status. Without one it falls back to REST: queued PRs show as Open, and the 60 requests/hour limit covers only one PR card at the 60-second refresh rate.

## Lists

Pick the list tool (second toolbar button, or `Shift+L`), click the canvas, and type a title.

- Drag widgets into the list and they stack vertically, stretch to the list's width, and the list grows to fit. Creating a widget on top of a list also adds it.
- Drag a widget up or down inside the list to reorder it; a gap opens where it will land. Drag it out to remove it.
- Drag the header to move the list; double-click the header to rename it. Resizing only changes the width, since height follows the contents.

## Columns and rows

Layout helpers, like auto-layout frames in a design tool. Pick the column or row tool (third and fourth toolbar buttons) and click the canvas.

- Box-shaped widgets inside fill the cross axis and split the main axis evenly. Fixed-size widgets (text, drawings, images) keep their size, and lists keep their height. Nest rows and columns to build grids.
- Resize the column or row and its contents follow. Drag widgets in, out, and along it to reorder, same as a list.
- Click or drag the padding around the edge to select or move it.

## Cards

A text box with a border and padding. Pick the card tool (fifth toolbar button), click the canvas, and type. It behaves like tldraw's text tool: the card grows with its text, drag a side handle to set a fixed width, and the style panel changes its font, size, and color. Leaving a card empty deletes it.

- In a list, a card fills the list's width and its height fits its text.
- In a row or column, a card fills its slot's width, and its height fits its text.
- Dragged back onto the canvas, a card goes back to fitting its text.

## Layout

- `backend/app.py`: REST API (`/api/canvases`, `/api/unfurl`)
- `backend/unfurl.py`: page title fetching and GitHub PR lookup
- `frontend/src/url-card/`: the URL card shape, tool, and paste handler
- `frontend/src/list/`: the list shape; `layout.ts` holds the stacking logic
- `frontend/src/stack/`: the column and row shapes; `layout.ts` holds the flex-style layout
- `frontend/src/card/`: the card shape, a subclass of tldraw's text shape
- `frontend/src/customShapes.tsx`: registers the custom shapes and the toolbar
- `frontend/src/CanvasEditor.tsx`: editor page with debounced autosave

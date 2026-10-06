import json
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from db import connect, init_db
from unfurl import unfurl


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)


class CanvasCreate(BaseModel):
    name: str = "Untitled canvas"


class CanvasUpdate(BaseModel):
    name: str


def _summary(row) -> dict:
    return {"id": row["id"], "name": row["name"], "created_at": row["created_at"], "updated_at": row["updated_at"]}


def _get_row(conn, canvas_id: str):
    row = conn.execute("SELECT * FROM canvases WHERE id = ?", (canvas_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Canvas not found")
    return row


@app.get("/api/canvases")
def list_canvases():
    with connect() as conn:
        rows = conn.execute("SELECT id, name, created_at, updated_at FROM canvases ORDER BY updated_at DESC").fetchall()
    return [_summary(r) for r in rows]


@app.post("/api/canvases", status_code=201)
def create_canvas(body: CanvasCreate):
    canvas_id = uuid.uuid4().hex
    with connect() as conn:
        conn.execute("INSERT INTO canvases (id, name) VALUES (?, ?)", (canvas_id, body.name))
        row = _get_row(conn, canvas_id)
    return _summary(row)


@app.get("/api/canvases/{canvas_id}")
def get_canvas(canvas_id: str):
    with connect() as conn:
        row = _get_row(conn, canvas_id)
    return {**_summary(row), "snapshot": json.loads(row["snapshot"]) if row["snapshot"] else None}


@app.patch("/api/canvases/{canvas_id}")
def update_canvas(canvas_id: str, body: CanvasUpdate):
    with connect() as conn:
        _get_row(conn, canvas_id)
        conn.execute(
            "UPDATE canvases SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
            (body.name, canvas_id),
        )
        row = _get_row(conn, canvas_id)
    return _summary(row)


@app.put("/api/canvases/{canvas_id}/snapshot", status_code=204)
def save_snapshot(canvas_id: str, snapshot: dict):
    with connect() as conn:
        _get_row(conn, canvas_id)
        conn.execute(
            "UPDATE canvases SET snapshot = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
            (json.dumps(snapshot), canvas_id),
        )


@app.delete("/api/canvases/{canvas_id}", status_code=204)
def delete_canvas(canvas_id: str):
    with connect() as conn:
        conn.execute("DELETE FROM canvases WHERE id = ?", (canvas_id,))


@app.get("/api/unfurl")
async def unfurl_url(url: str = Query(...)):
    try:
        return await unfurl(url)
    except ValueError as e:
        raise HTTPException(400, str(e))


FRONTEND_DIST = (Path(__file__).parent.parent / "frontend" / "dist").resolve()

# Only serve the built frontend if it exists, so dev mode (Vite on :5173) is unaffected.
# Registered last so it never shadows the API routes.
if FRONTEND_DIST.is_dir():

    @app.get("/{path:path}", include_in_schema=False)
    def serve_frontend(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        file = (FRONTEND_DIST / path).resolve()
        if path and file.is_file() and file.is_relative_to(FRONTEND_DIST):
            return FileResponse(file)
        # Client-side routes (e.g. /canvas/<id>) need index.html so reloads work
        return FileResponse(FRONTEND_DIST / "index.html")

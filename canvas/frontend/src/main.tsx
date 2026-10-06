import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import 'tldraw/tldraw.css'
import './index.css'
import { CanvasEditor } from './CanvasEditor.tsx'
import { CanvasList } from './CanvasList.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CanvasList />} />
        <Route path="/canvas/:id" element={<CanvasEditor />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)

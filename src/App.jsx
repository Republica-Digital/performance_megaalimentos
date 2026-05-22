import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BrandSelector } from './pages/BrandSelector'
import { Dashboard } from './pages/Dashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BrandSelector />} />
        <Route path="/dashboard/:marcaId/*" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

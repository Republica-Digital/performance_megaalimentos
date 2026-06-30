import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BrandSelector } from './pages/BrandSelector'
import { Dashboard } from './pages/Dashboard'
import { InfluencerDashboard } from './pages/InfluencerDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BrandSelector />} />
        <Route path="/dashboard/:marcaId/*" element={<Dashboard />} />
        <Route path="/influencers/:marcaId/*" element={<InfluencerDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

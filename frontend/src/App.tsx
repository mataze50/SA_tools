import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CreateSheet from './pages/CreateSheet'
import EditSheet from './pages/EditSheet'
import Generation from './pages/Generation'
import ReviewWizard from './pages/ReviewWizard'
import ConversationalCreate from './pages/ConversationalCreate'
import RemixSheet from './pages/RemixSheet'
import ManagerDashboard from './pages/ManagerDashboard'
import SheetFeedback from './pages/SheetFeedback'
import TemplatesLibrary from './pages/TemplatesLibrary'
import Analytics from './pages/Analytics'
import SearchPage from './pages/SearchPage'
import AdminDashboard from './pages/AdminDashboard'
import WorkshopNew from './pages/WorkshopNew'
import WorkshopGeneration from './pages/WorkshopGeneration'
import WorkshopEditor from './pages/WorkshopEditor'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Home />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="create" element={<CreateSheet />} />
        <Route path="create/chat" element={<ConversationalCreate />} />
        <Route path="generate/:sessionId" element={<Generation />} />
        <Route path="sheet/:id" element={<EditSheet />} />
        <Route path="sheet/:sheetId/review" element={<ReviewWizard />} />
        <Route path="sheet/:sourceId/remix" element={<RemixSheet />} />
        <Route path="sheet/:sheetId/feedback" element={<SheetFeedback />} />
        <Route path="templates" element={<TemplatesLibrary />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="manager" element={<ManagerDashboard />} />
        <Route path="admin" element={<AdminDashboard />} />
        {/* Workshop routes - Sprint 16 */}
        <Route path="workshops/new" element={<WorkshopNew />} />
        <Route path="workshops/generate/:sessionId" element={<WorkshopGeneration />} />
        <Route path="workshops/:id" element={<WorkshopEditor />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useWorkspace } from '@/data'
import { workspaceStart } from '@/shell/landing'
import { AuthGate } from '@/components/AuthGate'
const AppShell = lazy(() => import('@/shell/AppShell').then(module => ({ default: module.AppShell })))
const SearchPage = lazy(()=>import('@/shell/WorkspaceOverlays').then(module=>({default:module.SearchPage})))

const Design = lazy(() => import('@/pages/Design'))
const Projects = lazy(() => import('@/pages/Projects'))
const Tasks = lazy(() => import('@/pages/Tasks'))
const Calendar = lazy(() => import('@/pages/Calendar'))
const PageEditor = lazy(() => import('@/pages/PageEditor'))
const Trash = lazy(() => import('@/pages/Trash'))
const Settings = lazy(() => import('@/pages/Settings'))

function WorkspaceStart() {
  const { scope, projects } = useWorkspace()
  return <Navigate to={workspaceStart(scope, projects)} replace />
}
export function App() {
  return <AuthGate><WorkspaceApp /></AuthGate>
}
function WorkspaceApp() {
  return (
    <Suspense
      fallback={
        <div className="page quiet-empty" role="status">
          Opening your workspace…
        </div>
      }
    >
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<WorkspaceStart />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<Projects />} />
          <Route path="projects/:id/:view" element={<Projects />} />
          <Route path="projects-progress" element={<Projects progressSection />} />
          <Route path="projects-progress/:id" element={<Projects progressSection />} />
          <Route path="projects-progress/:id/:view" element={<Projects progressSection />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="p/:id" element={<PageEditor />} />
          <Route path="calendar/:view/:date" element={<Calendar />} />
          <Route path="settings/:section" element={<Settings />} />
          <Route path="trash" element={<Trash />} />
          <Route path="search" element={<SearchPage />} />
          <Route
            path="design"
            element={
              <Suspense
                fallback={
                  <div className="page">
                    <div className="skeleton" style={{ height: 48 }} />
                  </div>
                }
              >
                <Design />
              </Suspense>
            }
          />
          <Route path="*" element={<div className="page"><h1>Not found</h1><p>This page does not exist.</p></div>} />
        </Route>
      </Routes>
    </Suspense>
  )
}

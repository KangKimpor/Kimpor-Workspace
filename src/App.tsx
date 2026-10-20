import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Home, Placeholder } from '@/pages/Home'
import { AppShell } from '@/shell/AppShell'
const SearchPage = lazy(()=>import('@/shell/WorkspaceOverlays').then(module=>({default:module.SearchPage})))

const Design = lazy(() => import('@/pages/Design'))
const Projects = lazy(() => import('@/pages/Projects'))
const Tasks = lazy(() => import('@/pages/Tasks'))
const Calendar = lazy(() => import('@/pages/Calendar'))
const PageEditor = lazy(() => import('@/pages/PageEditor'))
const Trash = lazy(() =>
  import('@/pages/PageEditor').then((m) => ({ default: m.Trash })),
)
const Settings = lazy(() => import('@/pages/Settings'))

export function App() {
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
          <Route index element={<Home />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id/:view" element={<Projects />} />
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
          <Route path="*" element={<Placeholder />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

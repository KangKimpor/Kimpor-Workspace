import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Home, Placeholder } from '@/pages/Home'
import { AppShell } from '@/shell/AppShell'

const Design = lazy(() => import('@/pages/Design'))

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route
          path="design"
          element={
            <Suspense fallback={<div className="page"><div className="skeleton" style={{ height: 48 }} /></div>}>
              <Design />
            </Suspense>
          }
        />
        <Route path="*" element={<Placeholder />} />
      </Route>
    </Routes>
  )
}

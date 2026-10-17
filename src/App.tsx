import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { LoadingState } from '@/components/states/LoadingState'

// `import.meta.env.DEV` is a build-time constant, so this whole branch (and the
// styleguide chunk) is dropped from production builds.
const Styleguide = import.meta.env.DEV ? lazy(() => import('@/pages/dev/Styleguide')) : null

function Home() {
  return (
    <main className="min-h-dvh p-6">
      <h1 className="text-2xl font-semibold">StudySeat</h1>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {Styleguide && (
          <Route
            path="/dev/styleguide"
            element={
              <Suspense fallback={<LoadingState />}>
                <Styleguide />
              </Suspense>
            }
          />
        )}
      </Routes>
    </BrowserRouter>
  )
}

import { StudyAppProvider } from './context/StudyAppProvider'
import { AppShell } from './components/AppShell'
import { ErrorBoundary } from './components/ErrorBoundary'

function App() {
  return (
    <StudyAppProvider>
      <ErrorBoundary>
        <AppShell />
      </ErrorBoundary>
    </StudyAppProvider>
  )
}

export default App

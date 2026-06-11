import { StudyAppProvider } from './context/StudyAppProvider'
import { AppShell } from './components/AppShell'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SidebarCollapseProvider } from './components/sidebar/SidebarCollapseContext'

function App() {
  return (
    <SidebarCollapseProvider>
      <StudyAppProvider>
        <ErrorBoundary>
          <AppShell />
        </ErrorBoundary>
      </StudyAppProvider>
    </SidebarCollapseProvider>
  )
}

export default App

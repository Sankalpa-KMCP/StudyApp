import { StudyAppProvider } from './context/StudyAppProvider'
import { AppShell } from './components/AppShell'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SidebarCollapseProvider } from './context/sidebar/SidebarCollapseProvider'

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

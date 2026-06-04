import { StudyAppProvider } from './context/StudyAppProvider'
import { AppShell } from './components/AppShell'

function App() {
  return (
    <StudyAppProvider>
      <AppShell />
    </StudyAppProvider>
  )
}

export default App

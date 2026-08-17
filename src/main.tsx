import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('cozy-focus: uncaught render error', error)
  }

  resetData = () => {
    // Spotify tokens live under cozyfocus.spotify.tokens too, but resetting
    // saved data shouldn't force a reconnect — leave that key alone.
    Object.keys(localStorage)
      .filter((key) => key.startsWith('cozyfocus.') && key !== 'cozyfocus.spotify.tokens')
      .forEach((key) => localStorage.removeItem(key))
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div
        className="w-screen h-screen flex flex-col items-center justify-center gap-5 text-center"
        style={{ background: '#0E0906', color: '#EDE0CE' }}
      >
        <div className="font-serif-cf" style={{ fontSize: 32 }}>
          Something went wrong
        </div>
        <div style={{ color: 'rgba(237,224,206,.5)', fontSize: 14, maxWidth: 320 }}>
          Cozy Focus hit an unexpected error and couldn't continue.
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.location.reload()}
            className="cursor-pointer rounded-full text-[12px] tracking-[.1em] uppercase border"
            style={{ padding: '11px 22px', color: '#EDE0CE', borderColor: 'rgba(237,224,206,.22)' }}
          >
            Reload
          </button>
          <button
            onClick={this.resetData}
            className="cursor-pointer text-[12px] underline decoration-dotted"
            style={{ color: 'rgba(237,224,206,.4)' }}
          >
            Reset saved data
          </button>
        </div>
      </div>
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

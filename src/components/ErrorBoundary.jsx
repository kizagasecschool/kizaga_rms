import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6 max-w-2xl mx-auto mt-10">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h2>
            <pre className="text-sm text-red-700 whitespace-pre-wrap font-mono bg-red-100/50 rounded-lg p-3">
              {this.state.error.message}
            </pre>
            <details className="mt-3">
              <summary className="text-sm text-red-600 cursor-pointer">Stack trace</summary>
              <pre className="text-xs text-red-500 mt-2 whitespace-pre-wrap font-mono">
                {this.state.error.stack}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

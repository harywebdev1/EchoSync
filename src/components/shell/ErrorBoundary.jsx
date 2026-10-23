import { Component } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error(`EchoSync ${this.props.label || 'view'} error`, error, info)
  }

  componentDidUpdate(previous) {
    if (previous.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="error-boundary" role="alert">
        <span className="empty-icon"><AlertCircle /></span>
        <h4>{this.props.label || 'This view'} hit a wrong note</h4>
        <p>Playback and the rest of EchoSync are still safe. Try this view again.</p>
        <button className="primary-btn" onClick={() => this.setState({ hasError: false })}>
          <RefreshCw size={12} /> Try again
        </button>
      </div>
    )
  }
}

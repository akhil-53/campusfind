import React from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
            <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertOctagon className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-600 mb-6">
              {this.state.error?.message || 'An unexpected rendering error occurred in this view.'}
            </p>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition text-sm shadow-sm"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

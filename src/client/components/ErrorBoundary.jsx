import React, { Component } from 'react';
import { FatalErrorFallback } from './FatalErrorFallback.jsx';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  render() {
    const { error, errorInfo } = this.state;
    const { children } = this.props;

    if (error) {
      return (
        <FatalErrorFallback
          title="Something went wrong"
          message={error?.message || String(error)}
          error={error}
          errorInfo={errorInfo}
          onReload={() => window.location.reload()}
          onTryAgain={this.handleReset}
          tryAgainLabel="Try again"
        />
      );
    }

    return children;
  }
}

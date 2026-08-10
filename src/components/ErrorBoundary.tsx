'use client';

import { Component, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WallStateScreen } from '@/components/wall';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <WallStateScreen
          icon={<TriangleAlert className="h-8 w-8" aria-hidden="true" />}
          title="Something went wrong"
          description={
            <p>
              {process.env.NODE_ENV === 'development'
                ? this.state.error?.message || 'An unexpected error occurred.'
                : 'An unexpected error occurred. Please try again.'}
            </p>
          }
          actions={
            <>
              <Button type="button" size="touch" onClick={() => this.setState({ hasError: false, error: null })}>
                Try again
              </Button>
              <Button type="button" size="touch" variant="secondary" onClick={() => window.location.assign('/')}>
                Go to dashboard
              </Button>
            </>
          }
        />
      );
    }

    return this.props.children;
  }
}

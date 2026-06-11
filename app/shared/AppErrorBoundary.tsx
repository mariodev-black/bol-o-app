"use client";

import React from "react";
import { RouteErrorPage } from "@/app/shared/RouteErrorPage";

type AppErrorBoundaryProps = {
  children: React.ReactNode;
  /** Rotas autenticadas exibem header + nav. */
  showAppChrome?: boolean;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

/**
 * Captura qualquer erro de renderização/hidratação no client antes de virar
 * tela genérica do navegador ou página em branco.
 */
export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <RouteErrorPage
          reset={this.handleReset}
          embedded={!this.props.showAppChrome}
          message="Algo inesperado aconteceu nesta tela. Recarregue para continuar."
        />
      );
    }

    return this.props.children;
  }
}

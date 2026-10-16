import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Error capturado en la aplicación:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FBF9F4] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xl text-center space-y-4">
            <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h1 className="text-xl font-black text-stone-900 tracking-tight">
              Ocurrió un inconveniente al cargar la vista
            </h1>

            <p className="text-xs text-stone-600 leading-relaxed">
              La aplicación encontró un detalle inesperado en el renderizado. Puedes reintentar la carga o volver a la pantalla principal.
            </p>

            {this.state.error?.message && (
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-left">
                <p className="text-[11px] font-mono text-stone-600 break-words line-clamp-3">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recargar Aplicación</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Inicio</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    console.error("Root runtime error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full bg-[#0d0d0f] text-[#e8e8f0] p-4 font-mono text-xs">
          <h1 className="text-sm mb-2">Falha de runtime</h1>
          <p className="text-[#ef4444] whitespace-pre-wrap">{this.state.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);

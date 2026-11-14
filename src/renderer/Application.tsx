import { Component, type ReactNode } from "react";
import App from "./App";
import { UIProvider, Button } from "./components/ui";

class Boundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>界面发生错误</h1>
        <pre>{this.state.error.stack ?? this.state.error.message}</pre>
        <Button onClick={() => location.reload()}>重新载入界面</Button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export function Application() {
  return (
    <UIProvider>
      <Boundary>
        <App />
      </Boundary>
    </UIProvider>
  );
}

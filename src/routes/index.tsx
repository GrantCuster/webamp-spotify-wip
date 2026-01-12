import { createFileRoute } from "@tanstack/react-router";
import { WebampPlayer } from "../components/WebampPlayer";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <WebampPlayer />
    </div>
  );
}

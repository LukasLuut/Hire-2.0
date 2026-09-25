// main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/theme.css";
import App from "./App";
import { ToastProvider } from "./components/Toast/ToastContext";
import { SessionProvider } from "./context/SessionContext";

createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <StrictMode>
      <SessionProvider>
        <App />
      </SessionProvider>
    </StrictMode>
  </ToastProvider>
);

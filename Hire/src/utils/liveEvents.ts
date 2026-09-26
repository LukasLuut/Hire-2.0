import { useEffect, useRef } from "react";
import { LOCAL_PORT } from "../api/ApiClient";

/* --------------------------------------------------------------------------
 * Tempo real (Server-Sent Events): uma conexão por aba, compartilhada.
 * Pede um ticket de uso único com o token e abre o EventSource; se cair,
 * reconecta com espera crescente. Sem login, nada é aberto.
 * O polling das telas continua como reserva, bem mais espaçado.
 * -------------------------------------------------------------------------- */
export type LiveEvent = { type: "notification" } | { type: "conversation"; id: number };
type Listener = (e: LiveEvent) => void;

const listeners = new Set<Listener>();
let source: EventSource | null = null;
let connecting = false;
let retry = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Está recebendo eventos agora? (as telas usam para espaçar o polling) */
export const liveConnected = () => source?.readyState === EventSource.OPEN;

async function connect() {
  const token = localStorage.getItem("token");
  if (connecting || source || !token || !listeners.size) return;
  connecting = true;
  try {
    const res = await fetch(`${LOCAL_PORT}/events/ticket`, { method: "POST", headers: { Authorization: "Bearer " + token } });
    if (!res.ok) throw new Error("ticket");
    const { ticket } = await res.json();
    source = new EventSource(`${LOCAL_PORT}/events?ticket=${ticket}`);
    source.onopen = () => (retry = 0);
    source.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as LiveEvent;
        for (const l of listeners) l(event);
      } catch {
        /* evento malformado: ignora */
      }
    };
    // o ticket vale uma vez: em erro, fecha e pede outro
    source.onerror = () => {
      source?.close();
      source = null;
      schedule();
    };
  } catch {
    schedule();
  } finally {
    connecting = false;
  }
}

function schedule() {
  if (timer || !listeners.size) return;
  const delay = Math.min(30_000, 2_000 * 2 ** retry++);
  timer = setTimeout(() => {
    timer = null;
    connect();
  }, delay);
}

function disconnect() {
  source?.close();
  source = null;
  if (timer) clearTimeout(timer);
  timer = null;
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  connect();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) disconnect();
  };
}

/** Reconecta com o token atual (depois de login/logout) */
export function resetLive() {
  disconnect();
  retry = 0;
  connect();
}

/** Recebe os eventos enquanto o componente está montado */
export function useLiveEvent(handler: Listener) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribe((e) => ref.current(e)), []);
}

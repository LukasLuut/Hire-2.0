import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ServiceProgress } from "./ServiceProgress";
import { hireAPI } from "../api/HireAPI";
import { ServiceProgressSkeleton } from "../skeletons/ServiceProgressSkeleton/ServiceProgressSkeleton";
import { useSession } from "../context/SessionContext";
import type { HireEntity } from "../interfaces/Entities";
import { isOpenHire } from "../utils/hireStatus";

/* --------------------------------------------------------------------------
 * Acompanhamento de pedidos
 * - viewFor="provider": pedidos recebidos pelo prestador (/progress)
 * - viewFor="client": contratações feitas pelo usuário (/hires)
 * -------------------------------------------------------------------------- */
export function ServiceProgressContainer({ viewFor }: { viewFor: "provider" | "client" }) {
  const [data, setData] = useState<HireEntity[] | null>(null);
  const [error, setError] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const { provider, loading: sessionLoading } = useSession();
  const navigate = useNavigate();

  const getData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setError(false);
    try {
      if (viewFor === "client") setData(await hireAPI.getMine(token));
      else if (provider?.id) setData(await hireAPI.getHireByProviderId(provider.id));
    } catch {
      setError(true);
    }
  }, [viewFor, provider?.id]);

  useEffect(() => {
    setData(null);
    getData();
  }, [getData]);

  // Pedidos recebidos são só para prestadores
  useEffect(() => {
    if (viewFor === "provider" && !sessionLoading && !provider) navigate("/home", { replace: true });
  }, [viewFor, sessionLoading, provider, navigate]);

  const title = viewFor === "client" ? "Minhas contratações" : "Pedidos recebidos";
  const list = (data ?? []).filter((h) => (showClosed ? !isOpenHire(h) : isOpenHire(h)));

  return (
    <div className="bg-[var(--bg-dark)] min-h-screen p-4 md:p-10 pt-24">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-4 mt-16">
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--text)]">{title}</h1>
          <div className="flex rounded-full border border-[var(--border)] bg-[var(--bg-light)] p-1 text-sm" role="tablist">
            {[
              { label: "Em aberto", closed: false },
              { label: "Encerradas", closed: true },
            ].map((t) => (
              <button
                key={t.label}
                role="tab"
                aria-selected={showClosed === t.closed}
                onClick={() => setShowClosed(t.closed)}
                className={`px-4 py-1.5 rounded-full transition ${showClosed === t.closed ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)]"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="flex flex-col items-center italic w-full p-6 mt-20 border-1 border-[var(--border)] md:p-10 bg-[var(--bg-light)] rounded-2xl text-[var(--text)] shadow-lg">
            Não foi possível carregar os pedidos.
            <button onClick={getData} className="mt-3 not-italic text-[var(--primary)] underline">Tentar novamente</button>
          </div>
        ) : data === null ? (
          <ServiceProgressSkeleton />
        ) : list.length < 1 ? (
          <div className="md:text-1xl flex flex-col items-center justify-center text-center italic w-full h-full p-6 mt-20 border-1 border-[var(--border)] md:p-10 bg-[var(--bg-light)] rounded-2xl text-[var(--text)] shadow-lg hover:shadow-[0_0_25px_-5px_var(--primary)/20]">
            {showClosed
              ? "Nenhum pedido encerrado ainda."
              : viewFor === "client"
                ? "Você não tem contratações em andamento."
                : "Nenhum pedido em aberto. Quando um cliente contratar seus serviços, ele aparece aqui."}
            {viewFor === "client" && !showClosed && (
              <button onClick={() => navigate("/home")} className="mt-4 not-italic px-4 py-2 rounded-lg bg-[var(--primary)] text-white">
                Buscar serviços
              </button>
            )}
          </div>
        ) : (
          list.map((e) => (
            <ServiceProgress key={e.id} viewFor={viewFor} data={e} onChanged={getData} />
          ))
        )}
      </div>
    </div>
  );
}

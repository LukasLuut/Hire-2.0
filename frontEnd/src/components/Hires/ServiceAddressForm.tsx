import { useState } from "react";
import type { ServiceAddress } from "../../interfaces/Entities";

const EMPTY: ServiceAddress = { postalCode: "", street: "", num: "", complement: "", neighborhood: "", city: "", state: "" };

const input =
  "w-full p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]";

/**
 * Endereço do atendimento presencial. O CEP completa rua, bairro, cidade e UF (ViaCEP);
 * o cliente confere e informa número e complemento.
 */
export default function ServiceAddressForm({ value, onChange }: { value: ServiceAddress | null; onChange: (a: ServiceAddress) => void }) {
  const a = value ?? EMPTY;
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "error">("idle");
  const set = (k: keyof ServiceAddress, v: string) => onChange({ ...a, [k]: v });

  const lookup = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepStatus("loading");
    try {
      const via = await fetch(`https://viacep.com.br/ws/${digits}/json/`).then((r) => r.json());
      if (via?.erro) throw new Error();
      onChange({ ...a, postalCode: cep, street: via.logradouro || a.street, neighborhood: via.bairro || a.neighborhood, city: via.localidade, state: via.uf });
      setCepStatus("idle");
    } catch {
      setCepStatus("error");
    }
  };

  return (
    <div className="grid grid-cols-6 gap-2 text-sm">
      <label className="col-span-6 sm:col-span-2">
        <span className="text-[var(--text-muted)]">CEP</span>
        <input
          className={input}
          inputMode="numeric"
          autoComplete="postal-code"
          value={a.postalCode}
          maxLength={9}
          onChange={(e) => set("postalCode", e.target.value)}
          onBlur={(e) => lookup(e.target.value)}
          aria-describedby="cep-status"
        />
      </label>
      <p id="cep-status" className="col-span-6 sm:col-span-4 self-end text-xs text-[var(--text-muted)]" aria-live="polite">
        {cepStatus === "loading" ? "Buscando endereço…" : cepStatus === "error" ? "CEP não encontrado. Preencha à mão." : "O CEP completa o endereço."}
      </p>
      <label className="col-span-6 sm:col-span-4">
        <span className="text-[var(--text-muted)]">Rua</span>
        <input className={input} autoComplete="address-line1" value={a.street} onChange={(e) => set("street", e.target.value)} />
      </label>
      <label className="col-span-2 sm:col-span-2">
        <span className="text-[var(--text-muted)]">Número</span>
        <input className={input} value={a.num} onChange={(e) => set("num", e.target.value)} />
      </label>
      <label className="col-span-4 sm:col-span-3">
        <span className="text-[var(--text-muted)]">Complemento</span>
        <input className={input} autoComplete="address-line2" value={a.complement ?? ""} onChange={(e) => set("complement", e.target.value)} />
      </label>
      <label className="col-span-6 sm:col-span-3">
        <span className="text-[var(--text-muted)]">Bairro</span>
        <input className={input} value={a.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} />
      </label>
      <label className="col-span-4 sm:col-span-4">
        <span className="text-[var(--text-muted)]">Cidade</span>
        <input className={input} autoComplete="address-level2" value={a.city} onChange={(e) => set("city", e.target.value)} />
      </label>
      <label className="col-span-2 sm:col-span-2">
        <span className="text-[var(--text-muted)]">UF</span>
        <input className={input} autoComplete="address-level1" maxLength={2} value={a.state} onChange={(e) => set("state", e.target.value.toUpperCase())} />
      </label>
    </div>
  );
}

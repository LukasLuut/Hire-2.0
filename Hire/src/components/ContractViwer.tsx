import { useState } from "react";
import { PenLine, CheckCircle2, Loader2 } from "lucide-react";
import { contractAPI, type ContractEntity, type ContractSignature } from "../api/ContractAPI";
import { useToast } from "./Toast/ToastContext";
import { getErrorMessage } from "../utils/errors";

/**
 * ContractViewer.tsx
 *
 * Painel de assinatura eletrônica do contrato (fica abaixo do documento em /contract/:id).
 *
 * Props:
 *  - contract: contrato vindo da API (com as assinaturas já registradas)
 *  - fingerprintSource: texto que representa o conteúdo do contrato; o hash SHA-256 dele
 *    é guardado com cada assinatura (as duas partes precisam assinar o mesmo conteúdo)
 *  - onSigned: chamado com o contrato atualizado depois de assinar
 *
 * A assinatura registra: nome digitado, aceite dos termos, data/hora (servidor),
 * navegador, IP (só no servidor), localização (opcional) e o hash do conteúdo.
 */

type ContractViewerProps = {
  contract: ContractEntity;
  fingerprintSource: string;
  onSigned?: (contract: ContractEntity) => void;
};

/* --------------------
   Helpers
   -------------------- */
export async function computeSHA256(text: string) {
  if (!("crypto" in window) || !crypto.subtle) return null;
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

function formatSignedAt(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Linha de resumo de uma assinatura (também usada no rodapé do documento). */
export function SignatureInfo({ signature }: { signature: ContractSignature | null }) {
  if (!signature) return <p className="text-xs opacity-70">Aguardando assinatura</p>;
  return (
    <p className="text-xs opacity-80">
      Assinado eletronicamente por {signature.name}
      <br />
      em {formatSignedAt(signature.signedAt)} · {signature.hash.slice(0, 12)}…
    </p>
  );
}

/* --------------------
   Component
   -------------------- */
export default function ContractViewer({ contract, fingerprintSource, onSigned }: ContractViewerProps) {
  const { showToast } = useToast();
  const [agree, setAgree] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [shareLocation, setShareLocation] = useState(false);
  const [signing, setSigning] = useState(false);

  const mySignature = contract.myRole === "cliente" ? contract.clientSignature : contract.providerSignature;
  const otherSignature = contract.myRole === "cliente" ? contract.providerSignature : contract.clientSignature;
  const otherName =
    contract.myRole === "cliente"
      ? contract.provider?.companyName || contract.provider?.professionalName || "o prestador"
      : contract.user?.name ?? "o cliente";

  const handleSign = async () => {
    if (!agree) {
      showToast("Confirme que leu e concorda com os termos do contrato.", "warning");
      return;
    }
    if (!typedName || typedName.trim().length < 3) {
      showToast("Digite seu nome completo como assinatura.", "warning");
      return;
    }

    setSigning(true);

    // localização só quando a pessoa pede (evita o pedido de permissão de surpresa)
    const geolocation = shareLocation
      ? await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
          if (!("geolocation" in navigator)) return resolve(null);
          const geoTimeout = setTimeout(() => resolve(null), 8000); // timeout if takes too long
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(geoTimeout);
              resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            },
            () => {
              clearTimeout(geoTimeout);
              resolve(null);
            },
            { enableHighAccuracy: false, timeout: 7000 }
          );
        })
      : null;

    try {
      const hash = await computeSHA256(fingerprintSource);
      if (!hash) throw new Error("Seu navegador não permite calcular a impressão digital do contrato.");
      const token = localStorage.getItem("token") ?? "";
      const updated = await contractAPI.sign(contract.id, { name: typedName.trim(), hash, accepted: agree, geolocation }, token);
      showToast("Assinatura registrada.", "success");
      onSigned?.(updated);
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível registrar a assinatura."), "error");
    } finally {
      setSigning(false);
    }
  };

  /* --------------------
     Accessible UI
     -------------------- */
  if (mySignature) {
    return (
      <div className="max-w-4xl mx-auto mt-6 p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-light)] text-[var(--text)] flex items-start gap-3">
        <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold">Você assinou este contrato.</p>
          <SignatureInfo signature={mySignature} />
          <p className="mt-2 text-[var(--text-muted)]">
            {otherSignature ? "As duas partes assinaram. O contrato está completo." : `Aguardando a assinatura de ${otherName}.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-6 p-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-light)] text-[var(--text)]">
      <fieldset disabled={signing}>
        <legend className="text-lg font-semibold mb-1 flex items-center gap-2">
          <PenLine size={18} /> Assinatura eletrônica
        </legend>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          {otherSignature ? `${otherName} já assinou. Falta a sua assinatura.` : "Leia o contrato acima antes de assinar."}
        </p>

        <div className="mb-3">
          <label className="block text-sm mb-1" htmlFor="typedName">
            Digite seu nome completo (assinatura)
          </label>
          <input
            id="typedName"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            autoComplete="name"
            className="w-full rounded-lg px-3 py-2 bg-[var(--bg)] border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            placeholder="Ex: João da Silva"
          />
        </div>

        <div className="flex items-center gap-2 mb-2">
          <input
            id="agree"
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="w-4 h-4 accent-[var(--primary)]"
          />
          <label htmlFor="agree" className="text-sm">
            Li e concordo com os termos do contrato.
          </label>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <input
            id="shareLocation"
            type="checkbox"
            checked={shareLocation}
            onChange={(e) => setShareLocation(e.target.checked)}
            className="w-4 h-4 accent-[var(--primary)]"
          />
          <label htmlFor="shareLocation" className="text-sm text-[var(--text-muted)]">
            Registrar minha localização aproximada junto da assinatura (opcional)
          </label>
        </div>

        <button
          type="button"
          onClick={handleSign}
          className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg font-medium disabled:opacity-60 flex items-center gap-2"
        >
          {signing && <Loader2 size={16} className="animate-spin" />}
          {signing ? "Registrando assinatura..." : "Assinar contrato"}
        </button>
        <p className="text-xs text-[var(--text-muted)] mt-3">
          Registramos data e hora, navegador e a impressão digital (SHA-256) do conteúdo do contrato.
        </p>
      </fieldset>
    </div>
  );
}

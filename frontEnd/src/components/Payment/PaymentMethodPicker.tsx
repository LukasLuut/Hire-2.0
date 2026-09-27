import { CreditCard, QrCode, Receipt } from "lucide-react";
import type { PaymentMethod } from "../../interfaces/Entities";

const OPTIONS: { id: PaymentMethod; label: string; hint: string; Icon: typeof QrCode }[] = [
  { id: "pix", label: "Pix", hint: "Aprovação na hora", Icon: QrCode },
  { id: "cartao", label: "Cartão de crédito", hint: "Aprovação na hora", Icon: CreditCard },
  { id: "boleto", label: "Boleto", hint: "Compensação simulada na hora", Icon: Receipt },
];

/** Escolha da forma de pagamento (pagamento simulado: nada é cobrado). */
export default function PaymentMethodPicker({ value, onChange }: { value: PaymentMethod | null; onChange: (m: PaymentMethod) => void }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="sr-only">Forma de pagamento</legend>
      {OPTIONS.map(({ id, label, hint, Icon }) => (
        <label
          key={id}
          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors
            ${value === id ? "border-[var(--primary)] bg-[var(--bg-light)]" : "border-[var(--border)] hover:border-[var(--primary)]"}`}
        >
          <input type="radio" name="payment-method" value={id} checked={value === id} onChange={() => onChange(id)} className="accent-[var(--primary)]" />
          <Icon size={18} aria-hidden className="text-[var(--text-muted)]" />
          <span className="flex-1">
            <span className="block text-sm font-medium text-[var(--text)]">{label}</span>
            <span className="block text-xs text-[var(--text-muted)]">{hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

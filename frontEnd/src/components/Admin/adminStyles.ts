// Estilos compartilhados pelas abas da administração (mesmos da AdminPage)
export const adminInput = "p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]";

export const adminBtn = (primary = false, danger = false) =>
  `px-3 py-1.5 rounded-lg text-sm border transition disabled:opacity-60 ${
    danger ? "border-red-500/50 text-red-500 hover:bg-red-500/10" : primary ? "bg-[var(--primary)] text-white border-[var(--primary)] hover:brightness-110" : "border-[var(--border)] hover:border-[var(--primary)]"
  }`;

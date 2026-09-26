// Utilitários dos testes de API. Rodam contra o backend em execução (npm run dev)
// e usam as contas de teste do banco de desenvolvimento (senha Teste@123):
//   cliente@hire.dev · eletricista@hire.dev (prestador 1) · limpeza@hire.dev (prestador 2)
// Os testes criam contratações, conversas e serviços no banco de desenvolvimento.

export const API = process.env.API_URL ?? "http://localhost:8080";
export const PASSWORD = "Teste@123";

export async function login(email) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (r.status !== 200) throw new Error(`Login de ${email} falhou (${r.status}). O backend está rodando e o banco tem as contas de teste?`);
  return (await r.json()).token;
}

export async function tokens() {
  return {
    cli: await login("cliente@hire.dev"),
    ele: await login("eletricista@hire.dev"),
    lim: await login("limpeza@hire.dev"),
  };
}

/** Pagamento simulado do cliente (exigido antes de o prestador iniciar) */
export const pay = (hireId, token, method = "pix") => req("POST", `/hires/${hireId}/pay`, token, { method });

/** Requisição JSON (ou FormData); devolve { s: status, j: corpo } */
export async function req(method, path, token, body) {
  const isForm = body instanceof FormData;
  const headers = token ? { Authorization: "Bearer " + token } : {};
  if (body && !isForm) headers["Content-Type"] = "application/json";
  const r = await fetch(API + path, { method, headers, body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
  let j = null;
  try { j = await r.json(); } catch { /* sem corpo */ }
  return { s: r.status, j };
}

export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

/** FormData a partir de um objeto; arquivos como [campo, buffer, nome, tipo] */
export function form(fields, files = []) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  for (const [name, buf, filename, type] of files) f.append(name, new Blob([buf], { type }), filename);
  return f;
}

/** Próxima data (AAAA-MM-DDTHH:mm) de um dia da semana (0 = domingo) no horário dado */
export function nextWeekday(dow, hhmm) {
  const d = new Date();
  d.setDate(d.getDate() + (((dow - d.getDay() + 7) % 7) || 7));
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${hhmm}`;
}

/**
 * Acesso direto ao banco de desenvolvimento (lê o backend/.env), só para
 * simular a passagem do tempo nos testes (ex.: pedido feito há 3 dias).
 */
export async function db(sql, params = []) {
  const { default: dotenv } = await import("dotenv");
  const { fileURLToPath } = await import("node:url");
  const path = await import("node:path");
  dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env"), quiet: true });
  const mysql = await import("mysql2/promise");
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  try {
    const [rows] = await conn.execute(sql, params);
    return rows;
  } finally {
    await conn.end();
  }
}

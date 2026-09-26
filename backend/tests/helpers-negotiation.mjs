import { req, form } from "./helpers.mjs";

/**
 * Leva uma negociação até todos os tópicos acordados (sem os aceites finais):
 * pedido do cliente → resposta do prestador → cliente acorda preço/serviço/duração →
 * cliente propõe o início → prestador acorda.
 */
export async function negotiateUntilAgreed({ client, provider, serviceId, start = "Segunda, 08:00" }) {
  const q = await req("POST", "/conversations/request", client, form({ serviceId, description: "Pedido de teste", budget: "R$ 200" }));
  if (q.s !== 201) throw new Error("pedido de orçamento falhou: " + JSON.stringify(q.j));
  const cid = q.j.id;
  let c = (await req("POST", `/conversations/${cid}/respond`, provider, form({ title: "Proposta", description: "Serviço de teste", price: "R$ 240,00 • Pix", deadline: "2 horas" }))).j;
  const agree = (conv, key) => conv.topics.map((x) => (x.key === key ? { ...x, state: "Acordado" } : x));
  for (const key of ["payment", "service", "duration"]) c = (await req("PUT", `/conversations/${cid}/topics`, client, { topics: agree(c, key) })).j;
  c = (await req("PUT", `/conversations/${cid}/topics`, client, { topics: c.topics.map((x) => (x.key === "start" ? { ...x, content: start } : x)) })).j;
  c = (await req("PUT", `/conversations/${cid}/topics`, provider, { topics: agree(c, "start") })).j;
  return cid;
}

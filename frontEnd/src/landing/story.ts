// Roteiro da landing: todo o texto e a ordem das cenas ficam aqui (nada de texto solto nos componentes).
// A história usa o elenco da apresentação (backEnd/scripts/story/cast.ts): a Júlia procura um fotógrafo
// para o casamento, encontra o Tomás, conversa, negocia e contrata; depois a câmera vira para o lado dele.

export const BRAND = "Hire.";
export const TAGLINE = "Encontre quem faz.";
/** Aparece quando uma cena termina e espera o próximo scroll */
export const CONTINUE_HINT = "Role para continuar";
/** A setinha que mostra o menu recolhido durante a apresentação */
export const NAV_PEEK = "Mostrar o menu";

/** Destinos reais do app */
export const ROUTES = {
  explore: "/auth?cadastro=1&next=%2Fhome",
  provider: "/auth?cadastro=1&tipo=profissional",
  login: "/auth",
};

export const CHAPTERS = [
  { id: "encontre", number: "01", label: "Encontre" },
  { id: "o-problema", number: "02", label: "O problema" },
  { id: "descubra", number: "03", label: "Descubra" },
  { id: "conheca", number: "04", label: "Conheça" },
  { id: "confie", number: "05", label: "Confie" },
  { id: "converse", number: "06", label: "Converse" },
  { id: "contrate", number: "07", label: "Contrate" },
  { id: "mostre", number: "08", label: "Mostre seu trabalho" },
  { id: "compartilhe", number: "09", label: "Compartilhe" },
  { id: "ecossistema", number: "10", label: "O ecossistema" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

export const COPY = {
  encontre: {
    opening: "Encontre.",
    query: "Fotógrafo para eventos",
    scrollHint: "Role para começar",
    headline: "Encontre quem faz.",
    support: "Profissionais de verdade, com portfólio, avaliações e conversa direta — do primeiro clique ao serviço contratado.",
    cta: "Explorar o Hire.",
  },
  problema: {
    lines: ["Encontrar alguém é fácil.", "Encontrar a pessoa certa é outra história."],
    questions: ["Será que é confiável?", "Quanto custa?", "Ele realmente sabe fazer?", "Como entro em contato?"],
    answer: ["É aí que entra o", "Hire."],
  },
  descubra: {
    headline: ["Busque, filtre", "e compare quem faz."],
    steps: [
      { label: "Busca", text: "Uma palavra e o Hire procura em serviços, categorias e descrições." },
      { label: "Categoria e filtros", text: "Preço máximo, disponibilidade, atendimento online ou com agenda." },
      { label: "Localização", text: "Profissionais que atendem onde você está." },
      { label: "Resultados", text: "Cada serviço com preço, duração e quem faz." },
      { label: "Profissionais", text: "Os mais bem avaliados para o que você procurou." },
    ],
  },
  conheca: {
    headline: ["Antes de contratar,", "conheça quem está por trás do serviço."],
    beats: ["Quem é", "Como trabalha", "O que já fez"],
  },
  confie: {
    headline: "Veja o que diz quem já contratou.",
    facts: ["Conta verificada", "4,8 em 6 avaliações", "8 serviços concluídos pelo Hire", "Porto Alegre · atende até 150 km"],
  },
  converse: {
    words: ["Converse.", "Negocie.", "Combine."],
    beats: [
      "A Júlia conta o que precisa. O Tomás responde com perguntas.",
      "Valor, data e duração viram tópicos — cada um aceito pelos dois lados.",
      "Acordo fechado: o contrato sai da própria conversa.",
    ],
    between: "Júlia Martins · Tomás Albuquerque",
  },
  contrate: {
    headline: ["Do primeiro clique", "ao serviço contratado."],
    steps: ["Busca", "Perfil", "Portfólio", "Conversa", "Negociação", "Contrato"],
    payoff: "Assinado pelas duas partes. Sem papel, sem planilha, sem “combinado por áudio”.",
  },
  mostre: {
    eyebrow: "Agora, do outro lado",
    headline: "Seu trabalho também merece ser encontrado.",
    notes: [
      { title: "Um perfil que vende por você", text: "Serviços, portfólio, agenda e avaliações num endereço só seu." },
      { title: "Pedidos chegam organizados", text: "O Rodrigo pediu orçamento para a festa do café. Está tudo ali: data, convidados, valor." },
      { title: "Portfólio como vitrine", text: "O Tomás escolhe a ordem, conta a história de cada foto e o cliente vê do jeito que ele quer." },
    ],
  },
  compartilhe: {
    headline: ["Leve seu trabalho", "para onde seus clientes estão."],
    steps: ["Perfil público", "Compartilhar", "QR Code", "Acesso ao perfil"],
  },
  ecossistema: {
    headline: ["Quem precisa", "encontra quem faz."],
    nodes: ["Cliente", "Serviço", "Profissional", "Orçamento", "Contratação"],
  },
  final: {
    cta: "Explorar o Hire.",
    secondary: "Sou profissional",
    login: "Já tenho conta",
  },
} as const;

/** Textos alternativos das tomadas (o que a imagem mostra, em uma frase) */
export const ALT = {
  search: "Busca do Hire com Fotógrafo para eventos digitado",
  results: "Resultados da busca por Fotógrafo para eventos: Tomás Albuquerque, Rafael Duarte e Marina Costa, com nota e preço, e os três entre os prestadores recomendados",
  filters: "Painel de filtros da busca: categoria, subcategoria, preço máximo, ordenação e disponibilidade",
  location: "Menu de localização da busca aberto: usar minha localização ou digitar o CEP",
  hero: "Perfil público de Tomás Albuquerque Fotografia: conta verificada, nota 4,8 em 6 avaliações, Porto Alegre",
  about: "Seção Conheça Tomás, com a história e a forma de trabalhar do fotógrafo",
  portfolio: "Portfólio do Tomás com 12 trabalhos de casamentos, ensaios e eventos",
  lightbox: "Foto do portfólio ampliada: casal caminhando numa estrada de terra ao pôr do sol",
  lightboxEmbrace: "Foto do portfólio ampliada: Camila e Rafael abraçados, rindo, no ensaio de casal",
  lightboxSparklers: "Foto do portfólio ampliada: a saída dos noivos entre amigos com velas faísca",
  thread: "Conversa entre Júlia e Tomás sobre o casamento em março, da primeira mensagem ao acordo fechado",
  negotiation: "Negociação com os tópicos serviço, valor, data e duração marcados como acordados",
  contract: "Contrato assinado eletronicamente por Júlia Martins e Tomás Albuquerque",
  business: "Painel do prestador: perfil completo, agenda, divulgação e atalhos",
  request: "Pedido de orçamento de Rodrigo Albernaz aguardando resposta",
  businessPortfolio: "Gerenciador de portfólio do prestador",
  share: "Painel Compartilhar com link do perfil, WhatsApp e imagem com QR Code",
  card: "Imagem de divulgação do perfil do Tomás com QR Code",
  mProfile: "Perfil do Tomás aberto no celular",
  mSearch: "Resultados da busca no celular",
  mChat: "Conversa no celular",
  mPortfolio: "Portfólio no celular",
} as const;

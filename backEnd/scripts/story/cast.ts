/**
 * Elenco da apresentação do Hire (landing "Encontre quem faz").
 *
 * Uma história só, com personagens que se repetem: o fotógrafo Tomás Albuquerque é o protagonista
 * (busca → perfil → portfólio → avaliações → conversa → negociação → contrato → compartilhamento);
 * o Estúdio Lume e a Bia Nogueira mostram que "fotógrafo" é mais de um tipo de profissional; a Marina Costa e o
 * Rafael Duarte também fotografam eventos (aparecem ao lado do Tomás na busca "Fotógrafo para eventos");
 * Júlia, Rodrigo e Camila são os clientes que aparecem na conversa, nas avaliações e nos pedidos.
 *
 * Tudo aqui é fictício. As fotos vêm de uploads/story (npm run story:images; créditos em images.json).
 */

export const DOMAIN = "apresentacao.hire.dev";
export const PASSWORD = "Teste@123";
export const CATEGORY = "Fotografia e vídeo";

const img = (file: string) => `/uploads/story/${file}.jpg`;
const avatar = (key: string) => `/uploads/story/avatars/${key}.jpg`;

// ---------------------------------------------------------------- clientes

export type ClientKey = "julia" | "rodrigo" | "camila" | "leticia" | "guilherme" | "aline" | "fernanda" | "marcos" | "patricia" | "henrique" | "sabrina";

export const CLIENTS: Record<ClientKey, { name: string; email: string; avatar: string; about: string; hood: string; street: string; num: number; postalCode: string; since: number }> = {
  julia: {
    name: "Júlia Martins", email: `julia.martins@${DOMAIN}`, avatar: avatar("julia"), since: 220,
    about: "Arquiteta, apaixonada por casas antigas e por cozinhar para os amigos. Casando em março com o Diego.",
    hood: "Petrópolis", street: "Rua Coronel Bordini", num: 830, postalCode: "90440-001",
  },
  rodrigo: {
    name: "Rodrigo Albernaz", email: `rodrigo.albernaz@${DOMAIN}`, avatar: avatar("rodrigo"), since: 410,
    about: "Sócio do Café Tertúlia, no Bom Fim. Contrato sempre gente da cidade.",
    hood: "Bom Fim", street: "Rua Fernandes Vieira", num: 412, postalCode: "90035-091",
  },
  camila: {
    name: "Camila Freitas", email: `camila.freitas@${DOMAIN}`, avatar: avatar("camila"), since: 300,
    about: "Ceramista. Tenho um ateliê pequeno no Menino Deus e uma marca de peças feitas à mão, a Barro Cru.",
    hood: "Menino Deus", street: "Rua Múcio Teixeira", num: 205, postalCode: "90150-100",
  },
  leticia: { name: "Letícia Bittencourt", email: `leticia.bittencourt@${DOMAIN}`, avatar: avatar("leticia"), since: 520, about: "", hood: "Tristeza", street: "Avenida Wenceslau Escobar", num: 1780, postalCode: "91900-000" },
  guilherme: { name: "Guilherme Sartori", email: `guilherme.sartori@${DOMAIN}`, avatar: avatar("guilherme"), since: 480, about: "", hood: "Centro", street: "Rua Sinimbu", num: 1320, postalCode: "95020-002" },
  aline: { name: "Aline Petry", email: `aline.petry@${DOMAIN}`, avatar: avatar("aline"), since: 260, about: "", hood: "Centro", street: "Rua Bento Gonçalves", num: 540, postalCode: "93410-003" },
  fernanda: { name: "Fernanda Kuhn", email: `fernanda.kuhn@${DOMAIN}`, avatar: avatar("fernanda"), since: 190, about: "", hood: "Moinhos de Vento", street: "Rua Padre Chagas", num: 305, postalCode: "90570-080" },
  marcos: { name: "Marcos Lindner", email: `marcos.lindner@${DOMAIN}`, avatar: avatar("marcos"), since: 350, about: "Enólogo e sócio de uma vinícola familiar no Vale dos Vinhedos.", hood: "Centro", street: "Rua Marechal Deodoro", num: 88, postalCode: "95700-008" },
  patricia: { name: "Patrícia Moog", email: `patricia.moog@${DOMAIN}`, avatar: avatar("patricia"), since: 240, about: "", hood: "Auxiliadora", street: "Rua Dona Laura", num: 760, postalCode: "90430-091" },
  henrique: { name: "Henrique Dornelles", email: `henrique.dornelles@${DOMAIN}`, avatar: avatar("henrique"), since: 200, about: "Advogado, sócio da Dornelles & Prates.", hood: "Moinhos de Vento", street: "Rua Mostardeiro", num: 366, postalCode: "90430-000" },
  sabrina: { name: "Sabrina Oliveira", email: `sabrina.oliveira@${DOMAIN}`, avatar: avatar("sabrina"), since: 150, about: "", hood: "Cidade Baixa", street: "Rua da República", num: 190, postalCode: "90050-321" },
};

// ---------------------------------------------------------------- prestadores

export type ServiceSeed = {
  key: string;
  title: string;
  description: string;
  subcategory: string;
  price: number;
  priceUnit: "fixo" | "hora" | "orcamento";
  duration: string;
  negotiable: boolean;
  images: string[];
  packages?: { name: string; description: string; price: number }[];
};

export type ProviderSeed = {
  key: "tomas" | "lume" | "bia" | "marina" | "rafael";
  user: { name: string; email: string; avatar: string; accountType: "profissional" | "empresa"; legalName?: string; tradeName?: string; companySize?: string };
  professionalName: string;
  companyName: string;
  slug: string;
  businessType: "autonomo" | "empresa";
  profileImageUrl: string;
  description: string;
  about: string;
  phone: string;
  city: string;
  state: string;
  hood: string;
  street: string;
  num: number;
  postalCode: string;
  lat: number;
  lng: number;
  radiusKm: number;
  since: number;
  attendsOnline: boolean;
  specialties: string[];
  availability: { days: string[]; start: string; end: string; saturday?: { start: string; end: string } };
  services: ServiceSeed[];
  portfolio: { image: string; title: string; description: string; service?: string }[];
};

export const TOMAS: ProviderSeed = {
  key: "tomas",
  user: { name: "Tomás Albuquerque", email: `tomas.albuquerque@${DOMAIN}`, avatar: img("tomas-avatar"), accountType: "profissional" },
  professionalName: "Tomás Albuquerque",
  companyName: "Tomás Albuquerque Fotografia",
  slug: "tomas-albuquerque",
  businessType: "autonomo",
  profileImageUrl: img("tomas-avatar"),
  description: "Fotógrafo de casamentos, ensaios de casal e eventos em Porto Alegre. Fotografia documental, luz natural e nenhuma pose forçada — só vocês, do jeito que são.",
  about: [
    "Comecei a fotografar em 2013, como assistente de um fotógrafo de casamentos na Serra Gaúcha. Carregava bolsas, segurava rebatedores e prestava atenção em tudo: no pai que ajeita a gravata do noivo, na avó que chora antes de todo mundo. Foi ali que entendi que o meu trabalho não é criar momentos — é não deixar que eles passem despercebidos.",
    "Antes disso, passei três anos no fotojornalismo de um jornal de Porto Alegre, e trago de lá o jeito de trabalhar: chego cedo, conheço o lugar, converso com o cerimonial e depois quase desapareço. Prefiro a luz natural, os fins de tarde e as fotos em que ninguém está olhando para a câmera.",
    "Em onze anos, fotografei mais de 180 casamentos, de cerimônias para 20 pessoas em sítios de Viamão a festas para 400 convidados em Bento Gonçalves. Também faço ensaios de casal, pré-wedding e eventos de família: bodas, aniversários, batizados.",
    "Todo trabalho começa com uma conversa — pode ser por aqui mesmo, no chat — para entender a história de vocês, o roteiro do dia e o que não pode faltar. Entrego tudo em galeria online, com todas as fotos tratadas, e respondo mensagens em até um dia útil.",
    "Atendo Porto Alegre, região metropolitana, Serra e litoral gaúcho. Para outros lugares, é só chamar.",
  ].join("\n\n"),
  phone: "(51) 99814-2207",
  city: "Porto Alegre", state: "RS", hood: "Petrópolis", street: "Rua Lavradio", num: 145, postalCode: "90690-380",
  lat: -30.0431, lng: -51.1856, radiusKm: 150, since: 640, attendsOnline: false,
  specialties: ["Fotografia de eventos", "Ensaio fotográfico"],
  availability: { days: ["tuesday", "wednesday", "thursday", "friday"], start: "10:00", end: "19:00", saturday: { start: "09:00", end: "23:00" } },
  services: [
    {
      key: "casamento",
      title: "Fotografia de Casamento",
      description: "Fotógrafo de casamento com cobertura documental do making of à saída dos noivos e segundo fotógrafo na cerimônia. Galeria online com mais de 600 fotos tratadas, entregue em até 45 dias.",
      subcategory: "Fotografia de eventos", price: 4800, priceUnit: "fixo", duration: "10 horas", negotiable: true,
      images: [img("tomas-field-walk"), img("tomas-sparklers"), img("tomas-first-dance")],
      packages: [
        { name: "Essencial", description: "6 horas, cerimônia e recepção, 350+ fotos tratadas", price: 3200 },
        { name: "Completo", description: "10 horas, do making of à saída, segundo fotógrafo", price: 4800 },
        { name: "Completo + álbum", description: "Tudo do Completo e álbum 30×30 com 40 páginas", price: 6300 },
      ],
    },
    {
      key: "prewedding",
      title: "Ensaio Pré-Wedding",
      description: "Ensaio de casal no fim de tarde, em locação escolhida junto com vocês: Porto Alegre, Serra ou litoral. Direção leve, sem poses forçadas. 80 fotos tratadas em até 15 dias.",
      subcategory: "Ensaio fotográfico", price: 1200, priceUnit: "fixo", duration: "2 horas", negotiable: true,
      images: [img("tomas-pier"), img("tomas-golden-trees")],
    },
    {
      key: "casal",
      title: "Ensaio de Casal",
      description: "Uma hora e meia caminhando, conversando e sendo fotografados sem perceber. Para aniversário de namoro, gestação a dois ou só porque sim. 50 fotos tratadas.",
      subcategory: "Ensaio fotográfico", price: 850, priceUnit: "fixo", duration: "1h30", negotiable: false,
      images: [img("tomas-embrace"), img("tomas-beach")],
    },
    {
      key: "eventos",
      title: "Fotografia de Eventos e Festas",
      description: "Aniversários, bodas, batizados e festas de empresa. Fotógrafo discreto, que registra o que acontece sem interromper ninguém. Mínimo de 3 horas; galeria online em 20 dias.",
      subcategory: "Fotografia de eventos", price: 380, priceUnit: "hora", duration: "mínimo 3 horas", negotiable: true,
      images: [img("tomas-party"), img("tomas-dance-smoke")],
    },
    {
      key: "elopement",
      title: "Mini Wedding e Elopement",
      description: "Casamentos íntimos, para até 40 pessoas, ou só os dois e as testemunhas. Cobertura de 4 horas com retratos do casal no fim de tarde e 250 fotos tratadas.",
      subcategory: "Fotografia de eventos", price: 2900, priceUnit: "fixo", duration: "4 horas", negotiable: true,
      images: [img("tomas-ceremony-chairs"), img("tomas-bouquet-kiss")],
    },
  ],
  portfolio: [
    { image: img("tomas-field-walk"), service: "casamento", title: "Letícia & Bruno — casamento no campo, Viamão", description: "Os últimos minutos de luz antes da festa. Pedi que os dois caminhassem sem pressa até o fim da estrada — e fiquei para trás." },
    { image: img("tomas-embrace"), service: "casal", title: "Camila & Rafael — ensaio de casal", description: "Eles chegaram dizendo que travavam na frente da câmera. Dez minutos de conversa depois, era isto." },
    { image: img("tomas-pier"), service: "prewedding", title: "Fernanda & Otávio — pré-wedding no Guaíba", description: "Fim de tarde no trapiche. O vento cuidou do vestido; eu só esperei a cor do céu." },
    { image: img("tomas-veil"), service: "casamento", title: "Retrato da noiva — Moinhos de Vento", description: "Varanda do hotel, vento de fim de tarde e uma noiva que topou a ideia na hora." },
    { image: img("tomas-first-dance"), service: "casamento", title: "Guilherme & Marina — primeira dança", description: "Choveu o dia inteiro em Caxias do Sul. Às nove da noite, ninguém lembrava mais disso." },
    { image: img("tomas-golden-trees"), service: "prewedding", title: "Paula & Tiago — pré-wedding em Gramado", description: "Marcamos às 17h pensando exatamente nesta luz entre as árvores." },
    { image: img("tomas-bouquet-kiss"), service: "elopement", title: "Detalhes — mini wedding no jardim", description: "Um casamento para 30 pessoas, num jardim em Ipanema. O buquê foi montado pela avó da noiva." },
    { image: img("tomas-dance-smoke"), service: "casamento", title: "Primeira dança — Bento Gonçalves", description: "Uma pista de dança inteira esperando em silêncio pelos dois." },
    { image: img("tomas-sparklers"), service: "casamento", title: "A saída dos noivos", description: "Duzentas velas faísca, um corredor de amigos e trinta segundos para acertar a foto." },
    { image: img("tomas-beach"), service: "casal", title: "Ensaio de casal — Praia do Rosa", description: "Manhã de inverno, praia vazia e um casal que só queria caminhar." },
    { image: img("tomas-party"), service: "eventos", title: "Pista cheia — casamento em Caxias do Sul", description: "A parte da festa que ninguém lembra direito — e por isso precisa de foto." },
    { image: img("tomas-ceremony-chairs"), service: "elopement", title: "Antes da cerimônia", description: "O jardim pronto, quinze minutos antes de os convidados chegarem." },
  ],
};

export const LUME: ProviderSeed = {
  key: "lume",
  user: {
    name: "Carolina Vasconcellos", email: `carolina.vasconcellos@${DOMAIN}`, avatar: avatar("carolina"), accountType: "empresa",
    legalName: "Estúdio Lume Fotografia Ltda", tradeName: "Estúdio Lume", companySize: "ME",
  },
  professionalName: "Carolina Vasconcellos",
  companyName: "Estúdio Lume",
  slug: "estudio-lume",
  businessType: "empresa",
  profileImageUrl: img("lume-studio"),
  description: "Estúdio de fotografia comercial no 4º Distrito de Porto Alegre. Produto, still, gastronomia e campanhas para marcas que vendem pela imagem.",
  about: [
    "O Estúdio Lume nasceu em 2019, quando saí de uma agência de publicidade para fotografar, do meu jeito, as marcas pequenas que eu gostava de comprar. Hoje somos um estúdio de 90 m² no 4º Distrito, com fundo infinito, cozinha para food styling e uma equipe de três pessoas: eu na fotografia, a Natália na produção e o Léo no tratamento de imagem.",
    "Fotografamos produto para e-commerce, still publicitário, gastronomia e campanhas. Antes de qualquer clique, estudamos a marca: quem compra, onde a foto vai aparecer e o que ela precisa vender. Luz controlada, cor fiel ao produto e um cuidado quase obsessivo com reflexo, poeira e etiqueta torta.",
    "Já trabalhamos com ceramistas, joalherias, cafeterias, vinícolas e marcas de cosméticos do Rio Grande do Sul. Entregamos em até 5 dias úteis e ajustamos a edição sem custo até a marca aprovar.",
    "Atendemos no estúdio ou na sua empresa, em Porto Alegre e região.",
  ].join("\n\n"),
  phone: "(51) 3029-4471",
  city: "Porto Alegre", state: "RS", hood: "Floresta", street: "Rua Comendador Coruja", num: 326, postalCode: "90220-180",
  lat: -30.0189, lng: -51.2098, radiusKm: 40, since: 700, attendsOnline: true,
  specialties: ["Fotografia de produtos", "Filmagem"],
  availability: { days: ["monday", "tuesday", "wednesday", "thursday", "friday"], start: "09:00", end: "18:00" },
  services: [
    {
      key: "ecommerce",
      title: "Fotografia de Produtos para E-commerce",
      description: "Fotógrafos de produto com fundo infinito branco ou colorido, luz controlada e cor fiel. Valor por foto tratada, mínimo de 20 imagens; entrega em 5 dias úteis.",
      subcategory: "Fotografia de produtos", price: 45, priceUnit: "fixo", duration: "5 dias úteis", negotiable: true,
      images: [img("lume-shoes"), img("lume-necklace")],
    },
    {
      key: "still",
      title: "Still Publicitário",
      description: "Uma diária de estúdio para fotos de destaque: perfumes, joias, bebidas. Direção de arte, produção e tratamento incluídos. Até 8 imagens finais.",
      subcategory: "Fotografia de produtos", price: 1800, priceUnit: "fixo", duration: "1 diária", negotiable: true,
      images: [img("lume-perfume"), img("lume-jewelry")],
    },
    {
      key: "gastronomia",
      title: "Fotografia Gastronômica para Cardápios",
      description: "Food styling e fotos do cardápio no seu restaurante ou no nosso estúdio. Até 25 pratos por diária, com tratamento para impresso e delivery.",
      subcategory: "Fotografia de produtos", price: 1400, priceUnit: "fixo", duration: "1 diária", negotiable: true,
      images: [img("lume-bread"), img("lume-beans")],
    },
    {
      key: "campanha",
      title: "Campanha para Marcas",
      description: "Conceito, produção, fotografia e vídeos curtos para lançamentos e redes sociais. Orçamento conforme o tamanho da campanha.",
      subcategory: "Fotografia de produtos", price: 0, priceUnit: "orcamento", duration: "sob consulta", negotiable: true,
      images: [img("lume-wine")],
    },
  ],
  portfolio: [
    { image: img("lume-wine"), service: "campanha", title: "Lançamento de safra — vinícola do Vale dos Vinhedos", description: "Cinquenta tentativas até o splash desenhar a curva certa. Virou capa do catálogo." },
    { image: img("lume-jewelry"), service: "still", title: "Coleção Esmeralda — joalheria autoral", description: "Cenário em gesso feito no estúdio para a cor da pedra aparecer sem esforço." },
    { image: img("lume-perfume"), service: "still", title: "Still de perfume — luz de recorte", description: "Uma luz só, por trás, para mostrar a textura do frasco." },
    { image: img("lume-bread"), service: "gastronomia", title: "Cardápio de outono — Café Tertúlia", description: "Fornada da manhã fotografada ainda quente, antes de a cafeteria abrir." },
    { image: img("lume-beans"), service: "ecommerce", title: "Grãos e leguminosas — empório orgânico", description: "Fotos de cima para a loja virtual e para as embalagens novas." },
    { image: img("lume-shoes"), service: "ecommerce", title: "Calçados — catálogo de verão", description: "Fundo infinito e sombra suave: o produto aparece igual na foto e na caixa." },
    { image: img("lume-necklace"), service: "ecommerce", title: "Colar de pérolas barrocas", description: "Reflexo controlado em acrílico preto para cada pérola ter o próprio brilho." },
    { image: img("lume-studio"), title: "Bastidores do estúdio", description: "O fundo infinito montado para uma diária de e-commerce: 60 produtos em oito horas." },
  ],
};

export const BIA: ProviderSeed = {
  key: "bia",
  user: { name: "Beatriz Nogueira", email: `beatriz.nogueira@${DOMAIN}`, avatar: img("bia-avatar"), accountType: "profissional" },
  professionalName: "Beatriz Nogueira",
  companyName: "Bia Nogueira Retratos",
  slug: "bia-nogueira-retratos",
  businessType: "autonomo",
  profileImageUrl: img("bia-avatar"),
  description: "Retratos profissionais e ensaios individuais em Porto Alegre. Para quem precisa de uma boa foto e jura que não é fotogênico.",
  about: [
    "Sou fotógrafa de retratos há oito anos e comecei por acaso: uma amiga precisava de uma foto para o currículo e odiava todas as que tinha. Passamos uma tarde conversando, rindo e fotografando na janela da minha sala. Ela conseguiu o emprego — e eu descobri o que queria fazer.",
    "Hoje faço retratos profissionais, ensaios individuais e fotos de equipe para empresas. Meu trabalho começa antes da câmera: pergunto como você quer ser visto, onde a foto vai ser usada e o que te deixa desconfortável. A maioria das pessoas chega dizendo que não é fotogênica e sai surpresa.",
    "Trabalho com luz natural sempre que posso e levo um estúdio portátil para escritórios e consultórios. Entrego as fotos tratadas em até 5 dias úteis, com tratamento de pele natural — sem apagar quem você é.",
    "Atendo em Porto Alegre, Canoas e Novo Hamburgo, no meu estúdio no Moinhos de Vento ou no seu local de trabalho.",
  ].join("\n\n"),
  phone: "(51) 99602-3318",
  city: "Porto Alegre", state: "RS", hood: "Moinhos de Vento", street: "Rua Hilário Ribeiro", num: 202, postalCode: "90510-040",
  lat: -30.0262, lng: -51.2027, radiusKm: 35, since: 560, attendsOnline: false,
  specialties: ["Ensaio fotográfico"],
  availability: { days: ["monday", "tuesday", "wednesday", "thursday", "friday"], start: "08:30", end: "18:30", saturday: { start: "09:00", end: "13:00" } },
  services: [
    {
      key: "retrato",
      title: "Retrato Profissional",
      description: "Retratos para LinkedIn, site e imprensa. Conversa prévia sobre como você quer ser visto, direção de postura e expressão. 10 fotos tratadas em 5 dias úteis.",
      subcategory: "Ensaio fotográfico", price: 450, priceUnit: "fixo", duration: "1 hora", negotiable: false,
      images: [img("bia-portrait-glasses"), img("bia-portrait-hand")],
    },
    {
      key: "individual",
      title: "Ensaio Individual",
      description: "Ensaio pessoal em estúdio ou ao ar livre, para aniversário, recomeço ou só para ter fotos bonitas de você. 30 fotos tratadas.",
      subcategory: "Ensaio fotográfico", price: 650, priceUnit: "fixo", duration: "1h30", negotiable: true,
      images: [img("bia-portrait-red"), img("bia-laugh")],
    },
    {
      key: "equipes",
      title: "Retrato Corporativo para Equipes",
      description: "Estúdio montado na sua empresa, com luz padronizada para toda a equipe. Até 12 pessoas por período, fotos entregues em 5 dias úteis.",
      subcategory: "Ensaio fotográfico", price: 1600, priceUnit: "fixo", duration: "meio período", negotiable: true,
      images: [img("bia-corporate"), img("bia-portrait-glasses")],
    },
    {
      key: "imagem",
      title: "Ensaio de Imagem Pessoal",
      description: "Para quem vende o próprio trabalho e precisa de um fotógrafo que entenda de marca pessoal: retratos, fotos trabalhando e detalhes para site e redes. Inclui consultoria de roupa.",
      subcategory: "Ensaio fotográfico", price: 900, priceUnit: "fixo", duration: "2 horas", negotiable: true,
      images: [img("bia-outdoor"), img("bia-portrait-blonde")],
    },
  ],
  portfolio: [
    { image: img("bia-portrait-hand"), service: "retrato", title: "Helena, arquiteta — retrato editorial", description: "Fundo branco, uma luz lateral e a pose que ela mesma escolheu." },
    { image: img("bia-portrait-glasses"), service: "retrato", title: "Rafael, consultor — retrato para LinkedIn", description: "Fundo escuro para o rosto ser a única coisa que importa." },
    { image: img("bia-portrait-red"), service: "individual", title: "Ensaio individual — luz de fim de tarde", description: "Um quintal em Ipanema e vinte minutos de sol baixo." },
    { image: img("bia-bw-man"), service: "individual", title: "Seu Arlindo — projeto Ofícios de Porto Alegre", description: "Sapateiro há 52 anos no Centro. Um dos retratos da série que fotografo por conta própria." },
    { image: img("bia-portrait-blonde"), service: "imagem", title: "Marta, 54 — ensaio de imagem pessoal", description: "Fotos para o lançamento do livro dela. Pediu para não esconder nenhuma ruga." },
    { image: img("bia-portrait-window"), service: "individual", title: "Retrato de janela", description: "A mesma janela onde tudo começou, oito anos depois." },
    { image: img("bia-laugh"), service: "individual", title: "Ensaio de aniversário de 30 anos", description: "A foto boa veio depois da piada ruim que eu contei." },
    { image: img("bia-corporate"), service: "equipes", title: "Retratos da equipe — escritório de advocacia", description: "Doze sócios e associados, uma manhã, a sala de reuniões virou estúdio." },
    { image: img("bia-smile"), service: "retrato", title: "Retrato para palestra", description: "Foto de divulgação para um congresso de educação em Canoas." },
    { image: img("bia-outdoor"), service: "imagem", title: "Imagem pessoal — confeiteira", description: "Retratos na rua da confeitaria, para o site novo." },
  ],
};

export const MARINA: ProviderSeed = {
  key: "marina",
  user: { name: "Marina Costa", email: `marina.costa@${DOMAIN}`, avatar: avatar("marina"), accountType: "profissional" },
  professionalName: "Marina Costa",
  companyName: "Marina Costa Fotografia",
  slug: "marina-costa-fotografia",
  businessType: "autonomo",
  profileImageUrl: avatar("marina"),
  description: "Fotógrafa de eventos corporativos em Porto Alegre: congressos, palestras, lançamentos e confraternizações de empresa.",
  about: [
    "Fotografo eventos de empresa há seis anos — congressos, palestras, lançamentos de produto e festas de fim de ano. Sei onde ficar para não atrapalhar o palco e como pegar a plateia reagindo.",
    "Entrego uma seleção no mesmo dia para as redes da empresa e a galeria completa em até 5 dias úteis.",
  ].join("\n\n"),
  phone: "(51) 99731-4406",
  city: "Porto Alegre", state: "RS", hood: "Menino Deus", street: "Avenida Getúlio Vargas", num: 1150, postalCode: "90150-004",
  lat: -30.0551, lng: -51.2231, radiusKm: 60, since: 420, attendsOnline: false,
  specialties: ["Fotografia de eventos"],
  availability: { days: ["monday", "tuesday", "wednesday", "thursday", "friday"], start: "08:00", end: "20:00" },
  services: [
    {
      key: "corporativo",
      title: "Fotografia de Eventos Corporativos",
      description: "Fotógrafo para eventos de empresa: congressos, palestras, lançamentos e convenções. Seleção no mesmo dia para as redes e galeria completa em 5 dias úteis.",
      subcategory: "Fotografia de eventos", price: 420, priceUnit: "hora", duration: "mínimo 3 horas", negotiable: true,
      images: [img("marina-summit"), img("marina-speaker")],
    },
    {
      key: "confraternizacao",
      title: "Confraternização de Empresa",
      description: "Cobertura de festas de fim de ano e eventos internos, com retratos da equipe e fotos espontâneas.",
      subcategory: "Fotografia de eventos", price: 1600, priceUnit: "fixo", duration: "4 horas", negotiable: true,
      images: [img("marina-networking"), img("marina-summit")],
    },
  ],
  portfolio: [
    { image: img("marina-summit"), service: "corporativo", title: "Summit de inovação — palco principal", description: "Três dias de evento e uma luz de palco que mudava a cada painel." },
    { image: img("marina-speaker"), service: "corporativo", title: "Congresso de finanças", description: "O palestrante esqueceu o microfone ligado; a plateia riu e eu estava no lugar certo." },
    { image: img("marina-networking"), service: "confraternizacao", title: "Encontro de criadores", description: "O intervalo rende as melhores fotos de um evento." },
  ],
};

export const RAFAEL: ProviderSeed = {
  key: "rafael",
  user: { name: "Rafael Duarte", email: `rafael.duarte@${DOMAIN}`, avatar: avatar("rafael"), accountType: "profissional" },
  professionalName: "Rafael Duarte",
  companyName: "Rafael Duarte Fotografia",
  slug: "rafael-duarte-fotografia",
  businessType: "autonomo",
  profileImageUrl: avatar("rafael"),
  description: "Fotógrafo de festas, aniversários e formaturas em Porto Alegre e Canoas.",
  about: [
    "Comecei fotografando a festa de 15 anos da minha irmã e nunca mais parei. Hoje cubro aniversários, formaturas e festas de família, sempre no meio da pista.",
    "Gosto de fotos com movimento e luz de festa. Entrego a galeria em até 10 dias.",
  ].join("\n\n"),
  phone: "(51) 99218-7730",
  city: "Canoas", state: "RS", hood: "Centro", street: "Rua Tiradentes", num: 410, postalCode: "92010-260",
  lat: -29.9178, lng: -51.1839, radiusKm: 50, since: 300, attendsOnline: false,
  specialties: ["Fotografia de eventos"],
  availability: { days: ["tuesday", "wednesday", "thursday", "friday"], start: "10:00", end: "22:00", saturday: { start: "10:00", end: "23:30" } },
  services: [
    {
      key: "festas",
      title: "Aniversários e Festas",
      description: "Fotógrafo para eventos de família: aniversários, festas de 15 anos, bodas e chás. Galeria online com todas as fotos tratadas.",
      subcategory: "Fotografia de eventos", price: 300, priceUnit: "hora", duration: "mínimo 3 horas", negotiable: true,
      images: [img("rafael-candles"), img("rafael-dance")],
    },
    {
      key: "formatura",
      title: "Cobertura de Formaturas",
      description: "Colação de grau e baile de formatura, com fotos da família e da turma.",
      subcategory: "Fotografia de eventos", price: 1400, priceUnit: "fixo", duration: "5 horas", negotiable: true,
      images: [img("rafael-graduation"), img("rafael-dance")],
    },
  ],
  portfolio: [
    { image: img("rafael-candles"), service: "festas", title: "Aniversário de 30 anos — velas na mesa", description: "A luz das velas fez o trabalho todo; eu só abaixei a câmera." },
    { image: img("rafael-dance"), service: "festas", title: "Festa à fantasia", description: "Uma pista inteira fantasiada — ninguém queria sair da foto." },
    { image: img("rafael-graduation"), service: "formatura", title: "Colação de grau", description: "O abraço da família logo depois do diploma." },
  ],
};

export const PROVIDERS = [TOMAS, LUME, BIA, MARINA, RAFAEL];

// ---------------------------------------------------------------- serviços já concluídos (com avaliação)

export type PastHire = {
  provider: ProviderSeed["key"];
  service: string;
  client: ClientKey;
  price: number;
  daysAgo: number;
  rating?: number;
  review?: string;
  /** avaliação do prestador sobre o cliente */
  back?: string;
};

export const PAST_HIRES: PastHire[] = [
  // Tomás
  { provider: "tomas", service: "eventos", client: "rodrigo", price: 1520, daysAgo: 96, rating: 5, back: "O Rodrigo organizou tudo com antecedência e me apresentou a família inteira antes da festa. Assim fica fácil.",
    review: "Contratamos o Tomás para as bodas de 40 anos dos meus pais e foi a melhor decisão da festa. Ele passou a noite quase invisível e, mesmo assim, não perdeu nenhum abraço. As fotos chegaram uma semana antes do prometido e minha mãe chorou vendo a galeria." },
  { provider: "tomas", service: "casal", client: "camila", price: 850, daysAgo: 64, rating: 5,
    review: "Nós dois travamos na frente da câmera e o Tomás percebeu isso em cinco minutos. Foi conduzindo com conversa, pediu para a gente caminhar, rir de alguma coisa… Quando vimos as fotos, parecia que ninguém estava olhando. A luz do pôr do sol ficou inacreditável." },
  { provider: "tomas", service: "casamento", client: "leticia", price: 4800, daysAgo: 150, rating: 5,
    review: "Do primeiro orçamento até a entrega, tudo foi combinado pelo chat e cumprido à risca. No dia, ele chegou antes do horário, conversou com o cerimonial e ainda ajudou minha avó a encontrar o lugar dela. A galeria tem mais de 700 fotos e não achei nenhuma descartável." },
  { provider: "tomas", service: "casamento", client: "guilherme", price: 5200, daysAgo: 210, rating: 5,
    review: "Casamos num dia de chuva e eu estava apavorado. O Tomás tinha visitado o salão na semana anterior e já chegou com um plano B: usou a varanda e as janelas como se tivesse sido planejado. As fotos têm uma luz que eu não sei explicar." },
  { provider: "tomas", service: "eventos", client: "aline", price: 1140, daysAgo: 38, rating: 4,
    review: "Fotos lindas e muito naturais do aniversário de 60 anos da minha mãe. Demorou um pouco para responder na semana do evento, mas avisou antes e entregou dentro do prazo." },
  { provider: "tomas", service: "prewedding", client: "fernanda", price: 1200, daysAgo: 120, rating: 5,
    review: "Fizemos o pré-wedding no fim de tarde e ele sabia exatamente a hora em que a luz ia ficar dourada. Direção leve, sem pose forçada nenhuma. Gostamos tanto que já fechamos o casamento com ele." },
  { provider: "tomas", service: "elopement", client: "sabrina", price: 2900, daysAgo: 250 },
  { provider: "tomas", service: "casal", client: "patricia", price: 850, daysAgo: 180 },

  // Estúdio Lume
  { provider: "lume", service: "ecommerce", client: "camila", price: 1800, daysAgo: 45, rating: 5,
    review: "Fotografaram 40 peças da Barro Cru em dois dias, com fundo neutro para o site e algumas ambientadas para o Instagram. A Carolina entendeu a identidade da marca de primeira e as vendas online subiram no mês seguinte." },
  { provider: "lume", service: "gastronomia", client: "rodrigo", price: 1400, daysAgo: 130, rating: 5,
    review: "Fizemos o cardápio novo do Café Tertúlia com o Estúdio Lume. Cuidaram de tudo: produção, food styling e tratamento. As fotos ficaram com cara de revista e o prazo foi cumprido." },
  { provider: "lume", service: "campanha", client: "marcos", price: 6800, daysAgo: 90, rating: 5,
    review: "Campanha de lançamento da nossa safra nova. A foto do vinho sendo servido virou capa do catálogo e do site. Equipe organizada, orçamento claro desde o início." },
  { provider: "lume", service: "still", client: "patricia", price: 1800, daysAgo: 70, rating: 4,
    review: "Tratamento impecável das pedras, com cores fiéis. A primeira rodada de edição ficou um pouco escura para o meu gosto, mas ajustaram sem custo no mesmo dia." },

  // Marina Costa e Rafael Duarte (notas boas, menos avaliações que o Tomás — ele continua primeiro na busca)
  { provider: "marina", service: "corporativo", client: "henrique", price: 1680, daysAgo: 75, rating: 5,
    review: "Cobriu o congresso do escritório sem atrapalhar ninguém e mandou a seleção para as redes no fim do dia. Profissional do começo ao fim." },
  { provider: "marina", service: "corporativo", client: "marcos", price: 1260, daysAgo: 140, rating: 4,
    review: "Fotos muito boas do lançamento da safra. Só faltaram algumas da equipe da vinícola, que ela refez em outro dia sem cobrar." },
  { provider: "rafael", service: "festas", client: "patricia", price: 1200, daysAgo: 48, rating: 5,
    review: "O Rafael fez o aniversário de 60 anos do meu pai e pegou todo mundo dançando. As fotos têm a energia da festa." },

  // Bia Nogueira
  { provider: "bia", service: "retrato", client: "julia", price: 450, daysAgo: 160, rating: 5,
    review: "Precisava de fotos para o site do meu escritório de arquitetura e morria de vergonha de posar. A Bia conversou comigo sobre como eu queria ser vista pelos clientes antes de começar, e isso mudou tudo. Pela primeira vez gosto de uma foto minha." },
  { provider: "bia", service: "equipes", client: "henrique", price: 1600, daysAgo: 55, rating: 5,
    review: "Retrato corporativo para mim e mais onze pessoas em uma manhã, no próprio escritório. Montou o estúdio na sala de reuniões, fez todo mundo relaxar e entregou tudo em cinco dias com o mesmo padrão de luz." },
  { provider: "bia", service: "individual", client: "sabrina", price: 650, daysAgo: 28, rating: 5,
    review: "Ganhei o ensaio de presente de 40 anos e fui morrendo de medo. Saí de lá rindo, e as fotos mostram exatamente isso. Tratamento de pele natural, do jeito que eu pedi." },
];

// ---------------------------------------------------------------- a conversa principal (Júlia ↔ Tomás)

/** Uma fala do roteiro; `at` = minutos depois do início da conversa */
export type Line =
  | { at: number; from: "cliente" | "prestador"; text: string }
  | { at: number; from: "prestador"; propose: { service: string; payment: string; start: string; duration: string }; note: string }
  | { at: number; from: "cliente"; agree: true; note: string }
  | { at: number; from: "cliente" | "prestador"; accept: true };

/** A conversa começa há ~2 dias, às 20h14, e o acordo fecha na manhã de hoje */
export const CHAT_START_DAYS_AGO = 2;
export const CHAT_START_TIME = "20:14";

export const CHAT: Line[] = [
  { at: 0, from: "cliente", text: "Oi, Tomás! Tudo bem? Achei seu perfil procurando fotógrafo aqui no Hire e fiquei apaixonada pelo casamento no campo, com aquela luz de fim de tarde. O Diego e eu vamos casar em março e queríamos muito alguém com esse olhar." },
  { at: 1, from: "cliente", text: "É um casamento pequeno, uns 80 convidados, num sítio em Viamão. Cerimônia às 16h30 e festa até meia-noite, mais ou menos." },
  { at: 38, from: "prestador", text: "Oi, Júlia! Que alegria receber essa mensagem — e parabéns a vocês dois. Casamento em sítio no fim da tarde é exatamente a luz com que eu mais gosto de trabalhar." },
  { at: 39, from: "prestador", text: "Qual é a data certinha? Março costuma lotar rápido, então já confiro a agenda." },
  { at: 45, from: "cliente", text: "Sábado, 13 de março de 2027." },
  { at: 52, from: "prestador", text: "Tenho essa data livre. Para 80 convidados e esse horário, eu recomendo a cobertura completa: começo no making of da noiva, lá pelas 14h, e sigo até a saída de vocês. São umas 10 horas." },
  { at: 53, from: "prestador", text: "Já inclui um segundo fotógrafo na cerimônia e a galeria online com todas as fotos tratadas — costuma passar de 600 — entregue em até 45 dias." },
  { at: 61, from: "cliente", text: "Perfeito. Duas dúvidas: o álbum impresso está incluso? E você faz o ensaio pré-wedding junto?" },
  { at: 70, from: "prestador", text: "O álbum é à parte. O pré-wedding eu consigo incluir se a gente fechar os dois juntos: faço o ensaio em fevereiro, num fim de tarde, e vocês já se acostumam comigo antes do grande dia." },
  { at: 815, from: "cliente", text: "Conversei com o Diego e adoramos a ideia! O casamento no anúncio está R$ 4.800. Com o pré-wedding, consegue fazer R$ 5.400 em 3x?" },
  { at: 842, from: "prestador", text: "Consigo, sim: R$ 5.400 pelo casamento completo + pré-wedding, em 3x no cartão pelo Hire. Vou atualizar a negociação com tudo o que combinamos para vocês conferirem." },
  {
    at: 846, from: "prestador", note: "Atualizei a proposta com o pré-wedding incluído e o valor combinado.",
    propose: {
      service: "Casamento completo (making of até a saída dos noivos, segundo fotógrafo na cerimônia) + ensaio pré-wedding em fevereiro",
      payment: "R$ 5.400,00 • cartão em 3x",
      start: "13/03/2027 às 14:00",
      duration: "10 horas no casamento + 2 horas de ensaio",
    },
  },
  { at: 905, from: "cliente", agree: true, note: "Conferi tudo com o Diego: está exatamente como combinamos." },
  { at: 906, from: "cliente", accept: true },
  { at: 931, from: "prestador", accept: true },
  { at: 933, from: "prestador", text: "Contrato gerado! Qualquer dúvida sobre o roteiro do dia ou a lista de fotos com a família, é só me chamar por aqui." },
  { at: 940, from: "cliente", text: "Obrigada, Tomás! Até o pré-wedding." },
];

/** Pedido de orçamento que o Tomás ainda não respondeu (aparece no painel dele, na virada para "quem oferece") */
export const PENDING_REQUEST = {
  client: "rodrigo" as ClientKey,
  provider: "tomas" as const,
  service: "eventos",
  description: "Festa de 5 anos do Café Tertúlia, com uns 60 convidados entre clientes e fornecedores. Sexta, 20 de novembro, das 19h às 23h.",
  budget: "R$ 1.500",
  date: "2026-11-20",
  notes: "Você fotografou as bodas dos meus pais e todo mundo ainda comenta. Queria o mesmo jeito discreto na festa do café.",
  hoursAgo: 3,
};

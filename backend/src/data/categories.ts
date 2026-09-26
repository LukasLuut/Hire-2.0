/**
 * Catálogo de categorias do Hire (criado ao subir o servidor quando faltar alguma).
 * A administração pode editar nome, descrição e subcategorias depois; categorias já
 * existentes não são sobrescritas — só ganham as subcategorias se ainda não tiverem.
 */
export const CATEGORY_CATALOG: { name: string; description: string; subcategories: string[] }[] = [
  { name: "Reformas e reparos", description: "Elétrica, hidráulica, pintura, alvenaria e pequenos consertos em casa ou no trabalho.", subcategories: ["Elétrica", "Hidráulica", "Pintura", "Alvenaria", "Marcenaria", "Gesso e drywall", "Serralheria", "Telhados e calhas", "Pisos e revestimentos", "Vidraçaria"] },
  { name: "Limpeza", description: "Faxina residencial e comercial, pós-obra, estofados e higienização.", subcategories: ["Residencial", "Pós-obra", "Comercial", "Estofados", "Vidros e fachadas", "Caixa d'água", "Dedetização"] },
  { name: "Tecnologia", description: "Suporte técnico, desenvolvimento, redes e soluções digitais.", subcategories: ["Suporte técnico", "Desenvolvimento web", "Aplicativos", "Redes e Wi-Fi", "Segurança da informação", "Automação residencial"] },
  { name: "Aulas", description: "Reforço escolar, idiomas, música e cursos livres, presenciais ou online.", subcategories: ["Reforço escolar", "Idiomas", "Música", "Informática", "Pré-vestibular", "Programação"] },
  { name: "Beleza e estética", description: "Cabelo, barba, unhas, maquiagem e cuidados com a pele.", subcategories: ["Cabeleireiro", "Barbearia", "Manicure e pedicure", "Maquiagem", "Sobrancelhas e cílios", "Depilação", "Estética facial"] },
  { name: "Saúde e bem-estar", description: "Atividade física, fisioterapia, nutrição e terapias.", subcategories: ["Personal trainer", "Fisioterapia", "Nutrição", "Massoterapia", "Yoga e pilates", "Psicologia"] },
  { name: "Eventos", description: "Buffet, som, decoração, fotografia e equipe para festas e eventos.", subcategories: ["Buffet", "DJ e som", "Decoração", "Garçom e recepção", "Animação infantil", "Bartender", "Cerimonial"] },
  { name: "Pets", description: "Banho e tosa, passeios, adestramento e cuidados com animais.", subcategories: ["Banho e tosa", "Passeador de cães", "Adestramento", "Pet sitter", "Veterinário a domicílio"] },
  { name: "Automotivo", description: "Mecânica, funilaria, estética automotiva e socorro.", subcategories: ["Mecânica", "Funilaria e pintura", "Lavagem e estética", "Elétrica automotiva", "Guincho", "Pneus e alinhamento"] },
  { name: "Jardinagem e paisagismo", description: "Manutenção de jardins, paisagismo, poda e hortas.", subcategories: ["Manutenção de jardim", "Paisagismo", "Poda de árvores", "Horta e pomar", "Irrigação"] },
  { name: "Mudanças e fretes", description: "Fretes, mudanças, carretos e montagem de móveis.", subcategories: ["Frete", "Mudança residencial", "Montagem de móveis", "Carreto", "Içamento"] },
  { name: "Design e criatividade", description: "Design gráfico, identidade visual, ilustração e edição.", subcategories: ["Design gráfico", "Identidade visual", "Ilustração", "Edição de vídeo", "Social media", "Design de interiores"] },
  { name: "Fotografia e vídeo", description: "Ensaios, eventos, produtos, filmagem e drone.", subcategories: ["Ensaio fotográfico", "Fotografia de eventos", "Fotografia de produtos", "Filmagem", "Drone"] },
  { name: "Consultoria e negócios", description: "Contabilidade, jurídico, marketing, finanças e tradução.", subcategories: ["Contabilidade", "Jurídico", "Marketing digital", "Consultoria financeira", "Tradução", "Recursos humanos"] },
  { name: "Cuidados", description: "Babás, cuidadores de idosos e acompanhantes.", subcategories: ["Babá", "Cuidador de idosos", "Acompanhante hospitalar", "Enfermagem domiciliar"] },
  { name: "Moda e costura", description: "Ajustes, roupas sob medida, consultoria de estilo e reparos.", subcategories: ["Ajustes e consertos", "Sob medida", "Personal stylist", "Sapataria", "Bordado"] },
  { name: "Culinária", description: "Chef em casa, marmitas, confeitaria e aulas de cozinha.", subcategories: ["Chef em domicílio", "Marmitas", "Confeitaria", "Aulas de culinária", "Comida congelada"] },
  { name: "Assistência técnica", description: "Conserto e instalação de eletrodomésticos, ar-condicionado e eletrônicos.", subcategories: ["Ar-condicionado", "Eletrodomésticos", "Celulares", "Computadores e notebooks", "Refrigeração", "TV e som"] },
  { name: "Segurança", description: "Câmeras, alarmes, portões automáticos e chaveiro.", subcategories: ["Câmeras e alarmes", "Portões automáticos", "Chaveiro", "Cerca elétrica", "Interfones"] },
];

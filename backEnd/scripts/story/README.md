# Dados da apresentação (elenco da landing)

Um elenco pequeno e coerente para a landing "Encontre quem faz." — separado dos dados em massa de
`scripts/demo`. Todas as contas usam o domínio **@apresentacao.hire.dev** e a senha **Teste@123**.

```bash
npm run story:images   # baixa as fotos para uploads/story (uma vez; fica fora do Git)
npm run story:seed     # apaga a apresentação anterior e cria de novo
npm run story:reset    # só apaga
```

Nada fora de `@apresentacao.hire.dev` é tocado: o reset (`scripts/demo/reset.ts`, o mesmo dos dados de
demonstração) apaga só as contas desse domínio e tudo ligado a elas — prestadores, serviços, contratações,
pagamentos, contratos, conversas, negociações, avaliações e notificações.

## Quem está no elenco

| Conta | Papel na história |
|---|---|
| `tomas.albuquerque@` | **Tomás Albuquerque Fotografia** — protagonista; perfil verificado, 5 serviços, 12 trabalhos no portfólio, 6 avaliações, "Sobre" completo (`/prestador/tomas-albuquerque`) |
| `carolina.vasconcellos@` | **Estúdio Lume** (empresa ME) — fotografia comercial: produto, still, gastronomia |
| `beatriz.nogueira@` | **Bia Nogueira Retratos** — retratos profissionais e ensaios individuais |
| `julia.martins@` | cliente principal: conversa, negocia e fecha o casamento com o Tomás |
| `rodrigo.albernaz@` | avaliou o Tomás e o Lume; tem um pedido de orçamento aberto com o Tomás |
| `camila.freitas@` | avaliou o Tomás (ensaio de casal) e o Lume (fotos da marca dela) |
| outros 8 clientes | autores das demais avaliações |

A conversa Júlia ↔ Tomás passa pelo `ConversationService` (o mesmo código da API): mensagens, proposta
atualizada, tópicos acordados pelos dois lados, aceite final, contratação e contrato gerados de verdade.
Depois, as datas das mensagens são reescritas para parecer uma conversa de dois dias.

## Arquivos

- `cast.ts` — todo o roteiro: pessoas, textos do "Sobre", serviços, portfólio, avaliações, a conversa.
- `seed-story.ts` — cria tudo a partir do `cast.ts`.
- `images.json` — de onde vem cada foto (Wikimedia Commons, com autor e licença CC) e os retratos dos
  clientes (randomuser.me). `fetch-images.mjs` baixa e grava `uploads/story/CREDITS.json`.

As fotos são de demonstração: pertencem aos autores indicados em `images.json`, usadas sob as licenças
Creative Commons de cada uma, e não são trabalho de nenhum profissional real do Hire.

# Landing "Encontre quem faz." — storyboard e roteiros de captura

A página inicial de quem não está logado (`/` e `/apresentacao`) conta o Hire como uma história, usando o
**produto real**: todas as telas são tomadas do app rodando com o elenco da apresentação.

- Roteiro e textos: `frontEnd/src/landing/story.ts`
- Cenas: `frontEnd/src/landing/scenes/S01…S10`, fechamento `FinalCta.tsx`
- Enquadramentos (pontos de câmera em cada tomada): `frontEnd/src/landing/media.ts` (`SPOTS`)
- Tomadas: `frontEnd/public/landing/story` — gravadas por `frontEnd/scripts/landing-capture`
- Elenco e dados: `backEnd/scripts/story` (ver o README de lá)

## Logline

Para quem precisa de um profissional e não sabe em quem confiar, o Hire mostra quem faz — com portfólio,
avaliações e conversa direta — e transforma a conversa em contrato. Resultado: a Júlia encontra o Tomás,
fecha o casamento dela e ele ganha mais um cliente sem sair do Hire.

## Arco

| Ato | Cenas | Função |
|---|---|---|
| I — Setup | 01 Encontre (trailer), 02 O problema | promessa + dor |
| II — Confronto | 03 Descubra, 04 Conheça, 05 Confie, 06 Converse, **07 Contrate (clímax)** | o produto prova cada capacidade, sempre com o mesmo par |
| III — Resolução | 08 Mostre, 09 Compartilhe, 10 Ecossistema, CTA final | virada para quem oferece, callback da marca |

Curva: 01 pico (trailer) · 02 silêncio (só texto) · 03 médio · 04 lento (leitura) · 05 médio · 06 pico ·
07 clímax · 08 vale (luz muda) · 09 médio · 10 convergência · CTA estável.
**Callback**: a abertura é "Hire. / Encontre." e o fim é "Hire. / Encontre quem faz."; a foto do casal na estrada
fecha a cena 01 e abre a 05.

## Personagens (sempre os mesmos)

- **Tomás Albuquerque** — fotógrafo de casamentos em Porto Alegre, protagonista.
- **Júlia Martins** — arquiteta, casa em março com o Diego; encontra, conversa, negocia e contrata o Tomás.
- **Rodrigo Albernaz** — sócio do Café Tertúlia; avaliou o Tomás (bodas dos pais), avaliou o Estúdio Lume e pede orçamento novo (cena 08).
- **Camila Freitas** — ceramista; ensaio de casal com o Tomás e fotos de produto com o Estúdio Lume.
- **Estúdio Lume** (Carolina Vasconcellos) e **Bia Nogueira Retratos** — mostram que "fotógrafo" é mais de um tipo de profissional (aparecem na busca).

## Storyboard

Durações em telas de rolagem (1 = 100vh). Toda cena pinada termina com um trecho parado (hold).

```
SCENE 01 — ENCONTRE                                              5,4 telas
OBJECTIVE:      entender em segundos o que é o Hire e ver o produto de verdade
EMOTION:        curiosidade → reconhecimento
VISUAL:         escuro, "Hire." gigante; depois a busca real; ao fim, a foto do portfólio como cenário
PRODUCT ACTION: busca vazia → "Fotógrafo" digitado letra a letra (10 quadros reais) → resultados →
                card do Tomás → perfil → portfólio
CAMERA:         wide estático → a lista "desce" da barra (busca vira resultados) → destaque no card →
                push-in levando o card ao centro → perfil em slow push-in → a câmera desce para o
                portfólio → pull-out: a interface recua e a foto vira o cenário
TEXT:           "Encontre." · "Encontre quem faz." + apoio + CTA "Explorar o Hire."
TRANSITION:     a foto dá lugar ao escuro total da cena 02 (corte seco com respiro)
DESKTOP:        palco central, interface a 80vw
MOBILE:         a foto como fundo, "Hire.", manchete e CTA (sem coreografia)
REDUCED MOTION: mesma composição do mobile + a tela de resultados abaixo
```
```
SCENE 02 — O PROBLEMA                                            3,2 telas
OBJECTIVE:      preparar a solução pela dor
EMOTION:        identificação, leve tensão
VISUAL:         só texto no escuro; as quatro dúvidas no espaço negativo
CAMERA:         nenhuma — é a pausa depois do trailer
TEXT:           "Encontrar alguém é fácil." / "Encontrar a pessoa certa é outra história." /
                dúvidas / "É aí que entra o Hire."
TRANSITION:     "Hire." em azul vira a interface da cena 03
MOBILE/REDUCED: o mesmo texto em coluna, com entradas simples
```
```
SCENE 03 — DESCUBRA                                              3,6 telas
OBJECTIVE:      mostrar como a busca encontra quem faz
VISUAL:         roteiro de 5 passos à esquerda; a tela de resultados real à direita
PRODUCT ACTION: busca · painel de filtros real abrindo · botão de localização · grade · recomendados
CAMERA:         medium shot; destaque (rack focus por escurecimento) passa de parte em parte;
                leve push-in e pan para os recomendados
TRANSITION:     o Tomás (primeiro recomendado) vira o perfil da cena 04
MOBILE:         busca no celular (tomada 390 px)
```
```
SCENE 04 — CONHEÇA                                               4 telas
OBJECTIVE:      conhecer a pessoa antes do serviço
EMOTION:        proximidade
VISUAL:         a página pública do Tomás lida como página: topo, "Conheça Tomás", portfólio
CAMERA:         push-in lento na identidade → tilt (a câmera desce) até o texto → tilt até o portfólio →
                destaque na primeira foto → o visualizador do app abre → a foto cresce até a tela inteira
TEXT:           "Antes de contratar, / conheça quem está por trás do serviço." · Quem é / Como trabalha / O que já fez
TRANSITION:     a foto em tela cheia é o fundo da cena 05 (imagem vira background)
MOBILE:         perfil e portfólio no celular
```
```
SCENE 05 — CONFIE                                                3,4 telas
OBJECTIVE:      dar os sinais concretos de confiança
VISUAL:         a foto como cenário escurecido; a ficha do perfil (recorte real), fatos, avaliações reais
                chegando uma a uma, o card do serviço
CAMERA:         estática; os elementos sobem "de dentro" do perfil
TEXT:           "Mais informação para decidir com confiança."
TRANSITION:     a foto apaga para o escuro; a conversa começa
```
```
SCENE 06 — CONVERSE                                              4 telas
OBJECTIVE:      mostrar que o chat é central de negociação, não só mensagens
VISUAL:         "Converse. / Negocie. / Combine." à esquerda; o chat real à direita
PRODUCT ACTION: a conversa inteira Júlia ↔ Tomás (20 mensagens reais) rolando; o painel de
                negociação entra ao lado com os tópicos "Acordado"; destaque no card "Acordo fechado"
CAMERA:         tilt na conversa no ritmo da leitura; destaque no valor combinado; destaque no contrato
MOBILE:         conversa no celular + os três passos em texto
```
```
SCENE 07 — CONTRATE (clímax)                                     4,4 telas
OBJECTIVE:      a jornada inteira como uma só: busca → perfil → portfólio → conversa → negociação → contrato
CAMERA:         tracking horizontal (pan) pelas seis telas reais; as outras somem e a câmera se aproxima
                das duas assinaturas eletrônicas
TEXT:           "Do primeiro clique / ao serviço contratado." · "Assinado pelas duas partes…"
MOBILE:         seis quadros em grade, numerados
```
```
SCENE 08 — MOSTRE SEU TRABALHO                                   3,6 telas
OBJECTIVE:      virar a câmera para quem oferece
EMOTION:        oportunidade
VISUAL:         a luz muda (azul muito escuro); o painel real do Tomás; o pedido do Rodrigo vem para a
                frente; o gerenciador de portfólio
TEXT:           "Agora, do outro lado" · "Seu trabalho também merece ser encontrado."
```
```
SCENE 09 — COMPARTILHE                                           3,8 telas
PRODUCT ACTION: botão Compartilhar do perfil → painel real (link hire.dev/prestador/tomas-albuquerque) →
                a imagem com QR Code gerada pelo app → o perfil aberto no celular
CAMERA:         destaque no botão → o painel abre → a imagem vem para a frente → push-in no QR → o celular entra
```
```
SCENE 10 — O ECOSSISTEMA                                         3,4 telas
VISUAL:         cinco pedaços reais ligados por um fio: a mensagem da Júlia, o serviço, o Tomás, o valor
                acordado, as assinaturas; convergem para "Hire."
TEXT:           "Quem precisa / encontra quem faz." · "Encontre quem faz."
```
```
CTA FINAL — tela limpa: "Hire." / "Encontre quem faz." / apoio / "Explorar o Hire." + "Sou profissional"
            (cadastro profissional real: /auth?cadastro=1&tipo=profissional) + "Já tenho conta"
```

## Roteiros de captura (tomadas)

Gravadas por `frontEnd/scripts/landing-capture/capture.mjs` (Playwright, 2× de densidade, tema escuro,
relógio fixo numa quarta-feira às 15h para o Tomás aparecer "Aberto").

```
SCENE: BUSCA (search-type-00…09, search-results, search-filters)
OBJECTIVE: mostrar a busca encontrando o fotógrafo
INITIAL STATE: /home logada como Júlia, campo vazio
ACTION: digitar "Fotógrafo" (um quadro por letra); abrir Filtros
FOCUS: a barra; depois a grade e os recomendados
CAMERA: aplicada na página (câmera da cena)
FINAL STATE: 4 resultados — Tomás, Estúdio Lume, Bia Nogueira — e "Prestadores recomendados"
```
```
SCENE: PERFIL (profile-hero, profile-about, profile-portfolio, review-1…3, portfolio-lightbox)
INITIAL STATE: /prestador/tomas-albuquerque como Júlia
ACTION: rolar até "Conheça Tomás", portfólio, avaliações; abrir a primeira foto
FINAL STATE: foto do portfólio no visualizador do app
```
```
SCENE: CONVERSA (chat-room, chat-thread, negotiation-panel)
INITIAL STATE: /negotiation/<id> como Júlia
ACTION: a conversa inteira é rolada e costurada numa imagem alta; abrir o histórico da negociação
FINAL STATE: tópicos serviço, valor, data e duração "Acordado"
```
```
SCENE: CONTRATO (contract-signed)
ACTION: o Tomás e depois a Júlia assinam no próprio app (/contract/<id>)
FINAL STATE: "Assinado eletronicamente por…" das duas partes
```
```
SCENE: PAINEL (business, business-request, business-portfolio) — como Tomás, em https://hire.dev
SCENE: COMPARTILHAR (share-panel, share-card) — como Tomás, em https://hire.dev
SCENE: MOBILE (m-profile, m-portfolio, m-search, m-chat) — 390 px
SCENE: FOTO (photo-field-walk + versão 960 px) — a primeira foto do portfólio
```

O domínio `hire.dev` é o mesmo usado nos e-mails do projeto; a captura encaminha as requisições para o
servidor local, só para o link do perfil aparecer como apareceria em produção.

## Decisões

- **Tomadas estáticas em vez de vídeo.** Todas as telas são capturas reais em 2×, animadas por câmera
  (transform/opacity) ligada ao scroll. Resultado: texto nítido em qualquer zoom, 2,4 MB no total
  carregados por cena (vídeo equivalente passaria de 10 MB), e o visitante controla o ritmo.
  A digitação da busca é uma sequência de 10 quadros reais trocados pelo scroll.
- **Sem GSAP.** Framer Motion (já no projeto) resolve: `useScroll` + `useTransform` por cena, sem nova dependência.
- **Três modos por cena**: desktop com coreografia; celular com composição própria (tomadas de 390 px);
  movimento reduzido (sistema ou painel de acessibilidade do Hire) com a composição estática.
- **Nada de dado solto no JSX**: textos em `story.ts`, dimensões geradas em `media.gen.ts`, pontos de câmera em `media.ts`.

## Verificação (última rodada)

- Desktop 1440×900: todas as cenas revisadas quadro a quadro (0 → 1 de cada cena).
- Celular 390×844 e desktop com `prefers-reduced-motion`: página inteira, sem erros no console.
- Build de produção: chunk da landing 16,7 KB gzip; CLS 0; LCP inicial ~2,1 s (desktop) e ~2,5 s
  (celular com CPU 4× mais lenta e 4G).
- Não verificado: Safari/iOS real, leitor de tela de ponta a ponta.

Para regravar as tomadas depois de mudar o app: `backEnd: npm run story:seed` e `frontEnd/scripts/landing-capture: npm run capture`
(a tomada do contrato assina pelas duas partes, então precisa de uma apresentação recém-criada). Se o layout
de uma tela mudar, ajuste os pontos em `SPOTS` (media.ts).

## Revisão de roteiro e ritmo (setembro de 2026)

Mudanças sobre o storyboard acima (o código é a fonte da verdade; o ritmo fica em `frontEnd/src/landing/timing.ts`):

- **Reprodução por cena.** Rolar para baixo é o *play*: a página toca a cena atual até o fim e para, esperando o
  próximo gesto (`playback.ts`); aparece "Role para continuar". Rolar para cima é navegação livre. Cada cena tem
  estados completos com tempo de leitura (`hold`) e duração de movimento (`move`); as transições ganham duração
  própria. Cenas de ~8–13 s (antes ~4 s, com os estados passando em 0–0,6 s).
- **01 Encontre** termina mais cedo: resultados → destaque no card do Tomás → a câmera entra na **foto de capa do
  card**, que vira o cenário → "Encontre quem faz.". O perfil e o portfólio ficam só na cena 04. No celular, a busca
  digita "Fotógrafo" uma vez.
- **03 Descubra** — "Busque, filtre e compare quem faz.": a janela fica parada e a câmera entra nela, um
  enquadramento de perto por passo (barra, filtros, localização, resultados, recomendados).
- **05 Confie** — "Veja o que diz quem já contratou.": ficha compacta (foto, nome, selos) e **uma avaliação por
  vez**, grande o bastante para ler; sem o card de serviço.
- **06 Converse** termina com o acordo aceso (sem escurecer no fim).
- **07 Contrate**: a travessia vira montagem rápida; o fim troca o contrato inteiro (texto jurídico) pelo recorte
  das **assinaturas + "as duas partes assinaram"** (`SPOTS.contract.sealed`).
- **10 Ecossistema** fecha a página com os botões; o rodapé ficou só com "Já tenho conta" e os créditos
  (o fechamento não se repete).
- **Entradas sem palco vazio**: 03, 04, 06, 08, 09 e 10 já sobem compostas (a subida da página é a transição);
  a 02 continua começando no escuro, de propósito.
- Trilho de capítulos só com números (rótulo no hover); destaques escurecem menos; sombras das peças desligadas
  por ora (`elevation`/`lift` em `primitives.tsx`).

### Ajustes (setembro de 2026, 2ª rodada)

- **Busca "Fotógrafo para eventos"** (tomadas regravadas com o app real: `ONLY=search`). A busca devolve os dois
  serviços do Tomás (casamento e eventos); o card do casamento continua sendo o primeiro, e a capa dele abre o cenário.
- **Cena 04** abre no visualizador a foto da Camila & Rafael e avança para a saída dos noivos (`ONLY=lightboxes`);
  essa última (`photo-sparklers`, `ONLY=photos`) vira o cenário da cena 05 — a foto da estrada fica só na abertura.
- **Destaque do roteiro**: o item que a tela está mostrando ganha um quadro na cor do Hire (`ActiveBox`), que desliza
  de um item para o próximo (cenas 03, 04, 06, 08, 09).
- **Cena 03** sem câmera dentro da tela (com dois resultados, qualquer zoom cortava os cards): a tela inteira, com destaques.
- **Cena 05**: a ficha volta a ser o recorte do topo do perfil; as avaliações continuam uma de cada vez.
- **Cena 07**: a travessia começa assim que a cena chega, com aceleração e desaceleração.
- **Cena 09**: o zoom no QR Code é um movimento só (o estado de pausa ficava no meio do zoom e criava um degrau).
- **Fluidez do play**: o relógio do play usa o início do quadro (`document.timeline`) e as cenas leem a posição exata
  do play (`playhead`), sem esperar o evento de scroll arredondado — o movimento deixou de tremer. Ritmo geral 15%
  mais rápido (`PACE` em `playback.ts`).

### Ajustes (setembro de 2026, 3ª rodada — motion)

- **Curva única**: toda faixa de movimento usa `SMOOTH` (`motion.ts`) — sai devagar, acelera e pousa; keyframes com
  `useKeys`. Regra: nenhuma faixa atravessa uma pausa do play (ela congelaria no meio). Um detector automático
  (tocar cada cena e procurar movimento que para e retoma) confirmou: só sobram paradas intencionais de leitura.
- **Estado `arrive`** em `timing.ts`: movimentos longos têm tempo próprio (push-in da cena 01, traço da cena 10).
- **Prestadores**: Marina Costa (eventos corporativos) e Rafael Duarte (festas e formaturas) entraram no elenco
  (`cast.ts`, fotos CC em `images.json`); a busca mostra os três fotógrafos, com o Tomás primeiro.
- **01**: a digitação é recortada na forma da barra; a página entra com bordas esfumadas e a lista abre com borda
  suave; o push-in na capa, a foto e a frase são um movimento só; a aproximação da foto anda no tempo.
- **03**: localização abre o menu real (`search-location`), zoom nele e de volta; resultados e profissionais com
  zoom que enquadra a parte inteira (sem corte).
- **04 → 05**: a saída dos noivos é uma camada única (`sharedPhoto.tsx`), parada na tela durante as duas cenas.
- **06**: janela do chat dimensionada pela altura da tela; tópicos só com contraste (sem o quadro azul).
- **09**: celular com faixa de rodapé do aparelho (a barra de botões do app não encosta na borda).
- **10**: esquema redesenhado — uma curva contínua Cliente → Serviço → Profissional → Orçamento → Contratação,
  com ponto de luz e cada etapa acendendo quando o traço chega.

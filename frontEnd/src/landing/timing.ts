// Ritmo da apresentação: quanto cada cena ocupa de scroll e onde ela "respira".
// Um só lugar para as duas pontas do sistema — o palco (Scene/useNarrativeProgress) e o play (playback.ts).
import type { ChapterId } from "./story";

/**
 * Estado completo da cena: a faixa de progresso [a, b] em que ela pode ficar parada.
 *  - hold: segundos parado no fim da faixa durante o play (tempo de leitura);
 *  - move: segundos para percorrer a faixa, quando dentro dela algo anda (pan, conversa rolando, digitação);
 *  - arrive: segundos da transição que chega a este estado (quando um movimento longo precisa de tempo próprio).
 * Entre dois estados ficam as transições; o play dá a elas uma duração própria, com aceleração suave.
 * Regra de ouro: nenhuma faixa de movimento pode atravessar um `hold` — ela congelaria no meio (degrau).
 */
export type Rest = readonly [a: number, b: number, hold?: number, move?: number, arrive?: number];
export type Rests = readonly Rest[];

/** `pace`: multiplica as durações do play desta cena (1 = normal; > 1 = mais devagar) */
export type SceneTiming = { length: number; rests: Rests; pace?: number };

export const SCENES: Record<ChapterId, SceneTiming> = {
  // a marca · digitando "Fotógrafo para eventos" (e o tempo de ler a frase) · resultados · o card do Tomás · a capa vira o cenário · "Encontre quem faz." · botão
  encontre: {
    length: 4.2,
    // o push-in na capa, a foto em tela cheia e a frase são um movimento só (arrive 3,4 s), sem pausa no meio
    rests: [[0, 0.04], [0.14, 0.26, 0.9, 2.3], [0.36, 0.38, 1], [0.42, 0.46, 0.9], [0.84, 0.84, 1.4, undefined, 3.4], [0.92, 1]],
  },
  // primeira frase · a virada · as dúvidas, uma a uma · a resposta
  "o-problema": {
    length: 3.2,
    rests: [[0.12, 0.16, 1.4], [0.28, 0.32, 1.8], [0.41, 0.42, 0.45], [0.47, 0.48, 0.45], [0.53, 0.54, 0.45], [0.59, 0.68, 1.1], [0.9, 1]],
  },
  descubra: {
    length: 4.4,
    // busca · filtros · localização (o menu abre, zoom nele e de volta) · resultados de perto · quem faz
    rests: [[0.12, 0.2, 1.4], [0.27, 0.33, 1.6], [0.46, 0.5, 1.6, undefined, 1.9], [0.64, 0.72, 1.5, undefined, 1.9], [0.76, 0.76, 0.4, undefined, 1.1], [0.8, 1, 0, undefined, 1.1]],
  },
  // identidade · "Conheça" (leitura) · portfólio · a foto da Camila aberta · a saída dos noivos · a foto como cenário
  conheca: {
    length: 4,
    pace: 1.3,
    rests: [[0.1, 0.3, 1.2], [0.42, 0.62, 1.9], [0.72, 0.8, 1.2], [0.85, 0.87, 1.3], [0.91, 0.92, 1.3], [0.99, 1]],
  },
  // a foto (vinda da cena anterior) · a ficha · cada avaliação, lida inteira · a última
  confie: {
    length: 3.4,
    rests: [[0, 0.02], [0.2, 0.22, 1], [0.3, 0.44, 2.2], [0.52, 0.66, 2.2], [0.74, 1]],
  },
  // a conversa rolando no ritmo da leitura · a negociação ao lado até o acordo
  converse: {
    length: 4,
    rests: [[0.1, 0.47, 0.8, 4.2], [0.57, 1, 0, 3.2]],
  },
  // a travessia começa assim que a cena chega (com aceleração e desaceleração na própria cena) · as assinaturas
  contrate: {
    length: 4,
    rests: [[0, 0.62, 0.5, 3.4], [0.86, 1]],
  },
  // o painel · o perfil completo em destaque · o pedido do Rodrigo · o portfólio como vitrine
  mostre: {
    length: 3.6,
    rests: [[0, 0.14, 1], [0.2, 0.36, 1.4], [0.5, 0.62, 1.6], [0.76, 1]],
  },
  // o perfil · o botão Compartilhar · o painel · a imagem gerada · o QR Code (zoom inteiro, parado no fim) · o celular
  compartilhe: {
    length: 3.8,
    rests: [[0, 0.12, 0.8], [0.18, 0.28, 1.2], [0.38, 0.5, 1.6], [0.6, 0.7, 1.2], [0.8, 0.8, 1.2], [0.96, 1]],
  },
  ecossistema: {
    length: 3.2,
    // o traço inteiro num movimento só (arrive 4,8 s) · a marca · a frase · os botões
    rests: [[0.54, 0.56, 1, undefined, 4.8], [0.74, 0.74, 1], [0.84, 0.86, 1.2], [0.94, 1]],
  },
};

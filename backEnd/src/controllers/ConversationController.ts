import { Request, Response } from "express";
import { ConversationService } from "../services/ConversationService";

const conversationService = new ConversationService();
const userId = (req: Request) => (req as any).user.id as number;
const nid = (req: Request) => (req.params.nid ? Number(req.params.nid) : undefined);
const files = (req: Request) => (req.files as Express.Multer.File[]) ?? [];

/** Envolve o handler: erro com status vira resposta com a mensagem; sem status, 400 */
const handle =
  (fn: (req: Request) => Promise<unknown>, status = 200) =>
  async (req: Request, res: Response) => {
    try {
      res.status(status).json(await fn(req));
    } catch (e: any) {
      res.status(e.status ?? 400).json({ message: e.message });
    }
  };

/** Corpo multipart chega com campos aninhados em JSON (custom, proposal) */
const parsed = (v: unknown) => {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return undefined;
  }
};

export class ConversationController {
  open = handle((req) => conversationService.open(userId(req), req.body), 201);

  listMine = handle((req) =>
    conversationService.listMine(userId(req), {
      limit: Number(req.query.limit) || undefined,
      offset: Number(req.query.offset) || undefined,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      filter: req.query.filter === "unread" || req.query.filter === "negotiating" ? req.query.filter : "",
    })
  );

  listNegotiations = handle((req) => conversationService.listNegotiations(userId(req)));

  get = handle((req) => conversationService.get(Number(req.params.id), userId(req), req.query.after ? Number(req.query.after) : undefined));

  markRead = handle((req) => conversationService.markRead(Number(req.params.id), userId(req)));

  sendMessage = async (req: Request, res: Response) => {
    try {
      const id = await conversationService.sendMessage(Number(req.params.id), userId(req), req.body.text, req.file);
      res.status(201).json({ id });
    } catch (e: any) {
      res.status(e.status ?? 400).json({ message: e.message });
    }
  };

  createNegotiation = handle(
    (req) =>
      conversationService.createNegotiation(
        Number(req.params.id),
        userId(req),
        { serviceId: req.body.serviceId, custom: parsed(req.body.custom) as any, proposal: parsed(req.body.proposal) as any },
        files(req)
      ),
    201
  );

  updateTopics = handle((req) => conversationService.updateTopics(Number(req.params.id), userId(req), req.body.topics, req.body.note, nid(req)));

  /** Aceite final do acordo (a rota antiga /formalize faz o mesmo). */
  accept = handle((req) => conversationService.accept(Number(req.params.id), userId(req), nid(req)));

  request = handle((req) => conversationService.request(userId(req), req.body, files(req)), 201);

  respond = handle((req) => conversationService.respond(Number(req.params.id), userId(req), req.body, files(req), nid(req)));

  reject = handle((req) => conversationService.reject(Number(req.params.id), userId(req), req.body?.reason, nid(req)));

  close = handle((req) => conversationService.close(Number(req.params.id), userId(req), req.body?.reason, nid(req)));
}

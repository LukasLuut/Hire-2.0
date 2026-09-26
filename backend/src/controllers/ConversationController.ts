import { Request, Response } from "express";
import { ConversationService } from "../services/ConversationService";

const conversationService = new ConversationService();
const userId = (req: Request) => (req as any).user.id as number;

export class ConversationController {
  open = async (req: Request, res: Response) => {
    try {
      res.status(201).json(await conversationService.open(userId(req), req.body));
    } catch (e: any) {
      res.status(e.status ?? 400).json({ message: e.message });
    }
  };

  listMine = async (req: Request, res: Response) => {
    try {
      res.json(await conversationService.listMine(userId(req)));
    } catch (e: any) {
      res.status(e.status ?? 400).json({ message: e.message });
    }
  };

  get = async (req: Request, res: Response) => {
    try {
      const after = req.query.after ? Number(req.query.after) : undefined;
      res.json(await conversationService.get(Number(req.params.id), userId(req), after));
    } catch (e: any) {
      res.status(e.status ?? 404).json({ message: e.message });
    }
  };

  sendMessage = async (req: Request, res: Response) => {
    try {
      const id = await conversationService.sendMessage(Number(req.params.id), userId(req), req.body.text, req.file);
      res.status(201).json({ id });
    } catch (e: any) {
      res.status(e.status ?? 400).json({ message: e.message });
    }
  };

  updateTopics = async (req: Request, res: Response) => {
    try {
      res.json(await conversationService.updateTopics(Number(req.params.id), userId(req), req.body.topics, req.body.note));
    } catch (e: any) {
      res.status(e.status ?? 400).json({ message: e.message });
    }
  };

  /** Aceite final do acordo (a rota antiga /formalize faz o mesmo). */
  accept = async (req: Request, res: Response) => {
    try {
      res.json(await conversationService.accept(Number(req.params.id), userId(req)));
    } catch (e: any) {
      res.status(e.status ?? 400).json({ message: e.message });
    }
  };

  request = async (req: Request, res: Response) => {
    try {
      res.status(201).json(await conversationService.request(userId(req), req.body, (req.files as Express.Multer.File[]) ?? []));
    } catch (e: any) {
      res.status(e.status ?? 400).json({ message: e.message });
    }
  };

  respond = async (req: Request, res: Response) => {
    try {
      res.json(await conversationService.respond(Number(req.params.id), userId(req), req.body, (req.files as Express.Multer.File[]) ?? []));
    } catch (e: any) {
      res.status(e.status ?? 400).json({ message: e.message });
    }
  };

  reject = async (req: Request, res: Response) => {
    try {
      res.json(await conversationService.reject(Number(req.params.id), userId(req), req.body?.reason));
    } catch (e: any) {
      res.status(e.status ?? 400).json({ message: e.message });
    }
  };

  close = async (req: Request, res: Response) => {
    try {
      res.json(await conversationService.close(Number(req.params.id), userId(req), req.body?.reason));
    } catch (e: any) {
      res.status(e.status ?? 400).json({ message: e.message });
    }
  };
}

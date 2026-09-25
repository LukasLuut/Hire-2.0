import { Request, Response } from "express";
import { notificationService } from "../services/NotificationService";

const userId = (req: Request) => Number((req as any).user.id);

export class NotificationController {
  list = async (req: Request, res: Response) => {
    try {
      res.json(await notificationService.list(userId(req)));
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };

  pending = async (req: Request, res: Response) => {
    try {
      res.json(await notificationService.pending(userId(req)));
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };

  readAll = async (req: Request, res: Response) => {
    try {
      res.json(await notificationService.markRead(userId(req)));
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };

  readOne = async (req: Request, res: Response) => {
    try {
      res.json(await notificationService.markRead(userId(req), Number(req.params.id)));
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };
}

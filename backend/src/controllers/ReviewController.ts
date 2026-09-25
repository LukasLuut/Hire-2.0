import { Request, Response } from "express";
import { ReviewService } from "../services/ReviewService";

const reviewService = new ReviewService();

export class ReviewController {
  create = async (req: Request, res: Response) => {
    try {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const review = await reviewService.create((req as any).user.id, req.body, files);
      res.status(201).json(review);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };

  listForProvider = async (req: Request, res: Response) => {
    try {
      res.json(await reviewService.listForProvider(Number(req.params.providerId)));
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };

  listForClient = async (req: Request, res: Response) => {
    try {
      res.json(await reviewService.listForClient(Number(req.params.userId)));
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };

  listForHire = async (req: Request, res: Response) => {
    try {
      res.json(await reviewService.listForHire(Number(req.params.hireId)));
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };
}

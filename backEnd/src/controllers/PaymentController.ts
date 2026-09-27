import { Request, Response } from "express";
import { paymentService } from "../services/PaymentService";

export class PaymentController {
  /** Administração: pagamentos recentes e totais */
  overview = async (req: Request, res: Response) => {
    try {
      res.json(await paymentService.adminOverview(Number(req.query.limit) || 100));
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  };
}

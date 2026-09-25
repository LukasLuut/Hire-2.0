import { Request, Response } from "express";
import { ContractService } from "../services/ContractService";

const contractService = new ContractService;

export class ContractController {
    getById = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const contract = await contractService.getById(Number(id), (req as any).user.id);
            res.json(contract);
        } catch (e: any) {
            res.status(e.status ?? 404).json({ message: e.message})
        }
    }

    sign = async (req: Request, res: Response) => {
        try {
            const contract = await contractService.sign(Number(req.params.id), (req as any).user.id, req.body ?? {}, {
                userAgent: String(req.headers["user-agent"] ?? "").slice(0, 300),
                ip: req.ip ?? null,
            });
            res.json(contract);
        } catch (e: any) {
            res.status(e.status ?? 400).json({ message: e.message })
        }
    }
}

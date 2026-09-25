import { Request, Response } from "express";
import { ServiceService } from "../services/ServiceService";

const serviceService = new ServiceService;

function toBoolean(value: any): boolean {
  return value === true || value === "true" || value === "1" || value === 1;
}

// Aceita a imagem única do editor ("image") e as várias do assistente de criação ("images")
function filesOf(req: Request): Express.Multer.File[] {
  const f = req.files as Record<string, Express.Multer.File[]> | undefined;
  return [...(f?.images ?? []), ...(f?.image ?? [])];
}

const userId = (req: Request) => Number((req as any).user.id);

export class ServiceController {
    create = async (req: Request, res: Response) => {
        try {
            const {
                negotiable,
                requiresScheduling
            } = req.body;

            const body = {
                ...req.body,
                negotiable: toBoolean(negotiable),
                requiresScheduling: toBoolean(requiresScheduling),
            };

            const service = await serviceService.create(body, userId(req), filesOf(req));
            res.status(201).json(service);
        } 
        catch(err: any) {
          res.status(err.status ?? 400).json({ message: err.message })
        }
      }

    toggleLike = async (req: Request, res: Response) => {
        try {
            res.json(await serviceService.toggleLike(Number(req.params.id), (req as any).user.id));
        } catch (e: any) {
            res.status(400).json({ message: e.message });
        }
    }

    likedByMe = async (req: Request, res: Response) => {
        try {
            res.json(await serviceService.likedBy((req as any).user.id));
        } catch (e: any) {
            res.status(400).json({ message: e.message });
        }
    }

    list = async (req: Request, res: Response) => {
        try {
            const services = await serviceService.list();
            res.json(services)
        }
        catch(err: any) {
            res.status(400).json({ message: err.message})
        }
    }

    getById = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const services = await serviceService.getById(Number(id));
            res.json(services)
        }
        catch(err: any) {
            res.status(400).json({ message: err.message})
        }
    }

    update = async (req: Request, res: Response) => {
          try {
                const {
                    negotiable,
                    requiresScheduling
                } = req.body;

                const body = {
                    ...req.body,
                    negotiable: negotiable === undefined ? undefined : toBoolean(negotiable),
                    requiresScheduling: requiresScheduling === undefined ? undefined : toBoolean(requiresScheduling),
                };

                const { id } = req.params;
                const service = await serviceService.update(Number(id), body, userId(req), filesOf(req))
                res.json(service)
            } catch (e: any) {
                res.status(e.status ?? 400).json({ message: e.message })
            }
        }

    async delete(req: Request, res: Response) {
            try {
                const { id } = req.params
                const result = await serviceService.remove(Number(id), userId(req))
                res.json(result)
            } catch (e: any) {
                res.status(e.status ?? 404).json({ message: e.message })
            }
        }
}
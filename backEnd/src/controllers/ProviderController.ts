import { Request, Response } from "express";
import { ProviderService } from "../services/ProviderService";

const providerService = new ProviderService();

function toBoolean(value: any): boolean {
  return value === true || value === "true" || value === "1" || value === 1;
}

const BOOLEAN_FIELDS = [
  "attendsOnline", "attendsPresent", "personalizedProposals", "approximateLocation",
  "publicReviews", "pricesOnPage", "whatsNotification", "emailNotification",
];

// Campos de multipart chegam como texto: converte booleanos e a disponibilidade (JSON)
function normalizeBody(raw: any) {
  const body: any = { ...raw };
  for (const key of BOOLEAN_FIELDS) {
    if (key in body) body[key] = toBoolean(body[key]);
  }
  if (typeof body.availabilities === "string") {
    body.availabilities = body.availabilities ? JSON.parse(body.availabilities) : undefined;
  }
  return body;
}

export class ProviderController {
  create = async (req: Request, res: Response) => {
    try {
      const provider = await providerService.create(
        (req as any).user.id,
        normalizeBody(req.body),
        req.file
      );
      res.status(201).json(provider);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const provider = await providerService.getById((req as any).user.id);
      res.json(provider);
    } catch (err: any) {
      res.status(404).json({ message: err.message });
    }
  };

  getServices = async (req: Request, res: Response) => {
    try {
      const services = await providerService.getServices((req as any).user.id);
      res.json(services);

    } catch (err: any) {
      res.status(400).json({ messages: err.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const result = await providerService.remove((req as any).user.id);
      res.json(result);
    } catch (e: any) {
      res.status(404).json({ message: e.message });
    }
  }

  getPublic = async (req: Request, res: Response) => {
    try {
      // aceita id numérico (links antigos) ou slug (/prestador/<slug>)
      res.json(await providerService.getPublic(await providerService.resolveId(String(req.params.id))));
    } catch (e: any) {
      res.status(e?.status === 410 ? 410 : 404).json({ message: e.message, reason: e?.status === 410 ? "deactivated" : "not_found" });
    }
  };

  list = async (req: Request, res: Response) => {
    try {
      const providers = await providerService.list();
      res.json(providers);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const provider = await providerService.update(
        (req as any).user.id,
        normalizeBody(req.body),
        req.file
      );
      res.json(provider);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };

  // async delete(req: Request, res: Response) {
  //         try {
  //             const { id } = req.params
  //             const result = await categoryService.remove(Number(id))
  //             res.json(result)
  //         } catch (e: any) {
  //             res.status(404).json({ message: e.message })
  //         }
  //     }
}

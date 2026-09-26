import { Router } from "express";
import path from "path";
import { PRIVATE_DIR } from "../middlewares/uploadMiddleware";
import { validSignature } from "../utils/signedFile";

const fileRouter = Router();

// Anexo da negociação por link assinado (quem recebeu o link da API participa da conversa)
fileRouter.get("/c/:name", (req, res) => {
  const name = path.basename(String(req.params.name));
  if (!validSignature(name, req.query.exp, req.query.sig)) {
    res.status(403).json({ message: "Link expirado ou inválido. Abra a conversa de novo." });
    return;
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.sendFile(path.join(PRIVATE_DIR, name), (err) => {
    if (err && !res.headersSent) res.status(404).json({ message: "Arquivo não encontrado" });
  });
});

export default fileRouter;

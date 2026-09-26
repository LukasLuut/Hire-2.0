import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    // só letras, números, ponto, hífen e sublinhado: evita caminhos como "../"
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, "");
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .normalize("NFD")
      .replace(/[^\w-]+/g, "-")
      .slice(0, 60) || "arquivo";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${base}${ext}`);
  }
});

const ALLOWED = /^(image\/(png|jpe?g|gif|webp|svg\+xml)|application\/pdf)$/;

export const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.test(file.mimetype)) cb(null, true);
    else cb(new Error("Envie apenas imagens (PNG, JPG, GIF, WEBP) ou PDF de até 8 MB"));
  },
});

/**
 * Arquivos privados (provas de relatos, documentos): ficam fora de /uploads e
 * só saem por rotas que conferem quem pode ver. Sem SVG (pode carregar script).
 */
export const PRIVATE_DIR = path.join(__dirname, "..", "..", "private_uploads");
fs.mkdirSync(PRIVATE_DIR, { recursive: true });

const PRIVATE_ALLOWED = /^(image\/(png|jpe?g|gif|webp)|application\/pdf)$/;

export const privateUpload = multer({
  storage: multer.diskStorage({
    destination: PRIVATE_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 6);
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (PRIVATE_ALLOWED.test(file.mimetype)) cb(null, true);
    else cb(new Error("Envie apenas imagens (PNG, JPG, GIF, WEBP) ou PDF de até 8 MB"));
  },
});

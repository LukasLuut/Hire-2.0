import "reflect-metadata";
import fileRouter from "./routes/fileRoutes";
import express, { Application, NextFunction, Request, Response } from "express";
import { AppDataSource } from "./config/data-source";
import router from "./routes/index";
import cors from "cors";
import path from "path";
import { jwtSecret } from "./utils/jwt";
import { HireService } from "./services/HireService";
import { registerNotificationMailer } from "./services/NotificationMailer";
import { loadBlockedUsers } from "./utils/access";
import { seoRouter, spaHandler } from "./seo/seo";
import { ProviderService } from "./services/ProviderService";

const app: Application = express();
const PORTA: number = 8080;

// Sem um JWT_SECRET forte no .env o servidor não sobe (evita tokens assinados com valor conhecido)
jwtSecret();

app.use(express.json());
/*
  .initialize() é um método do ORM que inicia a conexão com o banco (que nem fazíamos com o createPool() da bilioteca do mysql2) e preparar todos os recursos antes de usar. Abre a conexão com o banco usando as configurações (host, porta, usuário, senha, banco), carrega as entidades (models/tabelas), executa sincronização (se synchronize: true estiver definido), que é o que cria as tabelas. Initialize é assíncrono, portanto retorna uma Promise. O que fica dentro de .then() é o que acontece se der certo, e o que fica no .catch() é o que acontece se houver erro.
*/
AppDataSource.initialize()
  .then(() => {
    console.log("Database connected successfully");
    // CORS só para os endereços do frontend (CORS_ORIGINS no .env, separados por vírgula).
    // Requisições sem Origin (mesmo domínio, curl, testes) passam normalmente.
    const origins = (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173").split(",").map((o) => o.trim()).filter(Boolean);
    app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.includes(origin)) }));
    app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), { setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff') }));
    app.use('/files', fileRouter);
    // SEO: robots.txt, sitemap.xml e, quando existe o build do frontend, a SPA com meta tags por página
    app.use(seoRouter);
    app.use(spaHandler());
    app.use(router);

    // Erros lançados por middlewares (ex.: upload inválido) viram JSON legível para o frontend
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      if (res.headersSent) return next(err);
      const tooBig = err?.code === "LIMIT_FILE_SIZE";
      res.status(err?.status ?? 400).json({ message: tooBig ? "Arquivo maior que 8 MB" : err?.message ?? "Requisição inválida" });
    });

    // Avisos também por e-mail (para quem confirmou o e-mail e quer receber)
    registerNotificationMailer();

    // perfis antigos ganham endereço público (/prestador/<slug>)
    new ProviderService().ensureSlugs().catch((err) => console.error("Falha ao gerar slugs:", err.message));

    // contas suspensas (consultadas pelo authMiddleware)
    loadBlockedUsers().catch((err) => console.error("Falha ao carregar contas suspensas:", err.message));

    // Pedidos sem resposta expiram (verificação ao subir e a cada 10 minutos)
    const hires = new HireService();
    const expire = () => hires.expireStale().catch((err) => console.error("Falha ao expirar pedidos:", err.message));
    expire();
    setInterval(expire, 10 * 60 * 1000);

    app.listen(PORTA, () => {
      console.log(`Server running in port: ${PORTA}`);
    });
  })
  .catch((err) => console.error("Error connecting to the database: ", err));

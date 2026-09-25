import "reflect-metadata";
import express, { Application, NextFunction, Request, Response } from "express";
import { AppDataSource } from "./config/data-source";
import router from "./routes/index";
import cors from "cors";
import path from "path";

const app: Application = express();
const PORTA: number = 8080;

app.use(express.json());
/*
  .initialize() é um método do ORM que inicia a conexão com o banco (que nem fazíamos com o createPool() da bilioteca do mysql2) e preparar todos os recursos antes de usar. Abre a conexão com o banco usando as configurações (host, porta, usuário, senha, banco), carrega as entidades (models/tabelas), executa sincronização (se synchronize: true estiver definido), que é o que cria as tabelas. Initialize é assíncrono, portanto retorna uma Promise. O que fica dentro de .then() é o que acontece se der certo, e o que fica no .catch() é o que acontece se houver erro.
*/
AppDataSource.initialize()
  .then(() => {
    console.log("Database connected successfully");
    app.use(
      cors(/* {
        origin: "http://localhost:5173", // ou a origem do teu frontend
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"], // 🔥 ESSA LINHA É ESSENCIAL
      } */)
    );
    app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
    app.use(router);

    // Erros lançados por middlewares (ex.: upload inválido) viram JSON legível para o frontend
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      if (res.headersSent) return next(err);
      const tooBig = err?.code === "LIMIT_FILE_SIZE";
      res.status(err?.status ?? 400).json({ message: tooBig ? "Arquivo maior que 8 MB" : err?.message ?? "Requisição inválida" });
    });

    app.listen(PORTA, () => {
      console.log(`Server running in port: ${PORTA}`);
    });
  })
  .catch((err) => console.error("Error connecting to the database: ", err));

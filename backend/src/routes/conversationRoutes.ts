import { Router } from "express";
import { ConversationController } from "../controllers/ConversationController";
import { authMiddleware } from "../middlewares/authMidlleware";
// anexos da negociação são privados: só as partes veem (link assinado)
import { privateUpload as upload } from "../middlewares/uploadMiddleware";
import { rateLimit } from "../utils/rateLimit";

const conversationRouter = Router();
const controller = new ConversationController();
// rajadas de mensagens (cada uma gera aviso para a outra parte)
const messageLimit = rateLimit({ windowMs: 60_000, max: 30, message: "Muitas mensagens seguidas. Espere um instante.", localDevBypass: true });

conversationRouter.use(authMiddleware);
conversationRouter.post("/", controller.open);
conversationRouter.post("/request", upload.array("attachments", 8), controller.request);
conversationRouter.get("/", controller.listMine);
conversationRouter.get("/negotiations", controller.listNegotiations);
conversationRouter.get("/:id", controller.get);
conversationRouter.post("/:id/read", controller.markRead);
conversationRouter.post("/:id/messages", messageLimit, upload.single("attachment"), controller.sendMessage);

// negociações dentro da conversa
conversationRouter.post("/:id/negotiations", upload.array("attachments", 8), controller.createNegotiation);
conversationRouter.put("/:id/negotiations/:nid/topics", controller.updateTopics);
conversationRouter.post("/:id/negotiations/:nid/accept", controller.accept);
conversationRouter.post("/:id/negotiations/:nid/respond", upload.array("attachments", 8), controller.respond);
conversationRouter.post("/:id/negotiations/:nid/reject", controller.reject);
conversationRouter.post("/:id/negotiations/:nid/close", controller.close);

// rotas da v1: agem na negociação aberta em destaque
conversationRouter.put("/:id/topics", controller.updateTopics);
conversationRouter.post("/:id/accept", controller.accept);
conversationRouter.post("/:id/formalize", controller.accept);
conversationRouter.post("/:id/respond", upload.array("attachments", 8), controller.respond);
conversationRouter.post("/:id/reject", controller.reject);
conversationRouter.post("/:id/close", controller.close);

export default conversationRouter;

import { Router } from "express";
import { ConversationController } from "../controllers/ConversationController";
import { authMiddleware } from "../middlewares/authMidlleware";
// anexos da negociação são privados: só as partes veem (link assinado)
import { privateUpload as upload } from "../middlewares/uploadMiddleware";

const conversationRouter = Router();
const controller = new ConversationController();

conversationRouter.use(authMiddleware);
conversationRouter.post("/", controller.open);
conversationRouter.post("/request", upload.array("attachments", 8), controller.request);
conversationRouter.get("/", controller.listMine);
conversationRouter.get("/:id", controller.get);
conversationRouter.post("/:id/messages", upload.single("attachment"), controller.sendMessage);
conversationRouter.put("/:id/topics", controller.updateTopics);
conversationRouter.post("/:id/accept", controller.accept);
conversationRouter.post("/:id/formalize", controller.accept);
conversationRouter.post("/:id/respond", upload.array("attachments", 8), controller.respond);
conversationRouter.post("/:id/reject", controller.reject);
conversationRouter.post("/:id/close", controller.close);

export default conversationRouter;

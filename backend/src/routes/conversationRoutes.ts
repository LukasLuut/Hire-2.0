import { Router } from "express";
import { ConversationController } from "../controllers/ConversationController";
import { authMiddleware } from "../middlewares/authMidlleware";
import { upload } from "../middlewares/uploadMiddleware";

const conversationRouter = Router();
const controller = new ConversationController();

conversationRouter.use(authMiddleware);
conversationRouter.post("/", controller.open);
conversationRouter.get("/", controller.listMine);
conversationRouter.get("/:id", controller.get);
conversationRouter.post("/:id/messages", upload.single("attachment"), controller.sendMessage);
conversationRouter.put("/:id/topics", controller.updateTopics);
conversationRouter.post("/:id/formalize", controller.formalize);
conversationRouter.post("/:id/close", controller.close);

export default conversationRouter;

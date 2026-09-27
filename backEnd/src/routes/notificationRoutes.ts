import { Router } from "express";
import { NotificationController } from "../controllers/NotificationController";
import { authMiddleware } from "../middlewares/authMidlleware";

const notificationRouter = Router();
const controller = new NotificationController();

// Avisos e pendências são sempre da pessoa logada
notificationRouter.use(authMiddleware);
notificationRouter.get("/", controller.list);
notificationRouter.get("/pending", controller.pending);
notificationRouter.post("/read", controller.readAll);
notificationRouter.post("/:id/read", controller.readOne);

export default notificationRouter;

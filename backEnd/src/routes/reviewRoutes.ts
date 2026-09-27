import { Router } from "express";
import { ReviewController } from "../controllers/ReviewController";
import { authMiddleware } from "../middlewares/authMidlleware";
import { upload } from "../middlewares/uploadMiddleware";

const reviewRouter = Router();
const controller = new ReviewController();

// Até 5 fotos por avaliação (campo "photos")
reviewRouter.post("/", authMiddleware, upload.array("photos", 5), controller.create);
reviewRouter.get("/provider/:providerId", controller.listForProvider);
reviewRouter.get("/user/:userId", controller.listForClient);
reviewRouter.get("/hire/:hireId", authMiddleware, controller.listForHire);

export default reviewRouter;

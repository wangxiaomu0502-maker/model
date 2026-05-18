import { Router } from "express";

import { requireAuth } from "../../middlewares/auth";
import { idCardOcrController } from "./ocr.controller";
import { ocrUploader } from "./ocr.middleware";

const ocrRouter = Router();

ocrRouter.post("/id-card", requireAuth, ocrUploader.single("file"), idCardOcrController);

export default ocrRouter;

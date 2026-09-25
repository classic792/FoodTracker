import { Router } from "express";
import * as batchController from "../controllers/batchController.js";

const router = Router();

router.post("/", batchController.createBatch);
router.get("/", batchController.listBatches);
router.get("/:id", batchController.getBatch);
router.patch("/:id", batchController.updateBatch);

export default router;

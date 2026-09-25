import { Router } from "express";
import * as storageLocationController from "../controllers/storageLocationController.js";

const router = Router();

router.post("/", storageLocationController.createStorageLocation);
router.get("/", storageLocationController.listStorageLocations);
router.get("/:id", storageLocationController.getStorageLocation);
router.patch("/:id", storageLocationController.updateStorageLocation);
router.delete("/:id", storageLocationController.deleteStorageLocation);

export default router;

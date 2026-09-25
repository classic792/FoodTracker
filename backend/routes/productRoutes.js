import { Router } from "express";
import * as productController from "../controllers/productController.js";

const router = Router();

router.post("/", productController.createProduct);
router.get("/", productController.listProducts);
router.get("/:id", productController.getProduct);
router.patch("/:id", productController.updateProduct);
router.delete("/:id", productController.deleteProduct);

export default router;

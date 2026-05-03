import { Router } from "express";
import { createUpdate, listUpdates } from "../controllers/updateController.js";

const router = Router();

router.get("/", listUpdates);
router.post("/", createUpdate);

export default router;

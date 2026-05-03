import { Router } from "express";
import { createGate, getGateRecommendation, listGates, updateGate } from "../controllers/gateController.js";

const router = Router();

router.get("/", listGates);
router.get("/recommendation", getGateRecommendation);
router.post("/", createGate);
router.put("/:gateId", updateGate);

export default router;

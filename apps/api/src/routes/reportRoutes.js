import { Router } from "express";
import { createReport, getLiveState, listReports, verifyReport } from "../controllers/reportController.js";

const router = Router();

router.get("/", listReports);
router.get("/live", getLiveState);
router.post("/", createReport);
router.post("/:reportId/verify", verifyReport);

export default router;

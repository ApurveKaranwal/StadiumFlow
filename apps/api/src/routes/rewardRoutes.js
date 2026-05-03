import { Router } from "express";
import { getRewardDashboard, redeemFoodDiscount, rewardDetourFan } from "../controllers/rewardController.js";

const router = Router();

router.get("/profile", getRewardDashboard);
router.post("/detour-points", rewardDetourFan);
router.post("/redeem-food", redeemFoodDiscount);

export default router;

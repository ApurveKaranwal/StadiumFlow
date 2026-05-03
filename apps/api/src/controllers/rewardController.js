import {
  awardRouteDetourPoints,
  DETOUR_POINTS,
  DISCOUNT_THRESHOLD,
  getOrCreateRewardProfile,
  redeemDiscount
} from "../services/rewardService.js";

export async function getRewardDashboard(req, res) {
  const fanName = String(req.query.fanName ?? "").trim();

  if (!fanName) {
    return res.status(400).json({ message: "fanName query parameter is required." });
  }

  try {
    const profile = await getOrCreateRewardProfile(fanName);
    return res.status(200).json(profile);
  } catch (error) {
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to load reward profile."
    });
  }
}

export async function rewardDetourFan(req, res) {
  const { fanName, gateName, matchId } = req.body;

  if (!fanName || !gateName || !matchId) {
    return res.status(400).json({
      message: "fanName, gateName, and matchId are required."
    });
  }

  try {
    const profile = await awardRouteDetourPoints({
      fanName,
      gateName,
      matchId
    });

    return res.status(200).json({
      message: `${DETOUR_POINTS} points added for accepting the reroute to ${gateName}.`,
      profile
    });
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : "Failed to award detour points."
    });
  }
}

export async function redeemFoodDiscount(req, res) {
  const { fanName } = req.body;

  if (!fanName) {
    return res.status(400).json({
      message: "fanName is required."
    });
  }

  try {
    const profile = await redeemDiscount({ fanName });
    return res.status(200).json({
      message: `Food discount redeemed for ${DISCOUNT_THRESHOLD} points.`,
      profile
    });
  } catch (error) {
    return res.status(400).json({
      message: error instanceof Error ? error.message : "Could not redeem food discount."
    });
  }
}

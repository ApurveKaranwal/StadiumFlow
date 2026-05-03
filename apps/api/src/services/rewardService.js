import { getDatabase } from "../config/database.js";

const DISCOUNT_THRESHOLD = 200;
const DETOUR_POINTS = 40;

function decorateProfile(profile) {
  return {
    fanName: profile.fan_name,
    points: profile.points,
    completedDetours: profile.completed_detours,
    reportReputation: profile.report_reputation ?? 0,
    liveReportsSubmitted: profile.live_reports_submitted ?? 0,
    liveReportsVerified: profile.live_reports_verified ?? 0,
    availableDiscounts: Math.floor(profile.points / DISCOUNT_THRESHOLD),
    nextDiscountAt: DISCOUNT_THRESHOLD
  };
}

export async function getOrCreateRewardProfile(fanName) {
  const safeFanName = fanName?.trim();

  if (!safeFanName) {
    throw new Error("fanName is required.");
  }

  const db = getDatabase();
  const existing = db.get("SELECT * FROM reward_profiles WHERE fan_name = ?", [safeFanName]);

  if (existing) {
    return decorateProfile(existing);
  }

  const now = new Date().toISOString();
  db.run(
    "INSERT INTO reward_profiles (fan_name, points, completed_detours, created_at, updated_at) VALUES (?, 0, 0, ?, ?)",
    [safeFanName, now, now]
  );

  const created = db.get("SELECT * FROM reward_profiles WHERE fan_name = ?", [safeFanName]);
  return decorateProfile(created);
}

export async function awardRouteDetourPoints({ fanName }) {
  const safeFanName = fanName?.trim();

  if (!safeFanName) {
    throw new Error("fanName is required.");
  }

  const db = getDatabase();
  await getOrCreateRewardProfile(safeFanName);

  db.run(
    "UPDATE reward_profiles SET points = points + ?, completed_detours = completed_detours + 1, updated_at = ? WHERE fan_name = ?",
    [DETOUR_POINTS, new Date().toISOString(), safeFanName]
  );

  const updated = db.get("SELECT * FROM reward_profiles WHERE fan_name = ?", [safeFanName]);
  return decorateProfile(updated);
}

export async function redeemDiscount({ fanName }) {
  const safeFanName = fanName?.trim();

  if (!safeFanName) {
    throw new Error("fanName is required.");
  }

  const db = getDatabase();
  const profile = db.get("SELECT * FROM reward_profiles WHERE fan_name = ?", [safeFanName]);

  if (!profile || profile.points < DISCOUNT_THRESHOLD) {
    throw new Error("Not enough points to redeem a food discount.");
  }

  db.run(
    "UPDATE reward_profiles SET points = points - ?, updated_at = ? WHERE fan_name = ?",
    [DISCOUNT_THRESHOLD, new Date().toISOString(), safeFanName]
  );

  const updated = db.get("SELECT * FROM reward_profiles WHERE fan_name = ?", [safeFanName]);
  return decorateProfile(updated);
}

export { DETOUR_POINTS, DISCOUNT_THRESHOLD };

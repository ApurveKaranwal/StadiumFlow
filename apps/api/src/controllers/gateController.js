import { getDatabase } from "../config/database.js";
import { buildRecommendation } from "../services/routingService.js";

function serializeGate(row) {
  return {
    id: String(row.id),
    gateId: row.gate_id,
    gateName: row.gate_name,
    displayOrder: row.display_order,
    visible: Boolean(row.visible),
    zoneLabel: row.zone_label,
    latitude: row.latitude,
    longitude: row.longitude,
    serviceRatePerMinute: row.service_rate_per_minute,
    queueLength: row.queue_length,
    liveCrowdScore: row.live_crowd_score,
    directionHint: row.direction_hint
  };
}

export async function listGates(_req, res) {
  try {
    const db = getDatabase();
    const gates = db.all("SELECT * FROM gates ORDER BY display_order ASC, gate_name ASC");
    res.json({ gates: gates.map(serializeGate) });
  } catch {
    res.status(500).json({ message: "Failed to load gates." });
  }
}

export async function createGate(req, res) {
  try {
    const payload = req.body;
    const db = getDatabase();
    const now = new Date().toISOString();

    const result = db.run(`
      INSERT INTO gates (
        gate_id, gate_name, display_order, visible, zone_label, latitude, longitude,
        service_rate_per_minute, queue_length, live_crowd_score, direction_hint, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      payload.gateId,
      payload.gateName,
      Number(payload.displayOrder ?? 1),
      payload.visible ? 1 : 0,
      payload.zoneLabel ?? "General",
      Number(payload.latitude),
      Number(payload.longitude),
      Number(payload.serviceRatePerMinute ?? 12),
      Number(payload.queueLength ?? 0),
      Number(payload.liveCrowdScore ?? 0),
      payload.directionHint ?? "",
      now,
      now
    ]);

    const created = db.get("SELECT * FROM gates WHERE id = ?", [result.lastInsertRowid]);
    res.status(201).json(serializeGate(created));
  } catch {
    res.status(400).json({ message: "Failed to create gate. Check the values and gate code uniqueness." });
  }
}

export async function updateGate(req, res) {
  try {
    const { gateId } = req.params;
    const payload = req.body;
    const db = getDatabase();

    const result = db.run(`
      UPDATE gates
      SET gate_name = ?, display_order = ?, visible = ?, zone_label = ?, latitude = ?, longitude = ?,
          service_rate_per_minute = ?, queue_length = ?, live_crowd_score = ?, direction_hint = ?, updated_at = ?
      WHERE gate_id = ?
    `, [
      payload.gateName,
      Number(payload.displayOrder ?? 1),
      payload.visible ? 1 : 0,
      payload.zoneLabel ?? "General",
      Number(payload.latitude),
      Number(payload.longitude),
      Number(payload.serviceRatePerMinute ?? 12),
      Number(payload.queueLength ?? 0),
      Number(payload.liveCrowdScore ?? 0),
      payload.directionHint ?? "",
      new Date().toISOString(),
      gateId
    ]);

    if (result.changes === 0) {
      return res.status(404).json({ message: "Gate not found." });
    }

    const updated = db.get("SELECT * FROM gates WHERE gate_id = ?", [gateId]);
    return res.json(serializeGate(updated));
  } catch {
    return res.status(400).json({ message: "Failed to update gate." });
  }
}

export async function getGateRecommendation(req, res) {
  try {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ message: "latitude and longitude query parameters are required." });
    }

    const db = getDatabase();
    const visibleGateRows = db.all("SELECT * FROM gates WHERE visible = 1 ORDER BY display_order ASC, gate_name ASC");

    if (visibleGateRows.length === 0) {
      return res.status(404).json({ message: "No visible gates configured by the organizer yet." });
    }

    const routing = await buildRecommendation(
      { latitude, longitude },
      visibleGateRows.map(serializeGate)
    );
    const nearestGate = [...routing.alternatives, routing.recommendedGate].sort(
      (left, right) => left.walkingMinutes - right.walkingMinutes
    )[0];

    res.json({
      matchId: "live-match",
      userLocation: {
        latitude,
        longitude
      },
      routing,
      needsConsentForLongerWalk: routing.recommendedGate.gateId !== nearestGate.gateId && routing.savedMinutes >= 5,
      detourIncentive: {
        points: 40,
        foodDiscountPercent: 10,
        temporaryStreamAccess: false
      }
    });
  } catch {
    res.status(500).json({ message: "Failed to calculate gate recommendation." });
  }
}

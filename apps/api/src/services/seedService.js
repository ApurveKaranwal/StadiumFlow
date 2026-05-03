import { getDatabase } from "../config/database.js";

const starterGates = [
  {
    gateId: "gate-1",
    gateName: "Gate 1",
    displayOrder: 1,
    visible: 1,
    zoneLabel: "North Stand",
    latitude: 19.0731,
    longitude: 72.8782,
    serviceRatePerMinute: 10,
    queueLength: 200,
    liveCrowdScore: 45,
    directionHint: "Closest to the metro drop-off."
  },
  {
    gateId: "gate-2",
    gateName: "Gate 2",
    displayOrder: 2,
    visible: 1,
    zoneLabel: "East Stand",
    latitude: 19.0726,
    longitude: 72.8806,
    serviceRatePerMinute: 11,
    queueLength: 79,
    liveCrowdScore: 19,
    directionHint: "Best option from parking zone B."
  },
  {
    gateId: "gate-3",
    gateName: "Gate 3",
    displayOrder: 3,
    visible: 1,
    zoneLabel: "South Stand",
    latitude: 19.0711,
    longitude: 72.8829,
    serviceRatePerMinute: 12,
    queueLength: 6,
    liveCrowdScore: 4,
    directionHint: "Use the east concourse beside the practice nets."
  },
  {
    gateId: "gate-4",
    gateName: "Gate 4",
    displayOrder: 4,
    visible: 1,
    zoneLabel: "West Stand",
    latitude: 19.0705,
    longitude: 72.8774,
    serviceRatePerMinute: 9,
    queueLength: 48,
    liveCrowdScore: 11,
    directionHint: "Use the south ramp from parking lot 4."
  }
];

const starterUpdates = [
  {
    authorType: "organizer",
    authorName: "Venue Ops",
    message: "Organizer dashboard is live. Gate visibility and queue simulation can now be managed centrally.",
    priority: "important",
    context: "operations"
  }
];

export async function seedDatabase() {
  const db = getDatabase();
  const now = new Date().toISOString();

  const gateCount = db.get("SELECT COUNT(*) AS count FROM gates").count;
  if (gateCount === 0) {
    for (const gate of starterGates) {
      db.run(
        `INSERT INTO gates (
          gate_id, gate_name, display_order, visible, zone_label, latitude, longitude,
          service_rate_per_minute, queue_length, live_crowd_score, direction_hint, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
        gate.gateId,
        gate.gateName,
        gate.displayOrder,
        gate.visible,
        gate.zoneLabel,
        gate.latitude,
        gate.longitude,
        gate.serviceRatePerMinute,
        gate.queueLength,
        gate.liveCrowdScore,
        gate.directionHint,
        now,
        now
        ]
      );
    }
  }

  const updateCount = db.get("SELECT COUNT(*) AS count FROM updates").count;
  if (updateCount === 0) {
    for (const update of starterUpdates) {
      db.run(
        `INSERT INTO updates (
          author_type, author_name, message, priority, context, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
        update.authorType,
        update.authorName,
        update.message,
        update.priority,
        update.context,
        now,
        now
        ]
      );
    }
  }
}

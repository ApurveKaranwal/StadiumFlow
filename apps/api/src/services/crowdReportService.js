import { getDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { getOrCreateRewardProfile } from "./rewardService.js";
import { rememberReportSnapshot, addVoteToSnapshot, getActiveSnapshots, markSnapshotVerified } from "./reportCacheService.js";

const REPORT_POINTS = {
  reporter: 30,
  verifier: 10
};

const crowdProfiles = {
  low: {
    queueDelta: 10,
    scoreDelta: 8,
    priority: "normal"
  },
  medium: {
    queueDelta: 35,
    scoreDelta: 24,
    priority: "important"
  },
  high: {
    queueDelta: 70,
    scoreDelta: 48,
    priority: "important"
  },
  critical: {
    queueDelta: 120,
    scoreDelta: 72,
    priority: "important"
  }
};

function serializeReport(row) {
  return {
    id: String(row.id),
    gateId: row.gate_id,
    authorName: row.author_name,
    message: row.message,
    crowdLevel: row.crowd_level,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
    verificationCount: row.verification_count,
    createdAt: row.created_at,
    verifiedAt: row.verified_at
  };
}

function distanceMeters(origin, target) {
  const earthRadiusKm = 6371;
  const toRadians = (value) => (value * Math.PI) / 180;
  const latDelta = toRadians(target.latitude - origin.latitude);
  const lonDelta = toRadians(target.longitude - origin.longitude);
  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(target.latitude);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lonDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)) * 1000;
}

function createSystemUpdate(db, { message, priority = "important", context = "entry", authorName = "Live Crowd Mesh" }) {
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO updates (author_type, author_name, message, priority, context, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ["organizer", authorName, message, priority, context, now, now]
  );
}

async function awardReputationForVerifiedReport(db, reportId) {
  const report = db.get("SELECT * FROM crowd_reports WHERE id = ?", [reportId]);
  if (!report || report.reputation_awarded) {
    return;
  }

  const votes = db.all("SELECT fan_name FROM crowd_report_votes WHERE report_id = ?", [reportId]);
  const uniqueVoters = [...new Set(votes.map((vote) => vote.fan_name))];
  const now = new Date().toISOString();

  await getOrCreateRewardProfile(report.author_name);
  db.run(
    `UPDATE reward_profiles
     SET points = points + ?, report_reputation = report_reputation + 2, live_reports_verified = live_reports_verified + 1, updated_at = ?
     WHERE fan_name = ?`,
    [REPORT_POINTS.reporter, now, report.author_name]
  );

  uniqueVoters
    .filter((fanName) => fanName !== report.author_name)
    .forEach((fanName) => {
      db.run(
        `UPDATE reward_profiles
         SET points = points + ?, report_reputation = report_reputation + 1, updated_at = ?
         WHERE fan_name = ?`,
        [REPORT_POINTS.verifier, now, fanName]
      );
    });

  db.run("UPDATE crowd_reports SET reputation_awarded = 1, updated_at = ? WHERE id = ?", [now, reportId]);
}

function applyCrowdPressureToGate(db, report) {
  const profile = crowdProfiles[report.crowdLevel] ?? crowdProfiles.medium;
  const gate = db.get("SELECT * FROM gates WHERE gate_id = ?", [report.gateId]);
  if (!gate) {
    return;
  }

  const currentQueue = Number(gate.queue_length ?? 0);
  const currentScore = Number(gate.live_crowd_score ?? 0);
  const nextQueue = Math.max(currentQueue, profile.queueDelta);
  const nextScore = Math.max(currentScore, profile.scoreDelta);

  db.run(
    `UPDATE gates
     SET queue_length = ?, live_crowd_score = ?, updated_at = ?
     WHERE gate_id = ?`,
    [nextQueue, nextScore, new Date().toISOString(), report.gateId]
  );

  createSystemUpdate(db, {
    message: `${gate.gate_name} crowd level verified as ${report.crowdLevel}. Routing has been updated for nearby fans.`,
    priority: profile.priority,
    context: "entry"
  });
}

function hydrateSnapshotsFromRecentReports(db) {
  const cutoffIso = new Date(Date.now() - env.reportWindowMinutes * 60 * 1000).toISOString();
  const reports = db.all(
    "SELECT * FROM crowd_reports WHERE created_at >= ? ORDER BY created_at DESC LIMIT 20",
    [cutoffIso]
  );
  reports.forEach((row) => rememberReportSnapshot(serializeReport(row)));
}

export async function submitCrowdReport({ gateId, fanName, message, crowdLevel, latitude, longitude }) {
  const db = getDatabase();
  await getOrCreateRewardProfile(fanName);

  const gate = db.get("SELECT * FROM gates WHERE gate_id = ?", [gateId]);
  if (!gate) {
    throw new Error("Gate not found.");
  }

  const now = new Date().toISOString();
  const result = db.run(
    `INSERT INTO crowd_reports (
      gate_id, author_name, message, crowd_level, latitude, longitude, status, verification_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 1, ?, ?)`,
    [gateId, fanName, message, crowdLevel, latitude, longitude, now, now]
  );

  db.run(
    `INSERT INTO crowd_report_votes (report_id, fan_name, latitude, longitude, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [result.lastInsertRowid, fanName, latitude, longitude, now]
  );

  db.run(
    `UPDATE reward_profiles
     SET live_reports_submitted = live_reports_submitted + 1, updated_at = ?
     WHERE fan_name = ?`,
    [now, fanName]
  );

  const created = serializeReport(db.get("SELECT * FROM crowd_reports WHERE id = ?", [result.lastInsertRowid]));
  rememberReportSnapshot(created);
  return created;
}

export async function verifyCrowdReport({ reportId, fanName, latitude, longitude }) {
  const db = getDatabase();
  await getOrCreateRewardProfile(fanName);
  hydrateSnapshotsFromRecentReports(db);

  const reportRow = db.get("SELECT * FROM crowd_reports WHERE id = ?", [reportId]);
  if (!reportRow) {
    throw new Error("Report not found.");
  }

  const report = serializeReport(reportRow);
  const meterDistance = distanceMeters(
    { latitude, longitude },
    { latitude: report.latitude, longitude: report.longitude }
  );

  if (meterDistance > env.reportRadiusMeters) {
    throw new Error(`You must be within ${env.reportRadiusMeters} meters of the report location to verify it.`);
  }

  const existingVote = db.get(
    "SELECT id FROM crowd_report_votes WHERE report_id = ? AND fan_name = ?",
    [Number(reportId), fanName]
  );
  if (existingVote) {
    throw new Error("You have already verified this crowd report.");
  }

  const now = new Date().toISOString();
  db.run(
    `INSERT INTO crowd_report_votes (report_id, fan_name, latitude, longitude, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [Number(reportId), fanName, latitude, longitude, now]
  );

  const snapshot = addVoteToSnapshot(String(reportId), fanName);
  const voteCount =
    snapshot?.verificationCount ??
    db.get("SELECT COUNT(*) AS count FROM crowd_report_votes WHERE report_id = ?", [Number(reportId)]).count;
  const nextStatus = voteCount >= env.reportVerificationThreshold ? "verified" : "pending";

  db.run(
    `UPDATE crowd_reports
     SET verification_count = ?, status = ?, verified_at = ?, updated_at = ?
     WHERE id = ?`,
    [voteCount, nextStatus, nextStatus === "verified" ? now : null, now, Number(reportId)]
  );

  if (nextStatus === "verified") {
    markSnapshotVerified(String(reportId));
    const verifiedReport = serializeReport(db.get("SELECT * FROM crowd_reports WHERE id = ?", [Number(reportId)]));
    applyCrowdPressureToGate(db, verifiedReport);
    await awardReputationForVerifiedReport(db, Number(reportId));
  }

  return serializeReport(db.get("SELECT * FROM crowd_reports WHERE id = ?", [Number(reportId)]));
}

export async function listCrowdReports({ gateId, latitude, longitude } = {}) {
  const db = getDatabase();
  hydrateSnapshotsFromRecentReports(db);

  let reports = gateId
    ? db.all("SELECT * FROM crowd_reports WHERE gate_id = ? ORDER BY created_at DESC LIMIT 30", [gateId])
    : db.all("SELECT * FROM crowd_reports ORDER BY created_at DESC LIMIT 30");

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    reports = reports.filter((row) => distanceMeters({ latitude, longitude }, { latitude: row.latitude, longitude: row.longitude }) <= env.reportRadiusMeters * 2);
  }

  return reports.map(serializeReport);
}

export async function getLiveCrowdState() {
  const db = getDatabase();
  hydrateSnapshotsFromRecentReports(db);

  const gates = db.all(`
    SELECT
      gates.*,
      SUM(CASE WHEN crowd_reports.status = 'pending' THEN 1 ELSE 0 END) AS pending_reports,
      SUM(CASE WHEN crowd_reports.status = 'verified' THEN 1 ELSE 0 END) AS verified_reports,
      MAX(crowd_reports.created_at) AS last_report_at
    FROM gates
    LEFT JOIN crowd_reports ON crowd_reports.gate_id = gates.gate_id
    GROUP BY gates.id
    ORDER BY gates.display_order ASC, gates.gate_name ASC
  `);

  return {
    activeReports: await listCrowdReports(),
    activeSnapshots: getActiveSnapshots(),
    gateSummaries: gates.map((gate) => ({
      gateId: gate.gate_id,
      pendingReports: Number(gate.pending_reports ?? 0),
      verifiedReports: Number(gate.verified_reports ?? 0),
      lastReportAt: gate.last_report_at ?? null,
      queueLength: Number(gate.queue_length ?? 0),
      liveCrowdScore: Number(gate.live_crowd_score ?? 0)
    }))
  };
}

import { env } from "../config/env.js";

const snapshots = new Map();

function getExpiryMs() {
  return env.reportWindowMinutes * 60 * 1000;
}

function isExpired(snapshot) {
  return Date.now() - snapshot.updatedAt > getExpiryMs();
}

function cleanupExpired() {
  for (const [key, snapshot] of snapshots.entries()) {
    if (isExpired(snapshot)) {
      snapshots.delete(key);
    }
  }
}

export function rememberReportSnapshot(report) {
  cleanupExpired();

  const existing = snapshots.get(report.id);
  snapshots.set(report.id, {
    reportId: report.id,
    gateId: report.gateId,
    crowdLevel: report.crowdLevel,
    message: report.message,
    latitude: report.latitude,
    longitude: report.longitude,
    status: report.status,
    verificationCount: report.verificationCount,
    updatedAt: Date.now(),
    voters: existing?.voters ?? new Set([report.authorName])
  });
}

export function addVoteToSnapshot(reportId, fanName) {
  cleanupExpired();
  const existing = snapshots.get(reportId);
  if (!existing) {
    return null;
  }

  const hadVoteAlready = existing.voters.has(fanName);
  existing.voters.add(fanName);
  existing.verificationCount = hadVoteAlready
    ? existing.verificationCount
    : Math.max(existing.verificationCount + 1, existing.voters.size);
  existing.updatedAt = Date.now();
  snapshots.set(reportId, existing);
  return existing;
}

export function markSnapshotVerified(reportId) {
  const existing = snapshots.get(reportId);
  if (!existing) {
    return;
  }

  existing.status = "verified";
  existing.updatedAt = Date.now();
}

export function getActiveSnapshots() {
  cleanupExpired();
  return [...snapshots.values()].sort((left, right) => right.updatedAt - left.updatedAt);
}

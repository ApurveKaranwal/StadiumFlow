import { getLiveCrowdState, listCrowdReports, submitCrowdReport, verifyCrowdReport } from "../services/crowdReportService.js";

export async function listReports(req, res) {
  try {
    const gateId = req.query.gateId ? String(req.query.gateId) : undefined;
    const latitude = req.query.latitude ? Number(req.query.latitude) : undefined;
    const longitude = req.query.longitude ? Number(req.query.longitude) : undefined;
    const reports = await listCrowdReports({ gateId, latitude, longitude });
    res.json({ reports });
  } catch {
    res.status(500).json({ message: "Failed to load live crowd reports." });
  }
}

export async function createReport(req, res) {
  try {
    const { gateId, fanName, message, crowdLevel, latitude, longitude } = req.body;
    if (!gateId || !fanName || !message || !crowdLevel || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return res.status(400).json({ message: "gateId, fanName, message, crowdLevel, latitude, and longitude are required." });
    }

    const report = await submitCrowdReport({
      gateId,
      fanName,
      message,
      crowdLevel,
      latitude: Number(latitude),
      longitude: Number(longitude)
    });
    return res.status(201).json(report);
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create crowd report." });
  }
}

export async function verifyReport(req, res) {
  try {
    const { reportId } = req.params;
    const { fanName, latitude, longitude } = req.body;
    if (!fanName || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return res.status(400).json({ message: "fanName, latitude, and longitude are required." });
    }

    const report = await verifyCrowdReport({
      reportId,
      fanName,
      latitude: Number(latitude),
      longitude: Number(longitude)
    });

    return res.json(report);
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : "Failed to verify crowd report." });
  }
}

export async function getLiveState(_req, res) {
  try {
    const snapshot = await getLiveCrowdState();
    res.json(snapshot);
  } catch {
    res.status(500).json({ message: "Failed to load live crowd state." });
  }
}

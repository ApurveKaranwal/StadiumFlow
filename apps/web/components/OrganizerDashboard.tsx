"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createGate, createUpdate, fetchGates, fetchLiveCrowdState, fetchUpdates, updateGate } from "../lib/api";
import type { FeedUpdate, GateMapView, GateRecord, LiveCrowdState, MapCoordinate } from "../lib/types";
import { AppHeader } from "./AppHeader";
import { CrowdPrivacyStudio } from "./CrowdPrivacyStudio";
import { LiveBarChart } from "./LiveBarChart";
import { OrganizerCommandCenter } from "./OrganizerCommandCenter";
import { OrganizerMap } from "./OrganizerMap";

const emptyGateForm = {
  gateId: "",
  gateName: "",
  displayOrder: 1,
  visible: true,
  zoneLabel: "",
  latitude: 0,
  longitude: 0,
  serviceRatePerMinute: 12,
  queueLength: 0,
  liveCrowdScore: 0,
  directionHint: ""
};

export function OrganizerDashboard() {
  const [gates, setGates] = useState<GateRecord[]>([]);
  const [updates, setUpdates] = useState<FeedUpdate[]>([]);
  const [liveState, setLiveState] = useState<LiveCrowdState | null>(null);
  const [selectedGateId, setSelectedGateId] = useState("");
  const [gateForm, setGateForm] = useState(emptyGateForm);
  const [notice, setNotice] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateContext, setUpdateContext] = useState<FeedUpdate["context"]>("operations");
  const [updatePriority, setUpdatePriority] = useState<FeedUpdate["priority"]>("important");
  const [isPending, startTransition] = useTransition();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const liveSummaryByGate = useMemo(
    () => new Map((liveState?.gateSummaries ?? []).map((summary) => [summary.gateId, summary])),
    [liveState]
  );

  const mapGates: GateMapView[] = gates.map((gate) => ({
    gateId: gate.gateId,
    gateName: gate.gateName,
    latitude: gate.latitude,
    longitude: gate.longitude,
    pendingReports: liveSummaryByGate.get(gate.gateId)?.pendingReports ?? 0,
    verifiedReports: liveSummaryByGate.get(gate.gateId)?.verifiedReports ?? 0,
    liveCrowdScore: liveSummaryByGate.get(gate.gateId)?.liveCrowdScore ?? gate.liveCrowdScore
  }));

  const mapCenter =
    mapGates[0] ??
    ({
      latitude: gateForm.latitude || 19.0728,
      longitude: gateForm.longitude || 72.8791
    } satisfies MapCoordinate);

  const loadOrganizerState = async () => {
    const [gateList, allUpdates, snapshot] = await Promise.all([fetchGates(), fetchUpdates(), fetchLiveCrowdState()]);
    setGates(gateList);
    setUpdates(allUpdates);
    setLiveState(snapshot);
    if (gateList[0] && !selectedGateId) {
      setSelectedGateId(gateList[0].gateId);
      setGateForm({
        gateId: gateList[0].gateId,
        gateName: gateList[0].gateName,
        displayOrder: gateList[0].displayOrder,
        visible: gateList[0].visible,
        zoneLabel: gateList[0].zoneLabel,
        latitude: gateList[0].latitude,
        longitude: gateList[0].longitude,
        serviceRatePerMinute: gateList[0].serviceRatePerMinute,
        queueLength: gateList[0].queueLength,
        liveCrowdScore: gateList[0].liveCrowdScore,
        directionHint: gateList[0].directionHint
      });
    }
  };

  useEffect(() => {
    if (!isMounted) {
      return;
    }
    startTransition(async () => {
      try {
        await loadOrganizerState();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Failed to load organizer data.");
      }
    });
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }
    const interval = window.setInterval(() => {
      void loadOrganizerState().catch(() => undefined);
    }, 10000);

    return () => window.clearInterval(interval);
  }, [isMounted, selectedGateId]);

  const selectGate = (gate: GateRecord) => {
    setSelectedGateId(gate.gateId);
    setGateForm({
      gateId: gate.gateId,
      gateName: gate.gateName,
      displayOrder: gate.displayOrder,
      visible: gate.visible,
      zoneLabel: gate.zoneLabel,
      latitude: gate.latitude,
      longitude: gate.longitude,
      serviceRatePerMinute: gate.serviceRatePerMinute,
      queueLength: gate.queueLength,
      liveCrowdScore: gate.liveCrowdScore,
      directionHint: gate.directionHint
    });
  };

  const saveGate = () => {
    setNotice("");

    startTransition(async () => {
      try {
        if (selectedGateId && selectedGateId === gateForm.gateId) {
          const updated = await updateGate(selectedGateId, {
            gateName: gateForm.gateName,
            displayOrder: gateForm.displayOrder,
            visible: gateForm.visible,
            zoneLabel: gateForm.zoneLabel,
            latitude: gateForm.latitude,
            longitude: gateForm.longitude,
            serviceRatePerMinute: gateForm.serviceRatePerMinute,
            queueLength: gateForm.queueLength,
            liveCrowdScore: gateForm.liveCrowdScore,
            directionHint: gateForm.directionHint
          });
          setGates((current) => current.map((item) => (item.gateId === updated.gateId ? updated : item)));
          setNotice(`${updated.gateName} updated.`);
          return;
        }

        const created = await createGate(gateForm);
        setGates((current) => [...current, created].sort((a, b) => a.displayOrder - b.displayOrder));
        setSelectedGateId(created.gateId);
        setNotice(`${created.gateName} created.`);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Failed to save gate.");
      }
    });
  };

  const publishOrganizerUpdate = () => {
    startTransition(async () => {
      try {
        const created = await createUpdate({
          authorType: "organizer",
          authorName: "Organizer Desk",
          message: updateMessage,
          priority: updatePriority,
          context: updateContext
        });
        setUpdates((current) => [created, ...current]);
        setUpdateMessage("");
        setNotice("Organizer update posted.");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Failed to post organizer update.");
      }
    });
  };

  const publishCommandCenterUpdate = async (message: string, context: FeedUpdate["context"]) => {
    const created = await createUpdate({
      authorType: "organizer",
      authorName: "Command Center",
      message,
      priority: "important",
      context
    });

    setUpdates((current) => [created, ...current]);
    setNotice(`${context} alert published from command center.`);
  };

  const startNewGate = () => {
    setSelectedGateId("");
    setGateForm(emptyGateForm);
  };

  const activeReports = liveState?.activeReports ?? [];
  const totalVerifiedReports = liveState?.gateSummaries.reduce((sum, gate) => sum + gate.verifiedReports, 0) ?? 0;
  const totalPendingReports = liveState?.gateSummaries.reduce((sum, gate) => sum + gate.pendingReports, 0) ?? 0;

  return (
    <main className="site-shell">
      <AppHeader current="organizer" />

      <section className="hero-section slim">
        <div className="hero-copy">
          <p className="eyebrow">Organizer Dashboard</p>
          <h1 className="hero-title">Run the stadium like a live command center.</h1>
          <p className="hero-text">
            Manage reroutes visually, push localized alerts in seconds, and sanitize crowd imagery on-device before it
            ever leaves the organiser workstation.
          </p>
        </div>
        <div className="hero-metrics">
          <div className="metric-card">
            <strong>{gates.length}</strong>
            <span>Live gates</span>
          </div>
          <div className="metric-card">
            <strong>{totalVerifiedReports}</strong>
            <span>Verified crowd signals</span>
          </div>
          <div className="metric-card highlight-card">
            <strong>{totalPendingReports}</strong>
            <span>Pending verifications</span>
          </div>
        </div>
      </section>

      {notice ? <p className="status-line">{notice}</p> : null}

      <section className="content-grid telemetry-grid">
        <LiveBarChart
          title="Verified Pressure by Gate"
          caption="These bars show where fan reports have already crossed the organiser trust threshold."
          data={gates.map((gate) => ({
            label: gate.gateName.replace("Gate ", "G"),
            value: liveSummaryByGate.get(gate.gateId)?.verifiedReports ?? 0,
            tone: "alert"
          }))}
        />
        <LiveBarChart
          title="Live Queue Model"
          caption="Manual queue settings and verified fan reports converge here before fan route recommendations update."
          data={gates.map((gate) => ({
            label: gate.gateName.replace("Gate ", "G"),
            value: liveSummaryByGate.get(gate.gateId)?.queueLength ?? gate.queueLength,
            tone: "cool"
          }))}
        />
      </section>

      <section className="content-grid command-layout">
        <OrganizerCommandCenter onBlastAlert={publishCommandCenterUpdate} />
        <CrowdPrivacyStudio />
      </section>

      <section className="map-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Gate placement map</p>
            <h2 className="section-title">Gate geometry and simulation controls</h2>
          </div>
          <p className="muted-inline">
            Select a gate, drag its marker, or click anywhere on the map to update latitude and longitude.
          </p>
        </div>
        <OrganizerMap
          center={{ latitude: mapCenter.latitude, longitude: mapCenter.longitude }}
          gates={mapGates}
          selectedGateId={selectedGateId}
          draftGate={
            !selectedGateId
              ? {
                  gateId: gateForm.gateId || "draft-gate",
                  gateName: gateForm.gateName || "New Gate",
                  latitude: gateForm.latitude || 19.0728,
                  longitude: gateForm.longitude || 72.8791
                }
              : null
          }
          onSelectGate={(gateId) => {
            const gate = gates.find((item) => item.gateId === gateId);
            if (gate) {
              selectGate(gate);
            }
          }}
          onPickLocation={(location) =>
            setGateForm((current) => ({
              ...current,
              latitude: Number(location.latitude.toFixed(6)),
              longitude: Number(location.longitude.toFixed(6))
            }))
          }
        />
      </section>

      <section className="content-grid organizer-grid">
        <section className="panel live-sync-panel">
          <div className="section-head tight">
            <div>
              <p className="eyebrow">Shared Live Mesh</p>
              <h2 className="section-title">What fans are seeing right now</h2>
            </div>
          </div>
          <div className="feed-column">
            {activeReports.length === 0 ? (
              <p className="tiny">No live crowd reports yet. Fan submissions and organiser broadcasts will appear here in real time.</p>
            ) : (
              activeReports.slice(0, 6).map((report) => (
                <article className="feed-card live-report-card" key={report.id}>
                  <div className="feed-top">
                    <strong>{report.authorName}</strong>
                    <span className={report.status === "verified" ? "badge ok" : "badge warn"}>{report.status}</span>
                  </div>
                  <p>{report.message}</p>
                  <div className="meta-row">
                    <span>{report.gateId}</span>
                    <span>{report.verificationCount} confirmations</span>
                    <span>{report.crowdLevel}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel light-panel">
          <div className="section-head tight">
            <div>
              <p className="eyebrow">Gate Setup</p>
              <h2 className="section-title">Visible gates</h2>
            </div>
            <button className="button secondary" onClick={startNewGate}>
              New gate
            </button>
          </div>

          <div className="gate-admin-list">
            {gates.map((gate) => (
              <button
                className={selectedGateId === gate.gateId ? "gate-admin-card active" : "gate-admin-card"}
                key={gate.gateId}
                onClick={() => selectGate(gate)}
              >
                <strong>{gate.gateName}</strong>
                <span>{gate.zoneLabel}</span>
                <span>{gate.visible ? "Visible to fans" : "Hidden from fans"}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-head tight">
            <div>
              <p className="eyebrow">Gate Editor</p>
              <h2 className="section-title">{selectedGateId ? "Edit selected gate" : "Create a new gate"}</h2>
            </div>
          </div>

          <div className="form-grid">
            <label className="field-group">
              <span className="field-label">Gate code</span>
              <input
                className="text-field"
                value={gateForm.gateId}
                disabled={Boolean(selectedGateId)}
                onChange={(event) => setGateForm({ ...gateForm, gateId: event.target.value })}
              />
            </label>
            <label className="field-group">
              <span className="field-label">Gate name</span>
              <input className="text-field" value={gateForm.gateName} onChange={(event) => setGateForm({ ...gateForm, gateName: event.target.value })} />
            </label>
            <label className="field-group">
              <span className="field-label">Display order</span>
              <input className="text-field" type="number" value={gateForm.displayOrder} onChange={(event) => setGateForm({ ...gateForm, displayOrder: Number(event.target.value) })} />
            </label>
            <label className="field-group">
              <span className="field-label">Zone label</span>
              <input className="text-field" value={gateForm.zoneLabel} onChange={(event) => setGateForm({ ...gateForm, zoneLabel: event.target.value })} />
            </label>
            <label className="field-group">
              <span className="field-label">Latitude</span>
              <input className="text-field large-number" type="number" value={gateForm.latitude} onChange={(event) => setGateForm({ ...gateForm, latitude: Number(event.target.value) })} />
            </label>
            <label className="field-group">
              <span className="field-label">Longitude</span>
              <input className="text-field large-number" type="number" value={gateForm.longitude} onChange={(event) => setGateForm({ ...gateForm, longitude: Number(event.target.value) })} />
            </label>
            <label className="field-group">
              <span className="field-label">Service rate / min</span>
              <input className="text-field" type="number" value={gateForm.serviceRatePerMinute} onChange={(event) => setGateForm({ ...gateForm, serviceRatePerMinute: Number(event.target.value) })} />
            </label>
            <label className="field-group">
              <span className="field-label">Queue length</span>
              <input className="text-field" type="number" value={gateForm.queueLength} onChange={(event) => setGateForm({ ...gateForm, queueLength: Number(event.target.value) })} />
            </label>
            <label className="field-group">
              <span className="field-label">Crowd score</span>
              <input className="text-field" type="number" value={gateForm.liveCrowdScore} onChange={(event) => setGateForm({ ...gateForm, liveCrowdScore: Number(event.target.value) })} />
            </label>
            <label className="field-group toggle-group">
              <span className="field-label">Visible to fans</span>
              <input checked={gateForm.visible} type="checkbox" onChange={(event) => setGateForm({ ...gateForm, visible: event.target.checked })} />
            </label>
            <label className="field-group full">
              <span className="field-label">Direction hint</span>
              <input className="text-field" value={gateForm.directionHint} onChange={(event) => setGateForm({ ...gateForm, directionHint: event.target.value })} />
            </label>
          </div>

          <div className="button-row">
            <button className="button" onClick={saveGate} disabled={isPending}>
              Save gate
            </button>
          </div>
        </section>
      </section>

      <section className="content-grid organizer-grid">
        <section className="panel light-panel">
          <div className="section-head tight">
            <div>
              <p className="eyebrow">Organizer Feed</p>
              <h2 className="section-title">Broadcast updates</h2>
            </div>
          </div>

          <div className="form-stack">
            <select className="text-field" value={updateContext} onChange={(event) => setUpdateContext(event.target.value as FeedUpdate["context"])}>
              <option value="operations">Operations</option>
              <option value="entry">Entry</option>
              <option value="match">Match</option>
              <option value="food">Food</option>
            </select>
            <select className="text-field" value={updatePriority} onChange={(event) => setUpdatePriority(event.target.value as FeedUpdate["priority"])}>
              <option value="important">Important</option>
              <option value="normal">Normal</option>
            </select>
            <textarea
              className="text-area"
              rows={4}
              value={updateMessage}
              onChange={(event) => setUpdateMessage(event.target.value)}
              placeholder="Gate 3 now open for east stand ticket holders..."
            />
            <button className="button" onClick={publishOrganizerUpdate} disabled={isPending || !updateMessage.trim()}>
              Publish organizer update
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="section-head tight">
            <div>
              <p className="eyebrow">Shared timeline</p>
              <h2 className="section-title">Organizer and fan signals</h2>
            </div>
          </div>

          <div className="feed-column">
            {updates.map((item) => (
              <article className="feed-card" key={item.id}>
                <div className="feed-top">
                  <strong>{item.authorName}</strong>
                  <span className={item.priority === "important" ? "pill alert" : "pill"}>{item.context}</span>
                </div>
                <p>{item.message}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

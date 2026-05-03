"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  awardDetourPoints,
  fetchGates,
  fetchLiveCrowdState,
  fetchRecommendation,
  fetchRewardProfile,
  fetchUpdates,
  redeemFoodDiscount,
  submitCrowdReport,
  verifyCrowdReport
} from "../lib/api";
import type {
  CrowdLevel,
  CrowdReport,
  FeedUpdate,
  GateLiveSummary,
  GateMapView,
  GateRecord,
  LiveCrowdState,
  RecommendationPayload,
  UserRewardProfile
} from "../lib/types";
import { AppHeader } from "./AppHeader";
import { GateRecommendationPanel } from "./GateRecommendationPanel";
import { LiveBarChart } from "./LiveBarChart";
import { StadiumMap } from "./StadiumMap";

const DEFAULT_FAN_NAME = "Guest Fan";

function formatRelativeDate(value: string | null) {
  if (!value) {
    return "No reports yet";
  }

  const date = new Date(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function levelTone(level: CrowdLevel) {
  switch (level) {
    case "low":
      return "badge ok";
    case "medium":
      return "badge warn";
    case "high":
    case "critical":
      return "badge hot";
    default:
      return "badge";
  }
}

export function FanDashboard() {
  const [fanName, setFanName] = useState(DEFAULT_FAN_NAME);
  const [profile, setProfile] = useState<UserRewardProfile | null>(null);
  const [updates, setUpdates] = useState<FeedUpdate[]>([]);
  const [gates, setGates] = useState<GateRecord[]>([]);
  const [liveState, setLiveState] = useState<LiveCrowdState | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationPayload | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedGateId, setSelectedGateId] = useState("");
  const [loadingMessage, setLoadingMessage] = useState("Locating you near the stadium...");
  const [locationState, setLocationState] = useState<"idle" | "loading" | "ready" | "blocked">("idle");
  const [feedback, setFeedback] = useState("");
  const [acceptedDetour, setAcceptedDetour] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportGateId, setReportGateId] = useState("");
  const [reportLevel, setReportLevel] = useState<CrowdLevel>("medium");
  const [isPending, startTransition] = useTransition();
  const [isMounted, setIsMounted] = useState(false);
  const normalizedFanName = fanName.trim() || DEFAULT_FAN_NAME;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }
    const savedName = window.localStorage.getItem("fan-name");
    if (savedName) {
      setFanName(savedName);
    }
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }
    window.localStorage.setItem("fan-name", normalizedFanName);
  }, [isMounted, normalizedFanName]);

  const loadLiveBundle = async (nextLocation?: { latitude: number; longitude: number } | null) => {
    const activeLocation = nextLocation ?? userLocation;
    const [feed, rewardProfile, gateList, snapshot] = await Promise.all([
      fetchUpdates(),
      fetchRewardProfile(normalizedFanName),
      fetchGates(),
      fetchLiveCrowdState()
    ]);

    setUpdates(feed);
    setProfile(rewardProfile);
    setGates(gateList);
    setLiveState(snapshot);
    if (!reportGateId && gateList[0]) {
      setReportGateId(gateList[0].gateId);
    }

    if (activeLocation) {
      const nextRecommendation = await fetchRecommendation(activeLocation.latitude, activeLocation.longitude);
      setRecommendation(nextRecommendation);
      setSelectedGateId((current) => current || nextRecommendation.routing.recommendedGate.gateId);
      setLocationState("ready");
      setLoadingMessage("");
    }
  };

  useEffect(() => {
    if (!isMounted) {
      return;
    }
    startTransition(async () => {
      try {
        await loadLiveBundle();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Failed to load dashboard data.");
      }
    });
  }, [isMounted, normalizedFanName]);

  const loadRecommendation = (latitude: number, longitude: number) => {
    setUserLocation({ latitude, longitude });
    setLocationState("loading");
    setLoadingMessage("Calculating live walking routes...");
    startTransition(async () => {
      try {
        await loadLiveBundle({ latitude, longitude });
        setAcceptedDetour(false);
      } catch (error) {
        setLocationState("blocked");
        setLoadingMessage(error instanceof Error ? error.message : "Failed to load routing data.");
      }
    });
  };

  useEffect(() => {
    if (!isMounted) {
      return;
    }
    if (!navigator.geolocation) {
      setLocationState("blocked");
      setLoadingMessage("Geolocation is not available on this device.");
      return;
    }

    setLocationState("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        setUserLocation(nextLocation);
        loadRecommendation(nextLocation.latitude, nextLocation.longitude);
      },
      () => {
        setLocationState("blocked");
        setLoadingMessage("Location permission is required for live routing.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }
    const interval = window.setInterval(() => {
      void loadLiveBundle().catch(() => undefined);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [isMounted, normalizedFanName, userLocation]);

  const fallbackCenter = useMemo(() => {
    if (userLocation) {
      return userLocation;
    }

    if (gates.length === 0) {
      return { latitude: 19.0728, longitude: 72.8791 };
    }

    const latitude = gates.reduce((sum, gate) => sum + gate.latitude, 0) / gates.length;
    const longitude = gates.reduce((sum, gate) => sum + gate.longitude, 0) / gates.length;
    return { latitude, longitude };
  }, [gates, userLocation]);

  const liveSummaryByGate = useMemo(() => {
    return new Map((liveState?.gateSummaries ?? []).map((summary) => [summary.gateId, summary]));
  }, [liveState]);

  const gatePulseCards = useMemo(() => {
    return gates
      .filter((gate) => gate.visible)
      .map((gate) => ({
        gate,
        live: liveSummaryByGate.get(gate.gateId) ?? ({
          gateId: gate.gateId,
          pendingReports: 0,
          verifiedReports: 0,
          lastReportAt: null,
          queueLength: gate.queueLength,
          liveCrowdScore: gate.liveCrowdScore
        } satisfies GateLiveSummary)
      }));
  }, [gates, liveSummaryByGate]);

  const allGates = useMemo<GateMapView[]>(() => {
    if (recommendation) {
      return [recommendation.routing.recommendedGate, ...recommendation.routing.alternatives].map((gate) => {
        const live = liveSummaryByGate.get(gate.gateId);
        return {
          ...gate,
          pendingReports: live?.pendingReports ?? 0,
          verifiedReports: live?.verifiedReports ?? 0,
          liveCrowdScore: live?.liveCrowdScore ?? gate.queueLength
        };
      });
    }

    return gates
      .filter((gate) => gate.visible)
      .map((gate) => ({
        gateId: gate.gateId,
        gateName: gate.gateName,
        latitude: gate.latitude,
        longitude: gate.longitude,
        pendingReports: liveSummaryByGate.get(gate.gateId)?.pendingReports ?? 0,
        verifiedReports: liveSummaryByGate.get(gate.gateId)?.verifiedReports ?? 0,
        liveCrowdScore: liveSummaryByGate.get(gate.gateId)?.liveCrowdScore ?? gate.liveCrowdScore
      }));
  }, [gates, liveSummaryByGate, recommendation]);

  const nearbyReports = useMemo(() => {
    return (liveState?.activeReports ?? []).filter((report) => report.status === "pending").slice(0, 6);
  }, [liveState]);

  const selectedGateSummary = selectedGateId ? liveSummaryByGate.get(selectedGateId) : undefined;

  const claimPoints = () => {
    if (!recommendation || !profile || (recommendation.needsConsentForLongerWalk && !acceptedDetour)) {
      return;
    }

    startTransition(async () => {
      try {
        const updatedProfile = await awardDetourPoints({
          fanName: normalizedFanName,
          gateName: recommendation.routing.recommendedGate.gateName,
          matchId: recommendation.matchId
        });
        setProfile(updatedProfile);
        setFeedback("Detour points added to your account.");
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Failed to award points.");
      }
    });
  };

  const redeemPoints = () => {
    startTransition(async () => {
      try {
        const updatedProfile = await redeemFoodDiscount({ fanName: normalizedFanName });
        setProfile(updatedProfile);
        setFeedback("Food discount redeemed.");
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Failed to redeem points.");
      }
    });
  };

  const submitReport = () => {
    if (!userLocation || !reportGateId || !reportMessage.trim()) {
      return;
    }

    setFeedback("");
    startTransition(async () => {
      try {
        await submitCrowdReport({
          gateId: reportGateId,
          fanName: normalizedFanName,
          message: reportMessage,
          crowdLevel: reportLevel,
          latitude: userLocation.latitude,
          longitude: userLocation.longitude
        });
        setReportMessage("");
        setFeedback("Crowd report submitted. Nearby fans can now verify it.");
        await loadLiveBundle();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Could not submit your crowd report.");
      }
    });
  };

  const verifyReportAction = (report: CrowdReport) => {
    if (!userLocation) {
      setFeedback("Location is required to verify nearby crowd reports.");
      return;
    }

    startTransition(async () => {
      try {
        await verifyCrowdReport({
          reportId: report.id,
          fanName: normalizedFanName,
          latitude: userLocation.latitude,
          longitude: userLocation.longitude
        });
        setFeedback("Verification recorded. Live routing will update once the threshold is met.");
        await loadLiveBundle();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Could not verify this crowd report.");
      }
    });
  };

  return (
    <main className="site-shell">
      <AppHeader current="fan" />

      <section className="hero-section slim fan-hero">
        <div className="hero-copy">
          <p className="eyebrow">Fan Dashboard</p>
          <h1 className="hero-title">See the live crowd picture before you commit to a gate.</h1>
          <p className="hero-text">
            Gate timing now reacts to verified fan reports. Submit what you see, verify nearby sightings, and earn
            reputation when your observations hold up.
          </p>
          <div className="fan-hero-actions">
            <button className="button secondary" onClick={() => loadRecommendation(fallbackCenter.latitude, fallbackCenter.longitude)}>
              Refresh live route
            </button>
            <button
              className="button secondary"
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (position) => loadRecommendation(position.coords.latitude, position.coords.longitude),
                    () => {
                      setLocationState("blocked");
                      setLoadingMessage("Location permission is required for live routing.");
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                  );
                }
              }}
            >
              Sync my GPS
            </button>
          </div>
        </div>

        <div className="fan-hero-side">
          <div className="profile-card fan-profile-card">
            <label className="field-label">Display name</label>
            <input className="text-field" value={fanName} onChange={(event) => setFanName(event.target.value)} />
            {profile ? (
              <div className="profile-stats fan-stats">
                <div>
                  <strong>{profile.points}</strong>
                  <span>Total points</span>
                </div>
                <div>
                  <strong>{profile.reportReputation}</strong>
                  <span>Trust score</span>
                </div>
                <div>
                  <strong>{profile.availableDiscounts}</strong>
                  <span>Food perks</span>
                </div>
                <div>
                  <strong>{profile.liveReportsSubmitted}</strong>
                  <span>Reports filed</span>
                </div>
                <div>
                  <strong>{profile.liveReportsVerified}</strong>
                  <span>Reports proven</span>
                </div>
                <div>
                  <strong>{profile.completedDetours}</strong>
                  <span>Detours helped</span>
                </div>
              </div>
            ) : null}
            <div className="button-row">
              <button
                className="button"
                onClick={claimPoints}
                disabled={isPending || !recommendation || !profile || (recommendation.needsConsentForLongerWalk && !acceptedDetour)}
              >
                Claim detour points
              </button>
              <button className="button secondary" onClick={redeemPoints} disabled={isPending || !profile}>
                Redeem food discount
              </button>
            </div>
          </div>
        </div>
      </section>

      {feedback ? <p className="status-line">{feedback}</p> : null}
      {loadingMessage ? <p className="status-line">{loadingMessage}</p> : null}
      {locationState === "blocked" ? (
        <p className="status-line">
          GPS route could not be loaded. The gate map still shows organizer-configured gates, and you can retry GPS at any time.
        </p>
      ) : null}

      <section className="fan-pulse-grid">
        {gatePulseCards.map(({ gate, live }) => (
          <article className="pulse-card" key={gate.gateId}>
            <div className="feed-top">
              <strong>{gate.gateName}</strong>
              <span className={live.verifiedReports > 0 ? "badge hot" : live.pendingReports > 0 ? "badge warn" : "badge ok"}>
                {live.verifiedReports > 0 ? "Verified pressure" : live.pendingReports > 0 ? "Watching" : "Steady"}
              </span>
            </div>
            <p className="tiny">{gate.zoneLabel}</p>
            <div className="stats">
              <span>{live.queueLength} in queue</span>
              <span>Crowd score {live.liveCrowdScore}</span>
              <span>{live.verifiedReports} verified</span>
              <span>{live.pendingReports} pending</span>
            </div>
            <p className="tiny">Last signal: {formatRelativeDate(live.lastReportAt)}</p>
          </article>
        ))}
      </section>

      <section className="content-grid telemetry-grid">
        <LiveBarChart
          title="Queue Pressure by Gate"
          caption="Verified reports feed into these queue estimates, which then shape route scoring."
          data={gatePulseCards.map(({ gate, live }) => ({
            label: gate.gateName.replace("Gate ", "G"),
            value: live.queueLength,
            tone: live.verifiedReports > 0 ? "alert" : live.pendingReports > 0 ? "cool" : "accent"
          }))}
        />
        <LiveBarChart
          title="Crowd Signal Confidence"
          caption="This chart compares pending sightings with already verified crowd pressure."
          data={gatePulseCards.map(({ gate, live }) => ({
            label: gate.gateName.replace("Gate ", "G"),
            value: live.verifiedReports * 2 + live.pendingReports,
            tone: live.verifiedReports > 0 ? "accent" : "neutral"
          }))}
          valueSuffix=""
        />
      </section>

      {allGates.length > 0 || userLocation ? (
        <>
          <section className="map-section live-map-shell">
            <div className="section-head">
              <div>
                <p className="eyebrow">Navigation</p>
                <h2 className="section-title">Live route map</h2>
              </div>
              <p className="muted-inline">
                {selectedGateSummary
                  ? `${selectedGateSummary.verifiedReports} verified reports influence this route.`
                  : "Total time = walking time + queue time"}
              </p>
            </div>
            <StadiumMap
              userLocation={recommendation?.userLocation ?? userLocation ?? fallbackCenter}
              gates={allGates}
              selectedGateId={selectedGateId || allGates[0]?.gateId || ""}
              onSelectGate={(gateId) => {
                setSelectedGateId(gateId);
                setAcceptedDetour(false);
              }}
            />
          </section>

          <section className="content-grid fan-main-grid">
            {recommendation ? (
              <GateRecommendationPanel
                routing={recommendation.routing}
                selectedGateId={selectedGateId}
                onSelectGate={(gateId) => {
                  setSelectedGateId(gateId);
                  setAcceptedDetour(false);
                }}
              />
            ) : (
              <section className="panel">
                <p className="eyebrow">Route status</p>
                <h2 className="section-title">Location received, waiting for route data</h2>
                <p className="section-copy">
                  Your current location marker is available. Route scoring will appear as soon as the backend and gate data respond.
                </p>
              </section>
            )}

            <section className="panel light-panel">
              {recommendation?.needsConsentForLongerWalk ? (
                <div className="consent-card">
                  <div>
                    <p className="eyebrow">Detour option</p>
                    <h3 className="card-title">Take the longer route for points?</h3>
                    <p className="muted-block">
                      The fastest gate is farther than the nearest gate. Accepting it earns you {recommendation.detourIncentive.points} points.
                    </p>
                  </div>
                  <div className="button-row">
                    <button className={acceptedDetour ? "button secondary active-toggle" : "button"} onClick={() => setAcceptedDetour(true)}>
                      Yes, I will take it
                    </button>
                    <button className={!acceptedDetour ? "button secondary active-toggle" : "button secondary"} onClick={() => setAcceptedDetour(false)}>
                      No, keep points off
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="fan-report-layout">
                <div className="composer-card report-composer">
                  <h3 className="card-title">Proof of crowd</h3>
                  <p className="tiny">
                    Post what you see at your current location. Nearby fans can verify it, and confirmed reports change gate routing live.
                  </p>
                  <div className="form-stack">
                    <select className="text-field" value={reportGateId} onChange={(event) => setReportGateId(event.target.value)}>
                      {gates.filter((gate) => gate.visible).map((gate) => (
                        <option key={gate.gateId} value={gate.gateId}>
                          {gate.gateName} · {gate.zoneLabel}
                        </option>
                      ))}
                    </select>
                    <select className="text-field" value={reportLevel} onChange={(event) => setReportLevel(event.target.value as CrowdLevel)}>
                      <option value="low">Low crowding</option>
                      <option value="medium">Medium crowding</option>
                      <option value="high">High crowding</option>
                      <option value="critical">Critical jam</option>
                    </select>
                    <textarea
                      className="text-area"
                      rows={4}
                      value={reportMessage}
                      onChange={(event) => setReportMessage(event.target.value)}
                      placeholder="Gate 2 is jammed at the scanners and the queue is spilling into the east ramp..."
                    />
                    <button className="button" onClick={submitReport} disabled={isPending || !userLocation || !reportMessage.trim()}>
                      Submit live crowd report
                    </button>
                  </div>
                </div>

                <div className="panel inset-panel">
                  <div className="section-head tight">
                    <div>
                      <p className="eyebrow">Nearby verifications</p>
                      <h2 className="section-title">Confirm what others are seeing</h2>
                    </div>
                  </div>
                  <div className="feed-column">
                    {nearbyReports.length === 0 ? (
                      <p className="tiny">No pending reports nearby right now.</p>
                    ) : (
                      nearbyReports.map((report) => (
                        <article className="feed-card live-report-card" key={report.id}>
                          <div className="feed-top">
                            <strong>{report.authorName}</strong>
                            <span className={levelTone(report.crowdLevel)}>{report.crowdLevel}</span>
                          </div>
                          <p>{report.message}</p>
                          <div className="meta-row">
                            <span>{report.gateId}</span>
                            <span>{report.verificationCount}/{3} confirmations</span>
                            <span>{formatRelativeDate(report.createdAt)}</span>
                          </div>
                          <button className="button secondary" onClick={() => verifyReportAction(report)} disabled={isPending || !userLocation}>
                            Verify near me
                          </button>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="section-head tight">
                <div>
                  <p className="eyebrow">Live Feed</p>
                  <h2 className="section-title">Crowd and match updates</h2>
                </div>
              </div>

              <div className="feed-column">
                {updates.map((item) => (
                  <article className="feed-card" key={item.id}>
                    <div className="feed-top">
                      <strong>{item.authorName}</strong>
                      <span className={item.priority === "important" ? "pill alert" : "pill"}>{formatRelativeDate(item.createdAt)}</span>
                    </div>
                    <p>{item.message}</p>
                    <div className="meta-row">
                      <span>{item.authorType}</span>
                      <span>{item.context}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </>
      ) : null}
    </main>
  );
}

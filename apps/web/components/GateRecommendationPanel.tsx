import type { RoutingResponse } from "../lib/types";

const badgeClass = {
  optimal: "badge ok",
  steady: "badge warn",
  congested: "badge hot"
};

export function GateRecommendationPanel({
  routing,
  selectedGateId,
  onSelectGate
}: {
  routing: RoutingResponse;
  selectedGateId: string;
  onSelectGate: (gateId: string) => void;
}) {
  const orderedGates = [routing.recommendedGate, ...routing.alternatives];

  return (
    <section className="panel">
      <p className="eyebrow">Routing Engine</p>
      <h2 className="section-title">Fastest gate, not nearest gate</h2>
      <p className="section-copy">
        The recommendation combines OSRM walking time with live queue time, then ranks gates by total time.
      </p>

      <div className="recommendation">
        <h3>
          Proceed to <strong>{routing.recommendedGate.gateName}</strong>
        </h3>
        <p>{routing.summary}</p>
        <div className="stats">
          <span>Walk: {routing.recommendedGate.walkingMinutes} min</span>
          <span>Distance: {Math.round(routing.recommendedGate.walkingDistanceMeters)} m</span>
          <span>Wait: {routing.recommendedGate.queueMinutes} min</span>
          <span>Total: {routing.recommendedGate.totalMinutes} min</span>
          <span>Saved: {routing.savedMinutes} min</span>
        </div>
        <p className="tiny">{routing.recommendedGate.directionHint}</p>
      </div>

      <div className="gate-list">
        {orderedGates.map((gate) => (
          <article
            className={`route-card ${selectedGateId === gate.gateId ? "route-card-active" : ""}`}
            key={gate.gateId}
            onClick={() => onSelectGate(gate.gateId)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                onSelectGate(gate.gateId);
              }
            }}
          >
            <div className="gate-card-header">
              <h3>{gate.gateName}</h3>
              <span className={badgeClass[gate.status]}>{gate.status}</span>
            </div>
            <div className="stats">
              <span>Walk {gate.walkingMinutes} min</span>
              <span>{Math.round(gate.walkingDistanceMeters)} m</span>
              <span>Queue {gate.queueMinutes} min</span>
              <span>Total {gate.totalMinutes} min</span>
              <span>{gate.queueLength} people</span>
            </div>
          </article>
        ))}
      </div>

      <div className="reward-box">
        <h3>Behavior incentive</h3>
        <p>
          If the recommended route is meaningfully longer than the nearest gate, ask for consent and reward the fan
          with detour points once arrival at the assigned gate is confirmed.
        </p>
      </div>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";

type SectorId = "north" | "south" | "east" | "west" | "club" | "plaza";
type CorridorId = "north-walk" | "east-ramp" | "south-ribbon" | "west-link";

type CommandCenterProps = {
  onBlastAlert: (message: string, context: "operations" | "entry" | "food" | "match") => Promise<void>;
};

type CorridorDrop = {
  id: string;
  corridorId: CorridorId;
  x: number;
  y: number;
};

const sectors: Array<{
  id: SectorId;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  context: "operations" | "entry" | "food" | "match";
  alertTemplate: string;
}> = [
  { id: "north", label: "Sector 1", x: 34, y: 14, width: 32, height: 18, context: "entry", alertTemplate: "Sector 1 entry flow redirected to Gate B due to crowd pressure." },
  { id: "east", label: "Sector 2", x: 69, y: 31, width: 18, height: 29, context: "food", alertTemplate: "Sector 2 concession stand is out of water. Use the south concourse instead." },
  { id: "south", label: "Sector 3", x: 34, y: 67, width: 32, height: 18, context: "operations", alertTemplate: "Sector 3 is under active crowd shaping. Follow steward instructions." },
  { id: "west", label: "Sector 4", x: 13, y: 31, width: 18, height: 29, context: "entry", alertTemplate: "Sector 4 fans should reroute through the west link immediately." },
  { id: "club", label: "Club Ring", x: 39, y: 37, width: 22, height: 24, context: "match", alertTemplate: "Club Ring access is temporarily paused for seat-side service clearance." },
  { id: "plaza", label: "Entry Plaza", x: 39, y: 88, width: 22, height: 10, context: "operations", alertTemplate: "Entry Plaza footfall is spiking. Queue marshals move to the south approach." }
];

const corridors: Array<{
  id: CorridorId;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}> = [
  { id: "north-walk", label: "North Walk", x: 28, y: 5, width: 44, height: 8 },
  { id: "east-ramp", label: "East Ramp", x: 82, y: 28, width: 9, height: 36 },
  { id: "south-ribbon", label: "South Ribbon", x: 28, y: 88, width: 44, height: 8 },
  { id: "west-link", label: "West Link", x: 9, y: 28, width: 9, height: 36 }
];

function corridorLabel(id: CorridorId) {
  return corridors.find((corridor) => corridor.id === id)?.label ?? id;
}

export function OrganizerCommandCenter({ onBlastAlert }: CommandCenterProps) {
  const [selectedSectorId, setSelectedSectorId] = useState<SectorId>("east");
  const [alertDraft, setAlertDraft] = useState(sectors[1]?.alertTemplate ?? "");
  const [barricades, setBarricades] = useState<CorridorDrop[]>([]);
  const [logEntries, setLogEntries] = useState<string[]>([
    "North Walk is flowing normally.",
    "Entry Plaza stewards staged for manual override.",
    "East Ramp cameras are live with privacy masking enabled."
  ]);
  const [isPosting, setIsPosting] = useState(false);

  const selectedSector = sectors.find((sector) => sector.id === selectedSectorId) ?? sectors[0];

  const corridorPressure = useMemo(() => {
    return corridors.map((corridor) => {
      const barricadeCount = barricades.filter((drop) => drop.corridorId === corridor.id).length;
      return {
        ...corridor,
        barricadeCount,
        status: barricadeCount > 1 ? "Closed" : barricadeCount === 1 ? "Rerouted" : "Open"
      };
    });
  }, [barricades]);

  return (
    <section className="panel command-center-panel">
      <div className="section-head tight">
        <div>
          <p className="eyebrow">Command Center</p>
          <h2 className="section-title">Visual event control</h2>
        </div>
        <span className="pill">Manual override ready</span>
      </div>

      <p className="section-copy">
        Drop barricades onto active approach corridors to signal reroutes, then click a sector to push a localized
        advisory. This gives organisers a fast fallback when automated crowd detection misses a spike.
      </p>

      <div className="command-grid">
        <div className="stadium-command-surface">
          <div className="drag-shelf">
            <button
              className="tool-chip barricade"
              draggable
              onDragStart={(event) => event.dataTransfer.setData("text/plain", "barricade")}
              type="button"
            >
              Barricade
            </button>
            <div className="tool-copy">
              Drag a barricade token onto a corridor to flag a reroute for fans.
            </div>
          </div>

          <div className="stadium-blueprint">
            {corridorPressure.map((corridor) => (
              <div
                className={corridor.barricadeCount > 0 ? "corridor-zone active" : "corridor-zone"}
                key={corridor.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (event.dataTransfer.getData("text/plain") !== "barricade") {
                    return;
                  }

                  const rect = event.currentTarget.getBoundingClientRect();
                  const x = ((event.clientX - rect.left) / rect.width) * 100;
                  const y = ((event.clientY - rect.top) / rect.height) * 100;

                  setBarricades((current) => [
                    ...current,
                    {
                      id: `drop-${Date.now()}-${current.length}`,
                      corridorId: corridor.id,
                      x,
                      y
                    }
                  ]);
                  setLogEntries((current) => [`${corridor.label} rerouted with a manual barricade placement.`, ...current].slice(0, 6));
                }}
                style={{
                  left: `${corridor.x}%`,
                  top: `${corridor.y}%`,
                  width: `${corridor.width}%`,
                  height: `${corridor.height}%`
                }}
              >
                <span>{corridor.label}</span>
                {barricades
                  .filter((drop) => drop.corridorId === corridor.id)
                  .map((drop) => (
                    <button
                      className="placed-barricade"
                      key={drop.id}
                      onClick={() => {
                        setBarricades((current) => current.filter((item) => item.id !== drop.id));
                        setLogEntries((current) => [`${corridor.label} barricade removed and path reopened.`, ...current].slice(0, 6));
                      }}
                      style={{ left: `${drop.x}%`, top: `${drop.y}%` }}
                      type="button"
                    >
                      X
                    </button>
                  ))}
              </div>
            ))}

            {sectors.map((sector) => (
              <button
                className={selectedSector.id === sector.id ? "sector-zone active" : "sector-zone"}
                key={sector.id}
                onClick={() => {
                  setSelectedSectorId(sector.id);
                  setAlertDraft(sector.alertTemplate);
                }}
                style={{
                  left: `${sector.x}%`,
                  top: `${sector.y}%`,
                  width: `${sector.width}%`,
                  height: `${sector.height}%`
                }}
                type="button"
              >
                <strong>{sector.label}</strong>
              </button>
            ))}

            <div className="stadium-core">
              <span>Operations Bowl</span>
            </div>
          </div>
        </div>

        <div className="command-sidecar">
          <div className="control-card emphasis-card">
            <p className="eyebrow">Selected sector</p>
            <h3 className="card-title">{selectedSector.label}</h3>
            <p className="muted-block">
              Context defaults to <strong>{selectedSector.context}</strong>. Tap a different section on the stadium
              map to update the localized blast.
            </p>
            <textarea
              className="text-area"
              onChange={(event) => setAlertDraft(event.target.value)}
              rows={4}
              value={alertDraft}
            />
            <button
              className="button"
              disabled={isPosting || !alertDraft.trim()}
              onClick={async () => {
                setIsPosting(true);
                try {
                  await onBlastAlert(alertDraft, selectedSector.context);
                  setLogEntries((current) => [`${selectedSector.label} alert sent to fans.`, ...current].slice(0, 6));
                } finally {
                  setIsPosting(false);
                }
              }}
            >
              Blast sector alert
            </button>
          </div>

          <div className="control-card">
            <p className="eyebrow">Corridor status</p>
            <div className="command-list">
              {corridorPressure.map((corridor) => (
                <div className="command-item" key={corridor.id}>
                  <div>
                    <strong>{corridor.label}</strong>
                    <span>{corridor.barricadeCount} barricade markers</span>
                  </div>
                  <span className={corridor.status === "Open" ? "badge ok" : "badge hot"}>{corridor.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="control-card">
            <p className="eyebrow">Recent operator actions</p>
            <div className="command-log">
              {logEntries.map((entry) => (
                <div className="log-line" key={entry}>
                  <span className="log-pulse" />
                  <p>{entry}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="control-card">
            <p className="eyebrow">Fan reroute copy</p>
            <p className="muted-block">
              {barricades.length > 0
                ? `Manual reroutes active at ${[...new Set(barricades.map((item) => corridorLabel(item.corridorId)))].join(", ")}.`
                : "No manual reroutes currently active."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

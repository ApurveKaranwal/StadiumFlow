"use client";

type ChartDatum = {
  label: string;
  value: number;
  tone?: "neutral" | "accent" | "alert" | "cool";
};

const toneMap = {
  neutral: "#c8b9a2",
  accent: "#124734",
  alert: "#b4532a",
  cool: "#2b6cb0"
};

export function LiveBarChart({
  title,
  caption,
  data,
  valueSuffix = ""
}: {
  title: string;
  caption: string;
  data: ChartDatum[];
  valueSuffix?: string;
}) {
  const safeData = data.length > 0 ? data : [{ label: "No data", value: 0, tone: "neutral" as const }];
  const highest = Math.max(1, ...safeData.map((item) => Number.isFinite(item.value) ? item.value : 0));

  return (
    <section className="chart-card">
      <div className="section-head tight">
        <div>
          <p className="eyebrow">Live Graph</p>
          <h3 className="card-title">{title}</h3>
        </div>
      </div>
      <p className="tiny">{caption}</p>
      <div className="bar-chart">
        {safeData.map((item) => (
          <div className="bar-column" key={item.label}>
            <span className="bar-value">
              {item.value}
              {valueSuffix}
            </span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  height: `${Math.max(10, ((Number.isFinite(item.value) ? item.value : 0) / highest) * 100)}%`,
                  background: toneMap[item.tone ?? "neutral"]
                }}
              />
            </div>
            <span className="bar-label">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

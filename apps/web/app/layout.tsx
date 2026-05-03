import "./globals.css";
import "leaflet/dist/leaflet.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stadium Flow Advisory",
  description: "Mathematical crowd routing for stadium entry and live match advisories."
};

const criticalStyles = `
  :root {
    --bg: #f3f1ec;
    --paper: #fbfaf7;
    --panel: #ffffff;
    --line: #e8e2d7;
    --text: #1d232b;
    --muted: #69717b;
    --accent: #124734;
    --highlight: #b4532a;
    --shadow: 0 18px 40px rgba(24, 33, 37, 0.07);
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    min-height: 100%;
    background: linear-gradient(180deg, #f4f1eb 0%, #f8f7f3 100%);
    color: var(--text);
    font-family: "Segoe UI", Arial, sans-serif;
  }
  body { min-height: 100vh; }
  a { color: inherit; text-decoration: none; }
  button, input, select, textarea { font: inherit; }
  .site-shell {
    max-width: 1240px;
    margin: 0 auto;
    padding: 28px 20px 64px;
  }
  .app-header,
  .section-head,
  .button-row,
  .action-row,
  .header-actions,
  .top-nav,
  .stats,
  .meta-row,
  .fan-hero-actions,
  .interactive-strip {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .app-header,
  .section-head {
    justify-content: space-between;
    align-items: center;
  }
  .hero-section,
  .content-grid,
  .fan-pulse-grid,
  .form-grid,
  .profile-stats,
  .feed-column,
  .form-stack,
  .gate-list,
  .gate-admin-list,
  .fan-report-layout,
  .command-grid,
  .hero-metrics,
  .privacy-stats {
    display: grid;
    gap: 16px;
  }
  .hero-section {
    grid-template-columns: 1.2fr 0.8fr;
    padding: 24px;
    border-radius: 28px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.84);
    box-shadow: var(--shadow);
  }
  .content-grid { grid-template-columns: 1.1fr 0.9fr; margin-top: 24px; }
  .fan-pulse-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 24px; }
  .form-grid,
  .profile-stats,
  .hero-metrics,
  .privacy-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fan-report-layout,
  .command-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .panel,
  .profile-card,
  .callout-card,
  .pulse-card,
  .map-section {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 24px;
    box-shadow: var(--shadow);
    padding: 22px;
  }
  .stadium-map,
  .privacy-stage {
    width: 100%;
    min-height: 380px;
    border-radius: 22px;
    overflow: hidden;
    border: 1px solid var(--line);
    background: #e9efe8;
  }
  .button,
  .button-link {
    border: 0;
    border-radius: 999px;
    padding: 14px 20px;
    background: var(--text);
    color: #fff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .button.secondary,
  .button-link.subtle {
    background: transparent;
    color: var(--text);
    border: 1px solid var(--line);
  }
  .text-field,
  .text-area {
    width: 100%;
    padding: 15px 16px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: #fff;
    color: var(--text);
  }
  .status-line,
  .composer-card,
  .reward-box,
  .consent-card {
    margin-top: 18px;
    padding: 18px;
    border-radius: 20px;
    border: 1px solid var(--line);
    background: var(--paper);
  }
  .hero-title { margin: 0; font-size: clamp(2.4rem, 5vw, 4.2rem); line-height: 0.97; }
  .hero-text, .muted-block, .section-copy, .muted-inline, .tiny { color: var(--muted); line-height: 1.65; }
  .eyebrow {
    margin: 0 0 10px;
    font-size: 0.84rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .pill, .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    border-radius: 999px;
    background: #f1eee6;
    color: var(--muted);
    font-size: 0.9rem;
  }
  @media (max-width: 980px) {
    .hero-section, .content-grid, .fan-pulse-grid, .form-grid, .profile-stats, .fan-report-layout, .command-grid, .hero-metrics, .privacy-stats {
      grid-template-columns: 1fr;
    }
    .app-header, .section-head { align-items: flex-start; }
  }
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <style dangerouslySetInnerHTML={{ __html: criticalStyles }} />
        {children}
      </body>
    </html>
  );
}

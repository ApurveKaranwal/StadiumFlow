import Link from "next/link";
import { AppHeader } from "../components/AppHeader";

export default function HomePage() {
  return (
    <main className="site-shell">
      <AppHeader current="home" />

      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Stadium Flow Advisory</p>
          <h1 className="hero-title">A stadium entry system that feels organized before fans even reach the queue.</h1>
          <p className="hero-text">
            Fans get the fastest gate recommendation from live walking routes and queue estimates. Organizers control
            gate setup, visibility, and operational messaging from a separate dashboard.
          </p>
          <div className="button-row">
            <Link className="button-link solid" href="/fan">
              Open fan dashboard
            </Link>
            <Link className="button-link subtle" href="/organizer">
              Open organizer dashboard
            </Link>
          </div>
        </div>

        <div className="landing-grid">
          <article className="landing-card">
            <p className="eyebrow">For fans</p>
            <h3 className="card-title">Route guidance that saves time</h3>
            <p className="muted-block">See the best gate, walking route, expected queue time, points balance, and live feed.</p>
          </article>
          <article className="landing-card">
            <p className="eyebrow">For organizers</p>
            <h3 className="card-title">Direct control over gate visibility</h3>
            <p className="muted-block">Define Gate 1, Gate 2, and every user-facing label, coordinate, and route hint.</p>
          </article>
          <article className="landing-card">
            <p className="eyebrow">Current traffic mode</p>
            <h3 className="card-title">Simulated congestion values</h3>
            <p className="muted-block">GPS crowd clustering will be added later. For now, organizers can tune queue and crowd scores manually.</p>
          </article>
        </div>
      </section>
    </main>
  );
}

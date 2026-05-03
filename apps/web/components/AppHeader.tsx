 "use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function AppHeader({ current }: { current: "home" | "fan" | "organizer" }) {
  const router = useRouter();

  const handleSignOut = () => {
    window.localStorage.removeItem("fan-name");
    router.push("/");
  };

  return (
    <header className="app-header">
      <Link className="brand" href="/">
        Stadium Flow
      </Link>
      <div className="header-actions">
        <nav className="top-nav">
          <Link className={current === "fan" ? "nav-link active" : "nav-link"} href="/fan">
            Fan dashboard
          </Link>
          <Link className={current === "organizer" ? "nav-link active" : "nav-link"} href="/organizer">
            Organizer dashboard
          </Link>
        </nav>
        {current !== "home" ? (
          <button className="button secondary header-signout" onClick={handleSignOut} type="button">
            Sign out
          </button>
        ) : null}
      </div>
    </header>
  );
}

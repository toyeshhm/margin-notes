import { lazy, Suspense, useEffect } from "react";

import { Hand } from "./components/Hand";
import { useEssays } from "./lib/store";
import { follow, usePath } from "./router";
import { EssayView } from "./screens/EssayView";
import { Home } from "./screens/Home";
import { Scan } from "./screens/Scan";

const Samples = lazy(() => import("./screens/Samples"));
const Essays = lazy(() => import("./screens/Essays"));
const MarkingKey = lazy(() => import("./screens/MarkingKey"));
const SharedNote = lazy(() => import("./screens/SharedNote"));

export const MENU = [
  { href: "/scan", label: "Scan an essay" },
  { href: "/samples", label: "Try a sample" },
  { href: "/essays", label: "My essays" },
  { href: "/key", label: "Marking key" },
] as const;

export const FOOTER = "Your essays are saved in this browser. Photos aren’t kept; what was read from them and each check’s result are, so a repeat costs nothing.";

function Bar({ path }: { path: string }): React.JSX.Element {
  const here = path.split("?")[0] ?? "/";
  // An opened essay belongs under My essays, or under Try a sample when it is one.
  const essays = useEssays();
  const owner = here.startsWith("/e/") ? (essays.find((e) => `/e/${e.id}` === here)?.sampleId === undefined ? "/essays" : "/samples") : undefined;
  return (
    <header className="bar">
      <a className="wordmark" href="/" onClick={follow} aria-current={here === "/" ? "page" : undefined}>
        Margin Notes
      </a>
      <nav aria-label="Menu">
        {MENU.map((m) => (
          <a key={m.href} href={m.href} onClick={follow} aria-current={here.startsWith(m.href) || m.href === owner ? "page" : undefined}>
            {m.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

function NotFound(): React.JSX.Element {
  return (
    <section className="lost">
      <span className="lost-mark" aria-hidden="true">
        <Hand words="?" size={72} write />
      </span>
      <h1>Nothing on this page</h1>
      <p>This link doesn&rsquo;t lead to an essay or a note. Check the address, or start from the desk.</p>
      <a className="btn" href="/" onClick={follow}>
        Back to the desk
      </a>
    </section>
  );
}

function route(path: string): React.JSX.Element {
  const [here = "/"] = path.split("?");
  if (here === "/") return <Home />;
  if (here === "/scan") return <Scan />;
  if (here === "/samples") return <Samples />;
  if (here === "/essays") return <Essays />;
  if (here === "/key") return <MarkingKey />;
  const essay = /^\/e\/([a-z0-9-]+)$/.exec(here);
  if (essay?.[1] !== undefined) return <EssayView key={essay[1]} id={essay[1]} />;
  const note = /^\/n\/([a-f0-9]{32})$/.exec(here);
  if (note?.[1] !== undefined) return <SharedNote id={note[1]} />;
  return <NotFound />;
}

const TITLES: Record<string, string> = {
  "/": "Margin Notes",
  "/scan": "Scan an essay | Margin Notes",
  "/samples": "Try a sample | Margin Notes",
  "/essays": "My essays | Margin Notes",
  "/key": "Marking key | Margin Notes",
};

export function App(): React.JSX.Element {
  const path = usePath();
  useEffect(() => {
    document.title = TITLES[path.split("?")[0] ?? "/"] ?? "Margin Notes";
  }, [path]);
  const shared = path.startsWith("/n/");
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      {!shared && <Bar path={path} />}
      <main id="main">
        <Suspense fallback={<div className="loading-screen" aria-label="Loading" />}>{route(path)}</Suspense>
      </main>
      {!shared && <footer className="foot">{FOOTER}</footer>}
    </>
  );
}

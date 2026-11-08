import { lazy, Suspense } from "react";

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

export const FOOTER = "Your essays stay in this browser. Photos are read, never stored.";

function Bar({ path }: { path: string }): React.JSX.Element {
  const here = path.split("?")[0] ?? "/";
  return (
    <header className="bar">
      <a className="wordmark" href="/" onClick={follow} aria-current={here === "/" ? "page" : undefined}>
        Margin Notes
      </a>
      <nav aria-label="Menu">
        {MENU.map((m) => (
          <a key={m.href} href={m.href} onClick={follow} aria-current={here.startsWith(m.href) || (m.href === "/essays" && here.startsWith("/e/")) ? "page" : undefined}>
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
      <h1>Nothing on this page</h1>
      <p>This link doesn&rsquo;t lead to an essay or a note. It may have been mistyped.</p>
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
  const note = /^\/n\/([a-f0-9]{12})$/.exec(here);
  if (note?.[1] !== undefined) return <SharedNote id={note[1]} />;
  return <NotFound />;
}

export function App(): React.JSX.Element {
  const path = usePath();
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

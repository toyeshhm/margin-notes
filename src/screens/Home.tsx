// The home desk: the kitchen table at night seen from above. Graphite-dust pictures of the
// student's own things across the top, the Margin Notes index card in the middle, and the menu laid
// out as objects on the desk.

import { Hand, Tick } from "../components/Hand";
import { prefersReducedMotion } from "../motion";
import { follow } from "../router";

const OBJECTS = [
  { href: "/scan", label: "Scan an essay", hint: "Photos of the marked pages, or a Word file", art: "phone" },
  { href: "/samples", label: "Try a sample", hint: "Three marked essays to open", art: "stack" },
  { href: "/essays", label: "My essays", hint: "Every essay and round, in this browser", art: "folder" },
  { href: "/key", label: "Marking key", hint: "What each mark means", art: "cards" },
] as const;

function Art({ kind }: { kind: (typeof OBJECTS)[number]["art"] }): React.JSX.Element {
  if (kind === "phone") {
    return (
      <span className="obj-phone" aria-hidden="true">
        <img src="/assets/scan-plane.webp" alt="" loading="lazy" />
      </span>
    );
  }
  if (kind === "stack") {
    return (
      <span className="obj-stack" aria-hidden="true">
        <span />
        <span />
        <span>
          <Hand words="awk" size={13} />
        </span>
      </span>
    );
  }
  if (kind === "folder") {
    return (
      <span className="obj-folder" aria-hidden="true">
        <span className="tab-label">Round 2</span>
        <Tick size={22} seed={4} />
      </span>
    );
  }
  return (
    <span className="obj-cards" aria-hidden="true">
      <span>
        <Hand words="frag" size={13} />
      </span>
      <span>
        <Hand words="sp" size={13} />
      </span>
      <span>
        <Hand words="so what?" size={13} />
      </span>
    </span>
  );
}

export function Home(): React.JSX.Element {
  return (
    <div className="home">
      <div className="mosaic" aria-hidden="true">
        <img className="m-pencil" src="/assets/home-pencil.webp" alt="" />
        <span className="m-awk">
          <Hand words="awk" size={56} write delay={0.4} />
        </span>
        {prefersReducedMotion() ? (
          <img className="m-relief" src="/assets/page1-relief.webp" alt="" />
        ) : (
          <video className="m-relief" autoPlay muted loop playsInline poster="/assets/page1-relief.webp">
            <source src="/assets/relief-loop.webm" type="video/webm" />
            <source src="/assets/relief-loop.mp4" type="video/mp4" />
          </video>
        )}
        <img className="m-page" src="/assets/home-page1.webp" alt="" />
        <span className="m-tick">
          <Tick size={70} write delay={1.4} seed={9} />
        </span>
        <img className="m-side" src="/assets/page1-side.webp" alt="" />
      </div>
      <section className="desk">
        <div className="index-card hero-card">
          <h1>Margin Notes</h1>
          <p className="tagline">Every comment, answered.</p>
          <p className="lede">Photograph the pages your teacher marked. Every comment is pinned to its sentence and put in plain words, then your revision is checked against each one.</p>
          <div className="actions">
            <a className="btn" href="/scan" onClick={follow}>
              Scan an essay
            </a>
            <a className="btn quiet dark" href="/samples" onClick={follow}>
              Try a sample
            </a>
          </div>
        </div>
        <ul className="objects">
          {OBJECTS.map((o) => (
            <li key={o.href}>
              <a className="object" href={o.href} onClick={follow}>
                <Art kind={o.art} />
                <span className="obj-text">
                  <span className="obj-label">{o.label}</span>
                  <span className="obj-hint">{o.hint}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

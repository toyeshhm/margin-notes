// The home desk: the kitchen table at night seen from above. Graphite-dust pictures of the
// student's own things across the top, which turn and shift with the visitor's hand, the Margin
// Notes index card in the middle, and the menu laid out as objects on the desk.

import { Orbit } from "../art/Orbit";
import { useDrift } from "../art/drift";
import { askForTilt } from "../art/pointer";
import { useRewrite } from "../art/rewrite";
import { PAGE_TURN, PENCIL_TURN } from "../art/sheets";
import { Hand, Tick } from "../components/Hand";
import { follow } from "../router";

const OBJECTS = [
  { href: "/scan", label: "Scan an essay", hint: "Photos of the marked pages, or a Word file", art: "phone" },
  { href: "/samples", label: "Try a sample", hint: "Three marked essays to open", art: "stack" },
  { href: "/essays", label: "My essays", hint: "Every essay and round, in this browser", art: "folder" },
  { href: "/key", label: "Marking key", hint: "What each mark means", art: "cards" },
] as const;

function Art({ kind, round }: { kind: (typeof OBJECTS)[number]["art"]; round: number }): React.JSX.Element {
  const write = round > 0;
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
          <Hand key={round} words="awk" size={13} write={write} />
        </span>
      </span>
    );
  }
  if (kind === "folder") {
    return (
      <span className="obj-folder" aria-hidden="true">
        <span className="tab-label">Round 2</span>
        <Tick key={round} size={22} seed={4} write={write} />
      </span>
    );
  }
  return (
    <span className="obj-cards" aria-hidden="true">
      <span>
        <Hand key={round} words="frag" size={13} write={write} />
      </span>
      <span>
        <Hand key={round} words="sp" size={13} write={write} delay={0.3} />
      </span>
      <span>
        <Hand key={round} words="so what?" size={13} write={write} delay={0.5} />
      </span>
    </span>
  );
}

function DeskObject({ href, label, hint, art }: (typeof OBJECTS)[number]): React.JSX.Element {
  const [round, again] = useRewrite(1.6);
  return (
    <a className="object" href={href} onClick={follow} onPointerEnter={again}>
      <Art kind={art} round={round} />
      <span className="obj-text">
        <span className="obj-label">{label}</span>
        <span className="obj-hint">{hint}</span>
      </span>
    </a>
  );
}

// The two depth clouds turn with the hand; the two page stills slide against it at different
// depths; the paper tiles write their marks again when the hand comes over them.
function Mosaic(): React.JSX.Element {
  const page = useDrift<HTMLImageElement>(18, 1.12);
  const side = useDrift<HTMLImageElement>(-12, 1.12);
  const [awk, rewriteAwk] = useRewrite();
  const [tick, rewriteTick] = useRewrite();
  return (
    <div className="mosaic" aria-hidden="true" onClick={askForTilt}>
      <Orbit className="m-pencil" still="/assets/turn-pencil.webp" {...PENCIL_TURN} />
      <span className="m-awk lifts" onPointerEnter={rewriteAwk}>
        <Hand key={awk} words="awk" size={56} write delay={awk === 0 ? 0.4 : 0} />
      </span>
      <Orbit className="m-relief" still="/assets/turn-page.webp" {...PAGE_TURN} />
      <span className="m-page m-frame">
        <img ref={page} src="/assets/home-page1.webp" alt="" />
      </span>
      <span className="m-tick lifts" onPointerEnter={rewriteTick}>
        <Tick key={tick} size={70} write delay={tick === 0 ? 1.4 : 0} seed={9} />
      </span>
      <span className="m-side m-frame">
        <img ref={side} src="/assets/page1-side.webp" alt="" />
      </span>
    </div>
  );
}

export function Home(): React.JSX.Element {
  return (
    <div className="home">
      <Mosaic />
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
              <DeskObject {...o} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

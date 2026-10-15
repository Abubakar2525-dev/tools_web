/**
 * Signature visual: a request trace descending through the strata of a
 * production AI system. Pure SVG + CSS animation (no JS); motion is disabled
 * under prefers-reduced-motion and the static diagram stays fully legible.
 */

const layers = [
  { label: "Product interface", note: "request in · user authenticated" },
  { label: "Orchestration", note: "plan → 2 tool calls, budgeted" },
  { label: "Retrieval & data", note: "hybrid search · 8 passages · ACL-filtered" },
  { label: "Model routing", note: "smallest model that passes the eval" },
  { label: "Guardrails & evaluation", note: "grounded · cited · traced" },
];

const W = 1160;
const BAND_H = 54;
const GAP = 18;
const TOP = 8;
const nodeX = [300, 460, 620, 780, 900];
const cy = (i: number) => TOP + i * (BAND_H + GAP) + BAND_H / 2;
const H = TOP + layers.length * (BAND_H + GAP) - GAP + 8;

const tracePath = nodeX
  .map((x, i) => {
    if (i === 0) return `M${x - 150} ${cy(0)} L${x} ${cy(0)}`;
    const px = nodeX[i - 1];
    const py = cy(i - 1);
    const y = cy(i);
    const mid = (py + y) / 2;
    return `C${px + 40} ${py} ${px + 30} ${mid} ${(px + x) / 2} ${mid} S${x - 40} ${y} ${x} ${y}`;
  })
  .join(" ")
  .concat(` L${W - 24} ${cy(layers.length - 1)}`);

export function StrataDiagram() {
  return (
    <figure className="relative">
      <figcaption className="sr-only">
        Diagram of an illustrative request travelling through five layers of a production AI system: product
        interface, orchestration, retrieval and data, model routing, and guardrails and evaluation.
      </figcaption>

      {/* Desktop / tablet: wide strata */}
      <svg viewBox={`0 0 ${W} ${H}`} className="hidden w-full md:block" role="presentation" aria-hidden="true">
        <defs>
          <linearGradient id="band-fade" x1="0" x2="1">
            <stop offset="0" stopColor="var(--surface)" />
            <stop offset="1" stopColor="var(--bg-sunken)" />
          </linearGradient>
        </defs>

        {layers.map((l, i) => {
          const y = TOP + i * (BAND_H + GAP);
          return (
            <g key={l.label} className="strata-layer" style={{ "--i": i } as React.CSSProperties}>
              <rect
                x={i * 14}
                y={y}
                width={W - i * 14}
                height={BAND_H}
                rx={12}
                fill="url(#band-fade)"
                stroke="var(--line-strong)"
              />
              <text
                x={i * 14 + 22}
                y={y + BAND_H / 2 + 5}
                fill="var(--ink-2)"
                style={{ font: "500 14px var(--font-geist)" }}
              >
                {l.label}
              </text>
            </g>
          );
        })}

        {/* base + animated trace */}
        <path d={tracePath} fill="none" stroke="var(--line-strong)" strokeWidth={1.5} />
        <path
          d={tracePath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinecap="round"
          className="strata-trace"
        />

        {nodeX.map((x, i) => {
          const y = cy(i);
          const note = layers[i].note;
          const w = note.length * 7.1 + 24;
          return (
            <g key={x}>
              <circle cx={x} cy={y} r={11} fill="var(--accent)" opacity={0.25} className="strata-pulse" style={{ animationDelay: `${i * 0.35}s` }} />
              <circle cx={x} cy={y} r={5.5} fill="var(--surface)" stroke="var(--accent)" strokeWidth={2} />
              <g className="strata-note" style={{ "--i": i } as React.CSSProperties}>
                <rect x={x + 18} y={y - 14} width={w} height={28} rx={7} fill="var(--ink)" />
                <text x={x + 30} y={y + 4.5} fill="var(--night-ink)" style={{ font: "400 12px var(--font-geist-mono)" }}>
                  {note}
                </text>
              </g>
            </g>
          );
        })}

        <circle r={4} fill="var(--accent)" className="strata-packet" style={{ offsetPath: `path("${tracePath}")` }} />
      </svg>

      {/* Mobile: vertical strata */}
      <svg viewBox="0 0 360 452" className="w-full md:hidden" role="presentation" aria-hidden="true">
        <path d="M322 0 V452" stroke="var(--line-strong)" strokeWidth={1.5} />
        <path d="M322 0 V452" stroke="var(--accent)" strokeWidth={2} className="strata-trace" />
        {layers.map((l, i) => {
          const y = i * 90 + 6;
          return (
            <g key={l.label} className="strata-layer" style={{ "--i": i } as React.CSSProperties}>
              <rect x={i * 6} y={y} width={300 - i * 6} height={76} rx={12} fill="var(--surface)" stroke="var(--line-strong)" />
              <text x={i * 6 + 16} y={y + 30} fill="var(--ink)" style={{ font: "500 15px var(--font-geist)" }}>
                {l.label}
              </text>
              <text x={i * 6 + 16} y={y + 54} fill="var(--muted)" style={{ font: "400 11.5px var(--font-geist-mono)" }}>
                {l.note.length > 34 ? `${l.note.slice(0, 33)}…` : l.note}
              </text>
              <circle cx={322} cy={y + 38} r={5.5} fill="var(--surface)" stroke="var(--accent)" strokeWidth={2} />
            </g>
          );
        })}
      </svg>
      <style>{`
        .strata-packet{display:none}
        @media (prefers-reduced-motion: no-preference){
          @supports (offset-path: path("M0 0")){
            .strata-packet{display:block;offset-rotate:0deg;animation:packet 4.8s cubic-bezier(.45,.05,.35,1) infinite 1.2s}
          }
        }
        @keyframes packet{0%{offset-distance:0%;opacity:0}6%{opacity:1}92%{opacity:1}100%{offset-distance:100%;opacity:0}}
      `}</style>
    </figure>
  );
}

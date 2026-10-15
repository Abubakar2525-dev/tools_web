import type { ProjectVisual as Kind } from "@/content/types";

/**
 * Abstract, original architecture glyphs for project cards. Each kind encodes
 * the real shape of the system: a pipeline, an agent loop, a workflow graph,
 * or an evaluation console's time-series.
 */
export function ProjectVisual({ kind, className = "", fit = "cover" }: { kind: Kind; className?: string; fit?: "cover" | "contain" }) {
  return (
    <svg viewBox="0 0 480 280" preserveAspectRatio={fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"} className={className} aria-hidden="true" fill="none">
      <rect width="480" height="280" fill="var(--bg-sunken)" />
      <g opacity=".7">
        {Array.from({ length: 11 }, (_, i) => (
          <path key={`v${i}`} d={`M${i * 48} 0V280`} stroke="var(--line)" />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <path key={`h${i}`} d={`M0 ${i * 48 + 20}H480`} stroke="var(--line)" />
        ))}
      </g>
      {kind === "pipeline" && <Pipeline />}
      {kind === "agent" && <Agent />}
      {kind === "graph" && <Graph />}
      {kind === "console" && <Console />}
    </svg>
  );
}

const Node = ({ x, y, w = 92, label, accent = false }: { x: number; y: number; w?: number; label: string; accent?: boolean }) => (
  <g>
    <rect
      x={x}
      y={y}
      width={w}
      height={36}
      rx={9}
      fill={accent ? "var(--ink)" : "var(--surface)"}
      stroke={accent ? "var(--ink)" : "var(--line-strong)"}
    />
    <text
      x={x + w / 2}
      y={y + 22.5}
      textAnchor="middle"
      fill={accent ? "var(--night-ink)" : "var(--ink-2)"}
      style={{ font: "400 11.5px var(--font-geist-mono)" }}
    >
      {label}
    </text>
  </g>
);

function Pipeline() {
  return (
    <g>
      <path className="draw" style={{ "--len": 420 } as React.CSSProperties} d="M86 88H150M242 88H300M346 106V152M300 170H242M150 170H118" stroke="var(--accent)" strokeWidth="1.75" />
      <Node x={-6} y={70} label="sources" />
      <Node x={150} y={70} label="chunk + tag" />
      <Node x={300} y={70} w={100} label="hybrid index" />
      <Node x={300} y={152} w={100} label="rerank" />
      <Node x={150} y={152} label="generate" accent />
      <Node x={26} y={152} label="cite" />
      <rect x="150" y="214" width="250" height="28" rx="7" fill="var(--accent-soft)" />
      <text x="164" y="232" fill="var(--accent-strong)" style={{ font: "400 11px var(--font-geist-mono)" }}>
        answer → [doc 3, §2.1] [ticket 8812]
      </text>
    </g>
  );
}

function Agent() {
  return (
    <g>
      <circle cx="240" cy="140" r="78" stroke="var(--line-strong)" strokeDasharray="3 6" />
      <circle className="draw" style={{ "--len": 500 } as React.CSSProperties} cx="240" cy="140" r="78" stroke="var(--accent)" strokeWidth="1.75" strokeDasharray="500" transform="rotate(-90 240 140)" />
      <Node x={194} y={122} label="agent" accent />
      <Node x={194} y={44} label="read playbook" />
      <Node x={318} y={122} label="compare" />
      <Node x={194} y={200} label="draft redline" />
      <Node x={70} y={122} label="flag risk" />
      <rect x="352" y="214" width="112" height="40" rx="9" fill="var(--surface)" stroke="var(--accent)" />
      <text x="408" y="238" textAnchor="middle" fill="var(--accent-strong)" style={{ font: "500 11.5px var(--font-geist-mono)" }}>
        human approve
      </text>
      <path d="M286 230 Q330 236 352 234" stroke="var(--accent)" strokeWidth="1.5" />
    </g>
  );
}

function Graph() {
  return (
    <g>
      <path
        className="draw"
        style={{ "--len": 700 } as React.CSSProperties}
        d="M100 140H140M232 140C262 140 262 84 292 84M232 140C262 140 262 196 292 196M384 84H412M384 196H412"
        stroke="var(--accent)"
        strokeWidth="1.75"
      />
      <Node x={10} y={122} label="inbox" />
      <Node x={140} y={122} label="classify" accent />
      <Node x={292} y={66} label="extract" />
      <Node x={292} y={178} label="exception" />
      <Node x={412} y={66} w={70} label="ERP" />
      <Node x={412} y={178} w={70} label="review" />
      <text x="292" y="132" fill="var(--muted)" style={{ font: "400 11px var(--font-geist-mono)" }}>
        validate totals, PO match
      </text>
    </g>
  );
}

function Console() {
  const pts = [180, 172, 176, 160, 164, 150, 154, 138, 146, 128, 132, 120];
  const line = pts.map((y, i) => `${i === 0 ? "M" : "L"}${40 + i * 36} ${y}`).join(" ");
  return (
    <g>
      <rect x="24" y="36" width="432" height="208" rx="12" fill="var(--surface)" stroke="var(--line-strong)" />
      <text x="44" y="66" fill="var(--ink-2)" style={{ font: "500 12px var(--font-geist-mono)" }}>
        eval: faithfulness · prompt v14 vs v15
      </text>
      <path d={`${line} L436 224 L40 224 Z`} fill="var(--accent)" opacity=".08" />
      <path className="draw" style={{ "--len": 460 } as React.CSSProperties} d={line} stroke="var(--accent)" strokeWidth="2" />
      <path d="M40 200 L436 200" stroke="var(--line-strong)" strokeDasharray="4 5" />
      <text x="436" y="214" textAnchor="end" fill="var(--muted)" style={{ font: "400 10.5px var(--font-geist-mono)" }}>
        release gate
      </text>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={44 + i * 64} y="84" width="54" height="8" rx="4" fill={i === 0 ? "var(--ink)" : "var(--line-strong)"} />
      ))}
    </g>
  );
}

const coverClass: Record<string, string> = {
  RAG: "articlesCoverRag",
  Agents: "articlesCoverAgents",
  "LLM Engineering": "articlesCoverLlm",
  Production: "articlesCoverProduction",
  Data: "articlesCoverData",
};

export function ArticleHeroVisual() {
  return (
    <figure
      className="articlesHeroVisual"
      aria-label="An animated editorial workflow connecting research notes, code and production checks"
    >
      <svg aria-hidden="true" viewBox="0 0 520 390" className="absolute inset-0 h-full w-full">
        <path d="M55 96 C 180 24, 304 78, 460 58" className="articlesHeroRail" fill="none" />
        <path d="M72 292 C 188 345, 330 292, 472 334" className="articlesHeroRail" fill="none" />
        <path d="M120 64 C 212 144, 305 245, 427 310" className="articlesHeroRail" fill="none" />
        <circle cx="89" cy="82" r="5" fill="var(--accent-on-night)" className="articlesHeroNode" />
        <circle cx="445" cy="69" r="5" fill="var(--accent-on-night)" className="articlesHeroNode" />
        <circle cx="434" cy="320" r="5" fill="var(--accent-on-night)" className="articlesHeroNode" />
      </svg>

      <div className="articlesHeroCard articlesHeroCardTop" aria-hidden="true">
        <span className="articlesHeroBadge"><i className="articlesHeroBadgeDot" /> Research</span>
        <i className="articlesHeroCardLine articlesHeroCardLineStrong" />
        <i className="articlesHeroCardLine" />
        <i className="articlesHeroCardLine articlesHeroCardLineShort" />
      </div>
      <div className="articlesHeroCard articlesHeroCardMiddle" aria-hidden="true">
        <span className="articlesHeroBadge"><i className="articlesHeroBadgeDot" /> Build</span>
        <i className="articlesHeroCardLine articlesHeroCardLineStrong" />
        <i className="articlesHeroCardLine" />
        <i className="articlesHeroCardLine articlesHeroCardLineShort" />
      </div>
      <div className="articlesHeroCard articlesHeroCardBottom" aria-hidden="true">
        <span className="articlesHeroBadge"><i className="articlesHeroBadgeDot" /> Measure</span>
        <i className="articlesHeroCardLine articlesHeroCardLineStrong" />
        <i className="articlesHeroCardLine" />
        <i className="articlesHeroCardLine articlesHeroCardLineShort" />
      </div>

      <figcaption className="articlesHeroStatus">
        <i className="articlesHeroStatusMark" aria-hidden="true" /> Evidence to implementation
      </figcaption>
    </figure>
  );
}

export function ArticleCover({ category, index, featured = false }: { category: string; index: number; featured?: boolean }) {
  return (
    <figure
      role="img"
      aria-label={`${category} editorial illustration`}
      className={`articlesCover ${coverClass[category] ?? "articlesCoverRag"} ${featured ? "articlesCoverFeatured" : ""}`}
    >
      <div className="articlesCoverMeta" aria-hidden="true">
        <span className="articlesCoverIndex">{String(index + 1).padStart(2, "0")}</span>
        <span>{category}</span>
      </div>
      <CategoryDiagram category={category} />
    </figure>
  );
}

function CategoryDiagram({ category }: { category: string }) {
  if (category === "Agents") {
    return (
      <svg aria-hidden="true" viewBox="0 0 360 160" className="articlesCoverDiagram">
        <path d="M62 82H147M213 82H298" className="articlesDiagramLine" />
        <path d="M180 55V28M180 109v25" className="articlesDiagramLine" />
        <rect x="22" y="60" width="74" height="44" rx="10" className="articlesDiagramSurface" />
        <rect x="143" y="50" width="74" height="64" rx="14" className="articlesDiagramSurface" />
        <rect x="264" y="60" width="74" height="44" rx="10" className="articlesDiagramSurface" />
        <circle cx="180" cy="82" r="10" className="articlesDiagramAccent" />
        <text x="40" y="86" className="articlesDiagramText">INPUT</text>
        <text x="159" y="88" className="articlesDiagramText">AGENT</text>
        <text x="279" y="86" className="articlesDiagramText">ACTION</text>
      </svg>
    );
  }

  if (category === "LLM Engineering") {
    return (
      <svg aria-hidden="true" viewBox="0 0 360 160" className="articlesCoverDiagram">
        <path d="M28 123 C 70 112, 88 43, 128 70 S 190 132, 222 85 S 279 43, 332 57" className="articlesDiagramAccent" />
        <path d="M28 132H332M28 96H332M28 60H332" className="articlesDiagramLine" />
        {[55, 102, 151, 202, 254, 305].map((x, i) => <circle key={x} cx={x} cy={[114, 75, 91, 108, 69, 53][i]} r="5" className="articlesDiagramSurface" />)}
        <text x="28" y="151" className="articlesDiagramText">TOKENS</text>
        <text x="284" y="151" className="articlesDiagramText">LATENCY</text>
      </svg>
    );
  }

  if (category === "Production") {
    return (
      <svg aria-hidden="true" viewBox="0 0 360 160" className="articlesCoverDiagram">
        <path d="M180 18 246 43v43c0 31-26 50-66 61-40-11-66-30-66-61V43l66-25Z" className="articlesDiagramSurface" />
        <path d="m151 82 20 20 42-47" className="articlesDiagramAccent" />
        <path d="M40 53h55M265 53h55M40 111h55M265 111h55" className="articlesDiagramLine" />
        <text x="38" y="45" className="articlesDiagramText">INPUT</text>
        <text x="273" y="45" className="articlesDiagramText">POLICY</text>
        <text x="38" y="130" className="articlesDiagramText">TRACE</text>
        <text x="275" y="130" className="articlesDiagramText">REVIEW</text>
      </svg>
    );
  }

  if (category === "Data") {
    return (
      <svg aria-hidden="true" viewBox="0 0 360 160" className="articlesCoverDiagram">
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${52 + i * 104} ${40 + i * 8})`}>
            <ellipse cx="40" cy="12" rx="40" ry="12" className="articlesDiagramSurface" />
            <path d="M0 12v56c0 7 18 12 40 12s40-5 40-12V12" className="articlesDiagramSurface" />
            <path d="M0 40c0 7 18 12 40 12s40-5 40-12" className="articlesDiagramLine" />
          </g>
        ))}
        <path d="M132 90h24M236 98h24" className="articlesDiagramAccent" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 360 160" className="articlesCoverDiagram">
      <rect x="26" y="33" width="86" height="96" rx="12" className="articlesDiagramSurface" />
      <rect x="137" y="48" width="86" height="72" rx="12" className="articlesDiagramSurface" />
      <rect x="248" y="60" width="86" height="48" rx="12" className="articlesDiagramSurface" />
      <path d="M112 81h25M223 84h25" className="articlesDiagramAccent" />
      <path d="M49 61h40M49 78h31M49 95h40M160 72h40M160 89h29" className="articlesDiagramLine" />
      <text x="43" y="119" className="articlesDiagramText">DOCUMENTS</text>
      <text x="153" y="111" className="articlesDiagramText">RETRIEVE</text>
      <text x="266" y="89" className="articlesDiagramText">ANSWER</text>
    </svg>
  );
}


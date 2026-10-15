import { Icon, type AnyIcon } from "@/components/ui/Icon";
import type { Service } from "@/content/types";

type VisualKind = "pipeline" | "network" | "interface" | "cms" | "commerce" | "mobile" | "analytics" | "operations";

type VisualSpec = {
  kind: VisualKind;
  eyebrow: string;
  title: string;
  items: readonly [string, string, string];
  signal: string;
  metric: string;
  metricLabel: string;
  icon: AnyIcon;
};

/**
 * Each route gets its own visual story. The renderers are shared to keep the
 * motion language consistent, while the scene, copy, iconography and signal
 * data remain specific to the service being explained.
 */
const visuals: Record<string, VisualSpec> = {
  "ai-application-development": {
    kind: "interface", eyebrow: "AI product preview", title: "Answer workspace",
    items: ["Grounded response", "Human fallback", "Cost trace"], signal: "Streaming", metric: "1.2s", metricLabel: "first token", icon: "spark",
  },
  "ai-agent-development": {
    kind: "network", eyebrow: "Agent run", title: "Plan → act → verify",
    items: ["Reasoning", "Tool call", "Approval"], signal: "Guardrails on", metric: "04", metricLabel: "tools connected", icon: "agent",
  },
  "rag-development": {
    kind: "pipeline", eyebrow: "Retrieval trace", title: "Question to cited answer",
    items: ["Documents", "Vector search", "Cited answer"], signal: "Sources attached", metric: "0.91", metricLabel: "retrieval score", icon: "rag",
  },
  "llm-integration": {
    kind: "pipeline", eyebrow: "Model gateway", title: "One typed model layer",
    items: ["Product input", "Model router", "Safe output"], signal: "Fallback ready", metric: "3", metricLabel: "models routed", icon: "llm",
  },
  "ai-workflow-automation": {
    kind: "pipeline", eyebrow: "Automation run", title: "Intake to completed task",
    items: ["New request", "AI decision", "System update"], signal: "Human checkpoint", metric: "18m", metricLabel: "time returned", icon: "workflow",
  },
  "data-engineering-for-ai": {
    kind: "pipeline", eyebrow: "Data quality flow", title: "Raw data to trusted context",
    items: ["Source data", "Validate + shape", "AI-ready layer"], signal: "Freshness checked", metric: "99.4%", metricLabel: "valid records", icon: "data",
  },
  "custom-software-development": {
    kind: "interface", eyebrow: "Product system", title: "Operations workspace",
    items: ["Shared workflow", "Role controls", "API events"], signal: "Release candidate", metric: "12", metricLabel: "flows unified", icon: "code",
  },
  "ai-deployment-and-monitoring": {
    kind: "operations", eyebrow: "Production control", title: "Model health monitor",
    items: ["Quality stable", "Latency healthy", "Cost in range"], signal: "All checks passing", metric: "99.95%", metricLabel: "availability", icon: "deploy",
  },
  "web-development": {
    kind: "interface", eyebrow: "Responsive build", title: "Website preview",
    items: ["Accessible UI", "CMS content", "API response"], signal: "Ready to publish", metric: "98", metricLabel: "performance", icon: "globe",
  },
  "wordpress-development": {
    kind: "cms", eyebrow: "Editor preview", title: "Reusable page builder",
    items: ["Hero block", "Content grid", "CTA block"], signal: "Draft autosaved", metric: "14", metricLabel: "custom blocks", icon: "layers",
  },
  "ecommerce-development": {
    kind: "commerce", eyebrow: "Storefront flow", title: "Cart to fulfillment",
    items: ["Product", "Secure checkout", "Order routed"], signal: "Inventory synced", metric: "2.1%", metricLabel: "checkout drop", icon: "briefcase",
  },
  "mobile-app-development": {
    kind: "mobile", eyebrow: "Mobile experience", title: "One-handed product flow",
    items: ["Sign in", "Core action", "Sync complete"], signal: "iOS + Android", metric: "60fps", metricLabel: "UI motion", icon: "app",
  },
  "seo-services": {
    kind: "analytics", eyebrow: "Search visibility", title: "Technical SEO console",
    items: ["Crawl health", "Index coverage", "Search demand"], signal: "Issues prioritized", metric: "+34%", metricLabel: "qualified clicks", icon: "search",
  },
  "digital-marketing": {
    kind: "analytics", eyebrow: "Campaign journey", title: "Audience to conversion",
    items: ["Reach", "Engagement", "Conversion"], signal: "Attribution live", metric: "4.8x", metricLabel: "return on spend", icon: "share",
  },
  "conversion-rate-optimization": {
    kind: "analytics", eyebrow: "Experiment readout", title: "Journey performance",
    items: ["Variant A", "Variant B", "Confidence"], signal: "Test significant", metric: "+18%", metricLabel: "completion rate", icon: "gauge",
  },
  "content-strategy-and-analytics": {
    kind: "analytics", eyebrow: "Content intelligence", title: "Demand and content map",
    items: ["Audience need", "Content cluster", "Business action"], signal: "Gaps identified", metric: "24", metricLabel: "topics mapped", icon: "book",
  },
  "website-maintenance-and-support": {
    kind: "operations", eyebrow: "Site operations", title: "Maintenance control room",
    items: ["Backups current", "Updates tested", "Forms healthy"], signal: "No action needed", metric: "99.99%", metricLabel: "uptime", icon: "checklist",
  },
  "website-speed-optimization": {
    kind: "operations", eyebrow: "Core Web Vitals", title: "Performance timeline",
    items: ["LCP 1.7s", "INP 86ms", "CLS 0.03"], signal: "Vitals passing", metric: "47%", metricLabel: "faster load", icon: "bolt",
  },
  "security-and-technical-support": {
    kind: "network", eyebrow: "Security perimeter", title: "Detect → contain → recover",
    items: ["Access policy", "Threat signal", "Clean restore"], signal: "Protected", metric: "0", metricLabel: "open incidents", icon: "shield",
  },
  "cloud-and-infrastructure": {
    kind: "network", eyebrow: "Cloud topology", title: "Reliable delivery network",
    items: ["Edge traffic", "App cluster", "Data layer"], signal: "Auto-scaling", metric: "3", metricLabel: "healthy regions", icon: "deploy",
  },
};

function PipelineScene({ spec }: { spec: VisualSpec }) {
  return (
    <div className="service-scene service-scene--pipeline">
      <svg viewBox="0 0 520 230" preserveAspectRatio="none">
        <path className="service-scene__rail" d="M72 116 C150 116 150 116 220 116 S350 116 448 116" />
        <circle className="service-scene__packet" cx="72" cy="116" r="5" />
      </svg>
      <div className="service-pipeline">
        {spec.items.map((item, index) => (
          <div className="service-pipeline__step" key={item} style={{ "--i": index } as React.CSSProperties}>
            <span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function NetworkScene({ spec }: { spec: VisualSpec }) {
  return (
    <div className="service-scene service-scene--network">
      <svg viewBox="0 0 520 230" preserveAspectRatio="none">
        <path className="service-scene__rail" d="M260 115 L92 54 M260 115 L92 176 M260 115 L428 54 M260 115 L428 176" />
      </svg>
      <div className="service-network__core"><span className="service-network__pulse" /><Icon name={spec.icon} size={26} /><strong>{spec.title}</strong></div>
      {[...spec.items, spec.signal].map((item, index) => <span className={`service-network__sat service-network__sat--${index + 1}`} key={item}>{item}</span>)}
    </div>
  );
}

function InterfaceScene({ spec, kind }: { spec: VisualSpec; kind: "interface" | "cms" }) {
  return (
    <div className={`service-scene service-scene--${kind}`}>
      <div className="service-browser">
        <div className="service-browser__bar"><i /><i /><i /><span>{spec.title}</span></div>
        <div className="service-browser__body">
          {kind === "cms" && <div className="service-browser__sidebar">{spec.items.map((item) => <span key={item}>{item}</span>)}</div>}
          <div className="service-browser__content">
            <div className="service-browser__hero"><span /><strong>{spec.items[0]}</strong><small>{spec.items[1]}</small></div>
            <div className="service-browser__cards"><i /><i /><i /></div>
          </div>
        </div>
      </div>
      <span className="service-float-card"><Icon name={spec.icon} size={16} /> {spec.signal}</span>
    </div>
  );
}

function CommerceScene({ spec }: { spec: VisualSpec }) {
  return (
    <div className="service-scene service-scene--commerce">
      <div className="service-product-grid">{[0, 1, 2].map((item) => <div key={item}><span /><i /><small /></div>)}</div>
      <div className="service-cart"><span className="service-cart__icon"><Icon name="briefcase" size={20} /></span><strong>{spec.items[1]}</strong><small>{spec.items[2]}</small><i /></div>
    </div>
  );
}

function MobileScene({ spec }: { spec: VisualSpec }) {
  return (
    <div className="service-scene service-scene--mobile">
      {[0, 1, 2].map((screen) => (
        <div className={`service-phone service-phone--${screen + 1}`} key={screen}>
          <i className="service-phone__speaker" /><span className="service-phone__art" /><strong>{spec.items[screen]}</strong><small /><small />
        </div>
      ))}
    </div>
  );
}

function AnalyticsScene({ spec }: { spec: VisualSpec }) {
  return (
    <div className="service-scene service-scene--analytics">
      <div className="service-analytics__metric"><small>{spec.metricLabel}</small><strong>{spec.metric}</strong><span>↗ live signal</span></div>
      <div className="service-chart"><span style={{ "--h": "42%" } as React.CSSProperties} /><span style={{ "--h": "58%" } as React.CSSProperties} /><span style={{ "--h": "51%" } as React.CSSProperties} /><span style={{ "--h": "76%" } as React.CSSProperties} /><span style={{ "--h": "68%" } as React.CSSProperties} /><span style={{ "--h": "92%" } as React.CSSProperties} /></div>
      <div className="service-analytics__legend">{spec.items.map((item, index) => <span key={item}><i style={{ "--i": index } as React.CSSProperties} />{item}</span>)}</div>
    </div>
  );
}

function OperationsScene({ spec }: { spec: VisualSpec }) {
  return (
    <div className="service-scene service-scene--operations">
      <div className="service-ops__summary"><Icon name={spec.icon} size={22} /><span><strong>{spec.metric}</strong><small>{spec.metricLabel}</small></span><i>{spec.signal}</i></div>
      <div className="service-ops__graph"><svg viewBox="0 0 460 75" preserveAspectRatio="none"><path className="service-ops__area" d="M0 61 C45 58 58 34 104 42 S180 60 218 32 S290 18 324 28 S398 8 460 16 L460 75 L0 75 Z" /><path className="service-ops__line" d="M0 61 C45 58 58 34 104 42 S180 60 218 32 S290 18 324 28 S398 8 460 16" /></svg></div>
      <div className="service-ops__checks">{spec.items.map((item, index) => <span key={item}><i>{index === 1 ? "↗" : "✓"}</i>{item}</span>)}</div>
    </div>
  );
}

export function ServiceIllustration({ service }: { service: Service }) {
  const spec = visuals[service.slug] ?? {
    kind: "pipeline", eyebrow: `${service.group} system`, title: service.navLabel,
    items: [service.integrations[0], service.primaryKeyword, service.stack[0]], signal: "Ready to adapt", metric: "Live", metricLabel: "delivery trace", icon: service.icon,
  };

  return (
    <figure className={`service-visual service-visual--${spec.kind}`} aria-labelledby={`service-visual-${service.slug}`}>
      <figcaption id={`service-visual-${service.slug}`} className="sr-only">
        Animated {spec.eyebrow.toLowerCase()} illustration for {service.navLabel}, showing {spec.items.join(", ")}.
      </figcaption>
      <div className="service-visual__topline" aria-hidden="true"><span>{spec.eyebrow}</span><span className="service-visual__status"><i />{spec.signal}</span></div>
      <div className="service-visual__canvas" aria-hidden="true">
        {spec.kind === "pipeline" && <PipelineScene spec={spec} />}
        {spec.kind === "network" && <NetworkScene spec={spec} />}
        {(spec.kind === "interface" || spec.kind === "cms") && <InterfaceScene spec={spec} kind={spec.kind} />}
        {spec.kind === "commerce" && <CommerceScene spec={spec} />}
        {spec.kind === "mobile" && <MobileScene spec={spec} />}
        {spec.kind === "analytics" && <AnalyticsScene spec={spec} />}
        {spec.kind === "operations" && <OperationsScene spec={spec} />}
      </div>
      <div className="service-visual__legend" aria-hidden="true"><span><i />{spec.title}</span><span><strong>{spec.metric}</strong> {spec.metricLabel}</span></div>
    </figure>
  );
}

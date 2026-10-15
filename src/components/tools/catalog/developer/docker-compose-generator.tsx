"use client";

import { useEffect, useMemo, useState } from "react";
import { Btn, CopyBtn, EmptyState, Notice, OutputBlock, PrivacyNote, ResetBtn, SelectField, TextArea, TextField, ToolPanel, downloadFile, uid, usePersistentState } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { PRESETS, buildCompose, type PresetId, type ServiceSpec } from "./lib/compose";

type YamlMod = typeof import("js-yaml");

const blank = (): ServiceSpec => ({
  id: uid(),
  name: "service",
  image: "",
  build: "",
  ports: "",
  env: "",
  volumes: "",
  dependsOn: "",
  command: "",
  restart: "unless-stopped",
  healthcheck: "",
});

const fromPreset = (id: PresetId): ServiceSpec => ({ id: uid(), ...(PRESETS.find((p) => p.id === id) ?? PRESETS[0]).make() });

const STARTER: ServiceSpec[] = [
  { ...fromPreset("node"), id: "s1", dependsOn: "db, redis", env: "NODE_ENV=production\nPORT=3000\nDATABASE_URL=postgres://app:change-me@db:5432/app\nREDIS_URL=redis://redis:6379" },
  { ...fromPreset("postgres"), id: "s2" },
  { ...fromPreset("redis"), id: "s3" },
];

export default function Tool() {
  const [services, setServices, clear] = usePersistentState<ServiceSpec[]>("docker-compose-generator", STARTER);
  const [preset, setPreset] = useState<PresetId>("postgres");
  const [yaml, setYaml] = useState<YamlMod | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    import("js-yaml")
      .then((m) => {
        if (alive) setYaml(m);
      })
      .catch(() => {
        if (alive) setLoadErr("The YAML library failed to load. Reload the page to try again.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const { doc, issues } = useMemo(() => buildCompose(services), [services]);
  const text = useMemo(() => {
    if (!yaml) return "";
    const header = "# Generated with the Nuvella Promo Code Docker Compose generator. Review before use.\n";
    return header + yaml.dump(doc, { lineWidth: -1, noRefs: true, quoteStyle: "double" });
  }, [yaml, doc]);

  const update = (id: string, patch: Partial<ServiceSpec>) => setServices((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const addPreset = () => {
    const s = fromPreset(preset);
    const names = new Set(services.map((x) => x.name));
    let name = s.name;
    let i = 2;
    while (names.has(name)) name = `${s.name}${i++}`;
    setServices((ss) => [...ss, { ...s, name }]);
  };
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  return (
    <div className="space-y-5">
      <ToolPanel title="Services" actions={<ResetBtn onClick={clear} label="Start over" />}>
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <SelectField className="min-w-[220px]" label="Preset" value={preset} onChange={(e) => setPreset(e.target.value as PresetId)} options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} />
            <Btn icon="plus" onClick={addPreset}>
              Add preset
            </Btn>
            <Btn variant="ghost" icon="plus" onClick={() => setServices((ss) => [...ss, blank()])}>
              Add empty service
            </Btn>
          </div>
          {services.length === 0 ? (
            <EmptyState icon="deploy" title="No services">
              Add a preset or an empty service.
            </EmptyState>
          ) : (
            <div className="space-y-4">
              {services.map((s, i) => (
                <details key={s.id} open={i === services.length - 1 || services.length <= 3} className="rounded-xl bg-sunken p-4">
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 font-medium text-ink">
                    <span>
                      {s.name || `Service ${i + 1}`} <span className="font-normal text-muted">{s.image || (s.build ? `build ${s.build}` : "")}</span>
                    </span>
                  </summary>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <TextField label="Service name" value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} />
                    <TextField label="Image" hint="For example postgres:17-alpine. Leave empty to build." value={s.image} onChange={(e) => update(s.id, { image: e.target.value })} />
                    <TextField label="Build context" optional hint="Folder with a Dockerfile, for example ." value={s.build} onChange={(e) => update(s.id, { build: e.target.value })} />
                    <SelectField
                      label="Restart policy"
                      value={s.restart}
                      onChange={(e) => update(s.id, { restart: e.target.value as ServiceSpec["restart"] })}
                      options={[
                        { value: "unless-stopped", label: "unless-stopped" },
                        { value: "always", label: "always" },
                        { value: "on-failure", label: "on-failure" },
                        { value: "no", label: "no" },
                      ]}
                    />
                    <TextArea label="Ports" optional mono rows={2} hint="host:container, one per line" value={s.ports} onChange={(e) => update(s.id, { ports: e.target.value })} />
                    <TextArea label="Environment" optional mono rows={3} hint="KEY=value, one per line" value={s.env} onChange={(e) => update(s.id, { env: e.target.value })} />
                    <TextArea label="Volumes" optional mono rows={2} hint="name:/path or ./host:/path, one per line" value={s.volumes} onChange={(e) => update(s.id, { volumes: e.target.value })} />
                    <TextField label="Depends on" optional hint="Service names, comma-separated" value={s.dependsOn} onChange={(e) => update(s.id, { dependsOn: e.target.value })} />
                    <TextField label="Command" optional value={s.command} onChange={(e) => update(s.id, { command: e.target.value })} />
                    <TextField label="Healthcheck command" optional hint="Runs with CMD-SHELL inside the container" value={s.healthcheck} onChange={(e) => update(s.id, { healthcheck: e.target.value })} />
                  </div>
                  <div className="mt-4">
                    <Btn variant="danger" icon="trash" onClick={() => setServices((ss) => ss.filter((x) => x.id !== s.id))}>
                      Remove {s.name || "service"}
                    </Btn>
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </ToolPanel>

      <ToolPanel
        title="compose.yaml"
        actions={
          <>
            <CopyBtn text={text} />
            <Btn variant="ghost" icon="download" disabled={!text} onClick={() => downloadFile("compose.yaml", text, "application/yaml")}>
              Download
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          {errors.length > 0 ? (
            <Notice tone="error" title={`${errors.length} problem${errors.length === 1 ? "" : "s"} to fix`}>
              <ul className="list-disc space-y-1 pl-4">
                {errors.map((e) => (
                  <li key={e.message}>{e.message}</li>
                ))}
              </ul>
            </Notice>
          ) : (
            services.length > 0 && <Notice tone="success">No conflicts found: ports, names and dependencies check out.</Notice>
          )}
          {warnings.length > 0 && (
            <Notice tone="warning">
              <ul className="list-disc space-y-1 pl-4">
                {warnings.map((w) => (
                  <li key={w.message}>{w.message}</li>
                ))}
              </ul>
            </Notice>
          )}
          {loadErr ? (
            <Notice tone="error">{loadErr}</Notice>
          ) : !yaml ? (
            <Spinner label="Loading the YAML writer" />
          ) : (
            <OutputBlock label="compose.yaml">
              <code>{text}</code>
            </OutputBlock>
          )}
          <p className="text-[0.8125rem] text-muted">
            Start it with docker compose up -d. depends_on waits for a healthy dependency when that service has a healthcheck. Replace placeholder passwords before deploying.
          </p>
        </div>
      </ToolPanel>
      <PrivacyNote stored />
    </div>
  );
}

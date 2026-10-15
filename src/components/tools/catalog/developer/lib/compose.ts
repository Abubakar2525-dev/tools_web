/** Docker Compose service model, presets and validation (pure TS). */

export interface ServiceSpec {
  id: string;
  name: string;
  image: string;
  /** Build context instead of an image ("" = use image). */
  build: string;
  ports: string; // one "host:container" per line
  env: string; // KEY=value per line
  volumes: string; // "source:target" per line
  dependsOn: string; // comma-separated service names
  command: string;
  restart: "no" | "always" | "unless-stopped" | "on-failure";
  healthcheck: string; // CMD-SHELL test, "" for none
}

export type PresetId =
  | "postgres"
  | "mysql"
  | "mariadb"
  | "redis"
  | "mongo"
  | "nginx"
  | "node"
  | "python"
  | "rabbitmq"
  | "adminer"
  | "mailpit"
  | "minio";

export const PRESETS: { id: PresetId; label: string; make: () => Omit<ServiceSpec, "id"> }[] = [
  {
    id: "postgres",
    label: "PostgreSQL",
    make: () => ({
      name: "db",
      image: "postgres:17-alpine",
      build: "",
      ports: "5432:5432",
      env: "POSTGRES_USER=app\nPOSTGRES_PASSWORD=change-me\nPOSTGRES_DB=app",
      volumes: "pgdata:/var/lib/postgresql/data",
      dependsOn: "",
      command: "",
      restart: "unless-stopped",
      healthcheck: "pg_isready -U app -d app",
    }),
  },
  {
    id: "mysql",
    label: "MySQL",
    make: () => ({
      name: "mysql",
      image: "mysql:8.4",
      build: "",
      ports: "3306:3306",
      env: "MYSQL_ROOT_PASSWORD=change-me\nMYSQL_DATABASE=app\nMYSQL_USER=app\nMYSQL_PASSWORD=change-me",
      volumes: "mysqldata:/var/lib/mysql",
      dependsOn: "",
      command: "",
      restart: "unless-stopped",
      healthcheck: "mysqladmin ping -h 127.0.0.1 -u root -p$$MYSQL_ROOT_PASSWORD",
    }),
  },
  {
    id: "mariadb",
    label: "MariaDB",
    make: () => ({
      name: "mariadb",
      image: "mariadb:11",
      build: "",
      ports: "3307:3306",
      env: "MARIADB_ROOT_PASSWORD=change-me\nMARIADB_DATABASE=app",
      volumes: "mariadbdata:/var/lib/mysql",
      dependsOn: "",
      command: "",
      restart: "unless-stopped",
      healthcheck: "healthcheck.sh --connect --innodb_initialized",
    }),
  },
  {
    id: "redis",
    label: "Redis",
    make: () => ({
      name: "redis",
      image: "redis:7-alpine",
      build: "",
      ports: "6379:6379",
      env: "",
      volumes: "redisdata:/data",
      dependsOn: "",
      command: "redis-server --appendonly yes",
      restart: "unless-stopped",
      healthcheck: "redis-cli ping",
    }),
  },
  {
    id: "mongo",
    label: "MongoDB",
    make: () => ({
      name: "mongo",
      image: "mongo:8",
      build: "",
      ports: "27017:27017",
      env: "MONGO_INITDB_ROOT_USERNAME=root\nMONGO_INITDB_ROOT_PASSWORD=change-me",
      volumes: "mongodata:/data/db",
      dependsOn: "",
      command: "",
      restart: "unless-stopped",
      healthcheck: "mongosh --quiet --eval \"db.adminCommand('ping').ok\"",
    }),
  },
  {
    id: "nginx",
    label: "Nginx",
    make: () => ({
      name: "web",
      image: "nginx:1.27-alpine",
      build: "",
      ports: "8080:80",
      env: "",
      volumes: "./nginx.conf:/etc/nginx/conf.d/default.conf:ro\n./public:/usr/share/nginx/html:ro",
      dependsOn: "",
      command: "",
      restart: "unless-stopped",
      healthcheck: "wget -qO- http://127.0.0.1/ >/dev/null || exit 1",
    }),
  },
  {
    id: "node",
    label: "Node.js app",
    make: () => ({
      name: "app",
      image: "",
      build: ".",
      ports: "3000:3000",
      env: "NODE_ENV=production\nPORT=3000",
      volumes: "",
      dependsOn: "",
      command: "",
      restart: "unless-stopped",
      healthcheck: "wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1",
    }),
  },
  {
    id: "python",
    label: "Python app",
    make: () => ({
      name: "api",
      image: "",
      build: ".",
      ports: "8000:8000",
      env: "PYTHONUNBUFFERED=1",
      volumes: "",
      dependsOn: "",
      command: "uvicorn main:app --host 0.0.0.0 --port 8000",
      restart: "unless-stopped",
      healthcheck: "",
    }),
  },
  {
    id: "rabbitmq",
    label: "RabbitMQ",
    make: () => ({
      name: "rabbitmq",
      image: "rabbitmq:4-management-alpine",
      build: "",
      ports: "5672:5672\n15672:15672",
      env: "RABBITMQ_DEFAULT_USER=app\nRABBITMQ_DEFAULT_PASS=change-me",
      volumes: "rabbitdata:/var/lib/rabbitmq",
      dependsOn: "",
      command: "",
      restart: "unless-stopped",
      healthcheck: "rabbitmq-diagnostics -q ping",
    }),
  },
  {
    id: "adminer",
    label: "Adminer",
    make: () => ({
      name: "adminer",
      image: "adminer:latest",
      build: "",
      ports: "8081:8080",
      env: "",
      volumes: "",
      dependsOn: "",
      command: "",
      restart: "unless-stopped",
      healthcheck: "",
    }),
  },
  {
    id: "mailpit",
    label: "Mailpit (test SMTP)",
    make: () => ({
      name: "mail",
      image: "axllent/mailpit:latest",
      build: "",
      ports: "1025:1025\n8025:8025",
      env: "",
      volumes: "",
      dependsOn: "",
      command: "",
      restart: "unless-stopped",
      healthcheck: "",
    }),
  },
  {
    id: "minio",
    label: "MinIO (S3 API)",
    make: () => ({
      name: "minio",
      image: "minio/minio:latest",
      build: "",
      ports: "9000:9000\n9001:9001",
      env: "MINIO_ROOT_USER=minioadmin\nMINIO_ROOT_PASSWORD=change-me-please",
      volumes: "miniodata:/data",
      dependsOn: "",
      command: 'server /data --console-address ":9001"',
      restart: "unless-stopped",
      healthcheck: "",
    }),
  },
];

const lines = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

/** Splits a quoted command string into an exec-form array. */
export function splitCommand(cmd: string): string[] {
  const out: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd))) out.push(m[1] !== undefined ? m[1].replace(/\\(.)/g, "$1") : m[2] !== undefined ? m[2] : m[3]);
  return out;
}

const NAMED_VOLUME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

export interface ComposeIssue {
  level: "error" | "warning";
  message: string;
}

export interface ComposeDoc {
  services: Record<string, Record<string, unknown>>;
  volumes?: Record<string, Record<string, never>>;
}

export function buildCompose(services: ServiceSpec[]): { doc: ComposeDoc; issues: ComposeIssue[] } {
  const issues: ComposeIssue[] = [];
  const doc: ComposeDoc = { services: {} };
  const namedVolumes = new Set<string>();
  const hostPorts = new Map<string, string>();
  const names = services.map((s) => s.name.trim());

  services.forEach((s, idx) => {
    const name = s.name.trim();
    const label = name || `service ${idx + 1}`;
    if (!name) issues.push({ level: "error", message: `Service ${idx + 1} needs a name.` });
    else if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)) issues.push({ level: "error", message: `"${name}" is not a valid service name (letters, digits, _, . and -, starting with a letter or digit).` });
    if (name && names.indexOf(name) !== idx) issues.push({ level: "error", message: `Service name "${name}" is used more than once.` });
    if (!s.image.trim() && !s.build.trim()) issues.push({ level: "error", message: `${label}: set an image or a build context.` });

    const svc: Record<string, unknown> = {};
    if (s.build.trim()) svc.build = s.build.trim();
    if (s.image.trim()) svc.image = s.image.trim();
    if (s.image.trim() && !/[:@]/.test(s.image.replace(/^[^/]*\//, ""))) issues.push({ level: "warning", message: `${label}: the image has no tag, so it resolves to "latest". Pin a version for repeatable builds.` });
    if (s.command.trim()) svc.command = splitCommand(s.command.trim());
    if (s.restart !== "no") svc.restart = s.restart;

    const ports = lines(s.ports);
    if (ports.length) {
      svc.ports = ports;
      for (const p of ports) {
        const m = /^(?:(\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-fA-F:]+\]):)?(?:(\d+)(?:-(\d+))?:)?(\d+)(?:-(\d+))?(\/(tcp|udp))?$/.exec(p);
        if (!m) {
          issues.push({ level: "error", message: `${label}: port mapping "${p}" should look like 8080:80, 127.0.0.1:5432:5432 or 53:53/udp.` });
          continue;
        }
        const nums = [m[2], m[3], m[4], m[5]].filter(Boolean).map(Number);
        if (nums.some((n) => n < 1 || n > 65535)) issues.push({ level: "error", message: `${label}: port numbers must be 1 to 65535 in "${p}".` });
        if (m[2]) {
          const from = Number(m[2]);
          const to = m[3] ? Number(m[3]) : from;
          const proto = m[7] ?? "tcp";
          for (let port = from; port <= to && port - from < 1000; port++) {
            const key = `${port}/${proto}`;
            const prev = hostPorts.get(key);
            if (prev && prev !== label) issues.push({ level: "error", message: `Host port ${port}/${proto} is published by both ${prev} and ${label}.` });
            else if (prev === label) issues.push({ level: "error", message: `${label}: host port ${port}/${proto} is published twice.` });
            hostPorts.set(key, label);
          }
        }
      }
    }

    const env = lines(s.env);
    if (env.length) {
      const obj: Record<string, string> = {};
      for (const e of env) {
        const eq = e.indexOf("=");
        if (eq <= 0) {
          issues.push({ level: "error", message: `${label}: environment line "${e}" needs the form KEY=value.` });
          continue;
        }
        obj[e.slice(0, eq).trim()] = e.slice(eq + 1);
      }
      svc.environment = obj;
      if (Object.entries(obj).some(([k, v]) => /PASS|SECRET|TOKEN/i.test(k) && /change-me/i.test(v))) {
        issues.push({ level: "warning", message: `${label}: replace the placeholder passwords, ideally with an .env file or Docker secrets.` });
      }
    }

    const vols = lines(s.volumes);
    if (vols.length) {
      svc.volumes = vols;
      for (const v of vols) {
        const parts = v.split(":");
        if (parts.length < 2 || !parts[1]) {
          if (!v.startsWith("/")) issues.push({ level: "warning", message: `${label}: volume "${v}" has no target, so Docker creates an anonymous volume.` });
          continue;
        }
        const src = parts[0];
        if (NAMED_VOLUME.test(src)) namedVolumes.add(src);
        if (!parts[1].startsWith("/")) issues.push({ level: "error", message: `${label}: the container path in "${v}" must be absolute.` });
      }
    }

    const deps = s.dependsOn
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    if (deps.length) {
      const dep: Record<string, { condition: string }> = {};
      for (const d of deps) {
        const target = services.find((x) => x.name.trim() === d);
        if (!target) issues.push({ level: "error", message: `${label} depends on "${d}", but no service has that name.` });
        if (d === name) issues.push({ level: "error", message: `${label} cannot depend on itself.` });
        dep[d] = { condition: target && target.healthcheck.trim() ? "service_healthy" : "service_started" };
      }
      svc.depends_on = dep;
    }

    if (s.healthcheck.trim()) {
      svc.healthcheck = { test: ["CMD-SHELL", s.healthcheck.trim()], interval: "10s", timeout: "5s", retries: 5, start_period: "20s" };
    }
    if (name) doc.services[name] = svc;
  });

  // dependency cycles
  const graph = new Map(services.map((s) => [s.name.trim(), s.dependsOn.split(",").map((d) => d.trim()).filter(Boolean)]));
  const state = new Map<string, number>();
  const visit = (n: string, path: string[]): boolean => {
    if (state.get(n) === 1) {
      issues.push({ level: "error", message: `Circular depends_on: ${[...path, n].join(" → ")}.` });
      return true;
    }
    if (state.get(n) === 2) return false;
    state.set(n, 1);
    for (const d of graph.get(n) ?? []) if (graph.has(d) && d !== n && visit(d, [...path, n])) return true;
    state.set(n, 2);
    return false;
  };
  for (const n of graph.keys()) if (n && visit(n, [])) break;

  if (namedVolumes.size) {
    doc.volumes = {};
    for (const v of namedVolumes) doc.volumes[v] = {};
  }
  return { doc, issues };
}

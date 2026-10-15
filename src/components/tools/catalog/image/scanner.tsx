"use client";

/**
 * Camera and image scanner shared by the QR code scanner and the barcode
 * scanner. Uses @zxing/browser (loaded on demand). Decoded text is shown as
 * plain text; links open only after an explicit click.
 */

import { useEffect, useRef, useState } from "react";
import { Btn, Checkbox, CopyBtn, EmptyState, Notice, PrivacyNote, Segmented, SelectField, ToolPanel } from "@/components/tools/kit";
import { FileDrop, Spinner } from "@/components/tools/engines/files";
import { errMsg } from "./shared";
import { classifyScan } from "./lib/qr";
import { gs1CheckDigit } from "./lib/barcode";
import { decodeImage, drawScaled } from "./lib/pipeline";

type Mode = "qr" | "barcode";
type Scan = { id: number; text: string; format: string; source: "camera" | "image"; time: string };
type Controls = { stop: () => void };
type Reader = {
  decodeFromVideoDevice: (id: string | undefined, video: HTMLVideoElement, cb: (r: ZResult | undefined) => void) => Promise<Controls>;
  decodeFromCanvas: (c: HTMLCanvasElement) => ZResult;
};
type ZResult = { getText: () => string; getBarcodeFormat: () => number };

const FORMAT_NAMES: Record<string, string> = {
  QR_CODE: "QR code",
  EAN_13: "EAN-13",
  EAN_8: "EAN-8",
  UPC_A: "UPC-A",
  UPC_E: "UPC-E",
  CODE_128: "Code 128",
  CODE_39: "Code 39",
  CODE_93: "Code 93",
  ITF: "ITF",
  CODABAR: "Codabar",
  DATA_MATRIX: "Data Matrix",
  PDF_417: "PDF417",
  AZTEC: "Aztec",
};

async function createReader(mode: Mode): Promise<{ reader: Reader; name: (f: number) => string }> {
  const zb = await import("@zxing/browser");
  const zl = await import("@zxing/library");
  const name = (f: number) => {
    const key = zb.BarcodeFormat[f] as string | undefined;
    return (key && FORMAT_NAMES[key]) || key || "Unknown";
  };
  const hints = new Map<import("@zxing/library").DecodeHintType, unknown>();
  hints.set(zl.DecodeHintType.TRY_HARDER, true);
  if (mode === "qr") {
    hints.set(zl.DecodeHintType.POSSIBLE_FORMATS, [zl.BarcodeFormat.QR_CODE]);
    return { reader: new zb.BrowserQRCodeReader(hints) as unknown as Reader, name };
  }
  const F = zl.BarcodeFormat;
  hints.set(zl.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.CODE_93, F.ITF, F.CODABAR, F.DATA_MATRIX, F.PDF_417, F.QR_CODE, F.AZTEC]);
  return { reader: new zb.BrowserMultiFormatReader(hints) as unknown as Reader, name };
}

function cameraError(e: unknown) {
  const n = (e as { name?: string })?.name;
  if (n === "NotAllowedError" || n === "SecurityError") return "Camera access was blocked. Allow the camera in your browser's site settings, then press Start camera again. You can also scan an image instead.";
  if (n === "NotFoundError" || n === "OverconstrainedError") return "No camera was found on this device. Use the image option instead.";
  if (n === "NotReadableError") return "The camera is in use by another app or tab. Close it and try again.";
  return `The camera could not start: ${errMsg(e)}`;
}

function ResultView({ scan }: { scan: Scan }) {
  const c = classifyScan(scan.text);
  const [showPw, setShowPw] = useState(false);
  const digits = /^\d+$/.test(scan.text) ? scan.text : null;
  const gs1 = digits && ["EAN-13", "EAN-8", "UPC-A"].includes(scan.format) ? gs1CheckDigit(digits.slice(0, -1)) === Number(digits[digits.length - 1]) : null;
  return (
    <li className="space-y-3 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2">
        <span>
          {scan.format} from {scan.source}, {scan.time}
        </span>
        <CopyBtn text={scan.text} />
      </div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-sunken p-3 font-mono text-[0.875rem] text-ink">{scan.text}</pre>
      {gs1 !== null && <p className="text-sm text-ink-2">{gs1 ? "Check digit is valid." : "Check digit does not match; the code may be misread."}</p>}
      {digits && scan.format === "EAN-13" && /^97[89]/.test(digits) && <p className="text-sm text-ink-2">This EAN-13 is an ISBN (book number).</p>}
      {c.kind === "url" && (
        <div className="space-y-2 rounded-lg bg-[color-mix(in_oklch,oklch(0.75_0.15_75)_14%,transparent)] p-3 text-sm">
          <p className="text-ink">
            This code contains a link to <strong>{c.host}</strong>. Check the full address above before opening it; QR codes are a common way to send people to fake sites.
          </p>
          {c.warnings.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-ink">
              {c.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <Btn variant="ghost" icon="external" onClick={() => window.open(c.url, "_blank", "noopener,noreferrer")}>
            Open link in a new tab
          </Btn>
        </div>
      )}
      {c.kind === "wifi" && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Network</dt>
          <dd className="text-ink">{c.ssid || "(none)"}</dd>
          <dt className="text-muted">Security</dt>
          <dd className="text-ink">{c.auth === "nopass" ? "Open" : c.auth}</dd>
          {c.password && (
            <>
              <dt className="text-muted">Password</dt>
              <dd className="flex items-center gap-2 text-ink">
                <span className="font-mono">{showPw ? c.password : "•".repeat(Math.min(12, c.password.length))}</span>
                <button type="button" className="link text-sm" onClick={() => setShowPw((v) => !v)}>
                  {showPw ? "Hide" : "Show"}
                </button>
              </dd>
            </>
          )}
        </dl>
      )}
      {c.kind === "email" && <p className="text-sm text-ink-2">Email address: {c.to}</p>}
      {c.kind === "phone" && <p className="text-sm text-ink-2">Phone number: {c.number}</p>}
      {c.kind === "sms" && <p className="text-sm text-ink-2">Text message to {c.number}{c.message ? `: "${c.message}"` : ""}</p>}
      {c.kind === "vcard" && <p className="text-sm text-ink-2">Contact card (vCard). Copy it into a .vcf file to import it.</p>}
      {c.kind === "geo" && <p className="text-sm text-ink-2">Map location: {c.lat}, {c.lon}</p>}
      {c.kind === "scheme" && <p className="text-sm text-ink-2">This uses the &quot;{c.scheme}:&quot; scheme. It is shown as text only and is not opened from here.</p>}
    </li>
  );
}

export function Scanner({ mode }: { mode: Mode }) {
  const [tab, setTab] = useState<"camera" | "image">("camera");
  const [scans, setScans] = useState<Scan[]>([]);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [devices, setDevices] = useState<{ id: string; label: string }[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [stopOnResult, setStopOnResult] = useState(true);
  const [camError, setCamError] = useState<string | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controls = useRef<Controls | null>(null);
  const counter = useRef(0);

  const stop = () => {
    controls.current?.stop();
    controls.current = null;
    setRunning(false);
  };
  useEffect(() => () => controls.current?.stop(), []);

  const push = (text: string, format: string, source: Scan["source"]) => {
    setScans((prev) => {
      if (prev[0] && prev[0].text === text && prev[0].source === source) return prev;
      counter.current += 1;
      return [{ id: counter.current, text, format, source, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 20);
    });
  };

  const start = async (id?: string) => {
    setCamError(null);
    if (typeof window !== "undefined" && !window.isSecureContext) return setCamError("Camera access needs a secure (https) page.");
    if (!navigator.mediaDevices?.getUserMedia) return setCamError("This browser does not support camera access. Use the image option instead.");
    const video = videoRef.current;
    if (!video) return;
    stop();
    setStarting(true);
    try {
      const { reader, name } = await createReader(mode);
      const ctl = await reader.decodeFromVideoDevice(id || undefined, video, (r) => {
        if (!r) return;
        push(r.getText(), name(r.getBarcodeFormat()), "camera");
        if (stopOnResultRef.current) {
          controls.current?.stop();
          controls.current = null;
          setRunning(false);
        }
      });
      controls.current = ctl;
      setRunning(true);
      const { BrowserCodeReader } = await import("@zxing/browser");
      const list = await BrowserCodeReader.listVideoInputDevices();
      setDevices(list.map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` })));
    } catch (e) {
      setCamError(cameraError(e));
    } finally {
      setStarting(false);
    }
  };

  const stopOnResultRef = useRef(stopOnResult);
  useEffect(() => {
    stopOnResultRef.current = stopOnResult;
  }, [stopOnResult]);

  const scanFile = async (file: File) => {
    setImgError(null);
    setImgBusy(true);
    try {
      const { reader, name } = await createReader(mode);
      const bmp = await decodeImage(file);
      try {
        const big = Math.max(bmp.width, bmp.height);
        const sizes = [Math.min(big, 1600), 800, Math.min(big, 2800)].filter((v, i, a) => v <= big && a.indexOf(v) === i);
        let found: ZResult | null = null;
        for (const s of sizes) {
          const k = s / big;
          try {
            found = reader.decodeFromCanvas(drawScaled(bmp, Math.max(1, Math.round(bmp.width * k)), Math.max(1, Math.round(bmp.height * k))));
            break;
          } catch {
            /* try the next size */
          }
        }
        if (!found) throw new Error(mode === "qr" ? "No QR code was found. Crop closer to the code, make sure it is in focus, and try again." : "No barcode was found. Use a sharp, well-lit image with the whole code visible and a margin around it.");
        push(found.getText(), name(found.getBarcodeFormat()), "image");
      } finally {
        bmp.close();
      }
    } catch (e) {
      setImgError(errMsg(e));
    } finally {
      setImgBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title={mode === "qr" ? "Scan a QR code" : "Scan a barcode"}
        actions={
          <Segmented
            label="Scan source"
            value={tab}
            onChange={(t) => {
              if (t === "image") stop();
              setTab(t);
            }}
            options={[
              { value: "camera", label: "Camera" },
              { value: "image", label: "Image" },
            ]}
          />
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <div className={tab === "camera" ? "space-y-4" : "hidden"}>
              <div className="relative overflow-hidden rounded-xl bg-night">
                <video ref={videoRef} className="block aspect-[4/3] w-full object-cover" muted playsInline aria-label="Camera preview" />
                {!running && (
                  <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-night-ink">
                    {starting ? <Spinner label="Starting camera" /> : "Camera is off"}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {running ? (
                  <Btn variant="ghost" onClick={stop}>
                    Stop camera
                  </Btn>
                ) : (
                  <Btn icon="eye" disabled={starting} onClick={() => start(deviceId)}>
                    Start camera
                  </Btn>
                )}
              </div>
              {devices.length > 1 && (
                <SelectField
                  label="Camera"
                  value={deviceId}
                  onChange={(e) => {
                    setDeviceId(e.target.value);
                    if (running) start(e.target.value);
                  }}
                  options={[{ value: "", label: "Default camera" }, ...devices.map((d) => ({ value: d.id, label: d.label }))]}
                />
              )}
              <Checkbox label="Stop after the first result" checked={stopOnResult} onChange={setStopOnResult} />
              {camError && <Notice tone="error">{camError}</Notice>}
              <p className="text-[0.8125rem] text-muted">Video is processed on this device and never recorded or uploaded. Your browser asks for camera permission the first time.</p>
            </div>
            {tab === "image" && (
              <>
                <FileDrop onFiles={(f) => f[0] && scanFile(f[0])} accept="image/*" maxSizeMB={25} allowPaste label="Choose or paste an image" hint="A photo or screenshot that shows the code clearly." />
                {imgBusy && <Spinner label="Scanning image" />}
                {imgError && <Notice tone="error">{imgError}</Notice>}
              </>
            )}
          </div>
          <div className="min-w-0 space-y-3" aria-live="polite">
            {scans.length ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">Results</p>
                  <Btn variant="subtle" icon="trash" onClick={() => setScans([])}>
                    Clear
                  </Btn>
                </div>
                <ul className="space-y-3">
                  {scans.map((s) => (
                    <ResultView key={s.id} scan={s} />
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState icon={mode === "qr" ? "qr" : "binary"} title="Nothing scanned yet">
                {mode === "qr" ? "Point the camera at a QR code or choose an image." : "Supports EAN, UPC, Code 128, Code 39, ITF, Codabar, Data Matrix, PDF417, QR and Aztec."}
              </EmptyState>
            )}
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}

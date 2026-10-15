"use client";

import { useState } from "react";
import { Btn, EmptyState, Notice, PrivacyNote, Segmented, TextField, ToolPanel } from "@/components/tools/kit";
import { FileChip, FileDrop, ProgressBar, downloadBlob, formatBytes } from "@/components/tools/engines/files";
import { DecryptError, PBKDF2_ITERATIONS, decryptBlob, encryptBlob } from "./lib/envelope";
import { errorText, isAbort, useAbortable } from "./shared";

type Mode = "encrypt" | "decrypt";
type Phase = { kind: "idle" } | { kind: "key" } | { kind: "work"; p: number } | { kind: "done"; blob: Blob; name: string } | { kind: "error"; title: string; text: string };

const MAX_MB = 1024;

export default function Tool() {
  const [mode, setMode] = useState<Mode>("encrypt");
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const { start, cancel } = useAbortable();

  const pwError = touched && !password ? "Enter a password." : null;
  const confirmError = touched && mode === "encrypt" && confirm !== password ? "The passwords do not match." : null;
  const running = phase.kind === "key" || phase.kind === "work";

  const run = async () => {
    setTouched(true);
    if (!file || !password || (mode === "encrypt" && confirm !== password)) return;
    const ctl = start();
    setPhase({ kind: "key" });
    try {
      const onProgress = (d: number, t: number) => setPhase({ kind: "work", p: t ? d / t : 1 });
      if (mode === "encrypt") {
        const parts = await encryptBlob(file, password, { signal: ctl.signal, onProgress });
        setPhase({ kind: "done", blob: new Blob(parts as BlobPart[], { type: "application/octet-stream" }), name: `${file.name}.enc` });
      } else {
        const parts = await decryptBlob(file, password, { signal: ctl.signal, onProgress });
        const name = /\.enc$/i.test(file.name) ? file.name.replace(/\.enc$/i, "") : `${file.name}.decrypted`;
        setPhase({ kind: "done", blob: new Blob(parts as BlobPart[]), name });
      }
    } catch (e) {
      if (isAbort(e)) return setPhase({ kind: "idle" });
      const kind = e instanceof DecryptError ? e.kind : null;
      setPhase({
        kind: "error",
        title: kind === "password" ? "Wrong password" : kind === "corrupt" ? "File damaged or modified" : kind === "format" ? "Not an encrypted file from this tool" : "Could not complete",
        text: errorText(e),
      });
    }
  };

  const pick = (f: File | null) => {
    setFile(f);
    setPhase({ kind: "idle" });
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title="File encryption and decryption"
        actions={
          <Segmented
            label="Mode"
            value={mode}
            onChange={(m) => {
              cancel();
              setMode(m);
              setPhase({ kind: "idle" });
              setTouched(false);
            }}
            options={[
              { value: "encrypt", label: "Encrypt" },
              { value: "decrypt", label: "Decrypt" },
            ]}
          />
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            {file ? (
              <FileChip file={file} onRemove={() => { cancel(); pick(null); }} />
            ) : (
              <FileDrop
                onFiles={(f) => pick(f[0])}
                maxSizeMB={MAX_MB}
                hint={mode === "encrypt" ? `Any file up to ${MAX_MB} MB.` : "A .enc file created by this tool."}
              />
            )}
            {touched && !file && <p className="text-sm text-danger" role="alert">Choose a file first.</p>}
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={pwError} autoComplete={mode === "encrypt" ? "new-password" : "current-password"} />
            {mode === "encrypt" && (
              <TextField label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={confirmError} autoComplete="new-password" />
            )}
            <Btn icon="lock" onClick={() => void run()} disabled={running}>
              {mode === "encrypt" ? "Encrypt file" : "Decrypt file"}
            </Btn>
            <p className="text-[0.8125rem] text-muted">
              AES-256-GCM in 1 MB authenticated chunks, key from PBKDF2-SHA-256 with {PBKDF2_ITERATIONS.toLocaleString("en-US")} iterations.
              The result is held in memory until you download it, so very large files need free RAM.
            </p>
          </div>
          <div className="min-w-0 space-y-4" aria-live="polite">
            {phase.kind === "idle" && (
              <EmptyState icon="lock" title="Nothing processed yet">
                {mode === "encrypt" ? "Choose a file and a strong password." : "Choose the .enc file and enter the password used to encrypt it."}
              </EmptyState>
            )}
            {phase.kind === "key" && <ProgressBar value={0} label="Deriving the key from your password" />}
            {phase.kind === "work" && <ProgressBar value={phase.p} label={mode === "encrypt" ? "Encrypting" : "Decrypting and verifying"} />}
            {running && (
              <Btn variant="ghost" icon="close" onClick={() => { cancel(); setPhase({ kind: "idle" }); }}>
                Cancel
              </Btn>
            )}
            {phase.kind === "error" && (
              <Notice tone="error" title={phase.title}>
                {phase.text}
              </Notice>
            )}
            {phase.kind === "done" && (
              <>
                <Notice tone="success" title={mode === "encrypt" ? "Encrypted" : "Decrypted and verified"}>
                  {phase.name} ({formatBytes(phase.blob.size)}).{" "}
                  {mode === "encrypt" ? "Without the password this file cannot be recovered by anyone, including us." : "Every chunk passed its integrity check."}
                </Notice>
                <Btn icon="download" onClick={() => downloadBlob(phase.blob, phase.name)}>
                  Download {phase.name}
                </Btn>
              </>
            )}
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}

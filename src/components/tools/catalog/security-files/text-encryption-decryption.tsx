"use client";

import { useState } from "react";
import { Btn, CopyBtn, EmptyState, Notice, OutputBlock, PrivacyNote, ResetBtn, Segmented, SplitGrid, TextArea, TextField, ToolPanel, downloadFile, inputCls } from "@/components/tools/kit";
import { Spinner } from "@/components/tools/engines/files";
import { fromBase64, fromUtf8, toBase64, utf8 } from "./lib/encoding";
import { DecryptError, PBKDF2_ITERATIONS, decryptBytes, encryptBytes } from "./lib/envelope";
import { errorText } from "./shared";

type Mode = "encrypt" | "decrypt";

export default function Tool() {
  const [mode, setMode] = useState<Mode>("encrypt");
  const [input, setInput] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<{ mode: Mode; text: string } | null>(null);
  const [error, setError] = useState<{ title: string; text: string } | null>(null);
  const [touched, setTouched] = useState(false);

  const inputError = touched && !input ? (mode === "encrypt" ? "Enter the text to encrypt." : "Paste the encrypted text.") : null;
  const pwError = touched && !password ? "Enter a password." : null;
  const confirmError = touched && mode === "encrypt" && confirm !== password ? "The passwords do not match." : null;

  const run = async () => {
    setTouched(true);
    if (!input || !password || (mode === "encrypt" && confirm !== password)) return;
    setBusy(true);
    setError(null);
    setOutput(null);
    try {
      if (mode === "encrypt") {
        const bytes = await encryptBytes(utf8(input), password);
        setOutput({ mode, text: toBase64(bytes) });
      } else {
        let data: Uint8Array;
        try {
          data = fromBase64(input);
        } catch {
          throw new DecryptError("format", "This is not valid Base64. Paste the full encrypted text without changes.");
        }
        const plain = await decryptBytes(data, password);
        let text: string;
        try {
          text = fromUtf8(plain);
        } catch {
          throw new DecryptError("format", "Decrypted, but the result is not UTF-8 text.");
        }
        setOutput({ mode, text });
      }
    } catch (e) {
      const kind = e instanceof DecryptError ? e.kind : null;
      setError({
        title: kind === "password" ? "Wrong password" : kind === "corrupt" ? "Integrity check failed" : kind === "format" ? "Not recognized" : "Could not complete",
        text: errorText(e),
      });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setInput("");
    setPassword("");
    setConfirm("");
    setOutput(null);
    setError(null);
    setTouched(false);
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title="Text encryption and decryption"
        actions={
          <>
            <Segmented
              label="Mode"
              value={mode}
              onChange={(m) => {
                setMode(m);
                setOutput(null);
                setError(null);
                setTouched(false);
              }}
              options={[
                { value: "encrypt", label: "Encrypt" },
                { value: "decrypt", label: "Decrypt" },
              ]}
            />
            <ResetBtn onClick={reset} />
          </>
        }
      >
        <SplitGrid>
          <div className="min-w-0 space-y-4">
            <TextArea
              label={mode === "encrypt" ? "Text to encrypt" : "Encrypted text (Base64)"}
              mono={mode === "decrypt"}
              rows={8}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              error={inputError}
            />
            <div>
              <label htmlFor="te-pw" className="text-sm font-medium text-ink">
                Password
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="te-pw"
                  type={show ? "text" : "password"}
                  className={`${inputCls} h-11`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "encrypt" ? "new-password" : "current-password"}
                  aria-invalid={pwError ? true : undefined}
                  aria-describedby={pwError ? "te-pw-err" : undefined}
                />
                <Btn variant="ghost" icon="eye" onClick={() => setShow((s) => !s)} aria-pressed={show}>
                  {show ? "Hide" : "Show"}
                </Btn>
              </div>
              {pwError && (
                <p id="te-pw-err" className="mt-2 text-sm text-danger" role="alert">
                  {pwError}
                </p>
              )}
            </div>
            {mode === "encrypt" && (
              <TextField label="Confirm password" type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} error={confirmError} autoComplete="new-password" />
            )}
            <Btn icon="lock" onClick={() => void run()} disabled={busy}>
              {mode === "encrypt" ? "Encrypt" : "Decrypt"}
            </Btn>
            <p className="text-[0.8125rem] text-muted">
              AES-256-GCM with a key derived by PBKDF2-SHA-256 ({PBKDF2_ITERATIONS.toLocaleString("en-US")} iterations, random salt). There is no
              recovery: if you forget the password, the text is gone.
            </p>
          </div>
          <div className="min-w-0 space-y-4" aria-live="polite">
            {busy ? (
              <Spinner label={mode === "encrypt" ? "Deriving key and encrypting" : "Deriving key and decrypting"} />
            ) : error ? (
              <Notice tone="error" title={error.title}>
                {error.text}
              </Notice>
            ) : output ? (
              <>
                <Notice tone="success">{output.mode === "encrypt" ? "Encrypted. Share the text and the password through different channels." : "Decrypted and verified."}</Notice>
                <div className="flex flex-wrap gap-2">
                  <CopyBtn text={output.text} />
                  <Btn
                    variant="ghost"
                    icon="download"
                    onClick={() => downloadFile(output.mode === "encrypt" ? "encrypted.txt" : "decrypted.txt", output.text)}
                  >
                    Download .txt
                  </Btn>
                </div>
                <OutputBlock label={output.mode === "encrypt" ? "Encrypted text" : "Decrypted text"}>
                  <code className="whitespace-pre-wrap break-all">{output.text}</code>
                </OutputBlock>
              </>
            ) : (
              <EmptyState icon="lock" title="No output yet">
                {mode === "encrypt" ? "Enter text and a password, then press Encrypt." : "Paste text produced by this tool and enter its password."}
              </EmptyState>
            )}
          </div>
        </SplitGrid>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}

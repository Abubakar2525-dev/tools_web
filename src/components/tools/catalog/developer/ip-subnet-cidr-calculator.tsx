"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Btn, CopyBtn, Notice, NumberField, PrivacyNote, ResetBtn, Segmented, StatGrid, TextField, ToolPanel, downloadFile, parseNum } from "@/components/tools/kit";
import { bits, classify, expandIPv6, formatIP, groupDigits, ipv4Class, parseCidr, prefixForCount, splitSubnet, subnetInfo, toBinary } from "./lib/cidr";

const EXAMPLES = ["192.168.1.10/24", "10.0.0.0 255.255.252.0", "172.16.5.4/30", "100.64.0.1/10", "2001:db8:abcd:12::1/64", "fe80::1/10"];
const LIST_LIMIT = 1024;

function Row({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-1 border-t border-line py-2.5 sm:grid-cols-[13rem_1fr] sm:items-center">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`flex min-w-0 items-center justify-between gap-2 text-ink ${mono ? "font-mono text-[0.9rem]" : "text-sm"}`}>
        <span className="min-w-0 break-all">{value}</span>
      </dd>
    </div>
  );
}

export default function Tool() {
  const [input, setInput] = useState("192.168.1.10/24");
  const [splitMode, setSplitMode] = useState<"count" | "prefix">("count");
  const [splitValue, setSplitValue] = useState("4");
  const dInput = useDeferredValue(input);

  const parsed = useMemo(() => parseCidr(dInput), [dInput]);
  const info = useMemo(() => ("error" in parsed ? null : subnetInfo(parsed)), [parsed]);

  const split = useMemo(() => {
    if (!info) return null;
    const v = parseNum(splitValue);
    const total = bits(info.family);
    if (v === null || !Number.isInteger(v) || v < 1) return { error: "Enter a whole number of 1 or more." };
    const newPrefix = splitMode === "count" ? prefixForCount(info.prefix, v) : v;
    if (newPrefix < info.prefix) return { error: `The new prefix must be /${info.prefix} or longer.` };
    if (newPrefix > total) return { error: splitMode === "count" ? `/${info.prefix} cannot be split into ${v} subnets (it would need a prefix longer than /${total}).` : `The prefix cannot exceed /${total}.` };
    const count = BigInt(2) ** BigInt(newPrefix - info.prefix);
    const list = splitSubnet(info, newPrefix, LIST_LIMIT);
    return { newPrefix, count, list };
  }, [info, splitMode, splitValue]);

  const splitText =
    info && split && !("error" in split)
      ? split.list.map((s) => `${formatIP(info.family, s.network)}/${split.newPrefix}\t${formatIP(info.family, s.network)} - ${formatIP(info.family, s.last)}`).join("\n")
      : "";

  return (
    <div className="space-y-5">
      <ToolPanel title="Address and prefix" actions={<ResetBtn onClick={() => setInput("")} />}>
        <div className="space-y-4">
          <TextField
            label="IPv4 or IPv6 address with prefix"
            hint="Examples: 192.168.1.10/24, 10.0.0.5 255.255.255.0, 2001:db8::1/48. A bare address is treated as a single host."
            value={input}
            spellCheck={false}
            autoComplete="off"
            error={dInput.trim() && "error" in parsed ? parsed.error : null}
            onChange={(e) => setInput(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((x) => (
              <Btn key={x} variant="ghost" onClick={() => setInput(x)}>
                {x}
              </Btn>
            ))}
          </div>
        </div>
      </ToolPanel>

      {info && (
        <ToolPanel title={`IPv${info.family} subnet`} actions={<CopyBtn text={`${formatIP(info.family, info.network)}/${info.prefix}`} label="Copy CIDR" />}>
          <div className="space-y-5">
            <StatGrid
              items={[
                { label: "Network", value: <span className="break-all font-mono text-base">{`${formatIP(info.family, info.network)}/${info.prefix}`}</span> },
                { label: info.family === 4 ? "Usable hosts" : "Addresses", value: groupDigits(info.family === 4 ? info.usable : info.total) },
                { label: "Total addresses", value: groupDigits(info.total) },
              ]}
            />
            <dl>
              <Row label="Address type" value={classify(info.family, info.address)} mono={false} />
              <Row label="Entered address" value={formatIP(info.family, info.address)} />
              {info.family === 6 && <Row label="Expanded form" value={expandIPv6(info.address)} />}
              <Row label="Network address" value={formatIP(info.family, info.network)} />
              {info.family === 4 && <Row label="Broadcast address" value={info.broadcast !== null ? formatIP(4, info.broadcast) : "None (/31 and /32 have no broadcast)"} mono={info.broadcast !== null} />}
              <Row label={info.family === 4 ? "First usable host" : "First address"} value={formatIP(info.family, info.firstHost)} />
              <Row label={info.family === 4 ? "Last usable host" : "Last address"} value={formatIP(info.family, info.lastHost)} />
              <Row label="Subnet mask" value={info.family === 4 ? `${formatIP(4, info.mask)} (/${info.prefix})` : `${formatIP(6, info.mask)} (/${info.prefix})`} />
              <Row label="Wildcard (inverse) mask" value={formatIP(info.family, info.wildcard)} />
              {info.family === 4 && <Row label="Binary mask" value={toBinary(4, info.mask)} />}
              {info.family === 4 && <Row label="Binary address" value={toBinary(4, info.address)} />}
              {info.family === 4 && <Row label="Historic class" value={ipv4Class(info.address)} mono={false} />}
              {info.family === 4 && <Row label="Reverse DNS zone (whole octets)" value={`${formatIP(4, info.network).split(".").slice(0, Math.max(1, Math.floor(info.prefix / 8))).reverse().join(".")}.in-addr.arpa`} />}
            </dl>
            {info.family === 4 && info.prefix === 31 && <Notice>A /31 has two addresses and no broadcast. Both are usable on point-to-point links (RFC 3021).</Notice>}
            {info.family === 6 && <Notice>IPv6 has no broadcast address, so every address in the range counts. Subnets for LANs are normally /64.</Notice>}
          </div>
        </ToolPanel>
      )}

      {info && (
        <ToolPanel title="Split into smaller subnets">
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <Segmented
                label="Split by"
                value={splitMode}
                onChange={(m) => {
                  setSplitMode(m);
                  setSplitValue(m === "count" ? "4" : String(Math.min(bits(info.family), info.prefix + 2)));
                }}
                options={[
                  { value: "count", label: "Number of subnets" },
                  { value: "prefix", label: "New prefix length" },
                ]}
              />
              <NumberField
                className="w-48"
                label={splitMode === "count" ? "Subnets needed" : "New prefix (/n)"}
                value={splitValue}
                error={split && "error" in split ? split.error : null}
                onChange={(e) => setSplitValue(e.target.value)}
              />
            </div>
            {split && !("error" in split) && (
              <>
                <p className="text-sm text-ink-2">
                  {groupDigits(split.count)} subnets of /{split.newPrefix}, each with {groupDigits(BigInt(2) ** BigInt(bits(info.family) - split.newPrefix))} addresses
                  {splitMode === "count" && parseNum(splitValue) !== Number(split.count) ? " (rounded up to a power of two)" : ""}.
                </p>
                <div className="flex flex-wrap gap-2">
                  <CopyBtn text={splitText} label="Copy list" />
                  <Btn variant="ghost" icon="download" onClick={() => downloadFile("subnets.txt", splitText + "\n")}>
                    Download .txt
                  </Btn>
                </div>
                <div className="max-h-[420px] overflow-auto rounded-lg shadow-[inset_0_0_0_1px_var(--line)]" tabIndex={0} aria-label="Subnet list">
                  <table className="w-full text-left text-[0.875rem]">
                    <thead className="sticky top-0 bg-sunken">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-medium text-muted">
                          #
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium text-muted">
                          Subnet
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium text-muted">
                          Range
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {split.list.map((s, i) => (
                        <tr key={i} className="border-t border-line font-mono">
                          <td className="px-3 py-1.5 font-sans tabular-nums text-muted">{i + 1}</td>
                          <td className="whitespace-nowrap px-3 py-1.5">
                            {formatIP(info.family, s.network)}/{split.newPrefix}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5">
                            {formatIP(info.family, s.network)} to {formatIP(info.family, s.last)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {split.count > BigInt(LIST_LIMIT) && <p className="text-[0.8125rem] text-muted">Showing the first {LIST_LIMIT.toLocaleString()} subnets.</p>}
              </>
            )}
          </div>
        </ToolPanel>
      )}
      <PrivacyNote />
    </div>
  );
}

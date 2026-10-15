"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Btn, Checkbox, Notice, PrivacyNote, SelectField, TextField, ToolPanel, downloadFile } from "@/components/tools/kit";
import { canvasToBlob, downloadBlob } from "@/components/tools/engines/files";
import { ColorField, RangeField, errMsg } from "./shared";
import { BARCODE_FORMATS, validateBarcode, type BarcodeFormat } from "./lib/barcode";
import { qrColorWarning } from "./lib/qr";

const SAMPLES: Record<BarcodeFormat, string> = {
  EAN13: "400638133393",
  EAN8: "9638507",
  UPC: "03600029145",
  ISBN: "978-0-306-40615-7",
  ITF14: "1001234567890",
  CODE128: "ORDER-2026-0042",
  CODE39: "PART 7781-B",
};

export default function Tool() {
  const [format, setFormat] = useState<BarcodeFormat>("EAN13");
  const [value, setValue] = useState(SAMPLES.EAN13);
  const [barWidth, setBarWidth] = useState(2);
  const [height, setHeight] = useState(90);
  const [showText, setShowText] = useState(true);
  const [fontSize, setFontSize] = useState(18);
  const [margin, setMargin] = useState(12);
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");
  const [scale, setScale] = useState(3);
  const [renderError, setRenderError] = useState<{ key: string; msg: string } | null>(null);

  const check = validateBarcode(format, value);
  const info = BARCODE_FORMATS.find((f) => f.value === format);
  const svgRef = useRef<SVGSVGElement>(null);
  const opts = (k = 1) => ({
    format: check.ok ? check.jsFormat : "CODE128",
    width: barWidth * k,
    height: height * k,
    displayValue: showText,
    fontSize: fontSize * k,
    margin: margin * k,
    lineColor: fg,
    background: bg,
    textMargin: 2 * k,
    font: "monospace",
  });
  const key = JSON.stringify([format, value, barWidth, height, showText, fontSize, margin, fg, bg]);

  const val = check.ok ? check.value : null;
  const jsf = check.ok ? check.jsFormat : null;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!val || !jsf) return;
    try {
      JsBarcode(svg, val, { format: jsf, width: barWidth, height, displayValue: showText, fontSize, margin, lineColor: fg, background: bg, textMargin: 2, font: "monospace" });
    } catch (e) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reporting a failure of the external renderer
      setRenderError({ key, msg: errMsg(e) });
    }
  }, [val, jsf, barWidth, height, showText, fontSize, margin, fg, bg, key]);

  const rError = renderError && renderError.key === key ? renderError.msg : null;
  const colorWarn = qrColorWarning(fg, bg);

  const downloadPng = async () => {
    if (!check.ok) return;
    const c = document.createElement("canvas");
    JsBarcode(c, check.value, opts(scale));
    downloadBlob(await canvasToBlob(c, "image/png"), `barcode-${check.value.replace(/[^A-Za-z0-9-]+/g, "_").slice(0, 40)}.png`);
  };
  const downloadSvg = () => {
    const svg = svgRef.current;
    if (!svg || !check.ok) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    downloadFile(`barcode-${check.value.replace(/[^A-Za-z0-9-]+/g, "_").slice(0, 40)}.svg`, new XMLSerializer().serializeToString(clone), "image/svg+xml");
  };

  return (
    <div className="space-y-5">
      <ToolPanel title="Barcode generator">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <SelectField
              label="Barcode type"
              value={format}
              onChange={(e) => {
                const f = e.target.value as BarcodeFormat;
                setFormat(f);
                setValue(SAMPLES[f]);
              }}
              options={BARCODE_FORMATS.map((f) => ({ value: f.value, label: f.label }))}
            />
            <TextField label="Value" value={value} onChange={(e) => setValue(e.target.value)} hint={info?.hint} error={check.ok ? null : check.error} spellCheck={false} autoComplete="off" />
            {check.ok && check.note && <p className="text-sm text-ink-2">{check.note}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <RangeField label="Bar width" value={barWidth} onChange={setBarWidth} min={1} max={5} unit=" px" />
              <RangeField label="Height" value={height} onChange={setHeight} min={30} max={240} unit=" px" />
              <RangeField label="Quiet zone" value={margin} onChange={setMargin} min={0} max={40} unit=" px" />
              <RangeField label="Text size" value={fontSize} onChange={setFontSize} min={10} max={36} unit=" px" />
              <ColorField label="Bar color" value={fg} onChange={setFg} />
              <ColorField label="Background" value={bg} onChange={setBg} />
            </div>
            <Checkbox label="Show human-readable text" checked={showText} onChange={setShowText} />
            {colorWarn && <Notice tone="warning">{colorWarn.replace("QR ", "").replace("code color", "bar color")}</Notice>}
          </div>
          <div className="min-w-0 space-y-4">
            <div className="overflow-x-auto rounded-xl bg-sunken p-4">
              <svg ref={svgRef} role="img" aria-label={check.ok ? `${info?.label} barcode for ${check.value}` : "No barcode"} className={check.ok ? "mx-auto block max-w-none" : "hidden"} />
              {!check.ok && <p className="py-10 text-center text-sm text-muted">Enter a valid value to see the barcode.</p>}
            </div>
            {rError && <Notice tone="error">{rError}</Notice>}
            {check.ok && (
              <>
                <p className="text-sm text-ink-2">
                  Encoded value: <span className="font-mono text-ink">{check.value}</span>
                </p>
                <RangeField label="PNG scale" value={scale} onChange={setScale} min={1} max={8} format={(v) => `${v}× (sharper for print)`} />
                <div className="flex flex-wrap gap-2">
                  <Btn icon="download" onClick={downloadPng}>
                    PNG
                  </Btn>
                  <Btn variant="ghost" icon="download" onClick={downloadSvg}>
                    SVG
                  </Btn>
                </div>
                <p className="text-[0.8125rem] text-muted">Print at 100% scale and test with a scanner. Retail EAN and UPC numbers must be licensed from GS1; this tool only draws the symbol.</p>
              </>
            )}
          </div>
        </div>
      </ToolPanel>
      <PrivacyNote />
    </div>
  );
}

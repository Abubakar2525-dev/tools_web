/** Gzip (RFC 1952) header helpers. */

export const isGzip = (b: Uint8Array) => b.length >= 18 && b[0] === 0x1f && b[1] === 0x8b && b[2] === 0x08;

export interface GzipHeader {
  name: string | null;
  mtime: number | null; // ms
  comment: string | null;
}

/** Reads the optional original file name, comment and modification time. */
export function parseGzipHeader(b: Uint8Array): GzipHeader {
  if (!isGzip(b)) throw new Error("Not gzip data: the file does not start with 1F 8B 08.");
  const flags = b[3];
  const mt = (b[4] | (b[5] << 8) | (b[6] << 16) | (b[7] << 24)) >>> 0;
  let p = 10;
  if (flags & 0x04) p += 2 + (b[p] | (b[p + 1] << 8));
  const readZ = () => {
    const end = b.indexOf(0, p);
    if (end < 0) return null;
    let s = "";
    for (let i = p; i < end; i++) s += String.fromCharCode(b[i]); // ISO 8859-1 per RFC 1952
    p = end + 1;
    return s;
  };
  const name = flags & 0x08 ? readZ() : null;
  const comment = flags & 0x10 ? readZ() : null;
  return { name: name ? name.split(/[\\/]/).pop() || null : null, mtime: mt ? mt * 1000 : null, comment };
}

/** Size of the original data mod 2^32 (ISIZE trailer). Exact for files under 4 GB. */
export function gzipISize(tail4: Uint8Array): number {
  return (tail4[0] | (tail4[1] << 8) | (tail4[2] << 16) | (tail4[3] << 24)) >>> 0;
}

/** Output name for decompression: header name, else the input name without .gz/.tgz. */
export function gunzipName(inputName: string, header: GzipHeader): string {
  if (header.name) return header.name;
  if (/\.tgz$/i.test(inputName)) return inputName.replace(/\.tgz$/i, ".tar");
  if (/\.gz$/i.test(inputName)) return inputName.replace(/\.gz$/i, "");
  return `${inputName}.out`;
}

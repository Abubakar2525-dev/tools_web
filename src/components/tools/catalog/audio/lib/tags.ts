/**
 * Tag form helpers for the metadata editor (pure, testable).
 */
import type { IAudioMetadata } from "music-metadata";

export type TagForm = {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  year: string;
  track: string;
  genre: string;
  comment: string;
};

type CommonLike = Pick<IAudioMetadata["common"], "title" | "artist" | "artists" | "album" | "albumartist" | "year" | "track" | "genre" | "comment">;

export function tagsFromMeta(meta: { common: CommonLike }): TagForm {
  const c = meta.common;
  const track = c.track?.no ? (c.track.of ? `${c.track.no}/${c.track.of}` : String(c.track.no)) : "";
  return {
    title: c.title ?? "",
    artist: c.artists?.length ? c.artists.join("; ") : (c.artist ?? ""),
    album: c.album ?? "",
    albumArtist: c.albumartist ?? "",
    year: c.year ? String(c.year) : "",
    track,
    genre: c.genre?.join("; ") ?? "",
    comment: c.comment?.map((x) => x.text ?? "").filter(Boolean).join("\n") ?? "",
  };
}

export function validateTags(f: TagForm): Partial<Record<keyof TagForm, string>> {
  const e: Partial<Record<keyof TagForm, string>> = {};
  const y = f.year.trim();
  if (y && !/^\d{4}$/.test(y)) e.year = "Use a four-digit year, e.g. 2024.";
  const t = f.track.trim();
  if (t) {
    const m = /^(\d{1,4})(?:\/(\d{1,4}))?$/.exec(t);
    if (!m || Number(m[1]) < 1) e.track = "Use a track number like 3 or 3/12.";
    else if (m[2] && Number(m[2]) < Number(m[1])) e.track = "The total cannot be smaller than the track number.";
  }
  return e;
}

export function isMp3(name: string, mime: string, container?: string): boolean {
  if (container && /mpeg/i.test(container) && !/mp4|mpeg-4/i.test(container)) return true;
  return /\.mp3$/i.test(name) || mime === "audio/mpeg" || mime === "audio/mp3";
}

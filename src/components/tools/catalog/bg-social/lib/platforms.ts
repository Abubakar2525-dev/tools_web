/**
 * Platform reference data for the social-media tools.
 *
 * Sizes and limits follow each platform's published guidance as checked in
 * October 2026. Platforms change these without notice, so every tool states
 * that the values are a snapshot. Values marked "approx." in `note` describe
 * on-screen overlaps (profile photos, timestamps) that platforms do not
 * publish in pixels; they are measured guides, not official numbers.
 */

import type { CountMethod } from "./text-count";

export type PlatformId =
  | "instagram"
  | "x"
  | "facebook"
  | "linkedin"
  | "youtube"
  | "pinterest"
  | "tiktok"
  | "threads"
  | "bluesky"
  | "mastodon";

export const PLATFORM_NAMES: Record<PlatformId, string> = {
  instagram: "Instagram",
  x: "X",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  pinterest: "Pinterest",
  tiktok: "TikTok",
  threads: "Threads",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
};

/* ------------------------------------------------------------------ */
/* Image presets (resizer)                                             */
/* ------------------------------------------------------------------ */

export interface ImagePreset {
  id: string;
  platform: PlatformId;
  label: string;
  w: number;
  h: number;
}

export const IMAGE_PRESETS: ImagePreset[] = [
  { id: "ig-square", platform: "instagram", label: "Feed post, square 1:1", w: 1080, h: 1080 },
  { id: "ig-portrait", platform: "instagram", label: "Feed post, portrait 4:5", w: 1080, h: 1350 },
  { id: "ig-grid", platform: "instagram", label: "Feed post, 3:4 (grid shape)", w: 1080, h: 1440 },
  { id: "ig-landscape", platform: "instagram", label: "Feed post, landscape 1.91:1", w: 1080, h: 566 },
  { id: "ig-story", platform: "instagram", label: "Story or Reel cover 9:16", w: 1080, h: 1920 },
  { id: "ig-profile", platform: "instagram", label: "Profile photo", w: 320, h: 320 },
  { id: "x-landscape", platform: "x", label: "Post image 16:9", w: 1600, h: 900 },
  { id: "x-square", platform: "x", label: "Post image 1:1", w: 1080, h: 1080 },
  { id: "x-header", platform: "x", label: "Profile header 3:1", w: 1500, h: 500 },
  { id: "x-profile", platform: "x", label: "Profile photo", w: 400, h: 400 },
  { id: "fb-feed", platform: "facebook", label: "Feed post 4:5", w: 1080, h: 1350 },
  { id: "fb-link", platform: "facebook", label: "Link or landscape post 1.91:1", w: 1200, h: 630 },
  { id: "fb-story", platform: "facebook", label: "Story 9:16", w: 1080, h: 1920 },
  { id: "fb-cover", platform: "facebook", label: "Page cover 16:9 (full on phones)", w: 1640, h: 924 },
  { id: "fb-profile", platform: "facebook", label: "Profile photo", w: 320, h: 320 },
  { id: "li-landscape", platform: "linkedin", label: "Post image 1.91:1", w: 1200, h: 627 },
  { id: "li-square", platform: "linkedin", label: "Post image 1:1", w: 1080, h: 1080 },
  { id: "li-portrait", platform: "linkedin", label: "Post image 4:5", w: 1080, h: 1350 },
  { id: "li-banner", platform: "linkedin", label: "Personal profile background 4:1", w: 1584, h: 396 },
  { id: "li-company", platform: "linkedin", label: "Company page cover", w: 1128, h: 191 },
  { id: "li-profile", platform: "linkedin", label: "Profile photo", w: 400, h: 400 },
  { id: "yt-thumb", platform: "youtube", label: "Video thumbnail 16:9", w: 1280, h: 720 },
  { id: "yt-banner", platform: "youtube", label: "Channel banner", w: 2560, h: 1440 },
  { id: "yt-profile", platform: "youtube", label: "Channel profile picture", w: 800, h: 800 },
  { id: "pin-standard", platform: "pinterest", label: "Standard pin 2:3", w: 1000, h: 1500 },
  { id: "pin-square", platform: "pinterest", label: "Square pin 1:1", w: 1000, h: 1000 },
  { id: "tt-video", platform: "tiktok", label: "Video or photo 9:16", w: 1080, h: 1920 },
  { id: "tt-profile", platform: "tiktok", label: "Profile photo", w: 200, h: 200 },
];

/* ------------------------------------------------------------------ */
/* Banner / cover presets with safe zones                              */
/* ------------------------------------------------------------------ */

export interface SafeZone {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** "safe": keep content inside; "avoid": something covers this area. */
  kind: "safe" | "avoid";
}

export interface CanvasSize {
  id: string;
  label: string;
  w: number;
  h: number;
  zones: SafeZone[];
  note?: string;
}

export const BANNER_PRESETS: CanvasSize[] = [
  {
    id: "yt-banner",
    label: "YouTube channel banner (2560×1440)",
    w: 2560,
    h: 1440,
    zones: [
      { label: "Desktop strip (2560×423)", x: 0, y: 508, w: 2560, h: 423, kind: "safe" },
      { label: "Tablet (1855×423)", x: 352, y: 508, w: 1855, h: 423, kind: "safe" },
      { label: "All devices: text and logo (1546×423)", x: 507, y: 508, w: 1546, h: 423, kind: "safe" },
    ],
    note: "TVs show the full image; phones and desktops show only the middle strip. YouTube asks for at least 2048×1152 and at most 6 MB.",
  },
  {
    id: "x-header",
    label: "X profile header (1500×500)",
    w: 1500,
    h: 500,
    zones: [
      { label: "Visible on most screens (approx.)", x: 0, y: 60, w: 1500, h: 380, kind: "safe" },
      { label: "Profile photo overlap (approx.)", x: 40, y: 330, w: 330, h: 170, kind: "avoid" },
    ],
    note: "The header is cropped top and bottom on some screen widths, and the profile photo covers the lower left.",
  },
  {
    id: "fb-cover",
    label: "Facebook Page cover (1640×924)",
    w: 1640,
    h: 924,
    zones: [{ label: "Shown on computers (center strip, approx.)", x: 0, y: 150, w: 1640, h: 624, kind: "safe" }],
    note: "Phones show the full 16:9 image; computers show a wider strip (about 820×312 on screen) from the middle.",
  },
  {
    id: "li-banner",
    label: "LinkedIn personal background (1584×396)",
    w: 1584,
    h: 396,
    zones: [{ label: "Profile photo overlap (approx.)", x: 40, y: 170, w: 420, h: 226, kind: "avoid" }],
    note: "Your profile photo sits over the lower left. Keep text right of center.",
  },
  {
    id: "li-company",
    label: "LinkedIn company page cover (1128×191)",
    w: 1128,
    h: 191,
    zones: [{ label: "Logo overlap (approx.)", x: 24, y: 95, w: 170, h: 96, kind: "avoid" }],
    note: "The page logo overlaps the lower left corner.",
  },
  {
    id: "tw-banner",
    label: "Generic web banner (1920×480)",
    w: 1920,
    h: 480,
    zones: [{ label: "Center safe area for cropping", x: 240, y: 40, w: 1440, h: 400, kind: "safe" }],
  },
];

export const YT_THUMB_SIZES: CanvasSize[] = [
  {
    id: "1280",
    label: "1280×720 (classic, smallest file)",
    w: 1280,
    h: 720,
    zones: [
      { label: "Duration badge (approx.)", x: 1110, y: 650, w: 160, h: 60, kind: "avoid" },
      { label: "Watch progress bar (approx.)", x: 0, y: 704, w: 1280, h: 16, kind: "avoid" },
    ],
  },
  {
    id: "1920",
    label: "1920×1080 (full HD)",
    w: 1920,
    h: 1080,
    zones: [
      { label: "Duration badge (approx.)", x: 1665, y: 975, w: 240, h: 90, kind: "avoid" },
      { label: "Watch progress bar (approx.)", x: 0, y: 1056, w: 1920, h: 24, kind: "avoid" },
    ],
  },
  {
    id: "3840",
    label: "3840×2160 (4K, recommended by YouTube)",
    w: 3840,
    h: 2160,
    zones: [
      { label: "Duration badge (approx.)", x: 3330, y: 1950, w: 480, h: 180, kind: "avoid" },
      { label: "Watch progress bar (approx.)", x: 0, y: 2112, w: 3840, h: 48, kind: "avoid" },
    ],
  },
];

export const OG_SIZES: CanvasSize[] = [
  {
    id: "og",
    label: "Open Graph 1200×630",
    w: 1200,
    h: 630,
    zones: [
      { label: "Center square some apps crop to", x: 285, y: 0, w: 630, h: 630, kind: "safe" },
      { label: "Comfortable margin (60 px)", x: 60, y: 60, w: 1080, h: 510, kind: "safe" },
    ],
  },
  {
    id: "x-card",
    label: "X large card 1200×600 (2:1)",
    w: 1200,
    h: 600,
    zones: [{ label: "Comfortable margin (60 px)", x: 60, y: 60, w: 1080, h: 480, kind: "safe" }],
  },
  {
    id: "square",
    label: "Square 1200×1200",
    w: 1200,
    h: 1200,
    zones: [{ label: "Comfortable margin (80 px)", x: 80, y: 80, w: 1040, h: 1040, kind: "safe" }],
  },
];

/** YouTube's upload limit for thumbnails from the mobile app (desktop accepts up to 50 MB). */
export const YT_THUMB_MAX_BYTES = 2 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* Character limits                                                    */
/* ------------------------------------------------------------------ */

export interface CharLimit {
  id: string;
  platform: PlatformId;
  label: string;
  limit: number;
  method: CountMethod;
  /** Shown before the "more" cut in feeds, where the platform truncates. */
  foldAt?: number;
  note?: string;
}

export const CHAR_LIMITS: CharLimit[] = [
  { id: "x-post", platform: "x", label: "X post", limit: 280, method: "x", note: "Weighted count: URLs 23, most CJK and emoji 2." },
  { id: "x-premium", platform: "x", label: "X post (Premium long post)", limit: 25000, method: "x", foldAt: 280 },
  { id: "threads", platform: "threads", label: "Threads post", limit: 500, method: "codepoints" },
  { id: "bluesky", platform: "bluesky", label: "Bluesky post", limit: 300, method: "graphemes", note: "Bluesky counts graphemes (what you see as one character)." },
  { id: "mastodon", platform: "mastodon", label: "Mastodon post (default server)", limit: 500, method: "mastodon", note: "Links count as 23. Servers can raise the limit." },
  { id: "ig-caption", platform: "instagram", label: "Instagram caption", limit: 2200, method: "codepoints", foldAt: 125 },
  { id: "ig-bio", platform: "instagram", label: "Instagram bio", limit: 150, method: "codepoints" },
  { id: "li-post", platform: "linkedin", label: "LinkedIn post", limit: 3000, method: "codepoints", foldAt: 210 },
  { id: "li-headline", platform: "linkedin", label: "LinkedIn headline", limit: 220, method: "codepoints" },
  { id: "fb-post", platform: "facebook", label: "Facebook post", limit: 63206, method: "codepoints", foldAt: 480 },
  { id: "tt-caption", platform: "tiktok", label: "TikTok caption", limit: 4000, method: "codepoints" },
  { id: "yt-title", platform: "youtube", label: "YouTube title", limit: 100, method: "codepoints" },
  { id: "yt-desc", platform: "youtube", label: "YouTube description", limit: 5000, method: "codepoints", foldAt: 150 },
  { id: "pin-title", platform: "pinterest", label: "Pinterest pin title", limit: 100, method: "codepoints" },
  { id: "pin-desc", platform: "pinterest", label: "Pinterest pin description", limit: 500, method: "codepoints" },
];

/* ------------------------------------------------------------------ */
/* Caption rules                                                       */
/* ------------------------------------------------------------------ */

export interface CaptionRule {
  id: PlatformId;
  label: string;
  maxChars: number;
  /** Suggested default hashtag cap; null means no published cap. */
  maxHashtags: number | null;
  hashtagNote: string;
}

export const CAPTION_RULES: CaptionRule[] = [
  { id: "instagram", label: "Instagram", maxChars: 2200, maxHashtags: 5, hashtagNote: "Instagram cut the cap from 30 to 5 hashtags per post in late 2025." },
  { id: "tiktok", label: "TikTok", maxChars: 4000, maxHashtags: null, hashtagNote: "No published hashtag cap; hashtags count toward the caption length." },
  { id: "linkedin", label: "LinkedIn", maxChars: 3000, maxHashtags: null, hashtagNote: "No hard cap; a few relevant tags read best." },
  { id: "facebook", label: "Facebook", maxChars: 63206, maxHashtags: null, hashtagNote: "No hard cap." },
  { id: "x", label: "X", maxChars: 280, maxHashtags: null, hashtagNote: "No cap, but each tag uses weighted characters." },
  { id: "threads", label: "Threads", maxChars: 500, maxHashtags: 1, hashtagNote: "Threads links one topic tag per post." },
];

/* ------------------------------------------------------------------ */
/* Feed truncation (post preview)                                      */
/* ------------------------------------------------------------------ */

export interface FoldRule {
  /** Visible characters before the cut (approximate; platforms vary by screen). */
  maxChars: number;
  /** Visible lines before the cut. */
  maxLines: number;
  moreLabel: string;
}

export const FOLD_RULES: Record<"x" | "instagram" | "linkedin" | "facebook", FoldRule> = {
  x: { maxChars: 280, maxLines: 1000, moreLabel: "Show more" },
  instagram: { maxChars: 125, maxLines: 2, moreLabel: "more" },
  linkedin: { maxChars: 210, maxLines: 3, moreLabel: "more" },
  facebook: { maxChars: 480, maxLines: 5, moreLabel: "See more" },
};

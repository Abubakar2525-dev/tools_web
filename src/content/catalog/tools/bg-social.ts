import type { CatalogTool } from "../types";

const definitions: CatalogTool[] = [
  {
    slug: "background-remover",
    name: "Background remover",
    category: "image",
    icon: "scissors",
    original: true,
    popular: true,
    summary:
      "Cut the subject out of a photo with an open AI model that runs in your browser.",
    h1: "Remove image backgrounds in your browser",
    metaTitle: "Background Remover, Private and In-Browser",
    metaDescription:
      "Remove photo backgrounds with an open-source AI model that runs in your browser. Transparent PNG, color, blur or new image. Up to 10 photos, nothing uploaded.",
    primaryKeyword: "remove background from image",
    intro:
      "Cut out people, products or pets with an openly licensed segmentation model that runs on your own device. Only the model files are downloaded; your photos never leave the browser.",
    instructions: [
      "The recommended **High quality, general** model (BiRefNet lite) is selected by default. Use **Fast, portraits** (MODNet, 25.9 MB) when speed matters more for a people photo.",
      "Choose up to 10 images or paste one. Processing starts automatically; the first run downloads the selected model and shows its progress.",
      "Drag the before/after slider (or use the arrow keys on it) to check the edges, and adjust edge feather and cleanup if needed.",
      "Pick a new background: none (transparent), a color, a blurred copy of the original, or your own image.",
      "Download a single PNG or JPG, or all results as a ZIP.",
    ],
    howItWorks: [
      "The tool runs a salient-object segmentation model with Transformers.js and ONNX Runtime Web, on your GPU through WebGPU when available, otherwise on the CPU through WebAssembly. The AI receives a reduced inference copy, but its soft alpha mask is applied to the native-resolution source canvas so the photo itself is not repeatedly resampled. Only unusually large images above the browser-safe 8,192 px or 48-megapixel canvas limit are reduced.",
      "Two models are offered. **MODNet** (`Xenova/modnet`, Apache-2.0, 25.9 MB) is fast and designed for portraits. **BiRefNet lite** (`onnx-community/BiRefNet_lite-ONNX`, MIT) handles general subjects with finer edges; it downloads 114.5 MB in half precision on GPUs that support it, or 224 MB in full precision otherwise. Both licenses allow commercial use. Your browser caches the files, so later runs skip the download.",
      "Limits: fine hair, glass, smoke and subjects that blend into the background can leave halos or holes. Very large images on phones may run out of memory; the tool reports that and suggests the fast model or a smaller photo. Results are not re-checked by a person, so inspect edges before printing.",
    ],
    example: {
      title: "Product photo on a white background",
      body: "A 3,000×2,000 px JPG of a sneaker on a cluttered desk, processed with the high-quality model and a #ffffff background, saved as JPG.",
      input:
        "sneaker.jpg (3000×2000, 2.4 MB), model: BiRefNet lite, background: color #ffffff",
      output:
        "sneaker-no-bg.jpg (3000×2000) with the shoe on plain white; choosing None instead gives a transparent PNG.",
    },
    faqs: [
      {
        q: "Are my photos uploaded anywhere?",
        a: "No. Segmentation runs in your browser. The only network traffic is the one-time download of the model files from Hugging Face, which your browser then caches.",
      },
      {
        q: "Which model should I use?",
        a: "Start with the fast model for headshots and people. Switch to the high-quality model for products, animals, objects or busy scenes; it is larger and slower but traces edges more closely.",
      },
      {
        q: "Can I use the results commercially?",
        a: "The models are licensed Apache-2.0 (MODNet) and MIT (BiRefNet lite), both of which permit commercial use. You still need the rights to the photo itself.",
      },
      {
        q: "Why is it slow on my laptop?",
        a: "Without WebGPU the lightweight MODNet model runs on the CPU. The larger high-quality model is enabled only when WebGPU is available, avoiding browser memory failures.",
      },
    ],
    related: ["image-cropper", "passport-id-photo-maker", "image-compressor"],
    network:
      "Downloads the background-removal model once from Hugging Face: MODNet (Apache-2.0, 25.9 MB) or BiRefNet lite (MIT, 114.5 MB in fp16 on WebGPU or 224 MB in fp32). Files are cached by your browser. Your images are never uploaded.",
  },
  {
    slug: "social-media-image-resizer",
    name: "Social media image resizer",
    category: "social-media",
    icon: "image",
    popular: true,
    summary:
      "Turn one image into correctly sized versions for Instagram, X, Facebook, LinkedIn, YouTube, Pinterest and TikTok.",
    h1: "Resize one image for every social platform",
    metaTitle: "Social Media Image Resizer for All Platforms",
    metaDescription:
      "Resize one image to Instagram, X, Facebook, LinkedIn, YouTube, Pinterest and TikTok sizes at once. Crop, fit or blur-fill, then download a ZIP.",
    primaryKeyword: "social media image resizer",
    intro:
      "Pick the sizes you need, choose how to handle a different shape, and get every version in one go.",
    instructions: [
      "Choose or paste an image.",
      "Tick the platform sizes you need, or use **Select all**.",
      "Choose a mode: **Fill** crops to the shape (set which part stays visible), **Fit** adds bars, **Fit on blur** puts the whole image over a blurred copy.",
      "Pick JPG, PNG or WebP and press **Create**. Download each image or all of them as a ZIP.",
    ],
    howItWorks: [
      "Each preset is drawn on a canvas at its exact pixel size. Fill scales the image until it covers the frame and crops the overflow at the focus point you set; Fit scales it until it fits entirely and paints bars; Fit on blur draws a blurred, slightly darkened cover copy behind the fitted image so there are no flat bars.",
      "Sizes follow each platform's published guidance as of October 2026, for example Instagram 1080×1350 (4:5) and 1080×1920 stories, X 1600×900 and a 1500×500 header, LinkedIn 1200×627 and 1584×396, YouTube 1280×720 thumbnails and 2560×1440 banners, Pinterest 1000×1500. Platforms revise these, so check before a large campaign.",
      "If a preset is larger than your source, the image is upscaled and marked as such; upscaling cannot add detail. Platforms also recompress uploads, so the file you post may not be the file viewers see.",
    ],
    example: {
      title: "Landscape photo to a portrait feed post",
      body: "A 4000×3000 photo resized to Instagram portrait with Fit on blur keeps the whole frame, filling the top and bottom with a blurred copy.",
      input:
        "beach.jpg (4000×3000), preset Instagram 4:5, mode Fit on blur, JPG 90%",
      output:
        "beach-ig-portrait-1080x1350.jpg: photo scaled to 1080×810, centered on a blurred 1080×1350 background",
    },
    faqs: [
      {
        q: "Which mode should I choose?",
        a: "Fill looks best when the subject is centered and cropping is acceptable. Fit on blur keeps the whole picture without plain bars. Fit with a solid color suits graphics and screenshots.",
      },
      {
        q: "Is my image uploaded?",
        a: "No. Resizing happens on a canvas in your browser, and the ZIP is built locally.",
      },
      {
        q: "Why does my post still look soft after uploading?",
        a: "Platforms recompress images. Uploading at the exact recommended size avoids an extra resize, which usually gives the sharpest result.",
      },
    ],
    related: ["image-resizer", "image-cropper", "social-media-banner-maker"],
  },
  {
    slug: "social-media-banner-maker",
    name: "Social media banner maker",
    category: "social-media",
    icon: "layers",
    summary:
      "Design channel banners and profile headers with text, logos and safe-zone guides for each platform.",
    h1: "Make social media banners with safe-zone guides",
    metaTitle: "Social Media Banner Maker with Safe Zones",
    metaDescription:
      "Create YouTube channel banners, X headers, Facebook covers and LinkedIn backgrounds with text, logos and safe-zone overlays. Export PNG, JPG or WebP.",
    primaryKeyword: "social media banner maker",
    intro:
      "Lay out a cover or header at the right size and see which areas get cropped or covered by your profile photo before you upload.",
    instructions: [
      "Choose a canvas size, such as YouTube channel banner, X header, Facebook cover or LinkedIn background, or enter a custom size.",
      "Set the background: a color, a gradient or your own photo (with zoom, focus, blur and a darken overlay).",
      "Edit the text layers, add more text or a logo, and drag layers into place. Select a layer and use the arrow keys for fine moves.",
      "Keep important content inside the dashed safe zones and out of the red areas, then download a PNG, JPG or WebP.",
    ],
    howItWorks: [
      "The editor draws your layers on an HTML canvas at the exact output size. Text wraps to the width you set and can have an outline, a shadow or a badge box behind it. Safe zones are drawn only in the preview, never in the export.",
      "Safe zones come from platform guidance where it exists: YouTube shows the full 2560×1440 banner on TVs but only a 1546×423 center area on every device. Profile-photo overlaps on X and LinkedIn are not published in pixels, so those areas are marked as approximate.",
      "Text uses fonts available in your browser. The site fonts and common system fonts are offered; a font missing on your system falls back to a similar one.",
    ],
    example: {
      title: "YouTube channel banner",
      body: "A 2560×1440 banner with the channel name centered inside the 1546×423 all-devices area, over a dark gradient.",
      input:
        'Canvas: YouTube channel banner, title "Kitchen Lab", subtitle "New recipes every Friday"',
      output:
        "banner-2560x1440.png with both lines inside the center strip, readable on phones, desktops and TVs",
    },
    faqs: [
      {
        q: "Why does my banner look cropped on my phone?",
        a: "Most platforms show a narrower slice of the banner on small screens. Keep text and logos inside the innermost safe zone so they show everywhere.",
      },
      {
        q: "Are the safe zones exact?",
        a: "YouTube's are published. X, Facebook and LinkedIn overlaps are measured guides and labelled approximate, because layouts vary with screen width.",
      },
      {
        q: "Can I add my logo?",
        a: "Yes. Add a PNG or SVG as an image layer, then set its size, position, corner radius, border and shadow.",
      },
    ],
    related: [
      "youtube-thumbnail-maker",
      "social-media-image-resizer",
      "open-graph-image-generator",
    ],
  },
  {
    slug: "youtube-thumbnail-maker",
    name: "YouTube thumbnail maker",
    category: "social-media",
    icon: "play",
    popular: true,
    summary:
      "Build a 1280×720 YouTube thumbnail with bold outlined text and badges, kept under 2 MB.",
    h1: "Make a YouTube thumbnail under 2 MB",
    metaTitle: "YouTube Thumbnail Maker, 1280×720 Under 2 MB",
    metaDescription:
      "Design a YouTube thumbnail with your image, bold outlined text, badges and a logo. Exports 1280×720 JPG under 2 MB automatically, or PNG. Runs in your browser.",
    primaryKeyword: "youtube thumbnail maker",
    intro:
      "Combine a frame from your video, a punchy headline and a badge, then export a file YouTube accepts on any device.",
    instructions: [
      "Pick an output size: 1280×720 (default), 1920×1080 or 3840×2160.",
      "Set the background to your image, then adjust zoom, focus, blur and darkening for contrast.",
      "Edit the headline and badge, or use **Add badge** and **Add text**. Choose a layout template to reposition them.",
      "Keep text clear of the duration badge area (shown in red), then download a JPG; quality is tuned automatically to stay under 2 MB.",
    ],
    howItWorks: [
      "Text is drawn with a thick rounded outline and an optional shadow so it stays readable at small sizes. Badges are text layers with a rounded box behind them.",
      "For JPG and WebP exports the tool searches for the highest quality that stays under 2 MB: it encodes at 95%, and if the file is too large it binary-searches between 40% and 95%. YouTube's help center lists 2 MB as the thumbnail limit for uploads from the mobile app (desktop uploads accept larger files) and recommends 16:9 with a minimum width of 640 px.",
      "PNG is lossless and cannot be tuned this way, so a detailed PNG may exceed 2 MB; the tool tells you when that happens.",
    ],
    example: {
      title: "Tutorial thumbnail",
      body: 'A screenshot background darkened by 30%, the headline "I tried it for 30 days" in white with a black outline, and a yellow "New" badge.',
      input: "1280×720, JPG, background photo 4032×3024",
      output:
        "youtube-thumbnail-1280x720.jpg at the highest quality that fits; a typical photo thumbnail at this size lands well under 2 MB",
    },
    faqs: [
      {
        q: "What size should a thumbnail be?",
        a: "16:9 with at least 640 px width. 1280×720 is a safe default; YouTube now also recommends larger files such as 3840×2160 when uploading from a computer.",
      },
      {
        q: "Why JPG instead of PNG?",
        a: "Photos compress far better as JPG, which makes staying under 2 MB easy. Use PNG only for flat graphics with few colors.",
      },
      {
        q: "Will the duration badge cover my text?",
        a: "It sits in the bottom-right corner. The red zone in the preview shows roughly where; keep important text elsewhere.",
      },
    ],
    related: [
      "social-media-banner-maker",
      "image-compressor",
      "open-graph-image-generator",
    ],
  },
  {
    slug: "open-graph-image-generator",
    name: "Open Graph image generator",
    category: "social-media",
    icon: "share",
    summary:
      "Create 1200×630 link preview images with a title, subtitle and logo, plus the meta tags.",
    h1: "Generate Open Graph images for link previews",
    metaTitle: "Open Graph Image Generator, 1200×630 PNG",
    metaDescription:
      "Make 1200×630 Open Graph images for link previews with templates, title, subtitle, logo and background. Download PNG or JPG and copy the og:image meta tags.",
    primaryKeyword: "open graph image generator",
    intro:
      "Design the image that appears when someone shares your page, then copy the tags that point to it.",
    instructions: [
      "Choose a size (1200×630 is the standard) and a template: Classic, Centered, Light or Room for a logo.",
      "Edit the site name, title and subtitle layers. Templates keep your text when you switch.",
      "Add a logo as an image layer, or set a background photo with a darken overlay for contrast.",
      "Download PNG or JPG, upload it to your site, and copy the meta tags with your image URL.",
    ],
    howItWorks: [
      'Open Graph is a set of `<meta property="og:...">` tags that apps read to build link previews. `og:image` should be an absolute URL; 1200×630 (about 1.91:1) is the size most platforms render without cropping, and declaring `og:image:width` and `og:image:height` helps them lay out the card before the image loads.',
      "The editor wraps text to the width you set and renders it on a canvas at the exact output size. Safe-zone guides show a comfortable margin and the center square that some chat apps crop to.",
      "Platforms cache previews. After changing an image, use the platform's own sharing debugger or wait for its cache to expire.",
    ],
    example: {
      title: "Blog post card",
      body: 'Classic template, title "How we cut page load time in half", subtitle with the topic, site name in the top left.',
      input: "1200×630, PNG",
      output:
        "og-image-1200x630.png plus tags including og:image:width 1200 and og:image:height 630",
    },
    faqs: [
      {
        q: "PNG or JPG?",
        a: "PNG keeps text crisp on flat backgrounds. Use JPG when the background is a photo, to keep the file small.",
      },
      {
        q: "Why doesn't my new image show when I share the link?",
        a: "The platform cached the old one. Re-scrape the URL with the platform's debugger or wait for the cache to expire.",
      },
      {
        q: "Does X need a separate image?",
        a: "No. With twitter:card set to summary_large_image, X uses og:image when no twitter:image is given.",
      },
    ],
    related: [
      "meta-tag-generator",
      "social-media-banner-maker",
      "social-post-preview",
    ],
  },
  {
    slug: "caption-formatter",
    name: "Caption formatter",
    category: "social-media",
    icon: "text",
    summary:
      "Keep caption line breaks, tidy bullets and clean up hashtags to each platform's limits.",
    h1: "Format captions with line breaks and clean hashtags",
    metaTitle: "Caption Formatter: Line Breaks and Hashtags",
    metaDescription:
      "Format Instagram, TikTok and LinkedIn captions: keep paragraph breaks with invisible spacers, tidy bullets, dedupe hashtags and apply hashtag caps.",
    primaryKeyword: "instagram caption line breaks",
    intro:
      "Paste a caption and get a version whose paragraph breaks survive posting, with bullets and hashtags tidied up.",
    instructions: [
      "Paste or write your caption, or load the sample.",
      "Choose the platform; this sets the character limit and a suggested hashtag cap you can change.",
      "Pick a blank-line spacer and a bullet style, and tick the hashtag cleanups you want.",
      "Copy the formatted caption (or download it) and paste it into the app.",
    ],
    howItWorks: [
      "Some apps drop empty lines or break formatting when a line ends with a space. The formatter trims line ends and replaces each empty line with a line holding one invisible character (by default U+2800, the Braille blank), so the gap is kept.",
      "Hashtags are found with a Unicode-aware pattern (letters, digits and underscores after #). The tool can remove duplicates (case-insensitive), drop number-only tags that most apps don't link, lowercase them, cap their number and move them into a block at the end. Instagram reduced its cap from 30 to 5 hashtags per post in late 2025; Threads links one topic tag per post.",
      "Character counts use Unicode code points, and X's weighted count when X is selected. Platforms change their rules; preview in the app before posting.",
    ],
    example: {
      title: "Instagram caption with a list",
      body: "Repeated tags, a number-only tag and dash bullets become a tidy caption with dot bullets and the unique hashtags in one block at the end.",
      input:
        "New recipe is live! #food #recipe #Food\n\nThree things:\n- roasted garlic\n- lemon #2024",
      output:
        "New recipe is live!\n⠀\nThree things:\n• roasted garlic\n• lemon\n⠀\n#food #recipe",
    },
    faqs: [
      {
        q: "Is the spacer character visible?",
        a: "U+2800 shows as blank space in every major app. If you prefer, choose a visible dot or keep plain empty lines.",
      },
      {
        q: "Does moving hashtags to the end change reach?",
        a: "Platforms don't publish that. The option is about readability; keep tags inline if you prefer.",
      },
      {
        q: "Is my draft saved?",
        a: "Yes, in this browser's local storage only, so it survives a reload. Reset clears it.",
      },
    ],
    related: [
      "social-character-counter",
      "social-post-preview",
      "case-converter",
    ],
  },
  {
    slug: "social-character-counter",
    name: "Social character counter",
    category: "social-media",
    icon: "hash",
    summary:
      "Count characters against every platform's limit, including X's weighted count for links, emoji and CJK.",
    h1: "Count characters for X, Instagram, LinkedIn and more",
    metaTitle: "Social Character Counter with X Weighted Count",
    metaDescription:
      "Check post length against X, Threads, Bluesky, Mastodon, Instagram, LinkedIn, TikTok and YouTube limits, with X's weighted rules: links 23, emoji and CJK 2.",
    primaryKeyword: "twitter character counter",
    intro:
      "Paste a post to see how it measures against each platform's limit, counted the way that platform counts.",
    instructions: [
      "Type or paste your post.",
      "Read the X panel for the weighted count, links and double-weight characters; text past the limit is highlighted.",
      "Tick **Premium long post** if you post long-form on X.",
      "Check the table for every other platform's count, limit and feed cut-off.",
    ],
    howItWorks: [
      "X uses the open-source twitter-text rules (version 3): text is normalized to NFC, every link counts as 23 characters whatever its length, each emoji counts as 2 (including multi-person and flag sequences), characters in the Latin, Greek, Cyrillic, Arabic, Hebrew, Devanagari and similar ranges (U+0000 to U+10FF plus a few punctuation ranges) count as 1, and others such as Chinese, Japanese and Korean count as 2. The limit is 280.",
      "Bluesky counts graphemes (what you see as one character), with a limit of 300. Mastodon counts each link as 23 with a default limit of 500. Other platforms are counted in Unicode code points against their published limits as of October 2026.",
      "Link detection follows twitter-text closely but uses a list of common domain endings rather than every one that exists, so a rare domain without https:// may be counted as plain text.",
    ],
    example: {
      title: "Mixed-language post with a link",
      body: "A post with English text, a long URL, one emoji and Japanese text.",
      input: "Hello 👋 https://example.com/a/very/long/path こんにちは",
      output:
        'X weighted length 43: "Hello " 6 + emoji 2 + space 1 + link 23 + space 1 + 5 Japanese characters × 2 = 10 (43 / 280)',
    },
    faqs: [
      {
        q: "Why does X say my post is longer than it looks?",
        a: "Emoji and CJK characters count as 2 each, and every link counts as 23 even if it is short.",
      },
      {
        q: "Do hashtags and mentions count?",
        a: "Yes, on every platform they count like normal text, including the # or @ sign.",
      },
      {
        q: "What is the feed cut-off?",
        a: "Instagram, LinkedIn and Facebook show only the first part of a long post before a more link. The table shows the approximate point.",
      },
    ],
    related: [
      "caption-formatter",
      "word-and-character-counter",
      "social-post-preview",
    ],
  },
  {
    slug: "social-post-preview",
    name: "Social post preview",
    category: "social-media",
    icon: "eye",
    summary:
      "See how a post looks in neutral X, Instagram, LinkedIn and Facebook style layouts, including the more cut.",
    h1: "Preview your social post before publishing",
    metaTitle: "Social Post Preview with Feed Truncation",
    metaDescription:
      "Preview a post in neutral layouts styled after X, Instagram, LinkedIn and Facebook feeds. See where text folds into more and how images crop.",
    primaryKeyword: "social media post preview",
    intro:
      "Check where your text gets cut off and how your image crops before you post.",
    instructions: [
      "Enter a display name, handle and the post text.",
      "Optionally attach an image and a profile photo (initials are used otherwise).",
      "Switch between the four layouts and light or dark mode.",
      "Use the more link in the preview to expand and collapse the text, and edit until the first lines carry your message.",
    ],
    howItWorks: [
      "Each layout is an original, logo-free card that mimics the structure of a feed: header, text, media and an action row. Hashtags, mentions and links are highlighted.",
      "Text folds where feeds usually cut: about 280 weighted characters on X (for long posts), about 125 characters or 2 lines on Instagram (the username counts), about 210 characters or 3 lines on LinkedIn, and about 480 characters or 5 lines on Facebook. Images are cropped to 16:9, 4:5, 1.91:1 and 1:1 respectively.",
      "Real apps adjust cut points by screen size and change them over time, so treat the fold as a close guide rather than an exact match.",
    ],
    example: {
      title: "LinkedIn-style post",
      body: "A 420-character post with a numbered list in the professional layout.",
      input: "First line: We rebuilt our onboarding from scratch…",
      output:
        "The first 3 lines show, followed by … more; clicking it reveals the full list.",
    },
    faqs: [
      {
        q: "Are these the real app designs?",
        a: "No. They are neutral layouts with similar structure and no logos, meant for checking length and cropping.",
      },
      {
        q: "Is my image uploaded?",
        a: "No. Images are shown from a local object URL and never leave your browser.",
      },
      {
        q: "Why does my post fold earlier in the app?",
        a: "Long words, emoji and narrow screens change where the visual line ends. Put the key message in the first sentence.",
      },
    ],
    related: [
      "social-character-counter",
      "caption-formatter",
      "open-graph-image-generator",
    ],
  },
];

export const tools = definitions.filter((tool) => tool.slug !== "background-remover");

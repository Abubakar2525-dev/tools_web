# Tool inventory

Source of truth for the /tools catalog. Reference: aiengfoundry.com/tools (408 tools across 18 categories, inspected 2026-10-12). The functionality notes are our own paraphrase. All copy and code must be original.

Format: `category | batch | slug | display name | functionality to implement`. Tool pages live at `/tools/<slug>`.

Rows with batch `existing` or `alias` are already built: do not rebuild them, but you may reference their slugs in `related`.

pdf | pdf-a | pdf-editor | PDF Editor | preview PDF pages; add, move, resize and delete text, pen strokes, highlights, rectangles and arrows; rotate views; export edits in the browser
pdf | pdf-a | pdf-to-image | PDF to image | PDF pages to JPG/PNG/WebP; choose resolution (DPI), page range; single download or ZIP
pdf | pdf-a | pdf-to-text | PDF to text | extract the text layer to .txt, page separators; no OCR
pdf | pdf-a | pdf-to-markdown | PDF to Markdown | text to Markdown; infer headings from font size, keep bullet/numbered lists
pdf | pdf-a | image-to-pdf | Image to PDF | JPG/PNG/WebP images into one PDF; page size (fit/A4/Letter), orientation, margin, order
pdf | pdf-a | text-to-pdf | Text to PDF | plain text into paginated PDF; page size, font size, margins, wrapping
pdf | pdf-a | email-eml-to-pdf | Email (.eml) to PDF | parse .eml (headers, plain/HTML body, attachment names) into a readable PDF
pdf | pdf-a | document-scanner | Document scanner | camera capture or photo; drag 4 corners for perspective correction; B&W/grayscale cleanup; multi-page PDF
pdf | pdf-a | merge-pdf | Merge PDF | combine multiple PDFs in chosen order
pdf | pdf-a | split-pdf | Split PDF | split into single pages, every N pages, or custom ranges; ZIP download
pdf | pdf-a | extract-pdf-pages | Extract PDF pages | new PDF from selected pages (click thumbnails or type ranges)
pdf | pdf-a | delete-pdf-pages | Delete PDF pages | remove selected pages (thumbnails, ranges, odd/even)
pdf | pdf-a | rotate-pdf | Rotate PDF | rotate all or individual pages 90/180/270
pdf | pdf-a | reorder-pdf-pages | Reorder PDF pages | rearrange pages with thumbnail move up/down (keyboard accessible)
pdf | pdf-a | duplicate-pdf-pages | Duplicate PDF pages | copy selected pages, inserted right after the originals
pdf | pdf-a | reverse-pdf-pages | Reverse PDF pages | reverse page order
pdf | pdf-a | pdf-booklet-maker | PDF booklet maker | impose pages in saddle-stitch order, 2-up on landscape sheets for duplex printing; pad with blanks to multiple of 4
pdf | pdf-a | pdf-poster-maker-tile-pages | PDF poster maker (tile pages) | enlarge one page across N×M sheets with overlap and labelled tiles to tape together
pdf | pdf-a | pdf-n-up-contact-sheet | PDF N-up / contact sheet | 2, 4, 6 or 9 pages per sheet
pdf | pdf-a | pdf-thumbnail-and-preview-generator | PDF thumbnail & preview generator | PNG preview per page at chosen width; ZIP
pdf | pdf-a | pdf-info-pages-size-version | PDF info (pages, size, version) | page count, file size, PDF version, page dimensions, metadata, encryption flag
pdf | pdf-b | add-text-to-pdf | Add text to PDF | click on page preview to place text; font size, color; download edited PDF
pdf | pdf-b | add-image-to-pdf | Add image to PDF | place PNG/JPG logo or stamp by clicking; size control
pdf | pdf-b | sign-pdf | Sign PDF | draw signature (pointer/touch), or type it; place on page; optional date stamp
pdf | pdf-b | add-links-to-pdf | Add links to PDF | draw rectangles on pages and attach URLs (link annotations)
pdf | pdf-b | add-watermark-to-pdf | Add watermark to PDF | diagonal or custom-angle text watermark; opacity, size, color
pdf | pdf-b | add-page-numbers | Add page numbers to PDF | format like "Page {n} of {total}", position, start number, font size, skip first page
pdf | pdf-b | add-header-and-footer | Add header & footer to PDF | left/center/right header and footer text with {page}/{total}/{date} tokens
pdf | pdf-b | add-margins-to-pdf | Add margins to PDF | add blank margins by scaling content inside unchanged page size
pdf | pdf-b | resize-pdf-pages | Resize PDF pages | resize pages to A4/Letter/Legal/A3/A5 with fit scaling
pdf | pdf-b | crop-pdf | Crop PDF | trim a percentage (or points) from each side via crop box
pdf | pdf-b | annotate-pdf | Annotate PDF | highlight rectangles, boxes, arrows and text comments drawn on page previews; flatten into PDF
pdf | pdf-b | pdf-form-filler | PDF form filler | list AcroForm fields (text, checkbox, radio, dropdown), fill, save; optional flatten
pdf | pdf-b | pdf-metadata-viewer-and-editor | PDF metadata viewer & editor | view/edit title, author, subject, keywords, creator, producer, dates; strip all
pdf | pdf-b | pdf-image-extractor | PDF image extractor | extract embedded raster images (via pdf.js operator list) at native size; ZIP
pdf | pdf-b | compare-pdfs | Compare PDFs | extract text from two PDFs and show line-by-line diff with highlights
image | image | svg-viewer | SVG viewer & converter | preview SVG safely; export PNG at scale, data URI, CSS background, img tag
image | image | image-converter | Image converter | convert between JPG, PNG, WebP, AVIF (where browser can encode), BMP, GIF (first frame), HEIC input; batch; ZIP
image | image | heic-to-jpg-png-webp | HEIC to JPG / PNG / WebP | batch HEIC/HEIF decode (heic2any) to JPG/PNG/WebP
image | image | favicon-and-ico-generator | Favicon & ICO generator | from image or letter+colors: multi-size favicon.ico (16/32/48), PNG icons (180, 192, 512), site.webmanifest, HTML snippet; ZIP
image | image | image-to-base64 | Image ↔ Base64 converter | image to data URI with CSS/HTML/Markdown snippets; decode Base64 back to image download
image | image | image-compressor | Image compressor | JPG/WebP/AVIF quality or target size (binary search on quality); batch; before/after sizes
image | image | image-resizer | Image resizer | exact px, percentage, or fit within box; keep aspect; batch; output format
image | image | image-cropper | Image cropper | drag crop box; aspect presets (1:1, 4:3, 16:9, custom, free); zoom; rotate; circle crop to PNG
image | image | rotate-and-flip-image | Rotate & flip image | rotate 90/180/270, flip H/V, fine straighten ±45° with auto-crop option
image | image | photo-adjustments | Photo adjustments | brightness, contrast, saturation, hue, temperature, exposure with live preview
image | image | photo-effects | Photo effects | blur, sharpen, pixelate, sepia, grayscale, negative, vignette
image | image | image-noise-reduction | Image noise reduction | median / smoothing filter strength; speck removal for scans
image | image | add-border-and-rounded-corners | Add border & rounded corners | border width/color, corner radius, padding, drop shadow; transparent PNG
image | image | image-watermark | Image watermark | text or logo watermark, position/tile, opacity, size; batch; ZIP
image | image | screenshot-annotator | Screenshot annotator | arrows, rectangles, text, numbered step markers, blur/pixelate boxes; undo; export PNG
image | image | image-to-text-ocr | Image to text (OCR) | tesseract.js OCR in browser (self-hosted worker/core; language data downloads from a CDN, disclose); copy/download .txt; multiple languages
image | image | exif-viewer-and-remover | EXIF viewer & remover | read EXIF/GPS/camera data (exifr); remove metadata from JPG/PNG losslessly by stripping segments/chunks; batch
image | image | image-dimensions-and-dpi-checker | Image dimensions & DPI checker | pixel size, aspect ratio, megapixels, DPI read; rewrite JPG JFIF density / PNG pHYs without re-encoding
image | image | duplicate-image-finder | Duplicate image finder | exact (SHA-256) and similar (dHash Hamming distance) duplicates in a batch; grouped results
image | image | passport-id-photo-maker | Passport & ID photo maker | presets (US 2x2in, UK/EU 35x45mm, India, Canada, China, Schengen...), crop with head guide, background color; single photo + 4x6in print sheet at 300 DPI
image | image | qr-code-generator | QR code generator | URL, text, Wi-Fi, email, phone, SMS, vCard; error correction, colors, margin; PNG/SVG download
image | image | bulk-qr-code-generator | Bulk QR code generator | list of URLs/text (one per line or CSV) to ZIP of PNG/SVG with filenames
image | image | qr-code-scanner | QR code scanner | scan from camera (getUserMedia) or image file/paste; show content safely, link only after confirmation
image | image | barcode-generator | Barcode generator | EAN-13, EAN-8, UPC-A, ISBN (EAN-13), Code 128, Code 39, ITF-14 with checksum validation; PNG/SVG
image | image | barcode-scanner | Barcode scanner | camera or image; EAN/UPC/Code 128/Code 39/ITF/Data Matrix/PDF417/QR via @zxing
audio | audio | audio-trimmer | Audio trimmer | waveform with draggable start/end, preview, export WAV or MP3
audio | audio | audio-merger | Audio merger | join files in order; optional gap or crossfade; resample to common rate; export
audio | audio | audio-splitter | Audio splitter | split at marked points, equal parts, fixed interval, or detected silences; ZIP
audio | audio | volume-changer-and-normalizer | Volume changer & normalizer | gain in dB, peak normalize, or loudness target (LUFS, ITU-R BS.1770 K-weighting) with limiter
audio | audio | audio-fade-in-out | Audio fade in / out | fade in/out durations with linear, exponential, logarithmic, S-curve shapes; preview
audio | audio | audio-speed-changer | Audio speed changer | 0.25x-4x; keep pitch (time-stretch, e.g. WSOLA) or tape-style (resample)
audio | audio | audio-pitch-changer | Audio pitch changer | shift semitones and cents preserving duration (time-stretch + resample)
audio | audio | reverse-audio | Reverse audio | reverse samples; export WAV/MP3
audio | audio | silence-remover-and-detector | Silence remover & detector | threshold dB and minimum duration; list silent regions; remove or shorten to N ms
audio | audio | voice-recorder | Voice recorder | MediaRecorder from microphone with level meter, pause, playback; download original (webm/ogg), WAV or MP3
audio | audio | audio-waveform-generator | Audio waveform generator | render waveform image (bars/line, colors, size); PNG or SVG
audio | audio | audio-spectrogram | Audio spectrogram | STFT spectrogram from file or live microphone; color map; export PNG
audio | audio | audio-metadata-and-id3-tag-editor | Audio metadata & ID3 tag editor | show duration/codec/bitrate/sample rate (music-metadata); edit MP3 ID3 tags (title, artist, album, year, track, genre, cover) without re-encoding
audio | audio | album-art-extractor | Album art extractor | extract embedded cover art from MP3/FLAC/M4A/OGG; download images or ZIP
audio | audio | audio-bitrate-and-file-size-calculator | Audio bitrate & file-size calculator | solve size/bitrate/duration; compare MP3/AAC/FLAC/WAV typical sizes
text | text | readability-checker | Readability checker | Flesch reading ease, Flesch-Kincaid grade, Gunning fog, SMOG, Coleman-Liau, ARI; flag long sentences
text | text | word-frequency-counter | Word frequency counter | word and 2-3 word phrase frequency, stop-word filter, case options, CSV export
text | text | essay-word-count-planner | Essay word-count planner | split target words across sections by %; page estimates by spacing/font
text | text | case-converter | Case converter | upper, lower, title, sentence, camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, alternating, inverse; per line
text | text | text-cleaner | Text cleaner | remove extra spaces, zero-width/invisible chars, HTML tags, smart quotes to straight, rejoin hard-wrapped lines
text | text | remove-duplicate-lines | Remove duplicate lines | keep first occurrence; case-insensitive and trim options; report removed count
text | text | remove-empty-lines | Remove empty lines | remove all blank lines or collapse runs to one; whitespace-only counts as empty option
text | text | remove-extra-spaces | Remove extra spaces | collapse multiple spaces, trim line ends, remove all spaces, tabs to spaces; keep line breaks
text | text | sort-lines | Sort lines | alphabetical (locale), natural numeric, by length, reverse, case-insensitive, unique
text | text | shuffle-lines | Shuffle lines | Fisher-Yates with crypto.getRandomValues
text | text | reverse-text | Reverse text | reverse characters (grapheme-aware), words, or line order
text | text | number-lines | Number lines | start, step, separator, padding, skip empty lines
text | text | add-prefix-suffix-to-lines | Add prefix / suffix to lines | add text to start/end of each line; skip empty lines
text | text | text-splitter-and-joiner | Text splitter & joiner | split by delimiter (comma, tab, custom, regex) into lines; join lines with delimiter, quote option
text | text | text-length-limiter | Text length limiter | truncate to N characters or words, at word boundary, with ellipsis; per line option
text | text | find-and-replace | Find & replace | plain or regex, case sensitivity, whole word, replace all, match count
text | text | diff-checker | Diff checker | side-by-side and inline diff (jsdiff) by line/word/char; ignore whitespace/case; export unified .diff
text | text | markdown-to-html-converter | Markdown ↔ HTML converter | Markdown to HTML (marked) with sanitized preview (DOMPurify); HTML to Markdown (turndown)
text | text | markdown-editor-and-formatter | Markdown editor & formatter | toolbar (bold, italic, heading, list, link, code, table), live preview, format with prettier standalone markdown parser, autosave locally
text | text | html-to-plain-text | HTML to plain text converter | strip tags keeping paragraphs, line breaks, lists as bullets, tables as tab-separated, links as text (url) option
text | text | text-to-html | Text to HTML converter | paragraphs to <p>, line breaks <br>, escape entities, autolink URLs
text | text | text-to-csv | Text ↔ CSV converter | delimited text to CSV (proper quoting); CSV to aligned columns, Markdown table, or TSV (papaparse)
text | text | text-to-binary | Text ↔ binary converter | UTF-8 bytes to 8-bit binary groups and back; separator options
text | text | text-to-hex | Text ↔ hex converter | UTF-8 bytes to hex and back; spacing/prefix options
text | text | text-to-ascii-codes | Text ↔ ASCII codes converter | decimal code points (or UTF-8 bytes) and back
text | text | rot13-encoder-decoder | ROT13 encoder / decoder | ROT13, plus ROT5/ROT18/ROT47 options
text | text | morse-code-translator | Morse code translator | text to International Morse and back; play audio via Web Audio with WPM speed
text | text | unicode-inspector-and-converter | Unicode inspector & converter | per-character code point, category, UTF-8/UTF-16 bytes, find invisible/confusable chars; convert to/from \u escapes, HTML entities, normalization NFC/NFD/NFKC
text | text | emoji-translator | Emoji translator | map words to emoji via an original built-in dictionary (~300 words); add after word or replace
text | text | lorem-ipsum-generator | Lorem ipsum generator | paragraphs, sentences, words or list items; start with "Lorem ipsum"; HTML tags option
text | text | username-generator | Username generator | adjective+noun combos with numbers/separators, length limits, style; crypto random; avoid offensive words
text | text | random-name-generator | Random name generator | first/last names from diverse built-in lists, style filters, count; copy as list/CSV
text | text | phone-number-formatter | Phone number formatter & validator | libphonenumber-js: parse, validate, format E.164/international/national per country; batch lines
text | text | postal-zip-code-formatter | Postal / ZIP code formatter | validate and format postal codes for ~28 countries with regex rules and normalization
research | research-web | apa-citation-generator | APA citation generator | APA 7 reference + in-text (parenthetical/narrative) for book, journal article, website, chapter, report; editable output
research | research-web | mla-citation-generator | MLA citation generator | MLA 9 works-cited + in-text
research | research-web | chicago-citation-generator | Chicago citation generator | Chicago 18 notes-bibliography (full note, short note, bibliography) and author-date
research | research-web | harvard-citation-generator | Harvard citation generator | Harvard (Cite Them Right style) reference + in-text
research | research-web | ieee-citation-generator | IEEE citation generator | numbered IEEE references
research | research-web | bibtex-generator | BibTeX generator | form to BibTeX entry with citation key; parse pasted BibTeX and render in APA/MLA/Chicago/Harvard/IEEE
research | research-web | reference-list-generator | Reference list generator | collect sources (form or BibTeX import), choose style, sorted bibliography; copy or export .bib; saved locally
research | research-web | literature-matrix | Literature matrix | table of sources (author, year, aim, method, findings, gaps, notes); saved locally; CSV export/import
web | research-web | url-encoder-decoder | URL encoder / decoder | encodeURIComponent/encodeURI, decode, + as space option, UTF-8
web | research-web | url-parser | URL parser | protocol, host, port, path, query params decoded table, hash; export JSON
web | research-web | utm-builder | UTM builder | source/medium/campaign/term/content; validate URL; copy; presets
web | research-web | url-tracking-cleaner | URL tracking cleaner | strip utm_*, fbclid, gclid, mc_eid etc.; unwrap google.com/url and l.facebook.com redirects; batch
web | research-web | slug-generator | Slug generator | transliterate accents, lowercase, separator choice, remove stop words, max length
web | research-web | domain-name-generator | Domain name generator | brandable combos from keywords with prefixes/suffixes and TLD list; note availability isn't checked (no network)
web | research-web | meta-tag-generator | Meta tag generator | title, description, canonical, robots, viewport tags with length warnings and search-result preview
web | research-web | open-graph-and-twitter-card-generator | Open Graph & Twitter card generator | og:* and twitter:* tags with a link-preview card
web | research-web | schema-json-ld-generator | Schema / JSON-LD generator | Organization, LocalBusiness, Article, Product, FAQPage, BreadcrumbList, Event, Person, WebSite; valid JSON-LD script output
web | research-web | robotstxt-generator | Robots.txt generator | user-agent rules, allow/disallow, AI crawler blocks (GPTBot, ClaudeBot, Google-Extended, CCBot...), sitemaps; test a URL path against rules
web | research-web | keyword-density-checker | Keyword density checker | paste text or HTML; keyword/phrase frequency and density; check title/H1/meta when HTML pasted
calculators | calc-math | basic-calculator | Basic calculator | keypad + keyboard input, brackets, percent, history; exact decimals (mathjs bignumber or decimal arithmetic)
calculators | calc-math | scientific-calculator | Scientific calculator | trig (deg/rad), inverse, log/ln, powers, roots, factorial, constants, memory, history (mathjs)
calculators | calc-math | ratio-and-proportion-calculator | Ratio & proportion calculator | simplify ratios, solve a:b = c:x, divide an amount by a ratio
calculators | calc-math | fraction-calculator | Fraction calculator | exact fraction/mixed number + − × ÷, simplified, decimal and percent
calculators | calc-math | exponent-calculator | Exponent calculator | exact big integer powers (BigInt), negative and fractional exponents
calculators | calc-math | root-calculator | Root calculator | nth roots to high precision (mathjs bignumber), simplified radicals
calculators | calc-math | logarithm-calculator | Logarithm calculator | any base, change of base steps, solve for argument or base
calculators | calc-math | factorial-calculator | Factorial calculator | exact n! and n!! with BigInt, digit count, trailing zeros
calculators | calc-math | prime-number-checker-and-generator | Prime number checker & generator | primality (BigInt Miller-Rabin), next/previous prime, list primes in range (sieve)
calculators | calc-math | prime-factorization-calculator | Prime factorization calculator | factor tree/exponent form, all divisors, divisor count/sum
calculators | calc-math | lcm-and-gcd-calculator | LCM & GCD calculator | multiple numbers, Euclid steps
calculators | calc-math | fibonacci-calculator | Fibonacci calculator | nth Fibonacci (BigInt, fast doubling), sequence listing, membership test (5n²±4)
calculators | calc-math | permutation-and-combination-calculator | Permutation & combination calculator | nPr, nCr with/without repetition, BigInt exact
calculators | calc-math | probability-calculator | Probability calculator | single events, A and/or B, at least once over n trials, binomial P(X=k), P(X≤k)
calculators | calc-math | equation-solver | Equation solver | linear/polynomial (numeric roots, real & complex), exponential/trig via numeric solve in range, systems of linear equations (mathjs)
calculators | calc-math | quadratic-equation-solver | Quadratic equation solver | roots (exact surd form where possible, complex), discriminant, vertex, axis, factored form, SVG graph
calculators | calc-math | matrix-calculator | Matrix calculator | add, multiply, transpose, determinant, inverse, rank, RREF up to 8x8 with fractions
calculators | calc-math | sequence-calculator | Sequence calculator | arithmetic/geometric nth term & sum, identify sequence type from terms
calculators | calc-math | series-calculator | Series calculator | arithmetic, geometric (incl. infinite convergence), sum of expression over k range (mathjs)
calculators | calc-math | derivative-calculator | Derivative calculator | symbolic derivative (mathjs derivative) up to 3rd order, simplify, evaluate at point
calculators | calc-math | vector-calculator | Vector calculator | 2D/3D add, subtract, dot, cross, magnitude, unit, angle, projection
calculators | calc-math | number-base-calculator | Number base calculator | arithmetic in bases 2-36, two's complement for bit widths, bitwise AND/OR/XOR/NOT/shifts
calculators | calc-math | mean-median-and-mode-calculator | Mean, median & mode calculator | mean, median, mode(s), range, quartiles (method noted), IQR, skewness from data list
calculators | calc-math | standard-deviation-and-variance-calculator | Standard deviation & variance calculator | sample vs population with step table
calculators | calc-math | z-score-calculator | Z-score calculator | z from x, μ, σ; normal probabilities (left/right/between); percentile ↔ z
calculators | calc-math | confidence-interval-calculator | Confidence interval calculator | mean (t or z) and proportion (Wald, Wilson) intervals
calculators | calc-math | p-value-calculator | P-value calculator | from z, t (df), chi-square (df); one/two-tailed; accurate distribution functions
calculators | calc-math | effect-size-calculator | Effect size calculator | Cohen's d, Hedges' g, Glass's Δ from means/SDs/n
calculators | calc-math | sample-size-calculator | Sample size calculator | survey proportion with finite population correction, mean estimate, two-group power analysis
calculators | calc-math | regression-calculator | Regression calculator | least squares line, r, R², slope SE & p-value, residuals, SVG scatter plot with line
calculators | calc-science | area-calculator | Area calculator | square, rectangle, triangle, circle, ellipse, trapezoid, parallelogram, sector, regular polygon; area and perimeter
calculators | calc-science | circle-calculator | Circle calculator | from radius, diameter, circumference or area derive the rest
calculators | calc-science | triangle-calculator | Triangle calculator | SSS, SAS, ASA, AAS, SSA (ambiguous case) solve; area, perimeter, type; SVG drawing
calculators | calc-science | volume-and-surface-area-calculator | Volume & surface area calculator | cube, cuboid, sphere, hemisphere, cylinder, cone, pyramid, prism, torus
calculators | calc-science | pythagorean-theorem-calculator | Pythagorean theorem calculator | missing side with steps
calculators | calc-science | speed-distance-and-time-calculator | Speed, distance & time calculator | solve any one with mixed units
calculators | calc-science | acceleration-calculator | Acceleration calculator | from Δv/t, F/m, or kinematics with distance
calculators | calc-science | force-calculator | Force calculator | F=ma solve any variable; weight from mass and g (planet presets)
calculators | calc-science | momentum-calculator | Momentum calculator | p=mv and impulse J=FΔt=Δp
calculators | calc-science | energy-calculator | Energy calculator | kinetic and gravitational potential, unit outputs (J, kJ, cal, kWh, eV)
calculators | calc-science | power-calculator | Power calculator | P=W/t, P=Fv, electrical P=VI, unit conversions (W, kW, hp)
calculators | calc-science | pressure-calculator | Pressure calculator | P=F/A, hydrostatic P=ρgh, units
calculators | calc-science | density-calculator | Density calculator | ρ=m/V solve any, units
calculators | calc-science | work-calculator | Work calculator | W=Fd cosθ
calculators | calc-science | projectile-motion-calculator | Projectile motion calculator | range, max height, flight time, impact speed, launch height; SVG trajectory
calculators | calc-science | gravitational-force-calculator | Gravitational force calculator | F=Gm1m2/r², field strength g=GM/r²
calculators | calc-science | wavelength-calculator | Wavelength calculator | λ=v/f, photon energy E=hc/λ, EM spectrum band
calculators | calc-science | frequency-calculator | Frequency calculator | f=1/T, ω=2πf, f=v/λ
calculators | calc-science | molarity-calculator | Molarity calculator | M=n/V, mass needed, dilution c1V1=c2V2
calculators | calc-science | molecular-weight-calculator | Molecular weight calculator | parse formulas incl. parentheses, hydrates (·5H2O), percent composition; IUPAC standard atomic weights table
calculators | calc-science | ph-calculator | pH calculator | pH, pOH, [H+], [OH-]; strong acids/bases and weak via Ka/Kb
calculators | calc-science | mole-calculator | Mole calculator | grams ↔ moles ↔ particles (Avogadro), uses molar mass from formula
calculators | calc-science | concentration-calculator | Concentration calculator | % w/w, % w/v, % v/v, ppm, ppb, g/L, mol/L conversions
calculators | calc-science | stoichiometry-calculator | Stoichiometry calculator | balanced equation + reactant amounts → limiting reagent, theoretical and percent yield
calculators | calc-science | chemical-equation-balancer | Chemical equation balancer | matrix nullspace with exact rational arithmetic; charges (e-, ions); atom count check table
calculators | calc-science | ideal-gas-law-calculator | Ideal gas law calculator | PV=nRT solve any with units; combined gas law
calculators | calc-science | half-life-calculator | Half-life calculator | N=N0(1/2)^(t/T); solve remaining, elapsed time, half-life; decay constant
calculators | calc-science | periodic-table | Periodic table | interactive 118 elements (symbol, name, number, atomic weight, category, group/period, electron configuration); search; keyboard accessible; shares atomic weights data with molecular weight
calculators | calc-eng | ohms-law-calculator | Ohm's law calculator | V, I, R, P from any two
calculators | calc-eng | resistance-calculator | Series & parallel resistance calculator | list resistors; series and parallel totals
calculators | calc-eng | coulombs-law-calculator | Coulomb's law calculator | F=kq1q2/r², attraction/repulsion, units (C, μC, nC)
calculators | calc-eng | resistor-color-code-calculator | Resistor color code calculator | 4/5/6-band decode with visual resistor; value to bands; nearest E12/E24/E96 value
calculators | calc-eng | power-factor-calculator | Power factor calculator | P, Q, S, PF, angle; capacitor kVAR and μF to correct to target PF at given V and f
calculators | calc-eng | voltage-divider-calculator | Voltage divider calculator | Vout, solve R1 or R2, current, load effect
calculators | calc-eng | capacitor-calculator | Capacitor calculator | series/parallel, Q=CV, energy, reactance Xc, RC time constant
calculators | calc-eng | inductor-calculator | Inductor calculator | series/parallel, energy, reactance XL, RL time constant, solenoid inductance
calculators | calc-eng | beam-calculator | Beam calculator | simply supported and cantilever with point and UDL loads: reactions, shear, moment, max deflection (E, I); SVG diagrams
calculators | calc-eng | stress-calculator | Stress calculator | normal σ=F/A, shear τ=V/A, σ=Eε
calculators | calc-eng | strain-calculator | Strain calculator | ε=ΔL/L, from stress/E, lateral strain via Poisson's ratio
calculators | calc-eng | reynolds-number-calculator | Reynolds number calculator | Re=ρvD/μ or vD/ν; laminar/transitional/turbulent; fluid presets
calculators | calc-eng | punnett-square-calculator | Punnett square calculator | mono/di/trihybrid crosses, genotype and phenotype ratios, grid
calculators | calc-eng | dna-complement-generator | DNA complement generator | complement, reverse complement, RNA transcription, GC content, validation (IUPAC codes)
calculators | calc-eng | final-grade-calculator | Final grade calculator | current grade, final weight, target → required final score
calculators | calc-eng | weighted-grade-calculator | Weighted grade calculator | categories with weights and scores → course grade
calculators | calc-eng | exam-grade-calculator | Exam grade calculator | points scored/total → % and letter (configurable scale), grading table for all scores
calculators | calc-eng | gpa-goal-planner | GPA goal planner | current GPA and credits, remaining credits, target → required GPA (feasibility on chosen scale)
everyday | calc-eng | time-calculator | Time calculator | add/subtract durations and clock times, difference across midnight, decimal hours
everyday | calc-eng | bmi-calculator | BMI calculator | metric/US, WHO adult categories, healthy weight range; note adult-only and limitations
everyday | calc-eng | random-number-generator | Random number generator | range, count, unique, sorted, integer/decimal, crypto RNG
everyday | calc-eng | random-picker | Random picker | pick N from list, shuffle, split into teams, weighted option
travel | calc-eng | fuel-cost-calculator | Fuel cost calculator | distance, efficiency (mpg US/UK, L/100km, km/L), price → trip cost, round trip, split
travel | calc-eng | mileage-and-fuel-consumption-calculator | Mileage & fuel consumption calculator | odometer readings and fill-ups → consumption per fill and average
travel | calc-eng | parking-cost-calculator | Parking cost calculator | compare tariffs (hourly, first-hour, daily max, flat) for a stay
travel | calc-eng | gps-coordinate-converter | GPS coordinate converter | decimal degrees ↔ DMS ↔ degrees decimal minutes ↔ UTM (WGS84)
travel | calc-eng | distance-between-coordinates | Distance between coordinates | haversine and Vincenty (WGS84) distances, km/mi/nmi
travel | calc-eng | bearing-calculator | Bearing calculator | initial/final bearing, midpoint, destination from start+bearing+distance
travel | calc-eng | map-scale-calculator | Map scale calculator | map ↔ real distance; derive scale from two measures
travel | calc-eng | car-depreciation-calculator | Car depreciation calculator | declining balance yearly schedule or derive rate from two values
travel | calc-eng | ev-charging-cost-calculator | EV charging cost calculator | battery kWh, SoC from/to, efficiency loss, price → cost and time by charger kW; compare to petrol trip cost
converters | converters | length-converter | Length converter | mm cm m km in ft yd mi nmi, mil, light year, etc.
converters | converters | weight-converter | Weight converter | mg g kg t, oz lb st, short/long ton, carat, troy ounce, grain
converters | converters | temperature-converter | Temperature converter | C F K Rankine; oven gas mark chart
converters | converters | area-converter | Area converter | mm² … km², in² ft² yd² mi², acre, hectare
converters | converters | volume-converter | Volume converter | ml l m³, US/UK gallons, quarts, pints, cups, fl oz, tbsp, tsp, ft³ in³
converters | converters | speed-converter | Speed converter | m/s km/h mph knots ft/s, Mach (sea level)
converters | converters | time-converter | Time converter | ns … years (average Gregorian)
converters | converters | pressure-converter | Pressure converter | Pa kPa MPa bar mbar psi atm mmHg inHg torr kgf/cm²
converters | converters | energy-converter | Energy converter | J kJ cal kcal Wh kWh BTU therm eV ft·lbf
converters | converters | power-converter | Power converter | W kW MW, mechanical/metric/electrical hp, BTU/h, refrigeration ton
converters | converters | frequency-converter | Frequency converter | Hz kHz MHz GHz, RPM, rad/s
converters | converters | force-converter | Force converter | N kN, lbf, kgf, dyn, kip, poundal
converters | converters | torque-converter | Torque converter | N·m, ft·lbf, in·lbf, kgf·m, kgf·cm
converters | converters | density-converter | Density converter | kg/m³, g/cm³, g/mL, lb/ft³, lb/in³, lb/gal
converters | converters | angle-converter | Angle converter | deg rad grad turn arcmin arcsec mil
converters | converters | fuel-economy-converter | Fuel economy converter | mpg US/UK, L/100 km, km/L, gal/100mi (non-linear)
converters | converters | cooking-unit-converter | Cooking unit converter | cups/spoons/ml/fl oz; cups to grams for common ingredients (density table, original)
converters | converters | data-storage-converter | Data storage converter | bit, byte, kB/KiB … PB/PiB decimal and binary
converters | converters | data-transfer-rate-converter | Data transfer rate converter | bps…Gbps, B/s…GB/s; download time for a file size
converters | converters | pixels-to-print-size-converter | Pixels to print size converter | px ↔ inches/cm at DPI; photo paper size chart with required pixels
converters | converters | screen-size-calculator | Screen size calculator | diagonal + aspect ratio + resolution → width, height, area, PPI, dot pitch
converters | converters | clothing-size-converter | Clothing size converter | women's dresses, men's suits/shirts US/UK/EU/IT/JP tables (original, note approximate)
converters | converters | shoe-size-converter | Shoe size converter | US men/women, UK, EU, Mondopoint (cm), Japan (approximate tables)
converters | converters | paper-size-reference | Paper size reference | ISO A/B/C, US Letter/Legal/Tabloid, ANSI, architectural, JIS B; mm/in/pt; px at DPI
converters | converters | number-base-converter | Number base converter | bases 2-36 including fractional parts; BigInt for integers
converters | converters | roman-numeral-converter | Roman numeral converter | 1-3999 both ways with validation of canonical form
converters | converters | number-to-words-converter | Number to words converter | English words (US/UK "and"), ordinal, cheque/currency style; words back to number
converters | converters | decimal-to-fraction-converter | Decimal to fraction converter | exact for terminating, repeating decimals (e.g., 0.(3)), continued-fraction approximation; nearest ruler fraction (1/16, 1/32, 1/64)
converters | converters | scientific-notation-converter | Scientific notation converter | standard ↔ scientific ↔ engineering; significant figures count and rounding
converters | converters | number-formatter | Number formatter | Intl.NumberFormat by locale: decimal, currency, percent, compact, unit
finance | finance | discount-calculator | Discount calculator | price & % → sale price, savings; original from sale; stacked discounts
finance | finance | tip-calculator | Tip calculator | bill, tip %, split, round up per person
finance | finance | bill-splitter | Bill splitter | even or itemized split with tax/tip share; group expense settle-up minimizing transfers
finance | finance | vat-gst-sales-tax-calculator | VAT / GST / sales tax calculator | add or remove tax; net/gross; multiple rates
finance | finance | unit-price-comparison | Unit price comparison | compare items with different sizes/units; cheapest per unit
finance | finance | currency-formatter | Currency formatter | Intl currency formatting by locale & currency, accounting style, symbols table
finance | finance | loan-emi-calculator | Loan / EMI calculator | EMI, total interest, amortization schedule table, CSV export
finance | finance | mortgage-calculator | Mortgage calculator | principal & interest, down payment, property tax, insurance, PMI, HOA; amortization; extra payments
finance | finance | simple-interest-calculator | Simple interest calculator | I=Prt solve any, steps
finance | finance | compound-interest-calculator | Compound interest calculator | compounding frequency, regular contributions, yearly table and chart
finance | finance | savings-calculator | Savings goal calculator | monthly saving needed for goal by date with interest
finance | finance | investment-calculator | Investment calculator | initial, contributions with annual increase, return, inflation-adjusted value
finance | finance | sip-calculator | SIP calculator | monthly SIP future value (annuity due), step-up %, invested vs gains
finance | finance | roi-calculator | ROI calculator | ROI %, gain/loss, annualized (CAGR) over period
finance | finance | retirement-calculator | Retirement calculator | savings projection to retirement age, required nest egg via withdrawal rate, gap
finance | finance | inflation-calculator | Inflation calculator | US CPI-U annual averages (sourced BLS dataset, cite) between years; or custom rate mode
finance | finance | net-worth-calculator | Net worth calculator | assets and liabilities lists, totals, saved locally
finance | finance | salary-converter | Salary converter | hourly/daily/weekly/biweekly/monthly/annual with hours and weeks settings
finance | finance | take-home-pay-calculator | Take-home pay calculator | US federal (single/married, standard deduction, FICA) and UK (income tax, NI) for a clearly stated tax year; estimate only
finance | finance | budget-planner | Budget planner | income and categorized expenses; 50/30/20 comparison; saved locally; chart
finance | finance | expense-tracker | Expense tracker | log expenses with category/date, monthly totals, filter, CSV export, saved locally
finance | finance | subscription-cost-calculator | Subscription cost calculator | subscriptions with billing cycles → weekly/monthly/yearly totals
finance | finance | student-budget-calculator | Student budget calculator | academic-year income (loans, grants, work) vs costs → weekly spending money
finance | finance | rent-affordability-calculator | Rent affordability calculator | 30% of gross income rule, 40x rent rule, with debts
finance | finance | iban-validator-and-formatter | IBAN validator & formatter | country lengths & structure, mod-97 check, print format, BBAN breakdown
finance | finance | swift-bic-checker | SWIFT / BIC checker | format validation, bank/country/location/branch breakdown, ISO country check
finance | finance | card-number-validator-luhn | Card number validator (Luhn) | Luhn check, network detection from IIN ranges; never stored or sent; testing only
date-time | datetime-a | age-calculator | Age calculator | exact years/months/days, total days, next birthday countdown, day of week born
date-time | datetime-a | date-difference-calculator | Date difference calculator | between two dates in days, weeks, months, years; include end date option
date-time | datetime-a | add-subtract-days | Add / subtract days | add or subtract days/weeks/months/years (month-end clamping explained)
date-time | datetime-a | business-days-calculator | Business days calculator | working days between dates or add N business days; custom weekend days and holiday list
date-time | datetime-a | day-of-the-week-calculator | Day of the week calculator | weekday, day of year, ISO week, quarter
date-time | datetime-a | week-number-calculator | Week number calculator | ISO 8601 week + date range; US week numbering option; list weeks of a year
date-time | datetime-a | leap-year-checker | Leap year checker | Gregorian rules explained, nearby leap years
date-time | datetime-a | countdown | Countdown | live countdown to a date/time, shareable via URL params, saved locally
date-time | datetime-a | time-zone-converter | Time zone converter | IANA zones via Intl, DST-aware, multiple targets
date-time | datetime-a | world-clock | World clock | live clocks for chosen cities, saved locally
date-time | datetime-a | meeting-planner | Meeting planner | participants' zones; 24h grid highlighting working-hour overlap
date-time | datetime-a | unix-timestamp-converter | Unix timestamp converter | seconds/ms ↔ ISO/local/UTC; live current timestamp
date-time | datetime-a | date-format-converter | Date format converter | parse many formats; output ISO 8601, RFC 2822, custom tokens (YYYY-MM-DD etc.), relative
date-time | datetime-a | stopwatch | Online stopwatch | accurate (performance.now), laps/splits, CSV export, keyboard shortcuts
date-time | datetime-a | timer-and-alarm | Timer & alarm | countdown timer and time-of-day alarm with generated sound, title update, notification
date-time | datetime-b | study-timer | Study timer | time sessions per subject, daily goals, history saved locally
date-time | datetime-b | exam-countdown | Exam countdown | list exams with dates; countdowns; upcoming highlighted; saved locally
date-time | datetime-b | presentation-timer | Presentation timer | sections with target durations, chimes, overrun warnings, split report
date-time | datetime-b | calendar-generator | Printable calendar generator | monthly/yearly printable calendars, week start, optional holiday list entry; print CSS or PDF (pdf-lib)
date-time | datetime-b | calendar-invite-ics-generator | Calendar invite (.ics) generator | title, start/end with time zone, location, description, attendees, alarms, recurrence; valid .ics
date-time | datetime-b | week-planner | Week planner | tasks per day, notes, done states, saved locally, print
date-time | datetime-b | to-do-list-and-checklist | To-do list & checklist | multiple lists, recurring tasks (daily/weekly), reorder, export JSON/text, saved locally
date-time | datetime-b | habit-tracker | Habit tracker | habits with daily check-ins grid, streaks, completion rate, saved locally
date-time | datetime-b | notes | Notes | private local notepad with multiple notes, Markdown preview, search, .md export
date-time | datetime-b | semester-planner | Semester planner | term weeks grid with course deadlines and exams; saved locally; print
date-time | datetime-b | daily-study-planner | Daily study planner | timed study blocks with tasks for a day; printable
date-time | datetime-b | project-planner | Project planner | tasks with owners, start/end dates, status; simple Gantt timeline; JSON export/import
date-time | datetime-b | thesis-planner | Thesis & dissertation planner | milestones backward from submission date, chapter word-count split, progress
security | security-files | password-generator | Password generator | length, character sets, exclude ambiguous, guarantee each set; crypto RNG, entropy bits
security | security-files | passphrase-generator | Passphrase generator | EFF large wordlist (CC BY 3.0, attribute; bundle locally), word count, separator, capitalization, number; entropy
security | security-files | pin-generator | PIN generator | length 4-12, avoid common/sequential/repeated patterns, crypto RNG
security | security-files | password-strength-checker | Password strength checker | zxcvbn-ts estimate, crack time scenarios, feedback; never sent
security | security-files | random-string-and-secret-key-generator | Random string & secret key generator | hex, base64, base64url, alphanumeric, custom charset; bytes/length; multiple
security | security-files | 2fa-totp-code-generator | 2FA / TOTP code generator | live codes from Base32 secret (otpauth), period/digits/algorithm; generate new secret + otpauth URI + QR
security | security-files | hash-generator | Hash generator | MD5 (implement), SHA-1, SHA-256, SHA-384, SHA-512 (WebCrypto), HMAC; text or file; compare/verify
security | security-files | file-checksum-calculator-and-verifier | File checksum calculator & verifier | large files chunked; SHA-256/SHA-1/SHA-512/MD5; verify against expected hash
security | security-files | text-encryption-decryption | Text encryption & decryption | AES-256-GCM with PBKDF2 (high iterations) password; base64 output with salt/iv; decrypt
security | security-files | file-encryption-decryption | File encryption & decryption | chunked AES-GCM stream format with header, up to ~1 GB; decrypt; integrity
files | security-files | zip-creator | ZIP creator | files and folders (keep paths), compression level; @zip.js/zip.js; optional AES password
files | security-files | archive-extractor | Archive extractor | ZIP (incl. password via zip.js), 7z/RAR/TAR/GZ via libarchive.js (self-hosted worker); list, extract single files or all as ZIP
files | security-files | tar-creator | TAR creator | create .tar or .tar.gz (write ustar headers manually + fflate gzip), keep folder paths
files | security-files | gzip-compressor | GZIP compressor | compress file to .gz or decompress .gz; size saving
files | security-files | batch-file-renamer | Batch file renamer | pattern with {name}/{n}/{ext}/{date}, numbering, find/replace (regex), case; preview; download renamed ZIP
files | security-files | filename-cleaner | Filename cleaner | safe for Windows/macOS/Linux/URLs: reserved names, illegal chars, spaces, accents, length; batch rename ZIP or text list
files | security-files | duplicate-file-finder | Duplicate file finder | hash files (size then SHA-256), group duplicates, wasted space, CSV report
files | security-files | file-comparison | File comparison | byte-by-byte compare two files, first difference offset, hex side-by-side around differences
files | security-files | file-type-and-mime-detector | File type & MIME detector | magic bytes signature table (original), MIME, extension mismatch warning
files | security-files | file-metadata-viewer-and-remover | File metadata viewer & remover | JPEG/PNG/WebP image metadata, PDF info dict, MP3 ID3, DOCX core props: view and strip without re-encoding where possible
developer | developer | json-to-csharp | JSON to C# class generator | classes or records, nullable, property naming, System.Text.Json attributes
developer | developer | json-to-typescript | JSON to TypeScript | interfaces or type aliases, optional fields from arrays of objects, root name
developer | developer | json-to-sql | JSON to SQL | CREATE TABLE with inferred types + INSERTs for dialects (Postgres, MySQL, SQLite, SQL Server)
developer | developer | json-to-csv-converter | JSON to CSV converter (and CSV to JSON) | flatten nested keys, delimiter, papaparse
developer | developer | json-to-xml-converter | JSON to XML converter (and XML to JSON) | fast-xml-parser both ways, attributes handling
developer | developer | json-to-yaml-converter | JSON to YAML converter (and YAML to JSON) | js-yaml, quote ambiguous values
developer | developer | xml-formatter | XML formatter & validator | DOMParser validation with line/col, pretty print, minify
developer | developer | yaml-formatter | YAML formatter & validator | js-yaml validate with line; format (note comment-preservation limits honestly)
developer | developer | csv-viewer-and-formatter | CSV viewer & formatter | papaparse; sortable table, delimiter detect, trim, dedupe, export CSV/TSV/JSON
developer | developer | html-formatter | HTML formatter & beautifier | prettier/standalone html parser; minify option (whitespace-safe)
developer | developer | css-formatter-and-minifier | CSS formatter & minifier | prettier css/scss/less; minify with csso
developer | developer | javascript-formatter-and-minifier | JavaScript formatter & minifier | prettier babel/typescript; minify with terser
developer | developer | html-entity-encoder-decoder | HTML entity encoder & decoder | escape minimal/all non-ASCII named/numeric; decode safely
developer | developer | jwt-decoder | JWT decoder & verifier | decode header/payload, exp/iat human time, verify HS256/384/512 secret or RS/ES public key via jose
developer | developer | jwt-generator | JWT generator | header/payload JSON, HS/RS/ES algorithms, generate keys, exp helper (jose)
developer | developer | uuid-ulid-generator | UUID & ULID generator | v4, v7 (implement), ULID (implement, crypto), bulk, uppercase/no-dash options; validate
developer | developer | mock-data-generator | Mock data generator | schema fields with faker types; count; JSON/CSV/SQL output (faker loaded lazily)
developer | developer | gitignore-generator | .gitignore generator | original templates for languages/frameworks/editors/OS; combine & dedupe
developer | developer | docker-compose-generator | Docker Compose generator | presets (postgres, mysql, redis, mongo, nginx, node app...), custom services: ports, env, volumes, depends_on; compose.yaml
developer | developer | cron-expression-builder-and-parser | Cron expression builder & parser | builder UI, cronstrue explanation, next run times (cron-parser) in time zone
developer | developer | regex-explainer | Regex explainer | tokenize JS regex and explain each part in plain English (own parser)
developer | developer | ip-subnet-cidr-calculator | IP subnet & CIDR calculator | IPv4/IPv6: network, broadcast, range, hosts, mask/wildcard; split into subnets
developer | developer | user-agent-parser | User-agent parser | ua-parser-js v1 (MIT): browser, engine, OS, device; current UA
developer | developer | sql-playground | SQL playground | sql.js (self-hosted wasm) in-browser SQLite: sample DB, run queries, results table, export
developer | developer | git-command-helper | Git command helper | searchable original catalog of common tasks with exact commands and explanations
business | business | invoice-generator | Invoice generator | logo, from/to, items, tax, discount, currency, notes; PDF via pdf-lib; saved draft locally
business | business | receipt-generator | Receipt generator | payment receipt PDF any currency
business | business | quotation-generator | Quotation generator | quote PDF with validity date, items, tax
business | business | purchase-order-generator | Purchase order generator | PO PDF with supplier, delivery date, terms, signature lines
business | business | expense-report-generator | Expense report generator | expense lines with categories, totals; signed PDF or CSV
business | business | letterhead-generator | Letterhead generator | logo, company details, colors, layout; PDF (A4/Letter) and editable body text
business | business | business-card-generator | Business card generator | front/back designs, QR code, print-ready PDF with bleed or PNG
business | business | email-signature-generator | Email signature generator | table-based HTML signature with inline styles; copy rich HTML or source
business | business | vcard-to-csv-converter | vCard ↔ CSV converter | parse vCard 2.1/3.0/4.0 to CSV and CSV to vCard 3.0
business | business | timesheet-and-working-hours-calculator | Timesheet & working hours calculator | daily in/out/breaks, weekly totals, overtime threshold, pay; CSV
business | business | overtime-calculator | Overtime calculator | regular/OT (1.5x)/double time thresholds daily/weekly, pay
business | business | commission-calculator | Commission calculator | flat or tiered (marginal or full-tier) commission, base pay, draw against commission
business | business | bonus-calculator | Bonus calculator | % of salary/target; gross-up a net bonus given tax rate
business | business | employee-cost-calculator | Employee cost calculator | salary + employer taxes/benefits/overheads → yearly/monthly/hourly cost
business | business | profit-margin-calculator | Profit margin calculator | margin, markup, price from any two
business | business | markup-calculator | Markup calculator | markup ↔ margin, price from cost
business | business | break-even-calculator | Break-even calculator | fixed costs, price, variable cost → units and revenue; chart
business | business | revenue-calculator | Revenue calculator | units × price; subscription MRR projection with growth and churn
business | business | cash-flow-calculator | Cash flow calculator | opening balance, monthly inflows/outflows → running balance, burn, runway, month cash runs out
business | business | project-cost-calculator | Project cost calculator | tasks with hours and rates, expenses, contingency, margin → quote
business | business | meeting-cost-calculator | Meeting cost calculator | attendees and salaries → cost; live running meter
business | business | resume-builder | Resume & CV builder | sections form, template choice, PDF export (pdf-lib), saved locally
business | business | portfolio-builder | Portfolio builder | profile, projects, links → single self-contained HTML file download with preview
business | business | job-application-tracker | Job & internship application tracker | statuses saved→applied→interview→offer/rejected, dates, notes, CSV export, saved locally
design | design | color-picker | Color picker | EyeDropper API (fallback note), pick from uploaded image, HSV square; HEX/RGB/HSL/HSV/CMYK/OKLCH
design | design | color-converter | Color converter | HEX, RGB, HSL, HSV/HSB, HWB, CMYK, LAB, LCH, OKLAB, OKLCH; nearest CSS named color
design | design | color-palette-generator | Color palette generator | shade scales (50-950), harmonies (complementary, triadic, analogous...), export CSS vars, Tailwind, SCSS, JSON
design | design | image-color-extractor | Image color extractor | dominant colors (k-means/median cut), coverage %, export
design | design | contrast-checker-wcag | Contrast checker (WCAG) | WCAG 2.2 ratio AA/AAA normal/large/UI, suggest nearest passing colors; APCA Lc informational
design | design | css-gradient-generator | CSS gradient generator | linear/radial/conic, stops editor, angle, preview, code
design | design | css-box-shadow-generator | CSS box-shadow generator | multiple layers, inset, preview, code
design | design | border-radius-generator | Border-radius generator | per-corner, elliptical radii, shortest CSS
design | design | css-button-generator | CSS button generator | colors, padding, radius, border, hover/focus/disabled states, contrast check, code
design | design | glassmorphism-generator | Glassmorphism generator | backdrop-filter blur, transparency, border; @supports fallback; code
design | design | neumorphism-generator | Neumorphism generator | flat/concave/convex/pressed from one color; code
design | design | font-pairing-tool | Font pairing tool | curated Google Fonts pairs preview (loads fonts from Google Fonts: disclose), embed code
design | design | type-scale-generator | Type scale generator | ratio presets, base size, fluid clamp() between viewports, CSS custom properties
design | design | aspect-ratio-calculator | Aspect ratio calculator | ratio from dimensions, resize keeping ratio, common ratios
design | design | golden-ratio-calculator | Golden ratio calculator | split lengths, golden rectangle SVG
design | design | svg-optimizer | SVG optimizer | svgo browser build, options, before/after size and preview
design | design | flowchart-maker | Flowchart maker | nodes (process/decision/start/end), labelled connectors, drag, auto-layout; export PNG/SVG; saved locally
design | design | mind-map-maker | Mind map maker | outline-driven tree with automatic radial/horizontal layout; export outline/PNG/SVG
design | design | timeline-maker | Timeline maker | events vertical/horizontal; PNG/SVG export
social-media | bg-social | social-media-image-resizer | Social media image resizer | one image to platform presets (Instagram, X, Facebook, LinkedIn, YouTube, Pinterest, TikTok) with fit/fill/blur-fill; ZIP
social-media | bg-social | social-media-banner-maker | Social media banner maker | cover/header sizes; background color/gradient/image, text, logo; safe zones; PNG
social-media | bg-social | youtube-thumbnail-maker | YouTube thumbnail maker | 1280x720 with image, text with outline, badges, logo; PNG/JPG under 2 MB
social-media | bg-social | open-graph-image-generator | Open Graph image generator | 1200x630 templates with title, subtitle, logo; PNG
social-media | bg-social | caption-formatter | Caption formatter | line breaks preserved (invisible spacer), bullets, hashtag cleanup/limits per platform
social-media | bg-social | social-character-counter | Social character counter | limits per platform; X weighted counting (URLs=23, CJK=2, emoji)
social-media | bg-social | social-post-preview | Social post preview | mock layouts styled originally for X, Instagram, LinkedIn, Facebook-like cards (no logos)
developer | existing | json-formatter | JSON formatter & validator | EXISTING page
developer | existing | sql-formatter | SQL formatter | EXISTING page
developer | existing | regex-tester | Regex tester | EXISTING page
developer | existing | base64-encoder-decoder | Base64 encoder & decoder | EXISTING page
developer | existing | api-request-builder | API request builder | EXISTING page (our addition)
text | existing | markdown-previewer | Markdown previewer | EXISTING page
ai | existing | prompt-builder | AI prompt builder | EXISTING page (our addition)
ai | existing | ai-use-case-planner | AI use-case planner | EXISTING page (our addition)
ai | existing | rag-readiness-checklist | RAG readiness checklist | EXISTING page (our addition)
ai | existing | token-estimator | Text & token estimator | EXISTING page (our addition)
text | alias | word-and-character-counter | Word & character counter | ALIAS → /student-tools/word-counter
calculators | alias | percentage-calculator | Percentage calculator | ALIAS → /student-tools/percentage-calculator
calculators | alias | gpa-calculator | GPA calculator | ALIAS → /student-tools/gpa-calculator
calculators | alias | grade-calculator | Grade calculator | ALIAS → /student-tools/grade-calculator
date-time | alias | pomodoro-timer | Pomodoro timer | ALIAS → /student-tools/pomodoro-timer
date-time | alias | assignment-planner | Assignment planner | ALIAS → /student-tools/assignment-planner

import type { CatalogTool } from "../types";

/** Business batch: document generators, pay and pricing calculators, career tools. */
export const tools: CatalogTool[] = [
  {
    slug: "invoice-generator",
    name: "Invoice generator",
    category: "business",
    icon: "file",
    summary: "Create a professional invoice with your logo, line items, taxes and discounts, then download it as a PDF.",
    h1: "Make an invoice and download it as PDF",
    metaTitle: "Free invoice generator with PDF download",
    metaDescription:
      "Build invoices with a logo, line items, per-line tax rates, discounts and any currency. Totals are exact to the cent and the PDF is made in your browser.",
    primaryKeyword: "invoice generator",
    intro:
      "Fill in who is billing whom, add your line items and download a clean, multi-page PDF invoice. Your draft stays in this browser so you can pick up where you left off.",
    instructions: [
      "Set the invoice number, dates, currency and number format, and upload a PNG or JPG logo if you have one.",
      "Fill in your details under **From** and your client under **Bill to**, including tax IDs if your invoices need them.",
      "Add line items with quantity, unit price, optional discount and tax rate. Use the document discount, shipping and **Amount paid** fields for the totals.",
      "Check the preview, then select **Download PDF**. Use **New invoice** for the next one; the number continues the sequence.",
    ],
    howItWorks: [
      "Amounts are stored as whole cents (or the currency's smallest unit: yen have none, Kuwaiti dinars have three), so totals never drift. Each line is quantity × unit price minus its discount, rounded half away from zero. A document discount is applied before tax and spread across tax rates in proportion to their lines, then tax is worked out once per rate, which is how most invoicing systems avoid penny differences.",
      "The PDF is built with pdf-lib and embedded Noto Sans, so accented, Greek and Cyrillic text prints correctly. Long item tables continue onto new pages with the column header repeated, and every page is numbered. Money is formatted with your browser's Intl rules for the chosen currency and number style.",
      'Limits: shipping is not taxed, each line has a single tax rate, and the tool does not know tax rules for your country, so check what your invoice must legally show. Characters outside the font (such as Chinese or emoji) print as "?" and the tool tells you when that happens.',
    ],
    example: {
      title: "Three lines, two tax rates",
      body: "Two taxable lines at 10% and one untaxed line give a subtotal of 3,990.00, tax of 384.00 and a total of 4,374.00.",
      input: "Discovery 1 × 1,800.00 (10% tax)\nDevelopment 24 × 85.00 (10% tax)\nHosting setup 1 × 150.00 (no tax)",
      output: "Subtotal 3,990.00\nTax 10% on 3,840.00 = 384.00\nTotal 4,374.00",
    },
    faqs: [
      {
        q: "Is my invoice data sent anywhere?",
        a: "No. The invoice is calculated and turned into a PDF in your browser. The draft is saved only in this browser's local storage; use **Export JSON** to keep a backup or move it to another device.",
      },
      {
        q: "How do I number invoices in sequence?",
        a: "Select **New invoice**. It keeps your details, logo and terms, clears the client and items, and increases the number while keeping its format, so INV-0042 becomes INV-0043 and 2026/9 becomes 2026/10.",
      },
      {
        q: "Can I enter prices that already include VAT?",
        a: "Yes. Tick **Prices include tax** and the tool works the tax out of each rate group (amount × rate ÷ (100 + rate)) and shows it as included instead of adding it on top.",
      },
      {
        q: "Why is my currency shown as a code in the PDF?",
        a: "If the PDF font has no glyph for a currency symbol (the Thai baht sign, for example), the PDF writes the ISO code such as THB instead of printing a blank box.",
      },
    ],
    related: ["quotation-generator", "receipt-generator", "vat-gst-sales-tax-calculator"],
    popular: true,
  },
  {
    slug: "receipt-generator",
    name: "Receipt generator",
    category: "business",
    icon: "check",
    summary: "Issue a payment receipt in any currency with items, tax, payment method and an optional signature line.",
    h1: "Create a payment receipt as PDF",
    metaTitle: "Receipt generator: payment receipts as PDF",
    metaDescription:
      "Write a payment receipt with items, tax, payment method and reference in any currency. Mark it paid in full or partly paid and download a clean PDF.",
    primaryKeyword: "receipt generator",
    intro: "Confirm a payment in writing: list what was paid for, how it was paid and whether anything is still owed, then download a PDF receipt.",
    instructions: [
      "Set the receipt number and payment date, pick the currency, and add your logo if you like.",
      "Fill in **Received by** (you) and **Received from** (the payer), plus the invoice or transaction reference.",
      "Add the items paid for with their tax rates, and enter the payment method.",
      "Leave **Paid in full** ticked, or untick it and enter the amount actually received, then select **Download PDF**.",
    ],
    howItWorks: [
      "Totals are calculated in whole cents with the same engine as the invoice generator: line amounts, optional discounts, tax per rate and shipping. With **Paid in full** the amount paid equals the total; otherwise the receipt shows the amount received and the balance remaining.",
      "The PDF uses embedded Noto Sans for accented, Greek and Cyrillic text, repeats the table header on long receipts and numbers every page. Your draft is saved in this browser.",
      "Limits: this creates a document, not a payment record. It does not check that money was actually received, and any legal requirements for receipts in your country (such as tax registration numbers) are up to you to include.",
    ],
    example: {
      title: "Service plan with a part",
      body: "A 480.00 plan and two filters at 24.50 with 8% tax give a total of 571.32, all marked as paid.",
      input: "Annual maintenance plan 1 × 480.00 (8%)\nReplacement filter 2 × 24.50 (8%)\nPaid in full by card",
      output: "Subtotal 529.00\nTax 8% = 42.32\nTotal 571.32\nAmount paid 571.32",
    },
    faqs: [
      {
        q: "Can I make a receipt for a partial payment?",
        a: "Yes. Untick **Paid in full** and enter the amount received. The receipt then shows the amount paid and the balance remaining.",
      },
      {
        q: "Which currencies are supported?",
        a: "About fifty ISO currencies, each with its correct number of decimals (for example 0 for JPY and 3 for KWD), formatted in the number style you choose.",
      },
      {
        q: "Where is my receipt stored?",
        a: "Only in this browser's local storage as a draft. Download the PDF for your records and export JSON if you want to edit it elsewhere.",
      },
    ],
    related: ["invoice-generator", "expense-report-generator", "currency-formatter"],
  },
  {
    slug: "quotation-generator",
    name: "Quotation generator",
    category: "business",
    icon: "quote",
    summary: "Prepare a price quote with items, discounts, tax and a validity date, ready to send as a PDF.",
    h1: "Write a price quotation and export a PDF",
    metaTitle: "Quotation generator: price quotes as PDF",
    metaDescription:
      "Build a quotation with line items, discounts, tax, a valid-until date and terms, plus an acceptance signature line. Download a tidy PDF made in your browser.",
    primaryKeyword: "quotation generator",
    intro: "Turn your estimate into a clear quote your client can accept: itemized prices, how long the offer stands and the terms that apply.",
    instructions: [
      "Set the quote number and date, then use the shortcut under **Valid until** to set a 30-day validity or pick any date.",
      "Fill in your details and the client under **Prepared for**.",
      "Add line items with optional line discounts and tax, and write your scope notes and terms.",
      "Keep the **Accepted by (client)** signature line or rename it, then select **Download PDF**.",
    ],
    howItWorks: [
      "Each line is quantity × unit price minus its discount, kept in whole cents. A whole-quote discount comes off before tax and is shared across tax rates in proportion, then tax is calculated once per rate. If you record a deposit, the quote also shows the amount left after it.",
      "The PDF is generated locally with pdf-lib and embedded Noto Sans, repeats the item header on every page and ends with signature and date lines for acceptance.",
      "Limits: a quote made here is a document, not an e-signature workflow; your client signs a printout or replies to accept. Check whether your country requires specific wording for binding offers.",
    ],
    example: {
      title: "Design package with a discounted line",
      body: "A 10% discount on the hourly line takes it from 180.00 to 162.00 before 20% tax is added.",
      input: "Brand identity 1 × 2,400.00\nBusiness card design 1 × 300.00\nFile preparation 3 × 60.00 (10% off)\nTax 20% on all lines",
      output: "Subtotal 2,862.00\nTax 20% = 572.40\nTotal 3,434.40",
    },
    faqs: [
      {
        q: "What is the difference between a quote and an invoice?",
        a: "A quote is an offer made before the work, valid until a date. An invoice asks for payment afterwards. You can export the quote as JSON and import it into the [invoice generator](/tools/invoice-generator) to reuse the items.",
      },
      {
        q: "Can I show prices including tax?",
        a: "Yes. Tick **Prices include tax** and the tax is extracted from each rate group and shown as included.",
      },
      {
        q: "Is the quote saved?",
        a: "The current draft is saved in this browser's local storage. Nothing is uploaded.",
      },
    ],
    related: ["invoice-generator", "project-cost-calculator", "profit-margin-calculator"],
  },
  {
    slug: "purchase-order-generator",
    name: "Purchase order generator",
    category: "business",
    icon: "list",
    summary: "Create a purchase order with supplier, ship-to address, delivery date, terms and signature lines.",
    h1: "Create a purchase order PDF",
    metaTitle: "Purchase order generator (PO PDF)",
    metaDescription:
      "Make a purchase order with buyer, supplier and ship-to addresses, delivery date, discounts, shipping, terms and signature lines, then download it as a PDF.",
    primaryKeyword: "purchase order generator",
    intro: "Send suppliers a clear order: what you are buying, at what price, where and when it should arrive, and who authorized it.",
    instructions: [
      "Enter the PO number, order date and delivery date, and the supplier's quote reference if you have one.",
      "Fill in **Buyer**, **Supplier** and, if goods go somewhere else, **Ship to**.",
      "List the items with quantities, unit prices and any agreed discount, and add shipping.",
      "Write delivery and payment terms, keep the two signature lines, then select **Download PDF**.",
    ],
    howItWorks: [
      "Line totals, discounts, tax and shipping are calculated in whole cents and formatted for the currency you pick. Prepaid amounts are subtracted to show the amount payable.",
      "The PDF lays out three address blocks, a multi-page item table with a repeated header and page numbers, your terms, and signature lines for the buyer and supplier with date lines.",
      "Limits: this tool does not track order status, receipts of goods or approvals. Shipping is shown untaxed; if your supplier charges tax on delivery, add it as a line item instead.",
    ],
    example: {
      title: "Office furniture order",
      body: "Twelve chairs and desks with a 5% agreed discount, monitor arms at list price and 120.00 delivery.",
      input: "12 × 219.00 chairs (5% off)\n12 × 389.00 desks (5% off)\n12 × 74.90 monitor arms\nShipping 120.00",
      output: "Subtotal 7,830.00\nShipping 120.00\nTotal 7,950.00",
    },
    faqs: [
      {
        q: "Do I need a ship-to address?",
        a: "Only if goods go somewhere other than the buyer's address. Leave it empty and the PDF shows just the buyer and supplier.",
      },
      {
        q: "Can I change the signature labels?",
        a: 'Yes. Edit the comma-separated list under **Signature line labels**, for example "Approved by finance, Received by warehouse". Up to four lines fit.',
      },
      {
        q: "Is anything uploaded?",
        a: "No. The PDF is built in your browser and the draft is saved in local storage only.",
      },
    ],
    related: ["invoice-generator", "quotation-generator", "letterhead-generator"],
  },
  {
    slug: "expense-report-generator",
    name: "Expense report generator",
    category: "business",
    icon: "coin",
    summary: "List expenses by date and category, total them, subtract advances and export a signed PDF or CSV.",
    h1: "Create an expense report for reimbursement",
    metaTitle: "Expense report generator (PDF and CSV)",
    metaDescription:
      "Record business expenses with dates, categories and tax, see totals by category, subtract any advance and download a PDF with signature lines or a CSV file.",
    primaryKeyword: "expense report template",
    intro: "Collect your receipts into one clear report: each expense with its date and category, a summary by category and the amount you are owed.",
    instructions: [
      "Enter your name under **Employee** and who the report goes to under **Submitted to**, plus the trip or project purpose.",
      "Add each expense with its date, category, description and amount. Add the tax rate if your company reclaims tax.",
      "Enter any **Advance received** so the report shows the amount to reimburse.",
      "Download the PDF with signature lines for you and your approver, or a CSV for your finance system.",
    ],
    howItWorks: [
      "Amounts are summed in whole cents and grouped by category. Expense amounts are treated as what you paid, so tax is shown as included (amount × rate ÷ (100 + rate)) rather than added on top; untick **Amounts include tax** if your figures are net.",
      "The amount to reimburse is the total minus any advance. The PDF lists every expense on as many pages as needed, adds a category summary, your declaration and signature and date lines; the CSV has one row per expense plus totals.",
      "Limits: receipts themselves are not attached; keep them with the report. Mileage must be entered as an amount (distance × your company's rate), and company policy limits are not checked.",
    ],
    example: {
      title: "Two-day client visit",
      body: "Four expenses totaling 550.25, of which 36.25 is included 10% tax on the hotel and lunch. With a 200.00 advance, 350.25 is due.",
      input: "Train 128.40 (Travel)\nHotel 312.00 (Lodging, 10% incl.)\nLunch 86.75 (Client entertainment, 10% incl.)\nTaxi 23.10 (Transport)\nAdvance 200.00",
      output: "Total 550.25\nIncludes tax 10% = 36.25\nAmount to reimburse 350.25",
    },
    faqs: [
      {
        q: "Can I sign the report digitally?",
        a: "The PDF has signature and date lines to sign on paper or with your PDF reader's signing feature. This tool does not create certified electronic signatures.",
      },
      {
        q: "How do I change the categories?",
        a: "Pick from the built-in list (travel, lodging, meals and more). The PDF and CSV group totals by whatever category each line uses.",
      },
      {
        q: "Where is the report saved?",
        a: "As a draft in this browser's local storage. Export JSON to back it up; nothing is sent to a server.",
      },
    ],
    related: ["expense-tracker", "receipt-generator", "budget-planner"],
  },
  {
    slug: "letterhead-generator",
    name: "Letterhead generator",
    category: "business",
    icon: "pen",
    summary: "Design a company letterhead with logo, colors and contact details, write your letter and export a PDF.",
    h1: "Design a letterhead and write a letter",
    metaTitle: "Letterhead generator with PDF export",
    metaDescription:
      "Create a branded letterhead with your logo, accent color and contact details in four layouts, type your letter and download a multi-page A4 or Letter PDF.",
    primaryKeyword: "letterhead generator",
    intro: "Set up your company header and footer once, then type or paste any letter and download it as a print-ready PDF.",
    instructions: [
      "Enter your company name, tagline, address and contact details, plus a registration or tax line and footer text.",
      "Choose a layout (Classic, Centered, Color band or Sidebar), an accent color, paper size and an optional PNG or JPG logo.",
      "Type or paste the letter under **Letter body**. Blank lines separate paragraphs.",
      "Select **Download PDF**. Your letterhead and text are saved in this browser for next time.",
    ],
    howItWorks: [
      "The PDF is drawn with pdf-lib using embedded Noto Sans. The full header appears on the first page; longer letters continue on extra pages with a compact header (or the same sidebar), and the footer and page numbers repeat on every page.",
      "Text is wrapped by measuring each word in the font, so lines never run past the margin. Light accent colors automatically switch header text to dark for legibility.",
      "Limits: the body is plain text, so there is no bold, italics or tables inside the letter. The on-screen preview is an approximation; page breaks are decided when the PDF is built. For an editable Word file, copy your text into your word processor instead.",
    ],
    example: {
      title: "Classic layout on A4",
      body: "A logo on the left, the company name in the accent color on the right with the address and contacts under it, a colored rule, then the letter. A three-paragraph letter fits on one page with the footer at the bottom.",
      input: "Layout: Classic\nPaper: A4\nBody: date, recipient, subject and three short paragraphs",
      output: "1-page PDF with header, letter text in 10.5 pt and footer with the registration line",
    },
    faqs: [
      {
        q: "Can I use the letterhead without writing a letter?",
        a: "Yes. Leave the body empty and download: you get a blank page with your header and footer, ready to print or use as a template.",
      },
      {
        q: "Which logo formats work?",
        a: "PNG and JPG. PNG keeps transparency. Large images are scaled down to 600 pixels on the long side before they are embedded.",
      },
      {
        q: "Is my letter uploaded?",
        a: "No. Everything, including the PDF, is made in your browser, and the draft is kept in local storage only.",
      },
    ],
    related: ["business-card-generator", "email-signature-generator", "invoice-generator"],
  },
  {
    slug: "business-card-generator",
    name: "Business card generator",
    category: "business",
    icon: "briefcase",
    summary: "Design a two-sided business card with your logo and a QR code, then export a print-ready PDF or PNG.",
    h1: "Design a print-ready business card",
    metaTitle: "Business card generator with QR code and bleed",
    metaDescription:
      "Create a front and back business card with your logo, colors and a QR code. Download a print PDF with 3 mm bleed and crop marks, or 300 DPI PNG files.",
    primaryKeyword: "business card generator",
    intro: "Fill in your details, pick a layout and colors, and get a two-page PDF your printer can cut, or PNG files for online use.",
    instructions: [
      "Enter your name, job title, company and the contact lines you want on the card.",
      "Optionally upload a PNG or JPG logo, then choose the card size, a front layout and your accent and background colors.",
      "Set up the back: choose its background, what to show, and whether the QR code opens your website or saves your contact card.",
      "Check the front and back previews; the dashed line marks where the card will be cut.",
      "Download the print PDF (with or without crop marks) or a 300 DPI PNG of either side.",
    ],
    howItWorks: [
      "The card is laid out in points at its real trim size: 3.5 × 2 in for US cards or 85 × 55 mm for European cards. Each PDF page adds 3 mm of **bleed** on every side, and backgrounds and color bands run into it so no white edge shows after cutting. With crop marks on, a further 6 mm margin holds short marks that sit outside the bleed. TrimBox and BleedBox are written into the PDF, page 1 is the front and page 2 is the back.",
      "The QR code is drawn as vector rectangles, so it stays sharp at any print resolution, on a white square with a four-module quiet zone. It either encodes your website address or a vCard 3.0 contact. Text uses embedded Noto Sans in the PDF, so accented, Greek and Cyrillic names print correctly; text that is too long for its line is shortened with an ellipsis.",
      "Limits: the PDF uses RGB colors, not CMYK, so very saturated colors can shift slightly on press. PNG exports and the on-screen preview use your system's Arial or Helvetica, so spacing differs a little from the PDF. Your design, including the logo, is saved in this browser only.",
    ],
    example: {
      title: "US card with a website QR code",
      body: "A US card with crop marks produces two pages of 303.02 × 195.02 pt: 252 × 144 pt of trim (3.5 × 2 in), plus 2 × 8.5 pt of bleed (3 mm each side) and 2 × 17 pt of crop-mark margin (6 mm each side).",
      input: "Size: US 3.5 × 2 in. Crop marks: on. QR code: website lumenpine.example",
      output: "business-card-print.pdf, 2 pages of 303.02 × 195.02 pt; the back QR code opens https://lumenpine.example/",
    },
    faqs: [
      {
        q: "What is bleed and do I need it?",
        a: "Bleed is extra background that extends past the cut line, so a slightly off cut never leaves a white sliver. Most print shops ask for 3 mm (about 1/8 in), which is what this tool adds to the PDF.",
      },
      {
        q: "Should I leave crop marks on?",
        a: "Turn them on for local printers or when you cut the cards yourself. Some online services ask for files without marks; check their upload guide and switch the option off if needed.",
      },
      {
        q: "Will the QR code scan when printed?",
        a: "A website QR code is small and scans well. A contact card QR code holds more data, so it is denser; if the tool warns that it is very dense, shorten the address or use the website option instead. Always test a printed proof with your phone.",
      },
      {
        q: "Is my logo uploaded anywhere?",
        a: "No. The logo is read in your browser and embedded straight into the PDF or PNG. It is kept in this browser's local storage so your design is there next time.",
      },
    ],
    related: ["qr-code-generator", "letterhead-generator", "email-signature-generator"],
  },
  {
    slug: "email-signature-generator",
    name: "Email signature generator",
    category: "business",
    icon: "pen",
    summary: "Build an email signature from your details and copy it as formatted HTML for Gmail, Outlook or Apple Mail.",
    h1: "Create an HTML email signature",
    metaTitle: "Email signature generator (HTML, copy and paste)",
    metaDescription:
      "Make a clean email signature with your contact details, links, photo and disclaimer. Copy it as formatted HTML or source code, or download it as an .html file.",
    primaryKeyword: "email signature generator",
    intro: "Type your details, choose one of three templates and an accent color, then copy the signature straight into your email app.",
    instructions: [
      "Fill in your name, title, company and the contact details you want to show.",
      "Add social or profile links and, if you like, the address of a logo or photo that is already online.",
      "Pick a template and accent color, and add a disclaimer if your company needs one.",
      "Check the live preview, then press **Copy signature** and paste it into your email app's signature settings. Use **Copy HTML source** or **Download .html** if your app wants raw HTML.",
    ],
    howItWorks: [
      "The signature is built from HTML tables with inline styles only, because many email apps remove style sheets, classes and scripts. Fonts fall back to Arial or Helvetica, which every app has. All text you type is HTML-escaped, so characters like `<` and `&` show up as written and can never turn into markup.",
      "Links are checked before they are added: phone numbers become `tel:` links, email addresses become `mailto:` links, and websites and social profiles must be `http` or `https` addresses. Anything else, such as a `javascript:` link, is left out and flagged next to the field. Copy signature puts both an HTML and a plain-text version on the clipboard.",
      "Limits: the image is not uploaded or stored by this tool; it must already be hosted online, and some email apps block remote images until the reader allows them. Copying formatted HTML needs a browser that supports the Clipboard API; older browsers can copy from the preview by hand. Rendering varies a little between email apps, so send yourself a test message.",
    ],
    example: {
      title: "Phone link output",
      body: "A phone number typed with spaces and brackets is turned into a dialable link that keeps only digits and the leading plus sign, while the visible text stays as you typed it.",
      input: "Phone: +1 (312) 555-0148",
      output: '<a href="tel:+13125550148" …>+1 (312) 555-0148</a>',
    },
    faqs: [
      {
        q: "Why doesn't my logo appear?",
        a: "The image address must be a public https link that opens the image directly, for example one ending in .png or .jpg. Links to sharing pages (such as a cloud drive preview) usually do not work. Some email apps also hide remote images until the recipient allows them.",
      },
      {
        q: "How do I add it to Gmail or Outlook?",
        a: "Press Copy signature, open the signature settings in Gmail (Settings, See all settings, Signature) or Outlook (Settings, Signatures), and paste into the editor. Avoid retyping inside the pasted block, which can break the layout.",
      },
      {
        q: "Is my information saved?",
        a: "Your details are kept in this browser's local storage so you can come back and edit them. Nothing is sent to a server; use Reset to clear them.",
      },
    ],
    related: ["business-card-generator", "letterhead-generator", "portfolio-builder"],
  },
  {
    slug: "vcard-to-csv-converter",
    name: "vCard ↔ CSV converter",
    category: "business",
    icon: "swap",
    summary: "Turn .vcf contact files into a spreadsheet-ready CSV, or build vCard 3.0 contacts from a CSV.",
    h1: "Convert vCard contacts to CSV and back",
    metaTitle: "vCard to CSV converter (and CSV to vCard)",
    metaDescription:
      "Convert vCard 2.1, 3.0 and 4.0 files to CSV with the columns you choose, or turn a Google or Outlook style CSV into a vCard 3.0 file. Runs in your browser.",
    primaryKeyword: "vcard to csv",
    intro: "Upload or paste contacts in either format. Pick the columns you want, check the preview and download the converted file.",
    instructions: [
      "Choose the direction: vCard to CSV, or CSV to vCard.",
      "Upload a file or paste the text. Use **Load sample** to see how it works.",
      "For CSV output, tick the columns you want and choose how multiple phones and emails are laid out. For vCard output, check the detected column mapping and adjust any field or type.",
      "Review the preview, then download the result or copy it.",
    ],
    howItWorks: [
      'The vCard reader follows RFC 2426 (3.0), RFC 6350 (4.0) and the vCard 2.1 specification. It unfolds wrapped lines, joins quoted-printable soft line breaks and decodes quoted-printable text using the declared CHARSET, so accented names from older phones come out right. It understands property groups like `item1.EMAIL`, all three TYPE styles (`TYPE=work,voice`, bare `WORK;VOICE` and quoted `TYPE="work,voice"`), PREF, and escaped commas, semicolons and line breaks.',
      "CSV output is RFC 4180 compliant with a UTF-8 byte order mark so spreadsheet apps keep accents. CSV input is matched to vCard fields by header name, including common Google and Outlook export columns, and written as vCard 3.0 with escaped values, lines folded at 75 bytes and CRLF line endings.",
      "Limits: photos, logos, custom X- fields and categories are not carried into the CSV. Birthdays written with slashes are read as month/day/year. Files without a CHARSET that are not UTF-8 may show wrong accents; re-save them as UTF-8 first.",
    ],
    example: {
      title: "vCard 3.0 to CSV with numbered columns",
      body: "A 3.0 card with an escaped comma in the company name and two typed phone numbers becomes one CSV row. The preferred phone is listed first.",
      input: "FN:Dr. Grace A. Okafor\nORG:Okafor\\, Lee & Partners;Research\nTEL;TYPE=WORK,VOICE:+1 415 555 0142\nTEL;TYPE=CELL,PREF:+1 415 555 0199",
      output:
        'Full name,Organization,Phone 1,Phone 1 type,Phone 2,Phone 2 type\nDr. Grace A. Okafor,"Okafor, Lee & Partners",+1 415 555 0199,cell,+1 415 555 0142,work',
    },
    faqs: [
      {
        q: "Which column layout should I choose?",
        a: "Numbered columns (Phone 1, Phone 1 type) keep every value and re-import cleanly. Column per type (Phone (work), Phone (cell)) is easiest to read in a spreadsheet. One cell each puts all phones or emails in a single cell separated by semicolons.",
      },
      {
        q: "Can I import the CSV into Google Contacts or Outlook?",
        a: "Usually it is simpler to import the .vcf file directly, since both accept vCard. Use the CSV when you need the contacts in a spreadsheet or another system, and map its columns in that system's import screen.",
      },
      {
        q: "Are my contacts uploaded?",
        a: "No. Parsing and conversion run entirely in your browser, and nothing is stored after you close the page.",
      },
      {
        q: "Why were some CSV rows skipped?",
        a: "A vCard needs a display name. Rows where no name, company, email or phone column is mapped, or where those cells are empty, are skipped and counted in the summary.",
      },
    ],
    related: ["csv-viewer-and-formatter", "json-to-csv-converter", "qr-code-generator"],
  },
  {
    slug: "timesheet-and-working-hours-calculator",
    name: "Timesheet & working hours calculator",
    category: "business",
    icon: "timer",
    summary: "Enter daily start, end and break times to total weekly hours, overtime and pay, then export CSV.",
    h1: "Calculate weekly working hours and pay",
    metaTitle: "Timesheet calculator: hours, overtime, pay",
    metaDescription:
      "Type start, end and break times for each day to total your working hours, split out overtime by weekly or daily limits, estimate gross pay and export a CSV.",
    primaryKeyword: "timesheet calculator",
    intro: "Fill in a week of shifts and see total hours in both h:mm and decimal form, with overtime and pay worked out for you.",
    instructions: [
      "For each day, type the start and end time (9:00, 0900, 9am or 5:30pm all work) and the unpaid break in minutes.",
      "Add or remove rows for extra shifts or days off.",
      "Enter your hourly rate, the weekly overtime threshold (40 by default), an optional daily threshold and the overtime multiplier.",
      "Read the totals and select **Download CSV** to keep a copy.",
    ],
    howItWorks: [
      "Each row's hours are end minus start minus the break; if the end time is earlier than the start, the shift is treated as crossing midnight. Totals are shown as hours and minutes and as decimal hours, which is what payroll usually needs (7:30 = 7.5).",
      "Overtime applies any daily limit first, then moves regular hours beyond the weekly limit into overtime in day order, so no hour is counted twice. Pay = regular hours × rate + overtime hours × rate × multiplier.",
      "Limits: rules such as California's seventh-consecutive-day overtime, paid breaks and rounding policies are not applied. Your timesheet is saved in this browser only.",
    ],
    example: {
      title: "A 47.5-hour week",
      body: "Five weekday shifts with 30-minute breaks plus a four-hour Saturday add up to 47:30. At 22.50 per hour with overtime after 40 hours at 1.5×, gross pay is 1,153.13.",
      input: "Mon 8:30-17:15, Tue 8:45-18:30, Wed 9:00-17:30, Thu 8:30-19:00, Fri 7:30-16:00 (30 min breaks), Sat 10:00-14:00",
      output: "Total 47:30 (47.5 h)\nRegular 40 h = 900.00\nOvertime 7.5 h × 33.75 = 253.13\nGross pay 1,153.13",
    },
    faqs: [
      {
        q: "How do I convert minutes to decimal hours?",
        a: "Divide the minutes by 60: 15 minutes is 0.25 h, 30 is 0.5 h and 45 is 0.75 h. The totals panel shows both formats so you can copy whichever your payroll needs.",
      },
      {
        q: "Can I log a night shift?",
        a: "Yes. Enter, for example, 22:00 to 06:00. Because the end is earlier than the start, the shift is counted as running past midnight (8 hours before breaks).",
      },
      {
        q: "Is my timesheet stored online?",
        a: "No. It is saved in this browser's local storage so it is still there next time. Download the CSV to keep a permanent record.",
      },
    ],
    related: ["overtime-calculator", "take-home-pay-calculator", "business-days-calculator"],
  },
  {
    slug: "overtime-calculator",
    name: "Overtime calculator",
    category: "business",
    icon: "timer",
    summary: "Work out regular, overtime and double-time hours and pay from weekly or daily thresholds.",
    h1: "Calculate overtime hours and pay",
    metaTitle: "Overtime pay calculator (1.5x and double time)",
    metaDescription:
      "Split hours into regular, overtime and double time using weekly or daily limits such as 40 hours a week or 8 a day, and see the pay for each with the working.",
    primaryKeyword: "overtime calculator",
    intro: "Enter your rate and hours to see how much is paid at time and a half or double time, using a simple weekly rule or day-by-day limits.",
    instructions: [
      "Pick **Weekly total** for a single number of hours, or **Day by day** to enter each day's hours.",
      "Enter your regular hourly rate and the thresholds that apply to you (for example 40 a week, 8 a day, double time after 12 a day).",
      "Adjust the multipliers if your contract differs from 1.5× and 2×.",
      "Read the pay breakdown and the working; in day-by-day mode a table shows each day's split.",
    ],
    howItWorks: [
      "Weekly mode: hours above the double-time threshold (if set) are double time, hours above the overtime threshold are overtime, the rest are regular. Day-by-day mode applies daily limits first, then turns regular hours past the weekly limit into overtime in day order, the method used under California-style rules.",
      "Pay = regular × rate + overtime × rate × overtime multiplier + double time × rate × double-time multiplier. Under the US FLSA the default is 1.5× after 40 hours in a workweek; California adds 1.5× after 8 hours and 2× after 12 hours in a day.",
      "Limits: special rules such as the seventh consecutive day, alternative workweek schedules, regular-rate adjustments for bonuses and exempt status are not modeled. Check your local law or contract.",
    ],
    example: {
      title: "California-style week",
      body: "Daily overtime after 8 hours and double time after 12, weekly overtime after 40, at 24.00 per hour.",
      input: "Days: 10, 9, 12, 8, 10 hours\nRate 24.00",
      output: "Regular 40 h, overtime 9 h, double time 0 h\nPay = 40 × 24 + 9 × 36 = 1,284.00",
    },
    faqs: [
      {
        q: "Are hours counted twice if both daily and weekly overtime apply?",
        a: "No. Daily overtime is taken out first, and only the remaining regular hours count toward the weekly limit.",
      },
      {
        q: "Does it handle salaried employees?",
        a: "Convert the salary to an hourly regular rate first (for example weekly salary ÷ hours the salary is meant to cover), then enter that rate. Exempt employees are generally not owed overtime.",
      },
      {
        q: "Can I use other multipliers?",
        a: "Yes. Both multipliers are editable, for example 1.25× for some contracts or 2.5× for holiday work.",
      },
    ],
    related: ["timesheet-and-working-hours-calculator", "take-home-pay-calculator", "salary-converter"],
  },
  {
    slug: "commission-calculator",
    name: "Commission calculator",
    category: "business",
    icon: "percent",
    summary: "Calculate flat or tiered sales commission, add base pay and settle a draw against commission.",
    h1: "Calculate sales commission and total pay",
    metaTitle: "Commission calculator with tiers and draws",
    metaDescription:
      "Work out sales commission with a flat rate or tiered bands (marginal or full tier), add base salary and see how a recoverable or non-recoverable draw is paid.",
    primaryKeyword: "commission calculator",
    intro: "Enter your sales and commission plan to see what you earn, how each band contributes and what a draw pays out this period.",
    instructions: [
      "Choose **Flat rate**, **Tiered, marginal** or **Tiered, full tier**.",
      "Enter total sales, then the flat rate or each tier's upper limit and rate. The last tier covers everything above.",
      "Add base pay for the period if you have one.",
      "Tick **Pay a draw against commission** to enter the draw, any balance owed from earlier periods and whether the draw is recoverable.",
    ],
    howItWorks: [
      "Marginal tiers work like tax brackets: each band's rate applies only to sales inside that band. Full-tier plans apply the rate of the band your total reaches to all sales, which creates jumps at each limit. The table shows how much of your sales fell in each band.",
      "With a draw, you are paid the larger of the draw and your commission. For a recoverable draw, a shortfall is added to the balance owed and repaid from future commission above the draw; a non-recoverable draw is never paid back.",
      "Limits: plans with quotas, accelerators on specific products, clawbacks for refunds or split deals need custom handling. Taxes are not deducted.",
    ],
    example: {
      title: "Marginal tiers with a draw",
      body: "Sales of 30,000 with bands of 5% to 10,000, 7.5% to 25,000 and 10% above, a 2,500 base and a recoverable 2,500 draw with 300 already owed.",
      input: "Sales 30,000\nTiers 5% / 7.5% / 10%\nBase 2,500, draw 2,500, owed 300",
      output: "Commission = 500 + 1,125 + 500 = 2,125\nDraw paid 2,500, balance owed 675\nTotal pay 5,000",
    },
    faqs: [
      {
        q: "What is the difference between marginal and full-tier commission?",
        a: "With 30,000 in sales and the tiers above, marginal pays 2,125 (an effective 7.08%), while full tier pays 10% on everything, 3,000. Full tier rewards crossing a limit but creates cliffs just below it.",
      },
      {
        q: "What is a recoverable draw?",
        a: "An advance against future commission. If commission is lower than the draw, the difference is owed back and deducted from later commission that exceeds the draw.",
      },
      {
        q: "Are my numbers saved?",
        a: "No. This calculator keeps nothing after you leave the page, and nothing is sent anywhere.",
      },
    ],
    related: ["bonus-calculator", "take-home-pay-calculator", "percentage-calculator"],
  },
  {
    slug: "bonus-calculator",
    name: "Bonus calculator",
    category: "business",
    icon: "spark",
    summary: "Calculate a bonus as a share of salary or target, estimate the net amount, or gross up a net bonus.",
    h1: "Calculate a bonus and gross it up",
    metaTitle: "Bonus calculator: gross, net and gross-up",
    metaDescription:
      "Work out a bonus from a share of salary or a target with performance factors, see it after withholding, or find the gross needed for a set net bonus.",
    primaryKeyword: "bonus calculator",
    intro:
      "Three common bonus questions in one place: how much is a percentage bonus, what does a target bonus pay out, and how much must be paid to deliver a set amount after tax.",
    instructions: [
      "Pick **% of salary**, **Target bonus** or **Gross up a net bonus**.",
      "Enter the salary and bonus percentage, or the target percentage with individual and company performance factors.",
      "Add the withholding rate on supplemental pay to see the net amount.",
      "For a gross-up, enter the net amount you want the employee to receive and the withholding rate.",
    ],
    howItWorks: [
      "Percentage bonus = salary × bonus %. Target bonus = salary × target % × individual factor × company factor, where 100% means on target. Net = gross × (1 − withholding rate).",
      "A gross-up solves for the gross amount that leaves the desired net: gross = net ÷ (1 − rate). For example, 1,000 net at 25% withholding needs 1,333.33 gross, because 25% of 1,333.33 is 333.33.",
      "Limits: one flat withholding rate is assumed. Progressive brackets, social security wage caps and local taxes can make the real figures differ; use the combined rate from your payslip or payroll provider.",
    ],
    example: {
      title: "Grossing up a 5,000 bonus",
      body: "To pay 5,000 after 29.65% combined withholding (for example 22% federal, 7.65% FICA), the gross bonus must be 7,107.32.",
      input: "Net bonus 5,000\nWithholding 29.65%",
      output: "Gross = 5,000 ÷ (1 − 0.2965) = 7,107.32\nWithheld 2,107.32",
    },
    faqs: [
      {
        q: "What withholding rate should I use?",
        a: "Use the combined rate your payroll applies to bonuses. In the US, federal supplemental withholding is commonly 22% up to 1 million, plus 7.65% FICA and any state tax.",
      },
      {
        q: "Why is grossing up more than adding the tax rate?",
        a: "Because the tax is charged on the gross amount, including the extra you add. Adding 29.65% to 5,000 gives 6,482.50, which would only net 4,560.44.",
      },
      {
        q: "Is anything stored?",
        a: "No. The calculation runs in your browser and nothing is saved or sent.",
      },
    ],
    related: ["take-home-pay-calculator", "commission-calculator", "salary-converter"],
  },
  {
    slug: "employee-cost-calculator",
    name: "Employee cost calculator",
    category: "business",
    icon: "briefcase",
    summary: "Estimate the full cost of an employee per year, month and hour, including taxes, benefits and overheads.",
    h1: "Calculate the true cost of an employee",
    metaTitle: "Employee cost calculator: yearly to hourly",
    metaDescription:
      "Add employer payroll taxes, benefits, bonus and overheads to a salary to find the full cost of an employee per year, month, paid hour and productive hour.",
    primaryKeyword: "employee cost calculator",
    intro:
      "A salary is only part of what an employee costs. Add the employer's taxes, benefits and overheads to see the real yearly, monthly and hourly figures.",
    instructions: [
      "Enter the gross annual salary and the employer payroll tax rate.",
      "Add yearly benefits, overheads (equipment, software, space) and any expected bonus.",
      "Enter weekly hours and paid days off (vacation, holidays, sick days).",
      "Read the totals and the breakdown table, which shows each item's share.",
    ],
    howItWorks: [
      "Employer taxes = (salary + bonus) × payroll tax rate. Total cost = salary + bonus + taxes + benefits + overheads. Paid hours are weekly hours × 52.",
      "Productive hours subtract paid days off at the average daily hours (weekly hours ÷ 5). Cost per productive hour is the number to use when pricing billable work or comparing with a contractor's rate.",
      "Limits: payroll tax caps and thresholds are not applied, so enter an effective average rate for high salaries. Recruiting, onboarding and management time are not included unless you add them as overheads.",
    ],
    example: {
      title: "A 60,000 salary",
      body: "With a 3,000 bonus, 8.5% employer taxes, 9,000 benefits, 4,000 overheads, 40-hour weeks and 25 paid days off.",
      input: "Salary 60,000, bonus 3,000, taxes 8.5%, benefits 9,000, overheads 4,000, 40 h/week, 25 days off",
      output: "Taxes 5,355\nTotal 81,355 per year (6,779.58 per month)\nProductive hours 1,880\nCost per productive hour 43.27",
    },
    faqs: [
      {
        q: "What payroll tax rate should I enter?",
        a: "Only the employer's share. In the US that is 7.65% FICA plus federal and state unemployment taxes up to their wage bases; other countries' social contributions vary widely.",
      },
      {
        q: "Why is the cost per productive hour higher than per paid hour?",
        a: "Paid holidays and vacation cost money but produce no billable work, so the same yearly cost is spread over fewer hours.",
      },
      {
        q: "Is my data saved?",
        a: "No. Nothing is stored or uploaded; the calculation runs in your browser.",
      },
    ],
    related: ["salary-converter", "take-home-pay-calculator", "project-cost-calculator"],
  },
  {
    slug: "profit-margin-calculator",
    name: "Profit margin calculator",
    category: "business",
    icon: "percent",
    summary: "Find margin, markup, price or cost from any two values, with the formulas shown.",
    h1: "Calculate profit margin, markup and price",
    metaTitle: "Profit margin calculator (margin and markup)",
    metaDescription:
      "Enter cost and price, cost and margin, price and margin, or cost and markup to get gross margin, markup, profit and selling price, with every step shown.",
    primaryKeyword: "profit margin calculator",
    intro: "Pick the two values you know and get the rest: selling price, cost, profit, gross margin and markup.",
    instructions: [
      "Choose the pair you know: cost and price, cost and margin, price and margin, or cost and markup.",
      "Enter the two values.",
      "Read the margin, markup, profit and price, and open the working to see the formulas.",
    ],
    howItWorks: [
      "Gross margin = (price − cost) ÷ price. Markup = (price − cost) ÷ cost. From a target margin, price = cost ÷ (1 − margin); from a markup, price = cost × (1 + markup).",
      "Margin is always smaller than markup for the same sale: a 25% markup is a 20% margin. Margin can never reach 100%, while markup has no upper limit.",
      "Limits: this is gross margin per unit. It ignores overheads, taxes and discounts unless you include them in the cost or price.",
    ],
    example: {
      title: "Cost 40, price 65",
      body: "A product that costs 40.00 and sells for 65.00.",
      input: "Cost 40.00\nPrice 65.00",
      output: "Profit 25.00\nMargin 38.46%\nMarkup 62.5%",
    },
    faqs: [
      {
        q: "What is the difference between margin and markup?",
        a: "Margin divides the profit by the selling price; markup divides it by the cost. The same 25.00 profit on a 40.00 cost and 65.00 price is a 38.46% margin and a 62.5% markup.",
      },
      {
        q: "What price gives a 50% margin?",
        a: "Price = cost ÷ (1 − 0.5), so double the cost. A 50% margin equals a 100% markup.",
      },
      {
        q: "Why can't margin be 100% or more?",
        a: "It would require a cost of zero or less. As margin approaches 100%, the required price grows without limit.",
      },
    ],
    related: ["markup-calculator", "break-even-calculator", "discount-calculator"],
    popular: true,
  },
  {
    slug: "markup-calculator",
    name: "Markup calculator",
    category: "business",
    icon: "percent",
    summary: "Set a selling price from cost and markup, find the markup on a price, or convert markup and margin.",
    h1: "Calculate markup and selling price",
    metaTitle: "Markup calculator: price, markup to margin",
    metaDescription:
      "Find a selling price from cost and markup, the markup on an existing price, or convert between markup and gross margin, with a table of common markups.",
    primaryKeyword: "markup calculator",
    intro: "Price your products from their cost, or translate a markup into the margin your accountant talks about, and back.",
    instructions: [
      "Choose **Price from markup**, **Markup from price**, **Markup to margin** or **Margin to markup**.",
      "Enter the cost and markup, cost and price, or the percentage to convert.",
      "Read the result and use the reference table of common markups.",
    ],
    howItWorks: [
      "Price = cost × (1 + markup ÷ 100). Markup = (price − cost) ÷ cost × 100.",
      "Converting: margin = markup ÷ (100 + markup) × 100, and markup = margin ÷ (100 − margin) × 100. So 25% markup is 20% margin, 50% is 33.33% and 100% is 50%.",
      "Limits: results are per unit and before tax. Margin must stay below 100% for the conversion to work.",
    ],
    example: {
      title: "25% markup on a cost of 80",
      body: "Adding a 25% markup to an 80.00 cost.",
      input: "Cost 80.00\nMarkup 25%",
      output: "Price 100.00\nProfit 20.00\nMargin 20%",
    },
    faqs: [
      {
        q: "Is a 30% markup the same as a 30% margin?",
        a: "No. A 30% markup gives a 23.08% margin. To earn a 30% margin you need a 42.86% markup.",
      },
      {
        q: "What is keystone pricing?",
        a: "Doubling the cost to set the price: a 100% markup, which equals a 50% margin.",
      },
      {
        q: "Is anything saved?",
        a: "No. Everything is calculated in your browser and nothing is stored.",
      },
    ],
    related: ["profit-margin-calculator", "discount-calculator", "vat-gst-sales-tax-calculator"],
  },
  {
    slug: "break-even-calculator",
    name: "Break-even calculator",
    category: "business",
    icon: "gauge",
    summary: "Find how many units and how much revenue you need to cover fixed costs, with a chart.",
    h1: "Find your break-even point",
    metaTitle: "Break-even calculator with chart",
    metaDescription:
      "Enter fixed costs, price and variable cost per unit to get break-even units and revenue, contribution margin, units for a target profit and a break-even chart.",
    primaryKeyword: "break even calculator",
    intro: "See the sales volume where revenue covers all costs, how far your forecast is above it and how many units a profit target needs.",
    instructions: [
      "Enter fixed costs for the period, the selling price per unit and the variable cost per unit.",
      "Optionally add a target profit to find the units needed to reach it.",
      "Optionally add expected unit sales to see profit and margin of safety.",
      "Read the results and the chart, where revenue and total cost lines cross at the break-even point.",
    ],
    howItWorks: [
      "Contribution per unit = price − variable cost. Break-even units = fixed costs ÷ contribution, rounded up to whole units; break-even revenue = units × price. With a target profit, the numerator becomes fixed costs + target profit.",
      "Margin of safety = (expected sales − break-even units) ÷ expected sales: how far sales can fall before you make a loss. The chart plots revenue against fixed plus variable costs, shading the loss and profit areas.",
      "Limits: the model assumes a constant price and variable cost at every volume and fixed costs that don't step up with capacity. For several products, use a weighted average contribution.",
    ],
    example: {
      title: "Fixed costs 12,000",
      body: "A product selling at 45.00 with 18.00 variable cost and 12,000 of fixed costs per month, with 600 units expected.",
      input: "Fixed 12,000\nPrice 45.00\nVariable 18.00\nExpected 600 units",
      output: "Contribution 27.00 (60%)\nBreak-even 444.44, so 445 units\nRevenue 20,000.00\nProfit at 600 units 4,200.00\nMargin of safety 25.93%",
    },
    faqs: [
      {
        q: "Why is the unit count rounded up?",
        a: "You can't sell part of a unit, and selling one fewer than the exact figure still leaves a small loss, so the next whole unit is the first one that breaks even.",
      },
      {
        q: "What if my price is below the variable cost?",
        a: "Then each sale loses money and there is no break-even point. The calculator tells you instead of showing a negative number.",
      },
      {
        q: "Is the chart accessible?",
        a: "Yes. It has a text description of the break-even point, and all values are also shown as text in the results.",
      },
    ],
    related: ["profit-margin-calculator", "revenue-calculator", "roi-calculator"],
  },
  {
    slug: "revenue-calculator",
    name: "Revenue calculator",
    category: "business",
    icon: "coin",
    summary: "Calculate sales revenue from units and price, or project subscription MRR with growth and churn.",
    h1: "Calculate revenue and project subscription MRR",
    metaTitle: "Revenue calculator and MRR projection",
    metaDescription:
      "Get net revenue from units, price, discounts and returns, or project monthly recurring revenue month by month from customers, new sign-ups, growth and churn.",
    primaryKeyword: "revenue calculator",
    intro: "Two views of revenue: a quick units-times-price total with discounts and refunds, and a month-by-month subscription projection.",
    instructions: [
      "Pick **Units × price** or **Subscription MRR**.",
      "For sales, enter units, price and optional average discount and refund rate.",
      "For subscriptions, enter today's customers, revenue per customer per month, new customers next month, growth in sign-ups, monthly churn and the number of months.",
      "Read the totals and the monthly table.",
    ],
    howItWorks: [
      "Sales mode: gross = units × price; discounts come off first, then refunds as a share of the discounted amount.",
      "MRR mode, each month: customers = previous − previous × churn + new sign-ups, where sign-ups grow by the growth rate each month. MRR = customers × average revenue per customer, and the cumulative column adds up the revenue earned. With flat sign-ups, the base levels off at new per month ÷ churn rate.",
      "Limits: the projection is a simple model. It does not include upgrades, downgrades, annual prepayments or seasonality, and customer counts are kept fractional internally.",
    ],
    example: {
      title: "A 250-customer subscription",
      body: "250 customers at 39.00 per month, 40 new next month growing 2% monthly, with 3% monthly churn, over 12 months.",
      input: "Start 250, ARPU 39.00, new 40 (+2%/mo), churn 3%, 12 months",
      output: "About 633 customers after 12 months\nMRR 24,686.23\nRevenue over the year 214,490.71",
    },
    faqs: [
      {
        q: "What is MRR?",
        a: "Monthly recurring revenue: the predictable subscription income for one month. Annual run rate (ARR) is MRR × 12.",
      },
      {
        q: "How does churn affect growth?",
        a: "Churn removes a share of your whole base each month, so as you grow, the same churn rate costs more customers. With 40 sign-ups a month and 3% churn, the base stops growing around 1,333 customers.",
      },
      {
        q: "Is my data saved?",
        a: "No. The numbers stay in this page only and nothing is uploaded.",
      },
    ],
    related: ["break-even-calculator", "cash-flow-calculator", "subscription-cost-calculator"],
  },
  {
    slug: "cash-flow-calculator",
    name: "Cash flow calculator",
    category: "business",
    icon: "wave",
    summary: "Plan monthly inflows and outflows to see your running cash balance, burn rate and runway.",
    h1: "Plan your monthly cash flow and runway",
    metaTitle: "Cash flow calculator: balance, burn, runway",
    metaDescription:
      "Enter an opening balance and monthly money in and out to see the running balance, total flows, burn rate, runway and the month your cash would run out.",
    primaryKeyword: "cash flow calculator",
    intro: "Lay out the coming months and see whether the bank balance holds, how fast cash is burning and how long it lasts.",
    instructions: [
      "Enter your opening cash balance and, optionally, the first month so rows get real month names.",
      "Type inflows and outflows for each month, or use **Fill every month** for recurring amounts.",
      "Add or remove months as needed (up to 60).",
      "Read the closing balance, burn and runway, and download the table as CSV.",
    ],
    howItWorks: [
      "Each month: closing balance = opening balance + inflows − outflows, and the closing balance carries into the next month. The first month that ends below zero is reported as the month cash runs out.",
      "Burn is the average net outflow over the last three months of the plan. Runway after the plan is the closing balance divided by that burn. If the last three months are net positive, there is no burn.",
      "Limits: this is a cash plan, not accounting profit. Timing within a month, credit lines and taxes due later are not modeled unless you enter them as flows. The plan is saved in this browser.",
    ],
    example: {
      title: "A year with rising sales",
      body: "Starting with 50,000, monthly inflows grow from 8,000 to 20,000 while outflows run 14,500 to 21,000.",
      input: "Opening 50,000\n12 months of inflows (164,000 total) and outflows (195,900 total)",
      output: "Lowest balance 12,400 in month 9\nClosing balance 18,100\nNo burn in the last 3 months",
    },
    faqs: [
      {
        q: "What counts as an inflow?",
        a: "Cash actually received in the month: customer payments, loans, investment, refunds. Invoices sent but not paid don't count yet.",
      },
      {
        q: "How is runway calculated?",
        a: "Closing balance ÷ average monthly net outflow of the last three months. A 60,000 balance with a 10,000 monthly burn gives 6 months of runway.",
      },
      {
        q: "Where is my plan stored?",
        a: "In this browser's local storage only. Nothing is uploaded; download the CSV to share it.",
      },
    ],
    related: ["budget-planner", "revenue-calculator", "break-even-calculator"],
  },
  {
    slug: "project-cost-calculator",
    name: "Project cost calculator",
    category: "business",
    icon: "calculator",
    summary: "Add tasks, hours, rates and expenses, apply contingency and margin, and get a project quote.",
    h1: "Estimate project cost and set a quote",
    metaTitle: "Project cost calculator and quote estimator",
    metaDescription:
      "List project tasks with hours and rates plus expenses, add a contingency buffer and a target margin, and get total cost, price, profit and tax in one quote.",
    primaryKeyword: "project cost calculator",
    intro: "Build a quote from the ground up: labor by task, materials and expenses, a buffer for unknowns and the margin you want to keep.",
    instructions: [
      "Add each task with its estimated hours and hourly rate.",
      "Add expenses and materials as fixed amounts.",
      "Set the contingency, target margin and any sales tax or VAT.",
      "Read the quote, copy the summary or download a CSV to paste into your proposal.",
    ],
    howItWorks: [
      "Labor = sum of hours × rate. Cost = (labor + expenses) × (1 + contingency). Price = cost ÷ (1 − margin), so the margin is a share of the price; the tool also shows the equivalent markup on cost. Tax is added on top of the price.",
      "The blended rate spreads the price minus expenses over all hours, which helps when a client asks for an hourly equivalent.",
      "Limits: estimates are only as good as the hours entered. Payment schedules, currency changes and taxes on expenses are not modeled. The project is saved in this browser.",
    ],
    example: {
      title: "Customer portal MVP",
      body: "Five tasks totaling 220 hours and 20,040 of labor, 730 of expenses, a 10% contingency and a 20% margin.",
      input: "Labor 20,040 (220 h)\nExpenses 730\nContingency 10%\nMargin 20%",
      output: "Total cost 22,847.00\nPrice 28,558.75\nProfit 5,711.75 (25% markup)",
    },
    faqs: [
      {
        q: "Should I use margin or markup?",
        a: "Margin is the share of the price you keep, which is how most businesses track profitability. A 20% margin equals a 25% markup on cost.",
      },
      {
        q: "How much contingency should I add?",
        a: "Many teams use 10% to 20% for well-understood work and more for projects with unclear scope. The right figure comes from how far past estimates have been off.",
      },
      {
        q: "Can I turn this into a formal quote?",
        a: "Yes. Copy the line items into the [quotation generator](/tools/quotation-generator) to produce a PDF with validity date and terms.",
      },
    ],
    related: ["quotation-generator", "employee-cost-calculator", "profit-margin-calculator"],
  },
  {
    slug: "meeting-cost-calculator",
    name: "Meeting cost calculator",
    category: "business",
    icon: "timer",
    summary: "See what a meeting costs from attendees' pay, with a live meter that runs while you meet.",
    h1: "Calculate what a meeting really costs",
    metaTitle: "Meeting cost calculator with live meter",
    metaDescription:
      "Add attendees with annual salaries or hourly rates and an overhead factor to see the cost per minute, per meeting and per year, plus a live running cost meter.",
    primaryKeyword: "meeting cost calculator",
    intro: "Put a number on meeting time. Enter who attends and how long it runs, or start the live meter and watch the cost add up.",
    instructions: [
      "Add attendee rows with a role, the number of people and their pay per year or per hour.",
      "Set the planned length, working hours per year and an overhead percentage for taxes and benefits.",
      "Read the planned cost and the yearly cost if the meeting repeats.",
      "Select **Start meeting** to run the live meter; pause, resume or reset it at any time.",
    ],
    howItWorks: [
      "Hourly cost per person = annual salary ÷ working hours per year (2,080 for 40 hours × 52 weeks), or the hourly rate. The meeting's hourly cost is the sum for all attendees × (1 + overhead). Planned cost = hourly cost × minutes ÷ 60.",
      "The live meter measures elapsed time from the system clock, so it stays correct even if the tab is in the background, and it updates once a second when your device asks for reduced motion.",
      "Limits: this counts salary cost only, not the value of the work people could have done instead. The attendee setup is saved in this browser; the meter is not.",
    ],
    example: {
      title: "Five people for an hour",
      body: "Four engineers on 120,000 and a manager on 150,000 with 30% overhead.",
      input: "4 × 120,000/yr, 1 × 150,000/yr\n2,080 h/yr, 30% overhead, 60 minutes",
      output: "Cost per hour 393.75\nPer minute 6.56\nWeekly for a year 20,475.00",
    },
    faqs: [
      {
        q: "What overhead should I use?",
        a: "Employer taxes and benefits typically add 20% to 40% to salary. Use 0% for a salary-only figure.",
      },
      {
        q: "Does the meter keep running if I switch tabs?",
        a: "Yes. It calculates from the start time, so the total is right when you come back even if the display paused.",
      },
      {
        q: "Is attendee pay stored?",
        a: "Only in this browser's local storage, so the setup is there next time. Nothing is sent to a server.",
      },
    ],
    related: ["meeting-planner", "employee-cost-calculator", "salary-converter"],
  },
  {
    slug: "resume-builder",
    name: "Resume & CV builder",
    category: "business",
    icon: "file",
    summary: "Fill in structured sections, pick a clean template and download a text-based PDF resume, saved in your browser.",
    h1: "Build a resume and export it as PDF",
    metaTitle: "Free resume and CV builder with PDF export",
    metaDescription:
      "Write your resume section by section, choose an ATS-friendly or accent template, preview it live and download a selectable-text PDF in A4 or US Letter.",
    primaryKeyword: "resume builder",
    intro:
      "Enter your experience, education and skills once, then switch templates and paper sizes without retyping anything. The PDF is built in your browser with real, selectable text.",
    instructions: [
      "Fill in **Contact details**, then add entries under Summary, Experience, Education, Skills, Projects, Certifications and Links. Empty sections are left out.",
      "Use the up and down arrow buttons to reorder entries or whole sections.",
      "Under **Layout**, choose Classic, Modern or Compact, pick A4 or US Letter and set an accent color. Check the live preview as you go.",
      "Select **Download PDF**. Use **Export JSON** to keep a backup you can bring back later with **Import JSON**.",
    ],
    howItWorks: [
      "Your draft is saved to this browser's local storage after every change. When you export, the tool lays out each section line by line with pdf-lib: text is wrapped to the page width, job and school headers stay with their first line, and a new page starts whenever the next line would cross the bottom margin. Multi-page resumes get page numbers in the footer.",
      "Text is embedded as real characters in Noto Sans, so recruiters can select and search it and applicant tracking systems can read it. Classic and Compact use a single column with standard headings and no tables or images, which is the safest layout for automated parsing. Modern adds a colored header band that is purely visual.",
      "Limits: the on-screen preview does not show where page breaks fall, and the PDF font covers Latin, Greek and Cyrillic only, so Chinese, Japanese, Arabic or emoji characters will not print. Links are printed as text rather than clickable annotations. Clearing your browser data deletes the saved draft, so export a JSON backup.",
    ],
    example: {
      title: "Sample resume on one page",
      body: "Load the sample, keep the Classic template and A4 paper, then download. The result is a one-page PDF with a centered header and seven ruled sections in the order shown in the editor.",
      input: "Jordan Rivera, Data analyst; 2 jobs, 1 degree, 2 skill groups, 1 project, 1 certification, 2 links; Classic, A4",
      output: "jordan-rivera-resume.pdf: 1 page, A4, sections Summary, Experience, Education, Skills, Projects, Certifications, Links",
    },
    faqs: [
      {
        q: "Is my resume uploaded anywhere?",
        a: "No. Editing, preview and PDF creation all happen in your browser. The draft is kept in this browser's local storage until you clear it, so use Export JSON if you want a copy on another device.",
      },
      {
        q: "Which template should I use for online job portals?",
        a: "Classic or Compact. Both are single column with plain section headings and real text, which applicant tracking systems parse most reliably. Modern is still text-based, but its colored header is better suited to resumes you send directly to a person.",
      },
      {
        q: "How do I keep my resume to one page?",
        a: "Switch to the Compact template, which uses smaller type and tighter spacing, and trim older roles to two or three bullets. The success message after export tells you how many pages the PDF has.",
      },
      {
        q: "Why do some characters show as empty boxes in the PDF?",
        a: "The embedded font covers Latin, Greek and Cyrillic alphabets. Characters outside that set, such as CJK scripts or emoji, have no glyph in the font, so remove or transliterate them before exporting.",
      },
    ],
    related: ["portfolio-builder", "job-application-tracker", "email-signature-generator"],
    popular: true,
  },
  {
    slug: "portfolio-builder",
    name: "Portfolio builder",
    category: "business",
    icon: "app",
    summary: "Turn your profile, projects and links into one accessible HTML page you can host anywhere.",
    h1: "Create a one-file portfolio website",
    metaTitle: "Portfolio builder: one-page HTML site",
    metaDescription:
      "Add your bio, projects, skills and links, pick a theme and accent color, preview the page, then download one self-contained HTML file with no scripts.",
    primaryKeyword: "portfolio website builder",
    intro:
      "Fill in a short form and get a complete single-page portfolio as one HTML file. It has no scripts, no external requests and works on any static host.",
    instructions: [
      "Enter your name, headline, bio, location and email under **Profile**, and choose initials, a photo or no avatar.",
      "Add projects with a title, description, tags and an optional link, then list your skills and social or website links.",
      "Pick a light, dark or visitor-matched theme and an accent color, and check the preview at full or phone width.",
      "Select **Download .html** or **Copy HTML**, then upload the file to any static hosting service.",
    ],
    howItWorks: [
      'The page is generated as plain HTML with inline CSS. It uses a header, main and footer landmarks, a skip link, real headings and lists, and `lang="en"`. Every piece of text you enter is HTML-escaped, and links are accepted only when they use http, https or mailto; anything else is flagged and left out.',
      "A Content-Security-Policy meta tag blocks scripts and every external request, and an uploaded photo is cropped to a square, resized to 320 px and embedded as a data URL. Link colors are shifted lighter or darker when needed to keep at least 4.5:1 contrast against the background.",
      "Limits: this builds one page with a fixed layout, so there is no blog, contact form or multi-page navigation. The preview runs in a fully sandboxed frame, so links do not open there. Hosting is up to you; the file itself never leaves your browser.",
    ],
    example: {
      title: "Unsafe input becomes plain text",
      body: "Text that looks like code is shown literally on the page, and a script link is rejected with an error next to the field.",
      input: "Name: Ada <script>alert(1)</script>\nProject link: javascript:alert(1)",
      output:
        '<h1>Ada &lt;script&gt;alert(1)&lt;/script&gt;</h1>\nLink field: "Only http, https and mailto links are allowed." (no link is written to the file)',
    },
    faqs: [
      {
        q: "Where can I host the downloaded file?",
        a: "Anywhere that serves static files: GitHub Pages, Netlify, Cloudflare Pages, a university web space or your own server. Rename it to index.html if the host expects that name.",
      },
      {
        q: "Does the page load fonts, trackers or other files?",
        a: "No. Styles are inline, the font is the visitor's system font, your photo is embedded in the file, and a Content-Security-Policy tag blocks any external request or script.",
      },
      {
        q: "Why is my link marked as invalid?",
        a: "Only web addresses (http or https) and mailto links are allowed. A bare domain like github.com/you gets https:// added automatically, but addresses with spaces or other schemes are rejected.",
      },
      {
        q: "Is my draft saved?",
        a: "Yes, in this browser's local storage, including the resized photo. Nothing is sent to a server. Clearing your browser data removes the draft.",
      },
    ],
    related: ["resume-builder", "color-palette-generator", "html-formatter"],
  },
  {
    slug: "job-application-tracker",
    name: "Job & internship application tracker",
    category: "business",
    icon: "briefcase",
    summary: "Track job and internship applications from saved to offer, with follow-up dates, notes and CSV export.",
    h1: "Track job and internship applications",
    metaTitle: "Job and internship application tracker",
    metaDescription:
      "Log each application with status, dates, salary and notes, filter and sort your pipeline, see your response rate and move data in and out with CSV files.",
    primaryKeyword: "job application tracker",
    intro:
      "Keep every role you are considering in one list, from the first saved posting to the final offer. See what needs a follow-up today and how many applications got a response.",
    instructions: [
      "Fill in the company and role, plus any link, status, dates, salary, next step and notes, then select **Add application**.",
      "Change a status from the dropdown on each card, or select **Edit** to update all fields. **Delete** can be undone.",
      "Search, filter by status and sort the list, or switch to **Pipeline** to see one column per stage.",
      "Use **Export CSV** for a spreadsheet copy, or **Import CSV** to add or replace entries from a file.",
    ],
    howItWorks: [
      "Each application has one of five stages: Saved, Applied, Interview, Offer or Rejected. Stages are shown with a text label and a symbol, not by color alone. Entries are saved in this browser's local storage after every change.",
      "The response rate is (Interview + Offer) divided by (Applied + Interview + Offer + Rejected). Saved roles are excluded because you have not applied yet. Follow-ups due counts open applications whose follow-up date is today or earlier.",
      "CSV import needs Company and Role columns and recognizes common alternatives such as Position or URL. Rows missing a company or role, or with an unknown status, are skipped and listed by row number; unreadable dates and non-web links are cleared with a note. The tracker does not send reminders, so check it or export dates to your calendar.",
    ],
    example: {
      title: "Response rate from ten applications",
      body: "Two of the ten roles are only saved, so eight count as applied. Three of those reached an interview or offer.",
      input: "Saved 2, Applied 4, Interview 2, Offer 1, Rejected 1",
      output: "Response rate = (2 + 1) ÷ (4 + 2 + 1 + 1) = 3 ÷ 8 = 37.5%",
    },
    faqs: [
      {
        q: "Can I open the export in Excel or Google Sheets?",
        a: "Yes. The CSV is UTF-8 with a byte order mark so accented names display correctly in Excel, and values that start with = or @ are prefixed with an apostrophe so they are not run as formulas.",
      },
      {
        q: "Why does a rejection lower my response rate?",
        a: "The rate measures how often an application turned into an interview or offer. A rejection is an application that did not, so it stays in the denominator. Track rejections anyway; the trend is more useful than any single number.",
      },
      {
        q: "Is my list private?",
        a: "Yes. Everything stays in this browser's local storage and nothing is uploaded. Export a CSV regularly if you want a backup or need the list on another device.",
      },
      {
        q: "What happens to rows that cannot be imported?",
        a: "They are skipped and listed with their row number and the reason, such as an empty role or an unknown status. All other rows are still imported, and you can undo the import.",
      },
    ],
    related: ["resume-builder", "calendar-invite-ics-generator", "salary-converter"],
  },
];

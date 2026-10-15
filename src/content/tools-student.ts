import type { ToolMeta } from "./tool-types";

const resourcesLink = {
  label: "Learning roadmaps and study guides",
  href: "/student-tools/resources",
};

export const studentTools: ToolMeta[] = [
  {
    slug: "gpa-calculator",
    kind: "student",
    name: "GPA calculator",
    category: "Academic Calculators",
    icon: "calculator",
    summary:
      "Add your courses, credits, and grades to get a credit-weighted GPA on 4.0, 5.0, 10-point, or custom scales.",
    h1: "GPA calculator for any grading scale",
    metaTitle: "GPA calculator: 4.0, 5.0, 10-point and custom",
    metaDescription:
      "Free GPA calculator for university students. Add courses with credits and grades, pick a 4.0, 5.0, 10-point, or custom scale, and get a weighted GPA.",
    primaryKeyword: "gpa calculator",
    intro:
      "Enter each course with its credit hours and grade, choose the grading scale your university uses, and see your semester GPA with a full breakdown. Everything runs in your browser and nothing is sent anywhere.",
    instructions: [
      "Pick a grading scale preset (4.0 with plus and minus, 4.0 without, 5.0, or 10-point) or switch to a custom table and enter your own grade points.",
      "Add a row for each course and enter its credit hours.",
      "Choose the grade you received (or expect) for each course.",
      "Read your GPA and the per-course breakdown of quality points. Your rows are saved in this browser so you can come back later.",
    ],
    howItWorks: [
      "Each grade is converted to grade points using the selected scale. The calculator multiplies those points by the course credits to get quality points, then divides the total quality points by the total credits: **GPA = Σ(points × credits) ÷ Σ(credits)**. Courses with more credits pull the result harder.",
      "Grading systems and credit rules differ between universities and countries. Some schools give an A+ 4.3, some do not use plus and minus at all, and some exclude pass/fail or repeated courses. That is why the scale is fully configurable: check your student handbook and edit the table to match it.",
      "The result is an estimate for planning. Your official GPA is whatever your registrar calculates, including any rounding or exclusion rules this tool cannot know about.",
    ],
    example: {
      title: "Three courses on a 4.0 scale with plus and minus",
      body: "A 3-credit course with an A, a 4-credit course with a B+, and a 2-credit course with a C. The 4-credit course carries the most weight, so the B+ matters more than the C.",
      input:
        "Course 1: 3 credits, A (4.0)\nCourse 2: 4 credits, B+ (3.3)\nCourse 3: 2 credits, C (2.0)",
      output:
        "Quality points: 12.0 + 13.2 + 4.0 = 29.2\nTotal credits: 9\nGPA: 29.2 ÷ 9 = 3.244… → 3.24",
    },
    faqs: [
      {
        q: "My university uses a different scale. Will this still work?",
        a: "Yes. Choose the closest preset, then switch to the custom table and change the letters and point values so they match your handbook. The formula stays the same whatever the scale.",
      },
      {
        q: "What is the difference between GPA and CGPA?",
        a: "GPA usually refers to one semester or term. CGPA (cumulative GPA) combines all semesters so far. Use the [CGPA calculator](/student-tools/cgpa-calculator) to combine several semester GPAs.",
      },
      {
        q: "Should I include pass/fail or audit courses?",
        a: "Most universities leave them out of GPA because they carry no grade points, but rules vary. If your school excludes a course, simply do not add a row for it.",
      },
      {
        q: "Is my data stored anywhere?",
        a: "Only in your own browser's local storage, so your courses are still there next time you open the page on the same device. Clearing site data removes them. Nothing is uploaded and there is no account.",
      },
    ],
    related: ["cgpa-calculator", "grade-calculator", "percentage-calculator"],
    learnMore: [resourcesLink],
  },
  {
    slug: "cgpa-calculator",
    kind: "student",
    name: "CGPA calculator",
    category: "Academic Calculators",
    icon: "sigma",
    summary:
      "Combine semester GPAs into a cumulative GPA and find the GPA you need next semester to hit a target.",
    h1: "CGPA calculator with target planning",
    metaTitle: "CGPA calculator: cumulative GPA and target",
    metaDescription:
      "Calculate your CGPA from semester GPAs, credit-weighted or simple average, or add a new semester to your current CGPA. Find the GPA you need to hit a target.",
    primaryKeyword: "cgpa calculator",
    intro:
      "Work out your cumulative GPA from past semesters, update it with a new semester, and see exactly what GPA you need next term to reach a target CGPA.",
    instructions: [
      "Set the maximum of your scale (for example 4.0, 5.0, or 10).",
      "Choose a mode: **Semester GPAs** to list each semester, or **Previous CGPA + new semester** if you already know your current CGPA and total credits.",
      "Enter GPAs and credits. In semester mode, toggle between credit-weighted and simple average to match your university's rule.",
      "Optionally open the target helper, enter the CGPA you want and next semester's credits, and read the GPA you need.",
    ],
    howItWorks: [
      "In credit-weighted mode, **CGPA = Σ(semester GPA × semester credits) ÷ Σ(credits)**, so a heavy semester counts for more. In simple average mode, the semester GPAs are added and divided by the number of semesters. In the previous CGPA mode, your old CGPA is treated as one block with its total credits and combined with the new semester the same weighted way.",
      "The target helper solves for the missing GPA: **required = (target × (old credits + new credits) − old CGPA × old credits) ÷ new credits**. If the answer is above your scale's maximum, the target is not reachable in one semester and the tool says so.",
      "Universities calculate CGPA differently. Some weight by credits, some average semesters, some drop repeated courses or use their own rounding. The scale maximum is configurable, but confirm the official method with your department before relying on a number.",
    ],
    example: {
      title: "Three semesters on a 4.0 scale, then a target",
      body: "Credit-weighted CGPA for three semesters, followed by the GPA needed next semester to reach 3.30. The target uses a current CGPA of 3.20 over 50 credits to keep the numbers clean.",
      input:
        "Sem 1: GPA 3.20, 18 credits\nSem 2: GPA 3.60, 15 credits\nSem 3: GPA 2.90, 17 credits\nTarget: current CGPA 3.20 over 50 credits, want 3.30 after an 18-credit semester",
      output:
        "Weighted: (57.6 + 54.0 + 49.3) ÷ 50 = 160.9 ÷ 50 = 3.218 → 3.22\nSimple average: (3.20 + 3.60 + 2.90) ÷ 3 = 3.233 → 3.23\nRequired next GPA: (3.30 × 68 − 3.20 × 50) ÷ 18 = (224.4 − 160) ÷ 18 = 3.578 → 3.58",
    },
    faqs: [
      {
        q: "Should I use credit-weighted or simple average?",
        a: "Use whatever your university uses. Credit-weighted is the most common, but some institutions average semester GPAs directly. Your transcript or student handbook usually states the method.",
      },
      {
        q: "Can I convert my CGPA to a percentage here?",
        a: "No. Conversion formulas are set by individual universities and boards (for example, some multiply a 10-point CGPA by a fixed factor), and they are not interchangeable. Use the official formula your institution publishes.",
      },
      {
        q: "The target helper says my goal is not reachable. What now?",
        a: "It means the required GPA is above your scale's maximum for that many credits. Try spreading the goal over two semesters by entering a larger credit count, or set an intermediate target.",
      },
      {
        q: "Does it handle repeated or improved courses?",
        a: "Not automatically, because replacement rules vary. If your university replaces an old grade, recalculate the affected semester's GPA with the [GPA calculator](/student-tools/gpa-calculator) and enter the updated value here.",
      },
    ],
    related: ["gpa-calculator", "grade-calculator", "percentage-calculator"],
    learnMore: [resourcesLink],
  },
  {
    slug: "percentage-calculator",
    kind: "student",
    name: "Percentage calculator",
    category: "Academic Calculators",
    icon: "percent",
    summary:
      "Turn marks into percentages across subjects, find X% of Y, percentage change, and marks needed for a target.",
    h1: "Percentage calculator for exam marks",
    metaTitle: "Percentage calculator for marks and exams",
    metaDescription:
      "Convert exam marks to a percentage, total several subjects, work out X% of Y and percentage change, and find the marks you need to reach a target score.",
    primaryKeyword: "percentage calculator for marks",
    intro:
      "Quick percentage maths for students: total marks across subjects, see your overall percentage, and answer the everyday questions like \"what is 15% of 80\" without reaching for a phone calculator.",
    instructions: [
      "Choose a mode: marks to percentage, X% of Y, percentage change, or marks needed for a target.",
      "For marks, add a row per subject with marks obtained and maximum marks.",
      "Read the per-subject percentages and the overall percentage underneath.",
      "For a target, enter the total maximum marks and the percentage you want, and the tool shows the marks required.",
    ],
    howItWorks: [
      "Marks to percentage is **obtained ÷ maximum × 100**. With several subjects, the overall figure is **total obtained ÷ total maximum × 100**, which is not the same as averaging each subject's percentage when the subjects have different maximum marks.",
      "X% of Y is **X ÷ 100 × Y**. Percentage change is **(new − old) ÷ old × 100**, positive for an increase and negative for a drop. Marks needed for a target is **target% ÷ 100 × maximum**, rounded up to the next whole mark when partial marks are not possible.",
      "Results are shown to two decimal places. Some boards round or truncate differently, so check the official rule for anything that goes on a certificate.",
    ],
    example: {
      title: "Three subjects with different maximum marks",
      body: "Subjects with different maximums are combined by totals, not by averaging their percentages.",
      input: "Maths: 78 / 100\nPhysics: 45 / 50\nEnglish: 62 / 75",
      output:
        "Maths 78.00%, Physics 90.00%, English 82.67%\nTotal: 185 / 225 = 82.22%\n(Averaging the three percentages would give 83.56%, which is not your real overall score.)",
    },
    faqs: [
      {
        q: "Why is my overall percentage different from the average of my subject percentages?",
        a: "Because subjects with larger maximum marks carry more weight in the total. The overall percentage uses total obtained over total maximum, which is how most marksheets calculate it.",
      },
      {
        q: "How do I calculate the percentage increase in my marks?",
        a: "Use percentage change mode. Going from 64 to 80 marks is (80 − 64) ÷ 64 × 100 = 25% increase. Note that this differs from the 16 percentage point difference between 64% and 80%.",
      },
      {
        q: "Can it convert percentage to CGPA or GPA?",
        a: "No, because those conversions are defined by each university or board. For GPA work, use the [GPA calculator](/student-tools/gpa-calculator) with your own scale.",
      },
      {
        q: "How many marks do I need for a distinction?",
        a: "Enter the total maximum marks and your distinction threshold (for example 75%) in target mode. For 500 maximum marks, 75% needs 375 marks.",
      },
    ],
    related: ["grade-calculator", "gpa-calculator", "cgpa-calculator"],
  },
  {
    slug: "grade-calculator",
    kind: "student",
    name: "Grade calculator",
    category: "Academic Calculators",
    icon: "grade",
    summary:
      "Track weighted course components, see your current grade, and find the score you need on the final.",
    h1: "Grade calculator and final exam planner",
    metaTitle: "Grade calculator: what do I need on the final?",
    metaDescription:
      "Enter weighted assignments, quizzes, and exams to see your current course grade, set your own letter boundaries, and find the score you need on your final.",
    primaryKeyword: "grade calculator",
    intro:
      "Add each graded component with its weight and score to see where you stand in a course right now, and what you need on the final to reach the grade you want.",
    instructions: [
      "Add your course components (assignments, quizzes, midterm, final) with the weight each one carries, as listed in your syllabus.",
      "Enter your score for every component you have completed. Leave future ones blank.",
      "Adjust the letter-grade boundaries if your course uses different cut-offs.",
      "In the final exam section, enter the overall grade you want to see the score required on the remaining component.",
    ],
    howItWorks: [
      "Your current grade only counts components you have finished: **current % = Σ(score × weight) ÷ Σ(weights completed)**. That gives your standing on the work done so far, not a projection that assumes zero on everything else.",
      "For the final, the tool solves **needed = (target − Σ(score × weight of completed)) ÷ final weight**. If the result is above 100%, the target is out of reach. If it is zero or below, you have already secured it.",
      "Weights should add up to 100%. If they do not, the tool warns you, since a mistyped weight is the most common reason a result looks wrong. Curves, drop-the-lowest rules, and extra credit are not applied automatically.",
    ],
    example: {
      title: "Midterm done, final still to come",
      body: "Assignments are worth 20%, the midterm 30%, and the final 50%. The student wants an 80% overall.",
      input:
        "Assignments: 88% (weight 20%)\nMidterm: 72% (weight 30%)\nFinal: not taken (weight 50%)\nTarget overall: 80%",
      output:
        "Weighted points so far: 17.6 + 21.6 = 39.2\nCurrent grade: 39.2 ÷ 0.50 = 78.4%\nNeeded on final: (80 − 39.2) ÷ 0.50 = 81.6%",
    },
    faqs: [
      {
        q: "My syllabus uses points, not percentages. Can I still use this?",
        a: "Yes. Convert each component to a weight by dividing its maximum points by the course total. For example, a 150-point midterm in a 500-point course is 30%.",
      },
      {
        q: "Why does my current grade look higher than expected?",
        a: "Current grade is based only on completed components. If you have done well early, it reflects that. It does not assume zeros for work you have not submitted yet.",
      },
      {
        q: "How do I handle a dropped lowest quiz?",
        a: "Remove the lowest quiz score before averaging your quizzes, then enter the average as one component with the full quiz weight.",
      },
      {
        q: "Can I change what counts as an A or a B?",
        a: "Yes. The letter boundaries are editable because cut-offs vary between instructors, departments, and countries.",
      },
    ],
    related: ["gpa-calculator", "percentage-calculator", "study-planner"],
  },
  {
    slug: "study-planner",
    kind: "student",
    name: "Study planner",
    category: "Study Productivity",
    icon: "calendar",
    summary:
      "Turn subjects, deadlines, and your free hours into a weekly study schedule you can export to your calendar.",
    h1: "Weekly study planner for students",
    metaTitle: "Study planner for students: weekly schedule",
    metaDescription:
      "Plan your study week. Add subjects with deadlines, priority, and hours, set when you are free, and get a weekly schedule with overload warnings and .ics export.",
    primaryKeyword: "study planner for students",
    intro:
      "Tell the planner what you need to study, by when, and when you are actually free. It builds a realistic weekly schedule and warns you when the plan does not fit.",
    instructions: [
      "Add each subject with its deadline or exam date, a priority, and the hours you think you need.",
      "Optionally break a subject into topics to use as a checklist while you study.",
      "Set your weekly availability, the hours you can study on each day.",
      "Generate the schedule, review any overload warnings, and export it as an .ics file for Google Calendar, Apple Calendar, or Outlook.",
    ],
    howItWorks: [
      "Scheduling is deterministic, not AI. Subjects are sorted by earliest deadline first, then by higher priority, and their hours are placed into your available time slots in that order. The same inputs always produce the same plan.",
      "If the hours a subject needs do not fit before its deadline, you get an overload warning instead of a silently broken plan. That is your cue to add hours, lower an estimate, or accept that a topic gets less time.",
      "Everything is saved in your browser's local storage. The .ics export is a standard calendar file, so your schedule works in whatever calendar app you already use. Re-export after you change the plan.",
    ],
    example: {
      title: "Three subjects in a 14-hour week",
      body: "Availability is 2 hours each weekday and 4 hours on Saturday, 14 hours total. Data structures has the earliest deadline, so it is placed first.",
      input:
        "Data structures: exam in 6 days, high priority, 6 h\nCalculus: problem set in 10 days, medium priority, 5 h\nHistory essay: due in 3 weeks, low priority, 3 h\nAvailability: Mon to Fri 2 h, Sat 4 h",
      output:
        "Mon to Wed: Data structures (6 h)\nThu, Fri, and 1 h of Sat: Calculus (5 h)\nRest of Sat: History essay (3 h)\n14 of 14 hours planned, no overload warning",
    },
    faqs: [
      {
        q: "How should I estimate the hours a subject needs?",
        a: "Look at the topics, guess how long each one takes to learn and practice, then add about a third for review. After a week, compare estimates with reality and adjust.",
      },
      {
        q: "Does the planner change itself if I fall behind?",
        a: "No. Regenerate the schedule after updating your remaining hours. A deterministic plan is easier to trust because you can see exactly why each block is where it is.",
      },
      {
        q: "How do I get the schedule onto my phone?",
        a: "Export the .ics file and open or import it in your phone's calendar app, or import it into Google Calendar on the web so it syncs to your phone.",
      },
      {
        q: "Will my plan sync between devices?",
        a: "No. Data stays in the browser where you created it. To move it, export the .ics file, or recreate the subjects on the other device.",
      },
    ],
    related: ["assignment-planner", "pomodoro-timer", "coding-practice-planner"],
    learnMore: [resourcesLink],
  },
  {
    slug: "assignment-planner",
    kind: "student",
    name: "Assignment deadline planner",
    category: "Study Productivity",
    icon: "deadline",
    summary:
      "Track every assignment by due date and priority, see what is overdue or due today, and export reminders.",
    h1: "Assignment deadline planner and tracker",
    metaTitle: "Assignment planner: track deadlines free",
    metaDescription:
      "Track assignments with due dates, priority, and time estimates. See what is overdue, due today, or this week, and export to your calendar or a CSV file.",
    primaryKeyword: "assignment planner",
    intro:
      "Keep all your assignments in one list sorted by urgency, so nothing sneaks up on you. Export them to your calendar with a reminder the day before each one is due.",
    instructions: [
      "Add an assignment with its course, due date and time, priority, and estimated hours.",
      "Check the groups: overdue, due today, this week, later, and done.",
      "Use the filters to focus on one course or priority level, and mark items done as you finish them.",
      "Export to .ics for your calendar (each event includes a reminder one day before) or to CSV for a spreadsheet.",
    ],
    howItWorks: [
      "Each assignment is placed in a group by comparing its due date and time with your device's current date and time. Anything past due and not done is overdue. Within a group, items are ordered by due time and then priority.",
      "The estimated hours help you spot a heavy week early. If three large assignments land in the same group, start the biggest one first.",
      "Data lives in your browser's local storage. The .ics export works with most calendar apps, and the CSV opens in Excel, Google Sheets, or Numbers.",
    ],
    example: {
      title: "A typical Wednesday",
      body: "It is Wednesday morning. The planner groups four assignments by urgency.",
      input:
        "Lab report: due Tuesday 23:59, high\nReading quiz: due today 17:00, medium\nDatabase project milestone: due Friday 12:00, high, 6 h\nResearch proposal: due in 12 days, low, 4 h",
      output:
        "Overdue: Lab report\nToday: Reading quiz (17:00)\nThis week: Database project milestone (Friday, 6 h)\nLater: Research proposal",
    },
    faqs: [
      {
        q: "Will I get push notifications for deadlines?",
        a: "Not from this page. Export the .ics file instead: each event includes a reminder one day before, and your calendar app will notify you.",
      },
      {
        q: "What time zone are due dates in?",
        a: "Your device's local time zone. If you are studying remotely with a university in another zone, convert the official deadline to your local time when you enter it.",
      },
      {
        q: "Can I share my list with a group project partner?",
        a: "Export to CSV or .ics and send the file. There are no shared lists, because nothing is stored on a server.",
      },
      {
        q: "What is the difference between this and the study planner?",
        a: "This tracks deliverables and their due dates. The [study planner](/student-tools/study-planner) turns study hours into a weekly schedule. Many students use both.",
      },
    ],
    related: ["study-planner", "pomodoro-timer", "word-counter"],
  },
  {
    slug: "pomodoro-timer",
    kind: "student",
    name: "Pomodoro study timer",
    category: "Study Productivity",
    icon: "timer",
    summary:
      "A configurable Pomodoro timer with focus and break sessions, sound, notifications, and today's focus minutes.",
    h1: "Pomodoro timer for focused study",
    metaTitle: "Pomodoro timer for students: focus and breaks",
    metaDescription:
      "Free Pomodoro timer for studying. Set focus and break lengths, a long break every few sessions, sound and notifications, and track your focus time today.",
    primaryKeyword: "pomodoro timer for students",
    intro:
      "Study in focused blocks with short breaks in between. Set the lengths that suit you, press Space to start, and see how many focus minutes you have done today.",
    instructions: [
      "Set your focus, short break, and long break lengths, and how many focus sessions come before a long break.",
      "Choose whether sessions auto-start, whether a sound plays, and whether to allow browser notifications.",
      "Press Start or the Space bar to begin. Press Space again to pause.",
      "Check today's focus minutes as you go. Only completed focus time counts.",
    ],
    howItWorks: [
      "The timer counts down against the real clock instead of counting ticks, so it stays accurate even if your browser slows background tabs. A focus session is followed by a short break, and every Nth session is followed by a long break.",
      "The end-of-session sound is a short tone generated in the browser, so there is no audio file to load. Notifications are optional and only work after you grant permission. Some phones limit sounds and notifications when the screen is locked.",
      "Today's focus minutes are stored in your browser's local storage and reset each day. Nothing is synced or uploaded.",
    ],
    example: {
      title: "The classic 25/5 setup",
      body: "Default-style settings, running one full cycle up to the first long break.",
      input:
        "Focus 25 min, short break 5 min, long break 15 min, long break every 4 sessions",
      output:
        "Cycle: 4 × 25 min focus + 3 × 5 min short breaks + 15 min long break\nTotal: 100 + 15 + 15 = 130 min\nFocus minutes added today: 100",
    },
    faqs: [
      {
        q: "Is 25 minutes the right focus length?",
        a: "It is a starting point, not a rule. Many students prefer 40 to 50 minutes for problem sets or coding, and shorter blocks for revision. Try a few lengths for a week and keep what works.",
      },
      {
        q: "Why did I not hear the sound?",
        a: "Browsers often block audio until you interact with the page, and phones may mute it when locked or in silent mode. Press Start at least once and keep the tab open.",
      },
      {
        q: "Does it keep running if I switch tabs?",
        a: "Yes. Timing is based on the clock, so switching tabs does not make it drift. Enable notifications if you want an alert while you are in another tab.",
      },
      {
        q: "What should I do during breaks?",
        a: "Step away from the screen: stand up, stretch, get water. Scrolling your phone tends to make it harder to restart focus.",
      },
    ],
    related: ["study-planner", "assignment-planner", "coding-practice-planner"],
  },
  {
    slug: "word-counter",
    kind: "student",
    name: "Word and character counter",
    category: "Writing and References",
    icon: "text",
    summary:
      "Count words, characters, sentences, and paragraphs, estimate reading and speaking time, and track word limits.",
    h1: "Word and character counter for essays",
    metaTitle: "Word counter and character counter",
    metaDescription:
      "Count words, characters with and without spaces, sentences, and paragraphs. See reading and speaking time, track an essay word limit, and spot repeated words.",
    primaryKeyword: "word counter",
    intro:
      "Paste or type your essay, abstract, or speech and get live counts, reading and speaking time estimates, and a progress bar toward your word limit.",
    instructions: [
      "Paste or type your text into the editor.",
      "Read the live counts: words, characters with and without spaces, sentences, paragraphs, and lines.",
      "Set a word or character limit to see how close you are and whether you have gone over.",
      "Check the frequent words list to catch repetition. Turn on the local draft option if you want the text kept in this browser.",
    ],
    howItWorks: [
      "Words are counted by splitting on whitespace, so hyphenated terms like `well-known` count as one word. Sentences are counted by ending punctuation, paragraphs by blank lines, and lines by line breaks. Different apps use slightly different rules, so counts may differ from your word processor by a few words.",
      "Reading time assumes **230 words per minute** and speaking time **130 words per minute**, typical averages for adult silent reading and a presentation pace. Your own speed may differ.",
      "Counting happens entirely in your browser. The text is not uploaded. If you enable the local draft, it is saved in local storage on this device only.",
    ],
    example: {
      title: "A short sample and an essay",
      body: "Counts for a short sample, then time estimates for a full essay.",
      input:
        "Sample: \"Study smart. Rest well. Repeat tomorrow.\"\nEssay: 1,150 words",
      output:
        "Sample: 6 words, 40 characters (35 without spaces), 3 sentences, 1 paragraph\nEssay reading time: 1,150 ÷ 230 = 5 min\nEssay speaking time: 1,150 ÷ 130 ≈ 8.8 min, about 9 min",
    },
    faqs: [
      {
        q: "Does the word count include references and footnotes?",
        a: "It counts whatever you paste. Many universities exclude the reference list from essay limits, so paste only the body text if that is your rule.",
      },
      {
        q: "Why is my count different from Microsoft Word or Google Docs?",
        a: "Tools treat hyphens, numbers, symbols, and URLs differently. A difference of a few words is normal. If your assignment has a strict limit, use the count your instructor specifies.",
      },
      {
        q: "How long is a 5-minute speech?",
        a: "At about 130 words per minute, roughly 650 words. Paste your script and check the speaking time, then rehearse out loud with a timer.",
      },
      {
        q: "Is my text private?",
        a: "Yes. It never leaves your browser. The optional draft is stored only on your device and you can clear it at any time.",
      },
    ],
    related: ["citation-formatter", "assignment-planner", "study-planner"],
  },
  {
    slug: "citation-formatter",
    kind: "student",
    name: "Citation formatter",
    category: "Writing and References",
    icon: "quote",
    summary:
      "Format APA 7th and MLA 9th citations for books, journal articles, websites, and book chapters.",
    h1: "APA and MLA citation formatter",
    metaTitle: "Citation formatter: APA 7th and MLA 9th",
    metaDescription:
      "Format APA 7th and MLA 9th citations for books, journal articles, websites, and chapters. Edit the output, save a reference list, and fix title case.",
    primaryKeyword: "citation formatter",
    intro:
      "Fill in the details of a source and get a correctly ordered APA 7th or MLA 9th reference you can edit, copy, and add to a saved list.",
    instructions: [
      "Choose the style (APA 7th or MLA 9th) and the source type: book, journal article, website, or chapter in an edited book.",
      "Fill in the fields: authors, year or date, title, publisher or journal, volume, issue, pages, DOI or URL.",
      "Review the formatted citation and edit it directly if something needs adjusting.",
      "Add it to your saved list, use the case helper to convert titles to sentence or title case, and copy the list into your document.",
    ],
    howItWorks: [
      "The formatter applies each style's rules for element order, punctuation, and author names. For example, APA uses initials and sentence-case titles, while MLA uses full first names and title case. Titles that should be italic are marked in the output, so check that italics survive when you paste.",
      "The case helper converts text to sentence case or title case. Automatic case conversion cannot know about proper nouns or acronyms, so check names like `Python` or `NASA` afterward.",
      "It covers the common cases only. Unusual sources (court cases, datasets, social media posts, translated works, many authors) have extra rules, so check the official style guide or your library's guide for those. Your saved list is stored in this browser only.",
    ],
    example: {
      title: "One book in both styles",
      body: "The same book formatted for APA 7th and MLA 9th. In your document, the title should be in italics.",
      input:
        "Author: Cal Newport\nYear: 2016\nTitle: Deep work: Rules for focused success in a distracted world\nPublisher: Grand Central Publishing",
      output:
        "APA 7th: Newport, C. (2016). Deep work: Rules for focused success in a distracted world. Grand Central Publishing.\nMLA 9th: Newport, Cal. Deep Work: Rules for Focused Success in a Distracted World. Grand Central Publishing, 2016.",
    },
    faqs: [
      {
        q: "Is this an automatic citation generator that looks up sources?",
        a: "No. You enter the details yourself, which means it works offline and never guesses wrong metadata. The DOI or publisher page usually has everything you need.",
      },
      {
        q: "Does it do in-text citations?",
        a: "It focuses on reference list entries. For in-text, APA uses author and year, for example (Newport, 2016), and MLA uses author and page, for example (Newport 42).",
      },
      {
        q: "Why did my italics disappear when I pasted?",
        a: "Some editors strip formatting on paste. Re-apply italics to the title in your word processor, or paste with formatting preserved if your editor supports it.",
      },
      {
        q: "Which style should I use?",
        a: "Whichever your instructor or department asks for. APA is common in social sciences and many CS and engineering courses, and MLA is common in humanities.",
      },
    ],
    related: ["word-counter", "assignment-planner", "study-planner"],
  },
  {
    slug: "coding-practice-planner",
    kind: "student",
    name: "Coding practice planner",
    category: "Programming Practice",
    icon: "practice",
    summary:
      "Track DSA and coding topics by confidence, log practice problems by difficulty, and keep a daily streak.",
    h1: "Coding practice planner for DSA and interviews",
    metaTitle: "Coding practice planner for DSA prep",
    metaDescription:
      "Plan your coding practice. Track topics by confidence, log problems by difficulty with links, keep a streak, get a next-step suggestion, and export JSON.",
    primaryKeyword: "coding practice planner",
    intro:
      "Organize your data structures and algorithms practice in one place: which topics feel weak, which problems you have solved, and what to do next.",
    instructions: [
      "Add topics you want to practice (arrays, hashing, trees, graphs, dynamic programming) and set your confidence for each.",
      "Add practice tasks under a topic with a difficulty level and a link to the problem.",
      "Mark tasks done as you solve them to update progress and your daily streak.",
      "Use **Suggest next** when you are unsure what to work on, and export to JSON to back up or move your data.",
    ],
    howItWorks: [
      "Progress is the share of tasks marked done per topic and overall. Your streak counts consecutive days, by your device's date, on which you completed at least one task. Missing a day resets it.",
      "**Suggest next** is a simple rule, not AI: it looks for your least confident topic that still has unfinished tasks and picks the easiest of them, so you build up gradually instead of jumping to the hardest problem.",
      "Data is kept in your browser's local storage. Export to JSON regularly as a backup, and use import to restore it or move it to another device.",
    ],
    example: {
      title: "Picking the next problem",
      body: "Three topics with different confidence levels. Suggest next goes to the weakest topic with work left.",
      input:
        "Arrays: confident, 6 of 6 done\nHashing: learning, 3 of 5 done (remaining: 1 easy, 1 medium)\nGraphs: new, 0 of 4 done (2 easy, 2 medium)",
      output:
        "Overall progress: 9 of 15 tasks (60%)\nSuggest next: an easy Graphs task, since Graphs is the least confident topic with unfinished tasks",
    },
    faqs: [
      {
        q: "How many problems should I do per day?",
        a: "Consistency matters more than volume. One or two problems a day that you fully understand, including reviewing a solution afterward, beats ten rushed ones.",
      },
      {
        q: "Does it connect to LeetCode or other judges?",
        a: "No. Paste the problem link into a task so you can open it in one tap. Progress is tracked here by you, not pulled from another site.",
      },
      {
        q: "How do I move my progress to a new laptop?",
        a: "Export to JSON on the old device, then import the file on the new one. Nothing syncs automatically.",
      },
      {
        q: "What order should I learn DSA topics in?",
        a: "A common path is arrays and strings, hashing, two pointers and sliding window, stacks and queues, linked lists, trees, graphs, then dynamic programming. See the [study guides](/student-tools/resources#cs-study-guides) for how to practice each one.",
      },
    ],
    related: ["study-planner", "pomodoro-timer", "assignment-planner"],
    learnMore: [resourcesLink],
  },
];

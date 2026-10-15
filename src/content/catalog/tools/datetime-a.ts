import type { CatalogTool } from "../types";

export const tools: CatalogTool[] = [
  {
    slug: "age-calculator",
    name: "Age calculator",
    category: "date-time",
    icon: "calendar",
    popular: true,
    summary: "Exact age in years, months and days, with totals, the weekday you were born and a birthday countdown.",
    h1: "Calculate your exact age",
    metaTitle: "Age Calculator: Years, Months and Days",
    metaDescription:
      "Find an exact age in years, months and days on any date, plus total weeks, days and hours, the weekday of birth and a countdown to the next birthday.",
    primaryKeyword: "age calculator",
    intro:
      "Enter a date of birth to see an exact age today or on any other date. Leap-day birthdays get an explicit rule instead of a silent guess.",
    instructions: [
      "Pick the date of birth.",
      "Leave **Age on this date** as today, or change it to check an age on a past or future date.",
      "If the birthday is February 29, choose whether common-year birthdays fall on February 28 or March 1.",
      "Read the age, the totals and the next birthday countdown.",
    ],
    howItWorks: [
      "The age counts completed birthdays first, then completed month anniversaries since the last birthday, then the remaining days. Month anniversaries that land on a missing day are clamped to the end of the month, so someone born on January 31 completes a month on February 28 (or 29).",
      "Dates are handled as plain calendar dates, not timestamps, so daylight-saving changes and your time zone cannot shift the result by a day. Total days are the exact number of calendar days between the two dates; hours and minutes are those days times 24 and 1,440, so they ignore the time of birth.",
      "For February 29 birthdays there is no universal rule. You choose February 28 or March 1 for common years, and the age, the next birthday and the countdown all follow that choice. The calendar used is the proleptic Gregorian calendar.",
    ],
    example: {
      title: "Born May 15, 1990, checked on October 12, 2026",
      body: "The last birthday was May 15, 2026, four month anniversaries have passed since, and 27 days remain.",
      input: "Date of birth: 1990-05-15\nAge on: 2026-10-12",
      output: "36 years, 4 months, 27 days\nTotal days: 13,299\nBorn on a Tuesday\nNext birthday: May 15, 2027, in 215 days (turning 37)",
    },
    faqs: [
      {
        q: "Why does my age in days differ from other sites by one?",
        a: "Some tools count both the birth date and today. This calculator counts the days between them, the same way you would count nights, so a baby born yesterday is 1 day old.",
      },
      {
        q: "How is a February 29 birthday handled?",
        a: "You choose. With February 28, the birthday in common years is the last day of February; with March 1, it is the day after. Both the age and the countdown use your choice.",
      },
      {
        q: "Can I calculate an age on a future date?",
        a: "Yes. Change **Age on this date** to any date after the birth date, for example to check eligibility on a deadline.",
      },
      {
        q: "Is my birth date stored or sent anywhere?",
        a: "No. The calculation runs in your browser and nothing is saved or uploaded.",
      },
    ],
    related: ["date-difference-calculator", "day-of-the-week-calculator", "countdown"],
  },
  {
    slug: "date-difference-calculator",
    name: "Date difference calculator",
    category: "date-time",
    icon: "calendar",
    popular: true,
    summary: "Count the days, weeks, months and years between two dates, with an option to include the end date.",
    h1: "Count the time between two dates",
    metaTitle: "Date Difference Calculator: Days Between Dates",
    metaDescription:
      "Count days between two dates and see the gap in weeks, months and years. Include the end date if you need to, and get weekday, hour and minute totals.",
    primaryKeyword: "days between dates",
    intro: "Pick a start and an end date to see the exact gap in calendar days, weeks, months and years. Turn on the end-date option when both days should count.",
    instructions: [
      "Choose a start date (it defaults to today).",
      "Choose an end date. Use **Swap** if you entered them the wrong way round.",
      "Tick **Include the end date** if both the first and last day should count.",
      "Read the total days and the breakdown, then copy the summary if you need it.",
    ],
    howItWorks: [
      "The day count is the number of calendar days from the start to the end date, computed from a day number for each date, so daylight-saving changes never add or lose a day. Including the end date adds one day.",
      "The years, months and days breakdown counts whole anniversaries: January 31 to February 28 is one month, because February has no 31st. Weekdays counts Monday to Friday only; it does not know about public holidays.",
      "Hours, minutes and seconds assume 24-hour days. A span that crosses a daylight-saving change has one hour more or less in real elapsed time.",
    ],
    example: {
      title: "From March 15 to Christmas 2026",
      body: "Without the end date the gap is 285 days; ticking the option makes it 286.",
      input: "Start: 2026-03-15\nEnd: 2026-12-25",
      output: "285 days\n9 months, 10 days\n40 weeks 5 days\n204 weekdays (Mon to Fri)",
    },
    faqs: [
      {
        q: "Should I include the end date?",
        a: "Include it when counting days of an event that covers both dates, such as a hotel stay counted by days or a leave request from Monday to Friday. Leave it off when measuring how long until something happens.",
      },
      {
        q: "What if the end date is before the start date?",
        a: "The tool shows the same size of gap and notes that the end date comes first.",
      },
      {
        q: "Does it skip holidays?",
        a: "No. For working days with your own weekend days and holiday list, use the [business days calculator](/tools/business-days-calculator).",
      },
    ],
    related: ["business-days-calculator", "add-subtract-days", "age-calculator"],
  },
  {
    slug: "add-subtract-days",
    name: "Add / subtract days",
    category: "date-time",
    icon: "calendar",
    summary: "Add or subtract days, weeks, months and years from a date, with clear month-end rules.",
    h1: "Add or subtract days from a date",
    metaTitle: "Add or Subtract Days, Weeks and Months",
    metaDescription:
      "Add or subtract days, weeks, months or years from any date. See exactly how month ends are handled, for example what January 31 plus one month becomes.",
    primaryKeyword: "add days to date",
    intro: "Move a date forward or back by any mix of years, months, weeks and days. When a month is too short for the start day, you choose what happens.",
    instructions: [
      "Pick the start date (today by default).",
      "Choose **Add** or **Subtract**.",
      "Enter years, months, weeks and days; leave unused fields empty.",
      "Pick the month-end rule, then read the result date and any adjustment note.",
    ],
    howItWorks: [
      "Years and months are applied first as calendar steps, then weeks and days as exact day counts. Days are added on calendar dates, not as 24-hour blocks of time, so the result never drifts on a daylight-saving weekend.",
      "When the start day does not exist in the target month, **Use the last day** gives the month end (January 31 + 1 month = February 28, or 29 in a leap year) and **Roll over** carries the extra days into the next month (March 3, or March 2 in a leap year). The tool tells you when either rule applied.",
      "Because of month-end clamping, adding one month and then subtracting one month does not always return the starting date. Results are limited to the years 1 to 9999.",
    ],
    example: {
      title: "One month and ten days after January 31, 2026",
      body: "February 2026 has 28 days, so the month step lands on February 28, then ten days are added.",
      input: "Start: 2026-01-31\nAdd 1 month, 10 days\nRule: use the last day",
      output: "2026-03-10 (Tuesday, March 10, 2026)\nNote: February 2026 has no day 31",
    },
    faqs: [
      {
        q: "Is adding 4 weeks the same as adding 1 month?",
        a: "No. Four weeks is always 28 days, while a month moves to the same day number in the next month, which is 28 to 31 days later.",
      },
      {
        q: "Which month-end rule should I use?",
        a: "Most spreadsheets and programming libraries use the last day of the month. Some contracts and billing systems roll over instead; check the rule that applies to you.",
      },
      {
        q: "Can I subtract years from a February 29?",
        a: "Yes. February 29, 2024 minus one year is February 28, 2023 with the last-day rule, or March 1, 2023 with roll over.",
      },
    ],
    related: ["date-difference-calculator", "business-days-calculator", "day-of-the-week-calculator"],
  },
  {
    slug: "business-days-calculator",
    name: "Business days calculator",
    category: "date-time",
    icon: "briefcase",
    summary: "Count working days between dates or add business days, with your own weekend days and holidays.",
    h1: "Count business days between dates",
    metaTitle: "Business Days Calculator with Holidays",
    metaDescription:
      "Count working days between two dates or add business days to a date. Pick your weekend days, paste a holiday list, and the settings stay in your browser.",
    primaryKeyword: "business days calculator",
    intro: "Count working days in a range or find the date a number of business days away. Weekends are configurable and you can paste your own holiday list.",
    instructions: [
      "Choose **Count between dates** or **Add business days**.",
      "Enter the start date and either an end date or a number of days (negative counts backward).",
      "Tick the days that are weekends where you work.",
      "Paste holidays, one per line as `YYYY-MM-DD` with an optional name. Invalid lines are listed so you can fix them.",
      "Read the result and the breakdown of skipped days.",
    ],
    howItWorks: [
      "Counting walks through each calendar day in the range and classifies it as a weekend day, a holiday on a working weekday, or a business day. You decide whether the start and end dates themselves count; by default both do, so Monday to Friday of one week is 5 business days.",
      "Adding business days starts counting on the day after the start date and skips weekend days and listed holidays, so 1 business day after a Friday is the next Monday. A holiday that falls on a weekend is only skipped once and is not moved to another day.",
      "No country's holidays are built in, because they vary by region and change every year; paste the official list for your location. Your weekend choice and holiday list are saved only in this browser.",
    ],
    example: {
      title: "Year-end with two holidays",
      body: "With a Saturday and Sunday weekend and December 25 and January 1 listed as holidays:",
      input: "Count: 2026-12-21 to 2027-01-08\nAdd: 5 business days after 2026-12-23",
      output: "13 business days (19 calendar days, 4 weekend days, 2 holidays)\n5 business days after Dec 23, 2026 is 2026-12-31",
    },
    faqs: [
      {
        q: "My weekend is Friday and Saturday. Can I use that?",
        a: "Yes. Untick Saturday and Sunday and tick Friday and Saturday, or any other combination. At least one day must remain a working day.",
      },
      {
        q: "Are observed holidays handled, like a Monday off for a Sunday holiday?",
        a: "Only if you list the observed date. The tool treats exactly the dates you paste as holidays.",
      },
      {
        q: "Is the start date counted when adding days?",
        a: "No. Adding 0 days returns the start date, and adding 1 returns the next working day.",
      },
      {
        q: "Where is my holiday list saved?",
        a: "In this browser's local storage only. Use Reset to clear it.",
      },
    ],
    related: ["date-difference-calculator", "add-subtract-days", "week-number-calculator"],
  },
  {
    slug: "day-of-the-week-calculator",
    name: "Day of the week calculator",
    category: "date-time",
    icon: "calendar",
    summary: "Find the weekday of any date, plus its day of the year, ISO week, quarter and a month view.",
    h1: "What day of the week was it?",
    metaTitle: "Day of the Week Calculator for Any Date",
    metaDescription:
      "Find which weekday any date falls on, from year 1 to 9999. Also shows the day of the year, ISO and US week numbers, the quarter and a small month calendar.",
    primaryKeyword: "what day of the week",
    intro: "Pick any date to see its weekday, where it sits in the year and its week number, with a month calendar for context.",
    instructions: [
      "Choose a date (today by default).",
      "Read the weekday and which occurrence it is in the month, such as the second Tuesday.",
      "Check the day of year, ISO week, US week, quarter and leap-year status.",
    ],
    howItWorks: [
      "Each date is converted to a day count since January 1, 1970, a Thursday, and the weekday is that count modulo 7. This works for any date in the proleptic Gregorian calendar without relying on the browser's time zone.",
      "The ISO week follows ISO 8601 (Monday start, week 1 contains January 4), so early January days can belong to the last week of the previous year. The US week starts on Sunday with week 1 containing January 1.",
      "Dates before October 1582 use Gregorian rules projected backward, so they may not match historical documents written in the Julian calendar.",
    ],
    example: {
      title: "July 4, 2026",
      body: "The 250th anniversary of US independence falls on a weekend.",
      input: "2026-07-04",
      output: "Saturday (the first Saturday of July 2026)\nDay 185 of 365 · ISO week 27 · Q3",
    },
    faqs: [
      {
        q: "Does it work for historical dates?",
        a: "It uses the Gregorian calendar for all years. Many countries used the Julian calendar before 1582 (Britain until 1752), so old records can be 10 to 13 days different.",
      },
      {
        q: "Why is January 1 sometimes in week 52 or 53?",
        a: "Under ISO 8601 a week belongs to the year that holds its Thursday. If January 1 is a Friday, Saturday or Sunday, it belongs to the last week of the previous year.",
      },
      {
        q: "What does day of the year mean?",
        a: "The position of the date in its year: January 1 is day 1 and December 31 is day 365, or 366 in a leap year.",
      },
    ],
    related: ["week-number-calculator", "leap-year-checker", "age-calculator"],
  },
  {
    slug: "week-number-calculator",
    name: "Week number calculator",
    category: "date-time",
    icon: "calendar",
    summary: "ISO 8601 or US week numbers for any date, the dates of any week, and a full list of weeks.",
    h1: "Find the week number of a date",
    metaTitle: "Week Number Calculator: ISO and US Weeks",
    metaDescription:
      "Get the ISO 8601 or US week number for any date, find the start and end dates of a week, and list every week of a year with a CSV download.",
    primaryKeyword: "week number",
    intro: "Look up the week number of a date, or the dates of a given week, in either the ISO 8601 or the US system. A full table lists every week of the year.",
    instructions: [
      "Choose **ISO 8601** or **US** numbering.",
      "Pick **Week of a date** and enter a date, or **Dates of a week** and enter a year and week.",
      "Read the week number, its Monday-to-Sunday (or Sunday-to-Saturday) range and the week-numbering year.",
      "Scroll the table of all weeks, or download it as CSV.",
    ],
    howItWorks: [
      "ISO 8601 weeks start on Monday, and week 1 is the week containing January 4 (the year's first Thursday). A year has 52 or 53 ISO weeks; it has 53 when it starts on a Thursday, or on a Wednesday in a leap year. Days in early January or late December can belong to a neighboring week-numbering year, which is why the result shows that year separately.",
      "The US convention starts weeks on Sunday and makes the week containing January 1 week 1, so the first and last weeks are often partial and a year has 53 or occasionally 54 numbered weeks. Some US software uses other variants, so check which one your system expects.",
      "All calculations use calendar dates and are not affected by your time zone.",
    ],
    example: {
      title: "New Year's Day 2027",
      body: "January 1, 2027 is a Friday, so under ISO 8601 it belongs to the last week of 2026.",
      input: "2027-01-01, ISO 8601",
      output: "2026-W53, Monday Dec 28, 2026 to Sunday Jan 3, 2027\n2026 has 53 ISO weeks",
    },
    faqs: [
      {
        q: "Which system does Excel use?",
        a: "`ISOWEEKNUM` follows ISO 8601. `WEEKNUM` with its default setting matches the US system here (Sunday start, week 1 contains January 1).",
      },
      {
        q: "Why does my calendar app show a different number?",
        a: "Apps pick a system based on your region settings. Europe mostly uses ISO 8601; the US and Canada usually use Sunday-start weeks.",
      },
      {
        q: "How do I write an ISO week?",
        a: "As `YYYY-Www`, for example `2026-W42`, optionally with the weekday: `2026-W42-1` is the Monday.",
      },
    ],
    related: ["day-of-the-week-calculator", "business-days-calculator", "calendar-generator"],
  },
  {
    slug: "leap-year-checker",
    name: "Leap year checker",
    category: "date-time",
    icon: "calendar",
    summary: "Check whether a year is a leap year, see each Gregorian rule applied, and list nearby leap years.",
    h1: "Is it a leap year?",
    metaTitle: "Leap Year Checker with the Rules Explained",
    metaDescription:
      "Check whether any year is a leap year and see why, step by step with the Gregorian rules. Lists earlier and later leap years and counts them in a range.",
    primaryKeyword: "leap year checker",
    intro: "Type a year to see whether it has 366 days, with each rule of the Gregorian calendar spelled out, plus nearby leap years and a range counter.",
    instructions: [
      "Enter a year (the current year is filled in).",
      "Read the yes or no answer and the rules that decided it.",
      "See the five leap years before and after.",
      "Optionally count all leap years between two years.",
    ],
    howItWorks: [
      "A Gregorian year is a leap year if it is divisible by 4, except years divisible by 100, which are leap years only if also divisible by 400. So 2024 and 2000 are leap years, while 1900 and 2100 are not.",
      "The range counter uses the closed form floor(y/4) - floor(y/100) + floor(y/400), so it is exact for any range. The rule averages 365.2425 days per year, close to the tropical year of about 365.2422 days.",
      "The Gregorian calendar started in 1582 and was adopted country by country. Years before that are evaluated with the same rules projected backward, which differs from the Julian calendar (every fourth year a leap year) used at the time.",
    ],
    example: {
      title: "The year 2100",
      body: "2100 is divisible by 4 and by 100 but not by 400, so it skips its leap day.",
      input: "2100",
      output: "No, 365 days\nEarlier: 2092, 2096 · Later: 2104, 2108",
    },
    faqs: [
      {
        q: "Was 2000 a leap year?",
        a: "Yes. It is divisible by 400, which overrides the century exception.",
      },
      {
        q: "How many leap years are there in a century?",
        a: "24 or 25. From 2001 to 2100 there are 24, because 2100 is not a leap year; from 1901 to 2000 there are 25.",
      },
      {
        q: "Why do we have leap years at all?",
        a: "A solar year is about 365.24 days. Without an extra day roughly every four years, the calendar would drift against the seasons by about a day every four years.",
      },
    ],
    related: ["day-of-the-week-calculator", "age-calculator", "add-subtract-days"],
  },
  {
    slug: "countdown",
    name: "Countdown",
    category: "date-time",
    icon: "timer",
    summary: "Live countdown to any date and time in any time zone, with a share link and saved countdowns.",
    h1: "Count down to any date and time",
    metaTitle: "Countdown Timer to a Date, Shareable Link",
    metaDescription:
      "Make a live countdown to any date and time in any time zone. Share it with a link that converts to each viewer's clock, and save countdowns in your browser.",
    primaryKeyword: "countdown to date",
    intro: "Set a date, time and time zone to see the days, hours, minutes and seconds left. Share a link or save it for later.",
    instructions: [
      "Enter a title, then pick the date, time and time zone of the moment you are counting down to.",
      "Watch the live countdown, which also shows the target in your own zone.",
      "Select **Copy share link** to send it to someone; the link opens the same countdown.",
      "Select **Save countdown** to keep it in your list in this browser.",
    ],
    howItWorks: [
      "The target is converted to an exact instant using the browser's time zone data, including daylight-saving rules, and the countdown is that instant minus the current time. It refreshes once per second on the second and pauses while the tab is hidden, then catches up immediately when you return.",
      "The share link carries the title, date, time and zone as URL parameters. Nothing is stored on a server, so anyone with the link sees the same moment converted to their own clock.",
      "The countdown depends on your device clock. If that clock is wrong, the remaining time will be off by the same amount.",
    ],
    example: {
      title: "New Year in London",
      body: "A countdown to midnight on January 1, 2027 in Europe/London. Viewed at noon UTC on October 12, 2026, it shows:",
      input: "Date: 2027-01-01, Time: 00:00, Zone: Europe/London",
      output: "80 days, 12 hours, 0 minutes, 0 seconds",
    },
    faqs: [
      {
        q: "Will the countdown keep running if I close the tab?",
        a: "The page only updates while open, but the target is fixed, so reopening a saved countdown or link shows the correct remaining time.",
      },
      {
        q: "What happens when the time arrives?",
        a: "The countdown shows that the moment was reached and how long ago.",
      },
      {
        q: "What does the link reveal?",
        a: "Only what you typed: the title, date, time and time zone, visible in the address. Avoid putting private details in the title.",
      },
    ],
    related: ["timer-and-alarm", "exam-countdown", "time-zone-converter"],
  },
  {
    slug: "time-zone-converter",
    name: "Time zone converter",
    category: "date-time",
    icon: "globe",
    popular: true,
    summary: "Convert a date and time between any IANA time zones, with daylight saving handled automatically.",
    h1: "Convert time between time zones",
    metaTitle: "Time Zone Converter with Daylight Saving",
    metaDescription:
      "Convert a date and time from one time zone to several others at once. Covers every IANA zone your browser knows, handles daylight saving and saves your list.",
    primaryKeyword: "time zone converter",
    intro: "Enter a time in one zone and see it in as many others as you like. Daylight-saving changes, half-hour offsets and date changes are handled for you.",
    instructions: [
      "Enter the date and time, or select **Use current time**.",
      "Search for the source time zone by city, country or zone name.",
      "Add target zones with the picker below the results; reorder or remove them as needed.",
      "Read each converted time, its offset and any day change, then copy them all.",
    ],
    howItWorks: [
      "Zones come from your browser's built-in IANA time zone database (`Intl.supportedValuesOf`). For a given instant, the offset of each zone is found by formatting that instant in the zone and comparing the result with UTC, so offsets always reflect the daylight-saving rules for that exact date.",
      "Converting a local wall time to an instant checks the offsets in force around that date. If the time is skipped by a spring-forward change, it moves forward by the gap (2:30 becomes 3:30), as most calendar apps do. If it happens twice after a fall-back change, the first occurrence is used and the tool tells you.",
      "Accuracy depends on the time zone data shipped with your browser. Governments sometimes change their rules on short notice, so an out-of-date browser may be wrong for future dates in affected zones.",
    ],
    example: {
      title: "A 9:00 call in New York",
      body: "On November 3, 2026, after the US has left daylight saving time but London has too:",
      input: "2026-11-03 09:00, America/New_York",
      output: "Europe/London: 14:00 (UTC+00:00)\nAsia/Kolkata: 19:30 (UTC+05:30)\nAsia/Tokyo: 23:00 (UTC+09:00)",
    },
    faqs: [
      {
        q: "Why is the difference between two cities not always the same?",
        a: "Regions change their clocks on different dates, or not at all. New York and London are usually 5 hours apart but only 4 for a few weeks in March and in October to November.",
      },
      {
        q: "Can I search by country?",
        a: "Yes, for many common countries and abbreviations (for example India, Japan or EST). Otherwise type the city in the zone name, such as Lagos or Denver.",
      },
      {
        q: "Is my list of zones saved?",
        a: "Your target zones are saved in this browser's local storage so they are there next time. Nothing is sent to a server.",
      },
    ],
    related: ["world-clock", "meeting-planner", "unix-timestamp-converter"],
  },
  {
    slug: "world-clock",
    name: "World clock",
    category: "date-time",
    icon: "globe",
    summary: "Live clocks for the cities you choose, with offsets, day changes and your list saved locally.",
    h1: "World clock for your cities",
    metaTitle: "World Clock: Current Time in Many Cities",
    metaDescription:
      "See the current time in the cities you pick, with UTC offsets, time zone abbreviations and the difference from your own time. Your list is saved locally.",
    primaryKeyword: "world clock",
    intro: "Build a board of live clocks for the places you care about. Your own zone is always shown first.",
    instructions: [
      "Search for a city or time zone and select it to add a clock.",
      "Reorder clocks with the arrow buttons or remove them with the trash button.",
      "Switch between 24-hour and 12-hour time and show or hide seconds.",
    ],
    howItWorks: [
      "Each clock formats the current instant in its IANA time zone with the browser's `Intl` API, so daylight saving starts and ends automatically. The difference from your time is the difference between the two zones' current UTC offsets.",
      "Clocks tick once per second, aligned to the second, and pause while the tab is hidden to save battery. They refresh as soon as you come back.",
      "All clocks are driven by your device clock, so they are only as accurate as it is. Your list and display choices are stored in this browser only.",
    ],
    example: {
      title: "Typical offsets in mid-October 2026",
      body: "While Europe and North America are still on summer time:",
      input: "New York, London, Dubai, Tokyo",
      output: "New York UTC-04:00 · London UTC+01:00 · Dubai UTC+04:00 · Tokyo UTC+09:00",
    },
    faqs: [
      {
        q: "Why does a city show an abbreviation like GMT+4 instead of a name?",
        a: "Browsers only have short names for some zones in English; for others they show the offset. The time is correct either way.",
      },
      {
        q: "Is my city list private?",
        a: "Yes. It is stored in this browser's local storage and never uploaded.",
      },
      {
        q: "Will the clock drift?",
        a: "No. Every tick reads the system clock again rather than counting seconds, so it cannot drift away from your device time.",
      },
    ],
    related: ["time-zone-converter", "meeting-planner", "countdown"],
  },
  {
    slug: "meeting-planner",
    name: "Meeting planner",
    category: "date-time",
    icon: "globe",
    summary: "Find hours that suit everyone across time zones with a 24-hour grid of each person's working day.",
    h1: "Plan a meeting across time zones",
    metaTitle: "Time Zone Meeting Planner, Working Hours",
    metaDescription:
      "Find a meeting time that falls inside everyone's working hours. Add people and their time zones and see a 24-hour grid with the shared hours spelled out.",
    primaryKeyword: "time zone meeting planner",
    intro: "List the participants, their time zones and their working hours. The grid shows each person's local time for every hour of the day and highlights the hours that work for all of them.",
    instructions: [
      "Pick the meeting date.",
      "Edit, add or remove participants, each with a name, a time zone and working hours.",
      "Move the person whose day you want to plan around to the top with **First**; the grid follows their calendar day.",
      "Read the summary of shared hours, then scan the grid for near misses.",
    ],
    howItWorks: [
      "The grid has one column per real hour of the first participant's calendar day, so it has 23 or 25 columns on a daylight-saving change day. For each hour, every participant's local time is computed from the instant with the browser's time zone data.",
      "An hour counts as available for someone only if the whole hour fits inside their working hours. Overnight shifts such as 22:00 to 06:00 are supported. Columns where everyone is available are outlined and listed in the summary with each person's local times.",
      "The grid works in whole hours from the reference zone's midnight, so participants in half-hour zones see times like 19:30. It does not know about holidays or individual calendars. Participants are saved in this browser.",
    ],
    example: {
      title: "London and New York on October 12, 2026",
      body: "Both work 09:00 to 17:00. London is on UTC+01:00 and New York on UTC-04:00.",
      input: "London office: Europe/London 09:00-17:00\nNew York office: America/New_York 09:00-17:00",
      output: "3 hours of overlap: 14:00 to 17:00 for London office, 09:00 to 12:00 for New York office.\nAdding Karachi (10:00-18:00, UTC+05:00) leaves no shared hour.",
    },
    faqs: [
      {
        q: "Why is there no overlap even though the hours look close?",
        a: "An hour must be fully inside everyone's working hours. Try widening one person's hours by an hour to see whether a slot appears.",
      },
      {
        q: "Does it account for daylight saving?",
        a: "Yes. Pick the real meeting date, because offsets can change between now and then.",
      },
      {
        q: "Where are participants stored?",
        a: "In this browser's local storage. Reset participants restores the example list.",
      },
    ],
    related: ["time-zone-converter", "world-clock", "calendar-invite-ics-generator"],
  },
  {
    slug: "unix-timestamp-converter",
    name: "Unix timestamp converter",
    category: "date-time",
    icon: "hash",
    summary: "Convert Unix timestamps in seconds or milliseconds to readable dates and back, with a live clock.",
    h1: "Convert Unix timestamps to dates",
    metaTitle: "Unix Timestamp Converter, Epoch to Date",
    metaDescription:
      "Convert Unix epoch timestamps to ISO 8601, UTC, local and relative dates, with seconds or milliseconds detected for you. Also converts dates to timestamps.",
    primaryKeyword: "unix timestamp converter",
    intro: "Paste a Unix timestamp to see it as a date in several formats, or turn a date into a timestamp. The current epoch time ticks live at the top.",
    instructions: [
      "Paste a timestamp into **Unix timestamp**. Separators such as spaces or underscores are ignored.",
      "Leave the unit on **Auto-detect** or force seconds, milliseconds, microseconds or nanoseconds.",
      "Copy any of the outputs: ISO 8601 in UTC or local time, RFC 2822, readable local time or relative time.",
      "To go the other way, pick a date and time under **Date to timestamp** and choose local time or UTC.",
    ],
    howItWorks: [
      "Unix time counts seconds since 1970-01-01 00:00:00 UTC, ignoring leap seconds. Auto-detect looks at the size of the number: below 100 billion it is read as seconds (that limit is the year 5138), below 100 trillion as milliseconds, then microseconds and nanoseconds.",
      "Conversion uses the JavaScript `Date` object, which holds milliseconds, so microsecond and nanosecond inputs are rounded to the millisecond. The supported range is about 271,821 BCE to 275,760 CE.",
      "Local times use your device's time zone and its daylight-saving rules. Relative output such as \"in 3 days\" is rounded to the most natural unit.",
    ],
    example: {
      title: "A 10-digit timestamp",
      body: "Ten digits is detected as seconds.",
      input: "1791810000",
      output: "2026-10-12T13:00:00.000Z\nMon, 12 Oct 2026 13:00:00 +0000",
    },
    faqs: [
      {
        q: "Seconds or milliseconds: how can I tell?",
        a: "Current dates are 10 digits in seconds and 13 digits in milliseconds. JavaScript and Java usually use milliseconds; most Unix tools and databases use seconds.",
      },
      {
        q: "What about the year 2038 problem?",
        a: "Systems that store seconds in a signed 32-bit integer overflow on 2038-01-19 at 03:14:07 UTC. This tool is not affected, but the systems you copy values into might be.",
      },
      {
        q: "Are leap seconds included?",
        a: "No. Unix time treats every day as exactly 86,400 seconds, as the POSIX standard defines.",
      },
    ],
    related: ["date-format-converter", "time-zone-converter", "countdown"],
  },
  {
    slug: "date-format-converter",
    name: "Date format converter",
    category: "date-time",
    icon: "swap",
    summary: "Parse dates in many formats and convert them to ISO 8601, RFC 2822, Unix time or your own pattern.",
    h1: "Convert dates between formats",
    metaTitle: "Date Format Converter: ISO 8601, RFC 2822",
    metaDescription:
      "Convert a date between ISO 8601, RFC 2822, US and European numeric formats, Unix time and Excel serials, or build your own pattern with format tokens.",
    primaryKeyword: "date format converter",
    intro: "Paste a date in almost any common format and get it back in many others at once, including a custom pattern you write with tokens like `YYYY-MM-DD`.",
    instructions: [
      "Type or paste a date, or select one of the samples.",
      "For numeric dates like 03/04/2026, choose whether the day or the month comes first.",
      "Choose how to read input without a zone (local time or UTC) and which zone to show the output in.",
      "Copy any output, or write a custom pattern using the token table.",
    ],
    howItWorks: [
      "Parsing uses explicit patterns rather than the browser's lenient date parser, so the same text gives the same result in every browser. Recognized inputs include ISO 8601 (with offsets, basic format, week dates like `2026-W42-1` and ordinal dates like `2026-285`), RFC 2822 email dates, numeric dates with `/`, `-` or `.`, written dates such as `12 Oct 2026`, 12-hour times with AM or PM, and 10- or 13-digit Unix timestamps.",
      "Numeric dates are ambiguous, so you choose the order. Two-digit years follow the POSIX pivot: 69 to 99 become 1969 to 1999, 00 to 68 become 2000 to 2068 (RFC 2822 dates use the email rule, 00 to 49 as 2000s). Impossible dates such as 31/02/2026 are rejected rather than rolled over.",
      "The Excel serial uses the 1900 date system and is only valid from March 1, 1900, because Excel treats 1900 as a leap year. Only a few RFC 2822 zone names (UT, GMT, EST/EDT, CST/CDT, MST/MDT, PST/PDT) are understood; otherwise use a numeric offset.",
    ],
    example: {
      title: "An ambiguous European date",
      body: "With **Day first** selected and input read as UTC:",
      input: "03/04/2026 14:30",
      output: "ISO 8601: 2026-04-03T14:30:00Z\nRFC 2822: Fri, 03 Apr 2026 14:30:00 +0000\nPattern dddd, MMMM Do YYYY: Friday, April 3rd 2026",
    },
    faqs: [
      {
        q: "Why does the same input give a different date when I switch the order?",
        a: "03/04/2026 is March 4 in the US and 3 April in most other countries. The tool never guesses; it uses the order you select and warns when the input is ambiguous.",
      },
      {
        q: "How do I put words in a custom pattern?",
        a: "Wrap them in square brackets, such as `[Week] W`, so letters that are also tokens are not replaced.",
      },
      {
        q: "Are these the same tokens as Moment.js or Day.js?",
        a: "They follow the same widely used style for the common tokens (YYYY, MM, DD, HH, mm, ss, A, Z), but check the table here for the exact meaning of each.",
      },
    ],
    related: ["unix-timestamp-converter", "time-zone-converter", "week-number-calculator"],
  },
  {
    slug: "stopwatch",
    name: "Online stopwatch",
    category: "date-time",
    icon: "timer",
    summary: "Accurate stopwatch with laps and splits, keyboard shortcuts and CSV export.",
    h1: "Online stopwatch with laps",
    metaTitle: "Online Stopwatch with Laps and CSV Export",
    metaDescription:
      "Time anything with an accurate online stopwatch. Record laps and splits, see the fastest and slowest lap, use keyboard shortcuts and export laps to CSV.",
    primaryKeyword: "online stopwatch",
    intro: "Start, stop and lap with a click or a key press. Lap times and running splits are listed with the fastest and slowest marked.",
    instructions: [
      "Select **Start** or press Space.",
      "Select **Lap** or press L to record a lap while it runs.",
      "Press Space again to stop, then resume or press R to reset.",
      "Copy or download the laps as CSV.",
    ],
    howItWorks: [
      "Elapsed time comes from `performance.now()`, a monotonic high-resolution clock that is not affected by changes to the system clock. The display is only a view of that clock, so slow frames or a background tab never make the stopwatch lose time.",
      "Each lap stores the split (total time) at the moment you press Lap; the lap time is the difference from the previous split. CSV export includes both, formatted and in milliseconds.",
      "Keyboard shortcuts work when focus is not in a text field or on a button, so typing elsewhere is not affected. With reduced motion turned on in your system, the display updates four times a second instead of every frame. Some browsers pause the monotonic clock while the computer sleeps, so do not rely on it across a sleep.",
    ],
    example: {
      title: "Three laps",
      body: "Lap presses at 1:02.50, 2:03.10 and 3:05.95 give:",
      input: "Splits: 01:02.50, 02:03.10, 03:05.95",
      output: "Lap 1: 01:02.50\nLap 2: 01:00.60 (fastest)\nLap 3: 01:02.85 (slowest)",
    },
    faqs: [
      {
        q: "How accurate is it?",
        a: "The underlying clock has sub-millisecond resolution in most browsers (some round it slightly for privacy). Your reaction time when pressing a key is a much larger source of error.",
      },
      {
        q: "Why does Space not work?",
        a: "Shortcuts are ignored while a text field, button or link has focus. Click an empty part of the page and try again, or use the buttons.",
      },
      {
        q: "Are my laps saved?",
        a: "No. They stay on the page until you reset or leave it. Export to CSV to keep them.",
      },
    ],
    related: ["timer-and-alarm", "presentation-timer", "study-timer"],
  },
  {
    slug: "timer-and-alarm",
    name: "Timer & alarm",
    category: "date-time",
    icon: "timer",
    summary: "Countdown timer and time-of-day alarm with a generated sound, tab title updates and optional notifications.",
    h1: "Online timer and alarm clock",
    metaTitle: "Online Timer and Alarm with Sound",
    metaDescription:
      "Set a countdown timer or a time-of-day alarm that plays a sound, shows the time left in the tab title and can send a browser notification. No sign-up.",
    primaryKeyword: "online timer",
    intro: "Start a countdown or set an alarm for a time of day. When it goes off you hear a tone, the tab title changes and, if you allow it, a notification appears.",
    instructions: [
      "Enter hours, minutes and seconds or pick a preset, then select **Start timer**.",
      "Pause, resume, add a minute or cancel while it runs.",
      "For an alarm, pick a time, add an optional label and select **Set alarm**.",
      "Choose a sound and volume, test it, and turn on notifications if you want them.",
    ],
    howItWorks: [
      "The timer stores its end time rather than counting down tick by tick, so throttled background tabs or a sleeping device cannot make it run slow. When the page wakes up it compares the clock with the end time and, if it is past, rings and tells you how late it was.",
      "The alarm fires at the next occurrence of the chosen time in your local time zone, today or tomorrow. Sounds are generated with the Web Audio API (no audio files) and ring for 30 seconds or until you stop them. The tab title shows the time remaining.",
      "Browsers only run timers while the page is open, and many block sound until you have interacted with the page, which starting the timer does. Notifications need your permission and may not appear on some mobile browsers.",
    ],
    example: {
      title: "A 25-minute focus block",
      body: "Started at 14:00:00:",
      input: "0 h 25 min 0 s",
      output: "Ends at 2:25 PM. Tab title: 25:00 · Timer, counting down.\nAt 14:25 a chime plays and the title changes to Time is up.",
    },
    faqs: [
      {
        q: "Will the alarm ring if I close the tab or the browser?",
        a: "No. Web pages cannot run when closed. Keep the tab open; it can be in the background.",
      },
      {
        q: "Why did the sound play late?",
        a: "Background tabs and sleeping devices delay page timers. The tool notices this and reports how late it was when it wakes.",
      },
      {
        q: "I do not hear anything. What should I check?",
        a: "Select **Test sound**, check the volume slider and your device volume, and make sure the tab is not muted.",
      },
    ],
    related: ["stopwatch", "pomodoro-timer", "countdown"],
  },
];

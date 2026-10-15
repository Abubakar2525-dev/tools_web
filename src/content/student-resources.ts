export type ResourceLink = { label: string; href: string; source: string; note: string };

export type ResourceSection = {
  id: string; // kebab-case anchor
  title: string;
  intro: string;
  kind: "original" | "external";
  /** For original sections: ordered items with real substance */
  items?: { title: string; body: string; points?: string[] }[];
  /** For external sections only */
  links?: ResourceLink[];
};

export const resourceSections: ResourceSection[] = [
  {
    id: "ai-engineer-roadmap",
    title: "AI engineering learning roadmap",
    intro:
      "AI engineering is mostly software engineering with a model in the loop. This roadmap goes from writing solid Python to shipping and monitoring an LLM feature. Each stage ends with something you can build and show.",
    kind: "original",
    items: [
      {
        title: "1. Programming foundations in Python",
        body: "Almost every AI library, SDK, and tutorial assumes comfortable Python. Aim to write small programs without copying from a tutorial line by line.",
        points: [
          "Learn functions, classes, modules, exceptions, and type hints.",
          "Use virtual environments and a dependency file (`requirements.txt` or `pyproject.toml`).",
          "Read and write JSON and files, and call an HTTP API with `requests` or `httpx`.",
          "Milestone: a command-line tool that takes arguments, reads a file, and prints a clean report.",
        ],
      },
      {
        title: "2. The math you actually need",
        body: "You do not need a math degree to build with LLMs, but a working intuition helps you read papers, debug embeddings, and understand evaluation numbers.",
        points: [
          "Vectors, dot products, and cosine similarity (the basis of semantic search).",
          "Probability basics: distributions, conditional probability, and sampling.",
          "Statistics for evaluation: mean, variance, confidence, and why small test sets mislead.",
          "Milestone: compute cosine similarity between a few sentence embeddings by hand in NumPy.",
        ],
      },
      {
        title: "3. Data handling and SQL",
        body: "Real AI features run on messy business data. Being able to clean, query, and reshape data is often the difference between a demo and a product.",
        points: [
          "Use pandas to load, filter, join, and group data.",
          "Write SQL: SELECT, WHERE, JOIN, GROUP BY, and window functions.",
          "Learn to spot data quality problems: duplicates, missing values, inconsistent formats.",
          "Milestone: load a public CSV into SQLite and answer five questions about it with SQL.",
        ],
      },
      {
        title: "4. Machine learning fundamentals",
        body: "Classical ML teaches the habits that matter for LLM work too: splitting data, measuring properly, and noticing when a model is fooling you.",
        points: [
          "Understand train, validation, and test splits, and why leakage ruins results.",
          "Train a classifier with scikit-learn and read precision, recall, and a confusion matrix.",
          "Learn what overfitting looks like and how to reduce it.",
          "Milestone: a small text classifier with an honest evaluation report.",
        ],
      },
      {
        title: "5. Working with LLM APIs",
        body: "Most AI products call a hosted model through an API. Learn to do it reliably: handle failures, control output shape, and keep an eye on cost.",
        points: [
          "Send messages with a system prompt and understand tokens, context windows, and temperature.",
          "Request structured output (JSON matching a schema) and validate it in code.",
          "Handle rate limits and timeouts with retries and exponential backoff.",
          "Milestone: build a CLI that calls an LLM API with retries and logs token usage per request.",
        ],
      },
      {
        title: "6. Retrieval (RAG) and evaluation",
        body: "Retrieval-augmented generation lets a model answer from your documents. The hard part is not wiring it up, it is knowing whether it works. Build the evaluation alongside the pipeline.",
        points: [
          "Chunk documents, create embeddings, and store them in a vector index.",
          "Combine keyword and vector search, and compare results on the same questions.",
          "Create a test set of questions with expected sources, and measure retrieval hit rate.",
          "Milestone: a Q&A tool over your course notes with a 20-question evaluation you can rerun.",
        ],
      },
      {
        title: "7. Agents and tool use",
        body: "Agents let a model decide which functions to call. Start small: one or two well-defined tools, clear limits, and logs of every step.",
        points: [
          "Define tools with clear names, descriptions, and input schemas.",
          "Run a loop that executes tool calls and feeds results back, with a step limit.",
          "Add guardrails: confirm before any action that changes data, and validate tool inputs.",
          "Milestone: an assistant that can search a small database and summarize the results, with a trace of each step.",
        ],
      },
      {
        title: "8. Deployment and monitoring",
        body: "A feature is not done until it runs somewhere others can use it, and you can see when it breaks.",
        points: [
          "Wrap your pipeline in a small web API (FastAPI or similar) and containerize it with Docker.",
          "Keep secrets in environment variables, never in code or Git history.",
          "Log inputs, outputs, latency, and cost per request, and review failures weekly.",
          "Milestone: deploy your RAG tool to a free or low-cost host and share a link with a friend for feedback.",
        ],
      },
    ],
  },
  {
    id: "software-engineer-roadmap",
    title: "Software engineering roadmap for students",
    intro:
      "A practical order for learning the skills employers expect from a junior developer. You do not have to finish one stage perfectly before starting the next, but the earlier stages make the later ones much easier.",
    kind: "original",
    items: [
      {
        title: "1. Programming fundamentals",
        body: "Pick one language (Python, JavaScript, Java, or C++) and get fluent before collecting more.",
        points: [
          "Variables, control flow, functions, and recursion.",
          "Working with strings, lists or arrays, and dictionaries or maps.",
          "Reading error messages and stack traces calmly.",
          "Milestone: solve 20 small problems without looking at solutions first.",
        ],
      },
      {
        title: "2. Data structures and algorithms",
        body: "DSA teaches you to reason about efficiency, and it is still how many companies interview juniors.",
        points: [
          "Big-O notation for time and space.",
          "Arrays, hash maps, stacks, queues, linked lists, trees, heaps, and graphs.",
          "Sorting, binary search, BFS, DFS, and basic dynamic programming.",
          "Milestone: implement a hash map and a binary search tree from scratch with tests.",
        ],
      },
      {
        title: "3. Git and the command line",
        body: "Every team uses version control. Learning it early saves you from losing work and makes collaboration possible.",
        points: [
          "Commit, branch, merge, and resolve a conflict.",
          "Push to GitHub and open a pull request with a clear description.",
          "Navigate the terminal: files, processes, environment variables, and pipes.",
          "Milestone: keep every project in a Git repository with a useful README.",
        ],
      },
      {
        title: "4. Web basics",
        body: "Even if you do not want to be a web developer, most software talks over HTTP and has a web interface somewhere.",
        points: [
          "HTML, CSS, and enough JavaScript to make a page interactive.",
          "How HTTP works: methods, status codes, headers, and JSON bodies.",
          "Build and call a REST API.",
          "Milestone: a small app with a frontend that reads and writes data through your own API.",
        ],
      },
      {
        title: "5. Databases",
        body: "Nearly every real application stores data. Understand relational databases first, they are the default for good reasons.",
        points: [
          "Design tables, primary keys, and foreign keys.",
          "Write queries with JOIN and GROUP BY, and understand indexes.",
          "Use transactions and know why they matter.",
          "Milestone: connect your web app to PostgreSQL or SQLite with a migration script.",
        ],
      },
      {
        title: "6. Testing",
        body: "Tests let you change code without fear. Teams notice juniors who write them without being asked.",
        points: [
          "Write unit tests with your language's standard framework (pytest, Jest, JUnit).",
          "Test edge cases: empty input, very large input, invalid input.",
          "Run tests automatically on every push with GitHub Actions or a similar CI service.",
          "Milestone: a project with a green CI badge and meaningful test coverage of its core logic.",
        ],
      },
      {
        title: "7. System design basics",
        body: "Juniors are not expected to design huge systems, but knowing the building blocks makes you a better teammate.",
        points: [
          "Clients, servers, load balancers, caches, and queues.",
          "Trade-offs between consistency, latency, and cost.",
          "Draw a simple architecture diagram for an app you built.",
          "Milestone: write a one-page design doc for a URL shortener.",
        ],
      },
      {
        title: "8. Ship a real project",
        body: "One deployed, polished project that people use teaches more than ten half-finished tutorials.",
        points: [
          "Choose a problem you or your classmates actually have.",
          "Deploy it, add basic error handling and logging, and fix the bugs users report.",
          "Write a README that explains what it does, how to run it, and what you learned.",
          "Milestone: a live link and a repository you are proud to put on your resume.",
        ],
      },
    ],
  },
  {
    id: "cs-study-guides",
    title: "Study guides for CS students",
    intro:
      "How you study matters as much as how long. These guides cover the skills most CS courses assume you already have.",
    kind: "original",
    items: [
      {
        title: "How to study data structures and algorithms",
        body: "Reading solutions feels productive but builds little skill. Struggle first, then learn from the solution, then revisit.",
        points: [
          "Learn one pattern at a time (for example, sliding window) and solve three to five problems that use it.",
          "Give each problem 20 to 30 minutes of honest effort before reading a hint.",
          "After reading a solution, close it and write the code yourself from memory.",
          "Revisit solved problems after a few days. If you cannot solve them again, they are not learned yet.",
          "Track topics and confidence in the [coding practice planner](/student-tools/coding-practice-planner).",
        ],
      },
      {
        title: "How to read documentation",
        body: "Documentation is the most reliable source of truth for a library, and reading it well is a skill that compounds.",
        points: [
          "Start with the quickstart or getting started page and run the example exactly as written.",
          "Skim the table of contents so you know what exists, even if you do not read it all yet.",
          "Use the API reference for exact parameters, return types, and errors.",
          "Check the version of the docs matches the version you installed.",
          "Keep a notes file of snippets that worked, with a link back to the page.",
        ],
      },
      {
        title: "How to debug systematically",
        body: "Random changes waste hours. Debugging is a process of narrowing down where your assumptions break.",
        points: [
          "Reproduce the bug reliably, with the smallest input that triggers it.",
          "Read the full error message and stack trace, starting from the line in your own code.",
          "Form a hypothesis, then test it with a print statement, a debugger breakpoint, or an assertion.",
          "Change one thing at a time and re-run.",
          "Once fixed, write a test that would have caught it.",
        ],
      },
      {
        title: "How to prepare for CS exams",
        body: "CS exams usually test whether you can apply ideas, trace code, and write code by hand, not whether you can recite definitions.",
        points: [
          "Collect past papers and practice under timed conditions.",
          "Trace code on paper: write down variable values line by line.",
          "Practice writing code without an editor or autocomplete.",
          "Make a one-page summary of complexities, formulas, and definitions for each topic.",
          "Plan revision across weeks with the [study planner](/student-tools/study-planner), not the night before.",
        ],
      },
      {
        title: "How to learn a new programming language quickly",
        body: "Once you know one language, the next is mostly mapping concepts you already understand onto new syntax.",
        points: [
          "Write the same small program you know well (a to-do list or word counter) in the new language.",
          "Learn how it handles errors, collections, and modules, since those differ most.",
          "Read idiomatic code from a well-maintained open-source project.",
          "Use the official tutorial before third-party courses.",
        ],
      },
    ],
  },
  {
    id: "beginner-ai-tutorials",
    title: "Beginner-friendly AI engineering tutorials",
    intro:
      "Three short, hands-on tutorials you can finish in an evening each. They use plain Python and any LLM provider's API, so the ideas carry over whichever model you choose.",
    kind: "original",
    items: [
      {
        title: "Your first LLM API call with structured output",
        body: "Get a model to return data your code can use directly, instead of free text you have to parse with guesswork.",
        points: [
          "1. Create an API key with your chosen provider and store it in an environment variable, not in your code.",
          "2. Install the provider's Python SDK in a virtual environment.",
          "3. Write a function that sends a short product review and asks for JSON with `sentiment` (positive, neutral, negative) and `summary` fields.",
          "4. Parse the response with `json.loads` and validate it with a Pydantic model or a few explicit checks.",
          "5. Wrap the call in a retry with exponential backoff, and log what happens when validation fails.",
          "6. Run it on ten reviews and print a table of results.",
        ],
      },
      {
        title: "A tiny RAG pipeline over your notes",
        body: "Answer questions from your own course notes, with sources. For a deeper look at combining keyword and vector search, read [hybrid retrieval for business documents](/articles/hybrid-retrieval-for-business-documents).",
        points: [
          "1. Put a few of your notes into a folder as text or Markdown files.",
          "2. Split each file into chunks of a few hundred words, keeping the filename with each chunk.",
          "3. Create an embedding for each chunk and store them in a simple list or a local vector store.",
          "4. For a question, embed it, find the top three chunks by cosine similarity, and put them in the prompt.",
          "5. Ask the model to answer only from the provided chunks and to cite the filenames it used.",
          "6. Try a question your notes cannot answer and check that the model says it does not know.",
        ],
      },
      {
        title: "Evaluate a prompt with a small test set",
        body: "Stop judging prompts by feel. A small, fixed test set tells you whether a change helped. To go further, see [evaluating RAG before launch](/articles/evaluating-rag-before-launch).",
        points: [
          "1. Write 15 to 20 test inputs, including a few tricky or edge cases.",
          "2. For each, write the expected output or a simple pass rule (for example, \"must mention the deadline\").",
          "3. Write a script that runs every input through your prompt and checks each rule in code.",
          "4. Record the pass rate and save the outputs to a file with the prompt version.",
          "5. Change one thing in the prompt, rerun, and compare. Keep the change only if the pass rate improves without new failures.",
        ],
      },
    ],
  },
  {
    id: "project-ideas",
    title: "Project ideas for students and junior developers",
    intro:
      "Projects that teach real skills and make good portfolio pieces. Pick one slightly above your comfort level and finish it properly, with a README and a live link if possible.",
    kind: "original",
    items: [
      {
        title: "Personal expense tracker (beginner)",
        body: "A web or command-line app to log expenses by category and show monthly totals.",
        points: [
          "CRUD operations and form validation.",
          "Storing data in SQLite or local storage.",
          "Simple charts or summary tables.",
        ],
      },
      {
        title: "Weather dashboard with caching (beginner)",
        body: "Fetch weather for a city from a public API and show a short forecast.",
        points: [
          "Calling a third-party API and handling errors.",
          "Caching responses to avoid hitting rate limits.",
          "Responsive layout that works on a phone.",
        ],
      },
      {
        title: "Class timetable clash checker (beginner)",
        body: "Enter course sections with times and detect overlapping classes.",
        points: [
          "Working with dates and times.",
          "Interval overlap logic.",
          "Writing unit tests for edge cases like back-to-back classes.",
        ],
      },
      {
        title: "URL shortener with analytics (intermediate)",
        body: "Create short links, redirect visitors, and count clicks per link.",
        points: [
          "Designing a database schema and indexes.",
          "Generating unique IDs safely.",
          "Basic rate limiting and input validation.",
        ],
      },
      {
        title: "Course notes Q&A bot (intermediate)",
        body: "Upload notes and ask questions that are answered with citations to the source notes.",
        points: [
          "Chunking, embeddings, and vector search.",
          "Prompting a model to stay grounded in sources.",
          "Building a small evaluation set to measure answer quality.",
        ],
      },
      {
        title: "Collaborative study group board (intermediate)",
        body: "A shared board where group members post tasks and mark them done.",
        points: [
          "Authentication and per-user permissions.",
          "Real-time updates with WebSockets or polling.",
          "Deploying a full-stack app.",
        ],
      },
      {
        title: "Job posting skill extractor (intermediate)",
        body: "Paste job descriptions and extract required skills into a structured list, then compare against your own skills.",
        points: [
          "Structured output from an LLM, with schema validation.",
          "Handling inconsistent text input.",
          "Aggregating results across many postings.",
        ],
      },
      {
        title: "Log analyzer CLI (intermediate)",
        body: "A command-line tool that reads server logs and reports error rates, slowest endpoints, and top IPs.",
        points: [
          "Parsing large files efficiently, line by line.",
          "Regular expressions and aggregation.",
          "Packaging and distributing a CLI tool.",
        ],
      },
      {
        title: "Mini key-value store (advanced)",
        body: "Build a persistent key-value database with a simple network protocol.",
        points: [
          "File I/O, append-only logs, and compaction.",
          "Concurrency and locking.",
          "Benchmarking and measuring performance honestly.",
        ],
      },
      {
        title: "Support ticket triage agent (advanced)",
        body: "An agent that reads incoming tickets, classifies them, looks up related docs, and drafts a reply for human review.",
        points: [
          "Tool calling with clear input schemas.",
          "Human-in-the-loop approval before any action.",
          "Logging and tracing each step for debugging.",
        ],
      },
    ],
  },
  {
    id: "interview-prep",
    title: "Interview preparation for junior roles",
    intro:
      "A practical checklist for internship and junior developer interviews. Preparation is mostly about being able to explain your thinking clearly.",
    kind: "original",
    items: [
      {
        title: "A resume that works for juniors",
        body: "Recruiters skim quickly. Make your projects and skills easy to find and easy to verify.",
        points: [
          "Keep it to one page, with education, projects, experience, and skills.",
          "For each project, say what it does, what you built, and the stack, in one or two lines.",
          "Link to GitHub repositories and live demos that actually work.",
          "Replace vague phrases like \"worked on\" with concrete actions like \"built\", \"designed\", or \"fixed\".",
        ],
      },
      {
        title: "A DSA practice plan",
        body: "Steady practice over several weeks works better than cramming the week before.",
        points: [
          "Cover core patterns: two pointers, sliding window, hashing, BFS and DFS, binary search, and basic DP.",
          "Solve problems out loud, as if explaining to an interviewer.",
          "Time yourself: aim to reach a working solution for medium problems within about 30 to 40 minutes.",
          "Review mistakes in a log and redo those problems a week later.",
        ],
      },
      {
        title: "Explaining your projects with STAR",
        body: "STAR (situation, task, action, result) keeps your answers focused and shows what you personally did.",
        points: [
          "Situation: the problem or context in one sentence.",
          "Task: what you were responsible for.",
          "Action: the specific decisions you made and why, including trade-offs.",
          "Result: what happened, what you measured, and what you would do differently.",
        ],
      },
      {
        title: "System design basics for juniors",
        body: "Junior system design questions check whether you can reason about components and trade-offs, not whether you know every buzzword.",
        points: [
          "Start by clarifying requirements and rough scale.",
          "Sketch the main components: client, API, database, and cache if needed.",
          "Explain data models and the main API endpoints.",
          "Name one or two bottlenecks and how you would address them.",
        ],
      },
      {
        title: "Behavioral questions",
        body: "Expect questions about teamwork, conflict, failure, and learning. Prepare a few honest stories you can adapt.",
        points: [
          "Prepare stories about a hard bug, a team disagreement, a missed deadline, and learning something fast.",
          "Be specific about your role, and do not blame teammates.",
          "Show what you learned and changed afterward.",
        ],
      },
      {
        title: "What to ask the interviewer",
        body: "Good questions show interest and help you decide whether the role suits you.",
        points: [
          "What does a typical week look like for someone in this role?",
          "How are new team members onboarded and mentored?",
          "How does the team review code and handle production issues?",
          "What would success look like in the first three months?",
        ],
      },
    ],
  },
  {
    id: "coding-exercises",
    title: "Practical coding exercises",
    intro:
      "Exercises closer to real work than typical puzzle problems. Use any language. Each one lists acceptance criteria, so you know when you are done.",
    kind: "original",
    items: [
      {
        title: "Implement an LRU cache",
        body: "Build a cache with a fixed capacity that evicts the least recently used item when full.",
        points: [
          "`get(key)` and `put(key, value)` both run in O(1) time.",
          "Accessing a key with `get` marks it as most recently used.",
          "When capacity is exceeded, the least recently used key is removed.",
          "Tests cover capacity 1, updating an existing key, and eviction order.",
        ],
      },
      {
        title: "Write a rate limiter",
        body: "Limit how many requests a client can make in a time window, using a token bucket or sliding window.",
        points: [
          "`allow(client_id)` returns true or false.",
          "Limits are tracked separately per client.",
          "The clock is injectable, so tests do not need to sleep.",
          "Tests show requests are allowed again after the window passes.",
        ],
      },
      {
        title: "Parse a CSV and compute aggregates",
        body: "Read a CSV of sales (date, region, product, amount) and report totals per region and per month.",
        points: [
          "Handles quoted fields that contain commas.",
          "Skips or reports invalid rows instead of crashing.",
          "Outputs totals sorted by amount, highest first.",
          "Works on a file too large to load into memory at once, by streaming rows.",
        ],
      },
      {
        title: "Build a retry helper with exponential backoff",
        body: "Wrap a function so it retries on failure, waiting longer each time.",
        points: [
          "Configurable maximum attempts, base delay, and maximum delay.",
          "Adds random jitter to the delay.",
          "Only retries on errors you mark as retryable.",
          "Raises the last error after the final attempt.",
        ],
      },
      {
        title: "Write a tiny template engine",
        body: "Replace placeholders like `{{name}}` in a string with values from a dictionary.",
        points: [
          "Supports nested keys such as `{{user.name}}`.",
          "Missing keys either raise a clear error or use a default, based on an option.",
          "HTML-escapes values by default.",
          "Tests cover adjacent placeholders and literal braces.",
        ],
      },
      {
        title: "Implement a trie for autocomplete",
        body: "Store a list of words and return suggestions for a given prefix.",
        points: [
          "`insert(word)` and `suggest(prefix, limit)` methods.",
          "Suggestions are returned in alphabetical order.",
          "Handles an empty prefix and a prefix with no matches.",
          "Can load 100,000 words without noticeable delay.",
        ],
      },
      {
        title: "Diff two JSON objects",
        body: "Compare two JSON documents and list what was added, removed, or changed.",
        points: [
          "Reports changes with a path, for example `user.address.city`.",
          "Handles nested objects and arrays.",
          "Treats `1` and `\"1\"` as different values.",
          "Output is stable and sorted, so it can be used in tests.",
        ],
      },
      {
        title: "Build a task queue with workers",
        body: "Process jobs from a queue using a fixed number of concurrent workers.",
        points: [
          "Configurable number of workers.",
          "Failed jobs are retried up to a limit, then moved to a failed list.",
          "Graceful shutdown waits for running jobs to finish.",
          "Logs when each job starts, finishes, or fails.",
        ],
      },
      {
        title: "Validate and normalize user input",
        body: "Write a function that validates a sign-up form: email, username, password, and date of birth.",
        points: [
          "Returns all errors at once, not just the first.",
          "Trims whitespace and lowercases the email.",
          "Rejects usernames with spaces or disallowed characters.",
          "Tests include unusual but valid emails and invalid dates like 31 February.",
        ],
      },
    ],
  },
  {
    id: "external-resources",
    title: "Curated external learning resources",
    intro:
      "Free, well-established resources from other organizations that we think are worth your time. They are not affiliated with Nuvella Promo Code.",
    kind: "external",
    links: [
      {
        label: "CS50x: Introduction to Computer Science",
        href: "https://cs50.harvard.edu/x/",
        source: "Harvard University",
        note: "A rigorous first course in programming and computer science, with problem sets that build real confidence.",
      },
      {
        label: "The Missing Semester of Your CS Education",
        href: "https://missing.csail.mit.edu/",
        source: "MIT CSAIL",
        note: "Short lessons on the shell, Git, editors, and debugging tools that most courses assume you already know.",
      },
      {
        label: "The Python Tutorial",
        href: "https://docs.python.org/3/tutorial/",
        source: "Python Software Foundation",
        note: "The official introduction to Python, clear and accurate, and the best place to check how the language really works.",
      },
      {
        label: "MDN Learn web development",
        href: "https://developer.mozilla.org/en-US/docs/Learn",
        source: "Mozilla",
        note: "Structured lessons on HTML, CSS, and JavaScript from the reference most web developers rely on daily.",
      },
      {
        label: "The Odin Project",
        href: "https://www.theodinproject.com/",
        source: "The Odin Project",
        note: "A project-based full-stack web curriculum that has you set up a real development environment from day one.",
      },
      {
        label: "freeCodeCamp curriculum",
        href: "https://www.freecodecamp.org/learn",
        source: "freeCodeCamp",
        note: "Interactive lessons and certification projects you can do in the browser, useful when you only have a laptop or a lab computer.",
      },
      {
        label: "Pro Git book",
        href: "https://git-scm.com/book/en/v2",
        source: "Git project",
        note: "The full Git book, free online. Read the first three chapters and branching will finally make sense.",
      },
      {
        label: "GitHub getting started docs",
        href: "https://docs.github.com/en/get-started",
        source: "GitHub",
        note: "How repositories, pull requests, and GitHub accounts work, for when you start sharing code with others.",
      },
      {
        label: "SQLBolt",
        href: "https://sqlbolt.com/",
        source: "SQLBolt",
        note: "Bite-sized interactive SQL lessons with exercises right in the page. A fast way to get comfortable with queries.",
      },
      {
        label: "MIT OpenCourseWare",
        href: "https://ocw.mit.edu/",
        source: "MIT",
        note: "Lecture notes, videos, and problem sets from real MIT courses, including algorithms, math, and machine learning.",
      },
      {
        label: "Machine Learning Crash Course",
        href: "https://developers.google.com/machine-learning/crash-course",
        source: "Google",
        note: "A practical introduction to ML concepts with interactive visuals and exercises.",
      },
      {
        label: "Kaggle Learn",
        href: "https://www.kaggle.com/learn",
        source: "Kaggle",
        note: "Short hands-on courses on pandas, ML, and data visualization that run in hosted notebooks, no setup needed.",
      },
      {
        label: "Practical Deep Learning for Coders",
        href: "https://course.fast.ai/",
        source: "fast.ai",
        note: "A code-first deep learning course that gets you training models early and explains the theory as you go.",
      },
      {
        label: "Hugging Face Learn",
        href: "https://huggingface.co/learn",
        source: "Hugging Face",
        note: "Free courses on transformers, NLP, and working with open models, written by the people behind the libraries.",
      },
    ],
  },
];

/**
 * Original .gitignore templates (written for this site) and a merge function
 * that adds section headers and removes duplicate patterns.
 */

export interface GitignoreTemplate {
  id: string;
  name: string;
  group: "Language" | "Framework" | "Editor" | "OS" | "Tooling";
  patterns: string;
}

export const TEMPLATES: GitignoreTemplate[] = [
  {
    id: "node",
    name: "Node.js",
    group: "Language",
    patterns: `# Dependencies
node_modules/
.pnp
.pnp.js
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
*.log

# Build and coverage output
dist/
build/
coverage/
.nyc_output/
*.tsbuildinfo

# Environment
.env
.env.*
!.env.example

# Caches
.eslintcache
.cache/
.parcel-cache/`,
  },
  {
    id: "python",
    name: "Python",
    group: "Language",
    patterns: `# Bytecode
__pycache__/
*.py[cod]
*$py.class

# Virtual environments
.venv/
venv/
env/
ENV/

# Packaging
build/
dist/
*.egg-info/
.eggs/
wheels/
pip-wheel-metadata/

# Test and type-check caches
.pytest_cache/
.mypy_cache/
.ruff_cache/
.tox/
.nox/
.coverage
.coverage.*
htmlcov/

# Notebooks
.ipynb_checkpoints/

# Environment
.env`,
  },
  {
    id: "java",
    name: "Java",
    group: "Language",
    patterns: `# Compiled classes and archives
*.class
*.jar
*.war
*.ear
*.nar
hs_err_pid*
replay_pid*

# Build tools
target/
build/
.gradle/
!gradle/wrapper/gradle-wrapper.jar
out/

# Logs
*.log`,
  },
  {
    id: "kotlin",
    name: "Kotlin",
    group: "Language",
    patterns: `*.class
*.jar
build/
.gradle/
!gradle/wrapper/gradle-wrapper.jar
.kotlin/
out/`,
  },
  {
    id: "go",
    name: "Go",
    group: "Language",
    patterns: `# Binaries
*.exe
*.exe~
*.dll
*.so
*.dylib
bin/

# Test output
*.test
*.out
coverage.*

# Workspace file (usually local)
go.work
go.work.sum

# Vendored modules (remove if you commit vendor/)
vendor/`,
  },
  {
    id: "rust",
    name: "Rust",
    group: "Language",
    patterns: `# Build output
target/

# Backup files from rustfmt
**/*.rs.bk

# Debug info on Windows
*.pdb

# Libraries usually do not commit the lockfile; applications should.
# Cargo.lock`,
  },
  {
    id: "dotnet",
    name: ".NET / C#",
    group: "Language",
    patterns: `# Build output
[Bb]in/
[Oo]bj/
[Dd]ebug/
[Rr]elease/
x64/
x86/
[Ll]og/
[Ll]ogs/

# User-specific files
*.user
*.suo
*.userosscache
*.sln.docstates
.vs/

# Test results and coverage
[Tt]est[Rr]esult*/
*.trx
*.coverage
*.coveragexml

# NuGet
*.nupkg
*.snupkg
**/packages/*
!**/packages/build/
project.lock.json
project.fragment.lock.json
artifacts/`,
  },
  {
    id: "cpp",
    name: "C / C++",
    group: "Language",
    patterns: `# Object files and libraries
*.o
*.obj
*.a
*.lib
*.so
*.so.*
*.dylib
*.dll

# Executables
*.exe
*.out
*.app

# Build systems
build/
cmake-build-*/
CMakeFiles/
CMakeCache.txt
cmake_install.cmake
compile_commands.json
Makefile.local

# Debug
*.pdb
*.ilk
*.dSYM/`,
  },
  {
    id: "php",
    name: "PHP / Composer",
    group: "Language",
    patterns: `vendor/
composer.phar
.phpunit.result.cache
.phpunit.cache/
.php-cs-fixer.cache
.env`,
  },
  {
    id: "ruby",
    name: "Ruby",
    group: "Language",
    patterns: `*.gem
*.rbc
.bundle/
vendor/bundle/
.byebug_history
coverage/
pkg/
tmp/
log/*
!log/.keep
.env`,
  },
  {
    id: "swift",
    name: "Swift / Xcode",
    group: "Language",
    patterns: `# Xcode user data
xcuserdata/
*.xcuserstate
DerivedData/
*.xcscmblueprint
*.xccheckout

# Swift Package Manager
.build/
.swiftpm/
Packages/

# CocoaPods and Carthage
Pods/
Carthage/Build/

# Archives
*.ipa
*.dSYM.zip
*.dSYM`,
  },
  {
    id: "dart",
    name: "Dart / Flutter",
    group: "Language",
    patterns: `.dart_tool/
.packages
.pub-cache/
.pub/
build/
.flutter-plugins
.flutter-plugins-dependencies
*.iml
android/.gradle/
android/local.properties
ios/Pods/
ios/.symlinks/
ios/Flutter/Generated.xcconfig`,
  },
  {
    id: "android",
    name: "Android",
    group: "Framework",
    patterns: `*.apk
*.aab
*.ap_
*.dex
.gradle/
build/
local.properties
captures/
.externalNativeBuild/
.cxx/
*.jks
*.keystore
google-services.json`,
  },
  {
    id: "nextjs",
    name: "Next.js",
    group: "Framework",
    patterns: `# Next.js build output
.next/
out/

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts

# Local env files
.env*.local`,
  },
  {
    id: "react-vite",
    name: "Vite (React, Vue, Svelte)",
    group: "Framework",
    patterns: `dist/
dist-ssr/
*.local
.vite/
vite.config.*.timestamp-*`,
  },
  {
    id: "angular",
    name: "Angular",
    group: "Framework",
    patterns: `dist/
tmp/
out-tsc/
.angular/cache/
.sass-cache/
/connect.lock
/libpeerconnection.log
testem.log
/typings`,
  },
  {
    id: "django",
    name: "Django",
    group: "Framework",
    patterns: `*.sqlite3
db.sqlite3-journal
media/
staticfiles/
local_settings.py
*.pot`,
  },
  {
    id: "rails",
    name: "Ruby on Rails",
    group: "Framework",
    patterns: `/log/*
/tmp/*
!/log/.keep
!/tmp/.keep
/storage/*
!/storage/.keep
/public/assets
/public/packs
/node_modules
/config/master.key
/config/credentials/*.key
.byebug_history`,
  },
  {
    id: "laravel",
    name: "Laravel",
    group: "Framework",
    patterns: `/vendor/
/node_modules/
/public/build
/public/hot
/public/storage
/storage/*.key
.env
.env.backup
.phpunit.result.cache
Homestead.json
Homestead.yaml`,
  },
  {
    id: "unity",
    name: "Unity",
    group: "Framework",
    patterns: `/[Ll]ibrary/
/[Tt]emp/
/[Oo]bj/
/[Bb]uild/
/[Bb]uilds/
/[Ll]ogs/
/[Uu]ser[Ss]ettings/
/[Mm]emoryCaptures/
/[Rr]ecordings/
*.csproj
*.unityproj
*.sln
*.suo
*.user
*.pidb
*.booproj
*.apk
*.aab
*.unitypackage
crashlytics-build.properties
/[Aa]ssets/[Ss]treamingAssets/aa/*`,
  },
  {
    id: "unreal",
    name: "Unreal Engine",
    group: "Framework",
    patterns: `Binaries/
DerivedDataCache/
Intermediate/
Saved/
Build/
.vs/
*.VC.db
*.opensdf
*.sdf
*.sln
*.suo`,
  },
  {
    id: "terraform",
    name: "Terraform",
    group: "Tooling",
    patterns: `**/.terraform/*
*.tfstate
*.tfstate.*
crash.log
crash.*.log
*.tfvars
*.tfvars.json
override.tf
override.tf.json
*_override.tf
*_override.tf.json
.terraformrc
terraform.rc`,
  },
  {
    id: "docker",
    name: "Docker",
    group: "Tooling",
    patterns: `# Local overrides and data volumes
docker-compose.override.yml
compose.override.yaml
.docker/
*.env.docker`,
  },
  {
    id: "jupyter",
    name: "Jupyter",
    group: "Tooling",
    patterns: `.ipynb_checkpoints/
*/.ipynb_checkpoints/*
profile_default/
ipython_config.py`,
  },
  {
    id: "secrets",
    name: "Secrets and keys",
    group: "Tooling",
    patterns: `.env
.env.*
!.env.example
*.pem
*.key
*.p12
*.pfx
id_rsa*
id_ed25519*
secrets.*
credentials.json`,
  },
  {
    id: "vscode",
    name: "VS Code",
    group: "Editor",
    patterns: `.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json
*.code-workspace
.history/`,
  },
  {
    id: "jetbrains",
    name: "JetBrains IDEs",
    group: "Editor",
    patterns: `.idea/
*.iml
*.ipr
*.iws
out/
.fleet/`,
  },
  {
    id: "vim",
    name: "Vim",
    group: "Editor",
    patterns: `[._]*.s[a-v][a-z]
[._]*.sw[a-p]
[._]s[a-rt-v][a-z]
[._]ss[a-gi-z]
[._]sw[a-p]
Session.vim
Sessionx.vim
.netrwhist
*~
tags`,
  },
  {
    id: "emacs",
    name: "Emacs",
    group: "Editor",
    patterns: `*~
\\#*\\#
.\\#*
/.emacs.desktop
/.emacs.desktop.lock
*.elc
auto-save-list/
tramp
.projectile`,
  },
  {
    id: "visualstudio",
    name: "Visual Studio",
    group: "Editor",
    patterns: `.vs/
*.user
*.suo
*.sln.docstates
*.VC.db
*.VC.VC.opendb
ipch/
*.aps
*.ncb
*.opendb`,
  },
  {
    id: "macos",
    name: "macOS",
    group: "OS",
    patterns: `.DS_Store
.AppleDouble
.LSOverride
._*
.Spotlight-V100
.Trashes
.fseventsd
.DocumentRevisions-V100
.TemporaryItems
.VolumeIcon.icns`,
  },
  {
    id: "windows",
    name: "Windows",
    group: "OS",
    patterns: `Thumbs.db
Thumbs.db:encryptable
ehthumbs.db
ehthumbs_vista.db
Desktop.ini
desktop.ini
$RECYCLE.BIN/
*.lnk
*.stackdump`,
  },
  {
    id: "linux",
    name: "Linux",
    group: "OS",
    patterns: `*~
.fuse_hidden*
.directory
.Trash-*
.nfs*`,
  },
];

/**
 * Merges templates in the given order. Each template becomes a section with a
 * header; a pattern already emitted by an earlier section is skipped, and
 * comment lines that would end up heading an empty block are dropped.
 */
export function mergeTemplates(ids: string[], custom: string): { text: string; removed: number } {
  const seen = new Set<string>();
  let removed = 0;
  const sections: string[] = [];
  const addSection = (title: string, body: string) => {
    const out: string[] = [];
    let pendingComments: string[] = [];
    for (const raw of body.split(/\r?\n/)) {
      const line = raw.replace(/\s+$/, "");
      if (!line) {
        if (pendingComments.length === 0 && out.length && out[out.length - 1] !== "") out.push("");
        continue;
      }
      if (line.startsWith("#") && !line.startsWith("\\#")) {
        pendingComments.push(line);
        continue;
      }
      if (seen.has(line)) {
        removed++;
        continue;
      }
      seen.add(line);
      if (pendingComments.length) {
        if (out.length && out[out.length - 1] !== "") out.push("");
        out.push(...pendingComments);
        pendingComments = [];
      }
      out.push(line);
    }
    while (out.length && out[out.length - 1] === "") out.pop();
    while (out.length && out[0] === "") out.shift();
    if (out.length) sections.push(`### ${title} ###\n${out.join("\n")}`);
  };
  for (const id of ids) {
    const t = TEMPLATES.find((x) => x.id === id);
    if (t) addSection(t.name, t.patterns);
  }
  if (custom.trim()) addSection("Custom", custom);
  return { text: sections.length ? sections.join("\n\n") + "\n" : "", removed };
}

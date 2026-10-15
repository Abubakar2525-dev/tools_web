/** Original catalog of common Git tasks. Placeholders are written in <angle-brackets>. */

export interface GitTask {
  area: string;
  task: string;
  commands: string[];
  explain: string;
  /** Present when the command can lose work or rewrite shared history. */
  warning?: string;
  keywords?: string;
}

export const AREAS = ["Setup", "Everyday", "Branches", "Remote", "Undo", "History", "Stash", "Rewrite", "Tags", "Inspect", "Cleanup"] as const;

export const GIT_TASKS: GitTask[] = [
  // Setup
  { area: "Setup", task: "Set your name and email", commands: ['git config --global user.name "<Your Name>"', 'git config --global user.email "<you@example.com>"'], explain: "Every commit records an author. --global stores it in your user config so all repositories use it; omit --global inside a repo to set it for that repo only.", keywords: "identity author configure" },
  { area: "Setup", task: "Start a new repository", commands: ["git init -b main"], explain: "Creates a .git folder in the current directory with an initial branch named main.", keywords: "create init new" },
  { area: "Setup", task: "Clone a repository", commands: ["git clone <url>", "git clone --depth 1 <url>"], explain: "Copies a remote repository with its full history. --depth 1 makes a shallow clone with only the latest commit, which is faster for large repos.", keywords: "download copy shallow" },
  { area: "Setup", task: "Set the default branch name for new repos", commands: ["git config --global init.defaultBranch main"], explain: "New repositories created with git init will start on this branch.", keywords: "master main default" },
  { area: "Setup", task: "Create a command alias", commands: ['git config --global alias.lg "log --oneline --graph --decorate --all"'], explain: "Afterwards git lg runs the longer command. Aliases live in your global config file.", keywords: "shortcut alias" },
  { area: "Setup", task: "Normalize line endings across platforms", commands: ["git config --global core.autocrlf input", "git add --renormalize ."], explain: "On macOS and Linux, input converts CRLF to LF on commit. On Windows, true is common. A .gitattributes file with * text=auto is the more reliable per-repo setting.", keywords: "crlf lf line endings windows" },

  // Everyday
  { area: "Everyday", task: "See what changed", commands: ["git status", "git status -sb"], explain: "Shows staged, unstaged and untracked files. -sb gives a compact view with the branch and its ahead/behind count.", keywords: "status changes" },
  { area: "Everyday", task: "Stage files", commands: ["git add <file>", "git add -A", "git add -p"], explain: "-A stages every change including deletions. -p walks through each change so you can stage only some hunks.", keywords: "add stage index patch" },
  { area: "Everyday", task: "Commit staged changes", commands: ['git commit -m "<message>"'], explain: "Records the staged snapshot with a message. Use a short summary line, then a blank line and details if needed.", keywords: "commit save" },
  { area: "Everyday", task: "Stage tracked changes and commit in one step", commands: ['git commit -am "<message>"'], explain: "-a stages modifications and deletions of files Git already tracks. New untracked files are not included.", keywords: "commit all" },
  { area: "Everyday", task: "See unstaged and staged differences", commands: ["git diff", "git diff --staged"], explain: "git diff compares the working tree with the index; --staged compares the index with the last commit, which is what will be committed.", keywords: "diff compare changes" },
  { area: "Everyday", task: "Rename or move a file", commands: ["git mv <old> <new>"], explain: "Moves the file and stages the rename in one step. Git detects renames by content, so a plain move plus git add -A works too.", keywords: "rename move" },
  { area: "Everyday", task: "Stop tracking a file but keep it on disk", commands: ["git rm --cached <file>"], explain: "Removes the file from the index so the next commit deletes it from the repository, while your local copy stays. Add it to .gitignore to keep it untracked.", keywords: "untrack remove cached ignore" },

  // Branches
  { area: "Branches", task: "Create and switch to a new branch", commands: ["git switch -c <branch>"], explain: "Creates the branch at the current commit and checks it out. Equivalent to the older git checkout -b.", keywords: "create branch checkout" },
  { area: "Branches", task: "Switch to an existing branch", commands: ["git switch <branch>"], explain: "Updates your working tree to that branch. Git refuses if uncommitted changes would be overwritten.", keywords: "checkout change branch" },
  { area: "Branches", task: "List branches", commands: ["git branch", "git branch -a", "git branch -vv"], explain: "-a includes remote-tracking branches; -vv shows the upstream and ahead/behind counts for each local branch.", keywords: "list branches" },
  { area: "Branches", task: "Rename the current branch", commands: ["git branch -m <new-name>"], explain: "Renames locally. To update a remote, push the new name and delete the old one on the remote.", keywords: "rename branch" },
  { area: "Branches", task: "Delete a merged branch", commands: ["git branch -d <branch>"], explain: "Deletes the branch only if its commits are merged into the current branch or its upstream.", keywords: "delete remove branch" },
  { area: "Branches", task: "Force-delete an unmerged branch", commands: ["git branch -D <branch>"], explain: "Deletes the branch even if it has unmerged commits.", warning: "Commits only reachable from this branch become unreferenced. They can be recovered from git reflog for a limited time.", keywords: "delete force branch" },
  { area: "Branches", task: "Merge another branch into the current one", commands: ["git merge <branch>", "git merge --no-ff <branch>"], explain: "Combines histories. --no-ff always creates a merge commit, which keeps the feature branch visible in history.", keywords: "merge combine" },
  { area: "Branches", task: "Rebase your branch onto the latest main", commands: ["git fetch origin", "git rebase origin/main"], explain: "Replays your commits on top of the updated main, giving a linear history.", warning: "Rebasing rewrites commit IDs. Do not rebase commits that others have already pulled; if the branch is shared, coordinate before force-pushing.", keywords: "rebase update linear" },
  { area: "Branches", task: "Resolve a merge conflict", commands: ["git status", "# edit the conflicted files, then:", "git add <file>", "git merge --continue"], explain: "Conflicted files contain <<<<<<<, ======= and >>>>>>> markers. Edit them to the final content, stage them, then continue. Use git rebase --continue during a rebase.", keywords: "conflict resolve markers" },
  { area: "Branches", task: "Abort a merge or rebase in progress", commands: ["git merge --abort", "git rebase --abort"], explain: "Returns the branch to the state before the operation started.", keywords: "abort cancel" },
  { area: "Branches", task: "Apply one commit from another branch", commands: ["git cherry-pick <commit>"], explain: "Creates a new commit on the current branch with the same changes. Use -x to note the original commit ID in the message.", keywords: "cherry pick copy commit" },

  // Remote
  { area: "Remote", task: "Add a remote", commands: ["git remote add origin <url>", "git remote -v"], explain: "Registers a named remote. -v lists remotes with their fetch and push URLs.", keywords: "remote origin add" },
  { area: "Remote", task: "Change a remote URL", commands: ["git remote set-url origin <new-url>"], explain: "Useful when switching between HTTPS and SSH or after a repository moves.", keywords: "remote url ssh https" },
  { area: "Remote", task: "Push a new branch and set its upstream", commands: ["git push -u origin <branch>"], explain: "-u links the local branch to the remote one, so later git push and git pull need no arguments.", keywords: "push upstream publish" },
  { area: "Remote", task: "Fetch without merging", commands: ["git fetch --all --prune"], explain: "Downloads new commits and branches from every remote and removes remote-tracking branches that were deleted on the server. Your local branches are not changed.", keywords: "fetch download prune" },
  { area: "Remote", task: "Pull with rebase instead of merge", commands: ["git pull --rebase", "git config --global pull.rebase true"], explain: "Rebases your local commits on top of the fetched ones, avoiding merge commits for simple updates. The config makes it the default.", keywords: "pull rebase update" },
  { area: "Remote", task: "Force-push safely after a rebase", commands: ["git push --force-with-lease"], explain: "Overwrites the remote branch only if it still points where you last saw it, so you do not erase commits someone else pushed meanwhile.", warning: "Any force push replaces remote history. Prefer --force-with-lease over --force, and never force-push a shared main branch without agreement.", keywords: "force push lease" },
  { area: "Remote", task: "Delete a remote branch", commands: ["git push origin --delete <branch>"], explain: "Removes the branch on the remote. Collaborators can clean their stale copies with git fetch --prune.", warning: "This deletes the branch for everyone using that remote.", keywords: "delete remote branch" },
  { area: "Remote", task: "Check out a branch that exists only on the remote", commands: ["git fetch", "git switch <branch>"], explain: "If exactly one remote has a branch with that name, git switch creates a local tracking branch automatically.", keywords: "remote branch track" },

  // Undo
  { area: "Undo", task: "Discard changes in a file", commands: ["git restore <file>"], explain: "Replaces the working copy with the staged version (or the last commit if nothing is staged).", warning: "Uncommitted edits in that file are lost and cannot be recovered with Git.", keywords: "discard revert file checkout" },
  { area: "Undo", task: "Unstage a file", commands: ["git restore --staged <file>"], explain: "Moves the change out of the index but keeps it in your working tree.", keywords: "unstage reset" },
  { area: "Undo", task: "Change the last commit message or add forgotten files", commands: ["git add <forgotten-file>", 'git commit --amend -m "<new message>"'], explain: "Replaces the last commit with a new one containing the staged changes and message. Use --no-edit to keep the message.", warning: "Amending rewrites the commit. If it was already pushed, you will need to force-push.", keywords: "amend fix commit message" },
  { area: "Undo", task: "Undo the last commit but keep the changes", commands: ["git reset --soft HEAD~1"], explain: "Moves the branch back one commit; the changes stay staged so you can recommit them.", keywords: "undo commit soft reset" },
  { area: "Undo", task: "Undo the last commit and unstage the changes", commands: ["git reset HEAD~1"], explain: "The default --mixed mode moves the branch back and leaves the changes in your working tree, unstaged.", keywords: "undo commit mixed reset" },
  { area: "Undo", task: "Throw away the last commit entirely", commands: ["git reset --hard HEAD~1"], explain: "Moves the branch back and resets the working tree to match.", warning: "Discards the commit and all uncommitted changes. The commit can be found in git reflog for a while; uncommitted changes cannot.", keywords: "hard reset delete commit" },
  { area: "Undo", task: "Revert a pushed commit safely", commands: ["git revert <commit>"], explain: "Creates a new commit that applies the inverse change. History is not rewritten, so it is safe on shared branches.", keywords: "revert undo pushed" },
  { area: "Undo", task: "Reset a branch to match the remote", commands: ["git fetch origin", "git reset --hard origin/<branch>"], explain: "Makes your local branch identical to the remote version.", warning: "Local commits not on the remote and all uncommitted changes are discarded.", keywords: "reset remote match" },
  { area: "Undo", task: "Recover a lost commit or branch", commands: ["git reflog", "git switch -c <recovered-branch> <commit>"], explain: "The reflog lists where HEAD has pointed recently, including commits removed by reset or rebase. Create a branch at the entry you need.", keywords: "reflog recover lost" },

  // History
  { area: "History", task: "View compact history as a graph", commands: ["git log --oneline --graph --decorate --all"], explain: "One line per commit, with branch and tag labels and an ASCII graph of merges.", keywords: "log graph history" },
  { area: "History", task: "Find commits that touched a file", commands: ["git log --follow -p -- <file>"], explain: "--follow continues across renames; -p shows the patch for each commit.", keywords: "file history log" },
  { area: "History", task: "See who last changed each line", commands: ["git blame <file>", "git blame -L 10,30 <file>"], explain: "Shows the commit, author and date for every line. -L limits it to a line range.", keywords: "blame annotate author" },
  { area: "History", task: "Search commits by message or code", commands: ['git log --grep="<text>"', 'git log -S "<code>"'], explain: "--grep searches commit messages; -S finds commits that added or removed the given string.", keywords: "search grep pickaxe" },
  { area: "History", task: "Compare two branches", commands: ["git log main..<branch> --oneline", "git diff main...<branch>"], explain: "Two dots in log list commits on the branch that are not on main. Three dots in diff show changes since the branches diverged.", keywords: "compare branches diff" },
  { area: "History", task: "Find the commit that introduced a bug", commands: ["git bisect start", "git bisect bad", "git bisect good <commit>", "# test, then mark each step good or bad", "git bisect reset"], explain: "Binary search through history: Git checks out the midpoint each time you mark a commit, so you need about log2(n) tests.", keywords: "bisect bug regression" },

  // Stash
  { area: "Stash", task: "Save work in progress temporarily", commands: ['git stash push -m "<note>"', "git stash push -u"], explain: "Shelves uncommitted changes and cleans the working tree. -u also stashes untracked files.", keywords: "stash save wip" },
  { area: "Stash", task: "List and restore stashes", commands: ["git stash list", "git stash pop", "git stash apply stash@{1}"], explain: "pop applies the latest stash and removes it; apply keeps it in the list.", keywords: "stash pop apply" },
  { area: "Stash", task: "Delete stashes", commands: ["git stash drop stash@{0}", "git stash clear"], explain: "drop removes one entry; clear removes all of them.", warning: "Dropped stashes are hard to recover. Make sure you no longer need them.", keywords: "stash drop clear" },

  // Rewrite
  { area: "Rewrite", task: "Squash or reorder recent commits", commands: ["git rebase -i HEAD~<n>"], explain: "Opens an editor listing the last n commits. Change pick to squash, fixup, reword or drop, or reorder lines.", warning: "Interactive rebase rewrites history. Only do it on commits that have not been shared, or force-push with --force-with-lease after coordinating.", keywords: "squash interactive rebase reorder" },
  { area: "Rewrite", task: "Create a fixup commit and autosquash it", commands: ["git commit --fixup <commit>", "git rebase -i --autosquash <commit>~1"], explain: "Marks a commit as a correction for an earlier one; autosquash folds it in automatically during the rebase.", warning: "Rewrites history from that commit onward.", keywords: "fixup autosquash" },
  { area: "Rewrite", task: "Change the author of the last commit", commands: ['git commit --amend --author="<Name> <email>" --no-edit'], explain: "Rewrites the last commit with a different author, keeping the message.", warning: "Rewrites the commit; force-push needed if already pushed.", keywords: "author amend" },
  { area: "Rewrite", task: "Remove a file from all history", commands: ["git filter-repo --path <file> --invert-paths"], explain: "git filter-repo is a separate tool (install it first) and the recommended replacement for filter-branch. Rotate any leaked secret immediately; rewriting history does not un-leak it.", warning: "Rewrites every commit ID in the repository. All collaborators must re-clone or hard-reset.", keywords: "secret remove history filter" },

  // Tags
  { area: "Tags", task: "Create an annotated tag", commands: ['git tag -a v<1.2.0> -m "<Release 1.2.0>"'], explain: "Annotated tags store the tagger, date and message and are recommended for releases.", keywords: "tag release version" },
  { area: "Tags", task: "Push tags", commands: ["git push origin v<1.2.0>", "git push --tags"], explain: "Tags are not pushed by default. Push one tag by name, or all of them with --tags.", keywords: "push tags" },
  { area: "Tags", task: "Delete a tag locally and on the remote", commands: ["git tag -d v<1.2.0>", "git push origin --delete v<1.2.0>"], explain: "Removes the tag in both places.", warning: "Others who fetched the tag keep their copy until they delete it.", keywords: "delete tag" },

  // Inspect
  { area: "Inspect", task: "Show a specific commit", commands: ["git show <commit>", "git show <commit>:<path>"], explain: "Prints the commit details and patch. The second form prints a file as it was in that commit.", keywords: "show commit file" },
  { area: "Inspect", task: "Count commits by author", commands: ["git shortlog -sn --all"], explain: "Summarizes commits per author, sorted by count.", keywords: "authors stats count" },
  { area: "Inspect", task: "Work on two branches at once", commands: ["git worktree add ../<folder> <branch>", "git worktree list", "git worktree remove ../<folder>"], explain: "A worktree is a second checkout that shares the same repository, so you can build one branch while editing another.", keywords: "worktree parallel" },
  { area: "Inspect", task: "Add a repository inside another (submodule)", commands: ["git submodule add <url> <path>", "git submodule update --init --recursive"], explain: "Records a pointer to a specific commit of another repository. After cloning, the second command fetches submodule contents.", keywords: "submodule nested" },

  // Cleanup
  { area: "Cleanup", task: "Preview and remove untracked files", commands: ["git clean -n", "git clean -fd"], explain: "-n shows what would be removed. -f actually deletes, -d includes directories, -x also removes ignored files.", warning: "Deleted untracked files are not in Git and cannot be restored by it.", keywords: "clean untracked delete" },
  { area: "Cleanup", task: "Delete local branches already merged into main", commands: ["git switch main", "git branch --merged main | grep -v '^\\*\\|main' | xargs -r git branch -d"], explain: "Lists branches fully merged into main and deletes them with the safe -d flag. The pipeline is for macOS/Linux shells (or Git Bash on Windows).", keywords: "cleanup merged branches" },
  { area: "Cleanup", task: "Make Git honor a newly ignored file", commands: ["git rm -r --cached .", "git add .", 'git commit -m "Apply .gitignore"'], explain: "Files that were already tracked keep being tracked after you add them to .gitignore. Removing everything from the index and re-adding applies the ignore rules.", keywords: "gitignore cached untrack" },
  { area: "Cleanup", task: "Optimize the repository", commands: ["git gc", "git maintenance start"], explain: "gc packs objects and prunes unreachable ones. maintenance start schedules background tasks such as prefetch and commit-graph updates.", keywords: "gc maintenance performance" },
];

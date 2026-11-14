# Cloudflare Setup

## Local Cloudflare variables saved outside the repository

- **Symptom:** Credentials were saved, but a repository-local check cannot find `.env.cloudflare.local`.
- **Verified cause:** Shell redirection created the file in the shell's current directory rather than the repository root.
- **Solution:** Confirm `pwd` is the repository root before saving, then verify only variable presence and that `git check-ignore .env.cloudflare.local` succeeds. Never print credential values.
- **Regression guard:** Use ignored `.env.cloudflare.local` for local Cloudflare secrets. Prefer a hidden prompt or secret manager so token literals do not enter shell history. `>>` appends and `>` replaces file contents.

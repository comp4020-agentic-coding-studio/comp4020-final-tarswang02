# Local development and handoff

This clone is the course's **Final Project** repository, not the earlier Crit 7 app. The repository currently contains the course placeholder plus planning documents; no Proofroom application has been implemented yet.

## Environment prepared on 2026-10-06 (Australia/Sydney)

- Runtime pins from `mise.toml`: Node `24.21.0`, pnpm `11.9.0`. Both are installed. Dependencies installed with the unchanged frozen lockfile.
- An ignored `.claude/settings.local.json` symlink points to an existing course-specific Claude Code configuration on this machine. It contains the school's proxy settings; its values are not copied into this repository. The proxy `/api/me` responded HTTP 200 without printing the token. A one-turn `mise exec -- claude -p` smoke test returned `READY` with `is_error: false`; this verifies the local Claude CLI can use the configured connection, not that app development has begun.
- On 2026-10-06 a user-level GitKraken `PermissionRequest` hook stalled a read-only Claude command. This repository now has ignored `.claude/settings.json` with `gitkraken-hooks@gitkraken` disabled locally; the user-level plugin remains untouched. The stalled child was ended and the same Claude session resumed successfully. If a new session stalls, inspect its actual hook/process state rather than assuming it is progressing.
- `mise exec -- pnpm typecheck` passed on the starter plus documents. `pnpm check:evidence` still fails as expected because `PROCESS.md` and reflections are templates, with example commit links. No running Proofroom app or Docker engine was available to run the full HTTP check or image locally.
- No source commit, push, Fly deployment or repository visibility change was made as part of this preparation.

## Start Claude Code with the school environment

From this clone, run `mise exec -- claude --permission-mode acceptEdits`. Claude Code reads the ignored project settings; the one-turn smoke test already succeeded. Do not paste the key into chat. Then paste the prompt in `docs/CLAUDE_HANDOFF_PROMPT.md`.

If the ignored symlink is moved or broken, recreate `.claude/settings.local.json` from your own authorised course settings; do not move the token into a tracked file. The course key is for course work, not app-user authentication or server-side inference.

## Local checks after the app exists

Run `mise exec -- pnpm install --frozen-lockfile`. Start the app on `0.0.0.0:8080` using the `dev` script Claude adds. In a separate terminal run `mise exec -- pnpm check` (or set `APP_URL` if another port is chosen). Run `mise exec -- pnpm check:evidence` only after the student has replaced template process/reflection text with an honest account. Check `git status --short`, `git diff --check`, and that secrets remain ignored before any commit. Docker image and Fly persistence require later verification in an environment with Docker/Fly and deployment authorisation.

## Student-authored argument still needed

The official brief advises the student to draft `README.md`, `PROCESS.md` and the COMP8020 research note personally. For the first 400–600-word README, answer in your own words: Who is the room for? Which specific handoff failure did you experience or observe? What would make a claim worth trusting? Why keep contradictory evidence instead of a single Done status? What did you read or inspect, and what did you decide *not* to build? Which promises can tests enforce and which require a person to judge? Claude can challenge this argument and check citations after you write it; it should not fabricate your experience.

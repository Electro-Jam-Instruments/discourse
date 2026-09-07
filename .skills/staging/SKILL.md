---
name: staging
description: Deploy a commit of the accessibility branch to the staging Discourse instance with production data, and verify it. Use when asked to test a branch on staging, refresh staging from production, upgrade staging, or check whether accessibility work still behaves after an upstream merge. Also covers what must be true before production is touched.
---

# Staging deploy and verification

Getting a commit onto `discoursestaging.electro-jam.com` with real data, and
proving it works before production sees it.

## Environment

- Host: `jsagent@78.47.198.125`, key `~/.ssh/jamsandwich_agent`
- Staging container `staging`, port 8081, config
  `/var/discourse/containers/staging.yml`, data `/var/discourse/shared/staging`
- Production container `app` — **deliberately unreachable from `jsagent`**
- `ssh-mcp` reads credentials from `%APPDATA%\ssh-mcp\config.toml`. It ignores
  `--key=` CLI args; passing them leaves it unconfigured, which surfaces to the
  client as a connection timeout rather than an auth error.

`sudo` is scoped. Permitted: `launcher {bootstrap,start,stop,restart,rebuild,destroy,logs,enter} staging`,
`launcher cleanup`, `docker exec staging *`, `docker logs staging`, `docker ps`.
Everything else prompts for a password — **including plain `sudo true`**. Do
not test sudo with an unrelated command and conclude it is blocked.

## Before starting

Staging pulls from GitHub, not the local working tree. Unpushed work will not
appear however many times you rebuild.

```bash
git rev-parse --short HEAD
git rev-parse --short origin/accessibility   # must match
```

## 1. Pin the commit

`staging.yml` inherits an `after_code` hook that resets to the branch tip. Pin
an exact SHA so what you test is what you promote.

`sed -i` fails here — the containers directory is root-owned and sed needs to
write a temp file in it. The file itself is writable, so edit in place:

```bash
ssh -i ~/.ssh/jamsandwich_agent jsagent@78.47.198.125 'python3 - <<"PYEOF"
import io
p="/var/discourse/containers/staging.yml"
s=io.open(p,encoding="utf-8").read()
s=s.replace("git reset --hard OLD_SHA","git reset --hard NEW_SHA")
io.open(p,"w",encoding="utf-8",newline="\n").write(s)
PYEOF
python3 -c "import yaml;yaml.safe_load(open(\"/var/discourse/containers/staging.yml\"));print(\"YAML OK\")"'
```

Always re-validate the YAML after editing.

## 2. Email off before anything boots

Once production data is restored, staging holds real member addresses.

- `DISCOURSE_DISABLE_EMAILS: 'yes'` — **plural**. `DISCOURSE_DISABLE_EMAIL` is
  silently ignored: no warning, config looks correct, email stays on. This has
  already been missed once.
- Every `DISCOURSE_SMTP_*` line commented out. This is the layer that actually
  held when the env var failed.
- `DISCOURSE_NOTIFICATION_EMAIL` commented out — inherited from `app.yml`, it
  points at the real community address.

Verify at runtime, never from the config file:

```bash
sudo docker exec staging rails runner 'puts SiteSetting.disable_emails'   # yes
```

## 3. Rebuild

```bash
LOG=~/rebuild-$(date +%Y%m%d-%H%M).log
nohup sudo -n /var/discourse/launcher rebuild staging > "$LOG" 2>&1 &
```

Detached — it takes 10-20 minutes and outlives an SSH session. Poll the log
rather than holding the connection.

**A rebuild may stop halfway.** If PostgreSQL needs a major upgrade the
launcher performs it, then exits:

```
UPGRADE OF POSTGRES COMPLETE
To complete the upgrade, rebuild again using: ./launcher rebuild app
```

The site is **down** at that point. Rebuild again to finish. The message says
`app` — generic launcher text, not an instruction to touch production. The old
cluster is preserved at `/shared/postgres_data_old`.

Expect a full Ember build every time: prebuilt assets 404 for a fork. Peaks
2-4 GiB.

## 4. Restore production data

Staging bootstrapped from empty runs **one** migration and proves nothing about
the upgrade path. Only a restore exercises what production will do.

The backups directory is owned by another user, so open it via the container:

```bash
sudo docker exec staging mkdir -p /shared/backups/default
sudo docker exec staging chmod 777 /shared/backups/default
cp /var/discourse/shared/standalone/backups/default/<latest>.tar.gz \
   /var/discourse/shared/staging/backups/default/
chmod 666 /var/discourse/shared/staging/backups/default/*.tar.gz

sudo docker exec staging rails runner 'SiteSetting.allow_restore = true'

LOG=~/restore-$(date +%Y%m%d-%H%M).log
nohup sudo -n docker exec staging discourse restore <filename>.tar.gz > "$LOG" 2>&1 &
```

The version gap in the log is the migration test:

```
Current version:  20260904065041   (the branch)
Restored version: 20260331024139   (production's data)
```

Ends with `[SUCCESS] Restore done.` **Time it.** That is the best available
estimate for production's outage window.

Re-check `disable_emails` immediately afterwards. A restore overwrites site
settings with production's values; the env var should override the database,
but verify rather than assume.

## 5. Verify

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://discoursestaging.electro-jam.com/
sudo docker exec staging git -C /var/www/discourse rev-parse --short HEAD
grep -icE "ActiveRecord::|PG::|migration.*(error|fail)" "$LOG"     # expect 0
sudo docker exec staging rails runner 'puts SiteSetting.disable_emails'
curl -s -o /dev/null -w "prod %{http_code}\n" https://community.electro-jam.com/
```

Production shares the host, so confirm it stayed healthy.

## 6. Login

Restored password hashes date from the backup. If the password changed since,
or the account normally uses a passkey, login fails — and email is disabled, so
self-service reset does not work either.

Generate a reset link and hand it over. Never set a password for someone:

```bash
sudo docker exec staging rails runner '
u = User.find_by(username: "community")
t = u.email_tokens.create!(email: u.email, scope: EmailToken.scopes[:password_reset])
puts "https://discoursestaging.electro-jam.com/u/password-reset/#{t.token}"'
```

Staging only; production credentials are untouched.

## 7. Accessibility verification

Structure:

```js
document.querySelectorAll('[role="grid"]').length      // topic list
document.querySelectorAll('[role="toolbar"]').length   // nav, post menu
document.querySelectorAll('[role="tree"]').length      // sidebar
```

**Focus styles: run the audit. Do not eyeball, and do not measure one
control.** See [references/focus-audit.md](references/focus-audit.md) — paste
the script into the console and it reports every focusable control on the page
as `ok`, `suppressed` (naming the selector responsible) or `browserDefault`.

The pass condition is `total === ok`. Anything else is a finding.

Do not substitute a screenshot or a single measurement. All three have given
wrong answers here: `outline-style: auto` is the browser's own ring and looks
plausible; Chrome ignores `outline-color` when it is set, so a colour-only fix
appears to do nothing; and programmatic `.focus()` does not trigger
`:focus-visible` at all. The audit avoids all three by reading the CSSOM rather
than focusing anything.

Run it logged out **and** logged in — roughly half the interface, including
New Topic, post menus and topic-row controls, does not render for anonymous
users.

Then by hand: arrow keys through the topic list and post stream; open a
dropdown menu and use arrows, Home, End, Escape; confirm the console is silent.
Any `[A11Y-NAV]` output means `DEBUG_NAV` was left enabled in
`post-stream-navigation.js`.

Record findings in `docs/TODOs/staging-test-findings.md`. **Gather the whole
set before fixing anything** — several findings usually share one cause, and
fixing them individually hides it.

## Before production

Do not schedule production until:

- A production backup has been restored into staging and rebuilt without error
- That run was timed, giving an outage estimate
- Accessibility has been verified against real content

Then follow `docs/grid/PRODUCTION-UPGRADE-RUNBOOK.md`. Production needs a
Hetzner volume snapshot first: repointing `app.yml` does **not** undo a
PostgreSQL major upgrade, so a code rollback is not a rollback.

## Gotchas, in the order they bite

- Unpushed commits — staging pulls from GitHub
- `DISCOURSE_DISABLE_EMAIL` singular is ignored; the setting is `disable_emails`
- `sed -i` cannot write in `/var/discourse/containers`
- A rebuild stopping after a PostgreSQL upgrade is expected, not a failure
- Restoring into empty staging tests nothing
- `sudo true` reports "password required" even though scoped launcher commands
  work
- `eslint --fix` strips `role="grid"` from the 18 ARIA files; never run it there

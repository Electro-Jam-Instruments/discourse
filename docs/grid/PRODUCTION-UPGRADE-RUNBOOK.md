# Production Upgrade Runbook

Bringing `community.electro-jam.com` from its current commit onto the
`accessibility` branch after the September 2026 upstream merge.

This is **not a routine rebuild.** Production is 3306 commits and five months
behind. Staging surfaced three things that a normal deploy would not have
prepared for, and one of them rewrites the database.

Written from what staging actually did, not from what the docs say should
happen. Every claim below was observed.

## Why this is different from a normal deploy

- **PostgreSQL is upgraded 15 to 18.** Not a code deploy - a major version
  migration of the live database. The launcher does this automatically and
  without asking.
- **The rebuild stops halfway.** After the Postgres upgrade the launcher exits
  and requires a second `rebuild` to finish. A single rebuild leaves the site
  **down**.
- **Dependency install fails without the branch fix.** Fixed in
  `c2da964f720`, so it comes along with the branch, but it is why the first
  staging bootstrap failed outright.
- **Five months of migrations run against populated tables.** Staging's first
  bootstrap started from an empty database and ran exactly one migration, so it
  did **not** exercise this path. Restoring a production backup into staging is
  the only way to test it.

## What staging has and has not proven

Proven:

- The branch builds, boots, serves pages, and migrates without error
- The accessibility work survives the merge - `role="grid"`, `role="toolbar"`,
  `role="tree"`, `tablist`, roving tabindex all present in the live DOM
- No JavaScript errors, no debug logging leaking to the console
- The Postgres 15 to 18 upgrade completes, and needs a second rebuild

Not proven:

- Migrations against real data volumes
- The upgrade path from production's actual commit
- How long the Postgres upgrade takes on a real dataset
- Screen reader behaviour end to end

Do not treat "staging is green" as "production is safe" until a production
backup has been restored into staging and rebuilt.

## Before the window

- Confirm a current backup exists in
  `/var/discourse/shared/standalone/backups/default/` and note its filename.
  Backups run weekly; the newest may be up to six days old.
- Take a **Hetzner volume snapshot** as well. The database backup does not
  cover a failed Postgres upgrade leaving the data directory in a bad state.
- Restore that backup into staging and rebuild staging. This is the only
  rehearsal of the real migration path. Time it - that is your outage estimate.
- Announce a maintenance window. The Postgres upgrade plus two rebuilds plus a
  full asset build is comfortably 30-60 minutes, longer on a large database.
- Check free memory. The asset build peaks at 2-4 GiB because prebuilt assets
  404 for a fork.
- Confirm `app.yml` pins a known commit rather than tracking the branch tip, so
  what you deploy is what you tested.

## The window

### 1. Backup immediately before

```bash
cd /var/discourse
./launcher enter app
discourse backup
exit
```

Do not skip this because a weekly backup exists. The weekly one predates
whatever happened this week.

### 2. First rebuild - expect it to stop

```bash
cd /var/discourse
./launcher rebuild app 2>&1 | tee ~/prod-rebuild1-$(date +%Y%m%d-%H%M).log
```

Watch for:

```
UPGRADE OF POSTGRES COMPLETE
Old 15 database is stored at /shared/postgres_data_old
To complete the upgrade, rebuild again using:
./launcher rebuild app
```

**The site is down at this point.** This is expected, not a failure. The old
database is preserved at `/shared/postgres_data_old` - do not delete it until
the upgrade is confirmed good.

### 3. Second rebuild - completes the upgrade

```bash
./launcher rebuild app 2>&1 | tee ~/prod-rebuild2-$(date +%Y%m%d-%H%M).log
```

This one runs the migrations and builds assets. Longest phase.

### 4. Verify before announcing

```bash
# Site responds
curl -s -o /dev/null -w "%{http_code}\n" https://community.electro-jam.com/

# Correct commit deployed
sudo docker exec app git -C /var/www/discourse rev-parse --short HEAD

# Migrations clean - should print nothing
grep -iE "ActiveRecord::|PG::|migration.*(error|fail)" ~/prod-rebuild2-*.log

# Email still working on prod (unlike staging, prod SHOULD send)
sudo docker exec app rails runner 'puts SiteSetting.disable_emails'   # => no
```

Then, by hand: log in, load a topic, post a reply, check that a notification
email is delivered. Migrations can succeed while mail quietly breaks.

### 5. Accessibility spot check

```
role="grid"     on the topic list
role="toolbar"  on navigation
role="tree"     on the sidebar
```

Arrow keys through the topic list and post stream. Open a dropdown menu and
navigate it with arrows, Home/End, Escape - that component was rebuilt during
the merge and is the highest-risk resolution in it.

Console should be silent. Any `[A11Y-NAV]` output means `DEBUG_NAV` was left
enabled.

## If it goes wrong

### Never delete postgres_data

An empty `postgres_data/` triggers a broken upgrade path in the launcher that
corrupts triggers and WAL. Recovery then means manual Postgres initialisation
and a backup restore. See `.claude/agents/discourse-deployer.md`.

### Rebuild fails partway

```bash
./launcher logs app
```

Read the failure before retrying. Repeated rebuilds do not fix a config
problem and each one costs another full asset build.

### Postgres upgrade fails

The old cluster is at `/shared/postgres_data_old`. Recovery means restoring
that directory or the Hetzner snapshot - which is why the snapshot is not
optional.

### Rolling back the code

Repoint `app.yml` to the previous commit and rebuild. **This does not roll back
the database.** Once Postgres 18 has run, an older Discourse may not start
against it. A code-only rollback is not a full rollback after this upgrade -
plan on restoring the snapshot instead.

## Known warnings that are not errors

- **Collation version mismatch** - "database was created using collation
  version 2.36, but the operating system provides version 2.41". Follows a base
  image update. Usually benign; can affect text index ordering. If searching or
  sorting misbehaves afterwards, run `REINDEX DATABASE discourse` and
  `ALTER DATABASE discourse REFRESH COLLATION VERSION`.
- **Prebuilt assets 404** - normal for a fork. Triggers a full Ember build.
- **`ERR_PNPM_IGNORED_BUILDS`** - should no longer appear. If it does, the
  deployed commit predates `c2da964f720`.

## Sequence summary

- Snapshot the volume
- Back up the database
- Restore that backup into staging, rebuild staging, time it
- Announce the window
- Back up production again
- `./launcher rebuild app` - stops after the Postgres upgrade
- `./launcher rebuild app` - completes it
- Verify: HTTP 200, commit, migrations, email delivery
- Accessibility spot check
- Keep `postgres_data_old` and the snapshot for a few days

## See also

- `docs/grid/DEPLOYMENT.md` - staging setup and the staging/prod differences
- `docs/accessibility/00-index.md` - what the accessibility work does

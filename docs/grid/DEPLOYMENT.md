# Deployment Guide

This document covers deploying accessibility changes from the `accessibility`
branch to staging and production.

## Branch Strategy

```
accessibility branch (your work)
    ↓
Push to the Electro-Jam fork
    ↓
Deploy to staging (discoursestaging.electro-jam.com)
    ↓
Verify keyboard navigation and screen reader behaviour
    ↓
Deploy to production (community.electro-jam.com)
```

Staging exists so that upstream merges get exercised somewhere other than the
live forum. Anything that has not been run — a large upstream merge especially —
goes to staging first.

## Environments

| | Staging | Production |
|---|---|---|
| Hostname | `discoursestaging.electro-jam.com` | `community.electro-jam.com` |
| Container | `staging` | `app` |
| Config | `/var/discourse/containers/staging.yml` | `/var/discourse/containers/app.yml` |
| Data volume | `/var/discourse/shared/staging` | `/var/discourse/shared/standalone` |
| Port | 8081 | 80/443 |
| Server | Hetzner, `78.47.198.125` | same box |

Both containers run on the same host. Production uses roughly 2.3 GiB, leaving
about 6.7 GiB free, plus a 4 GiB swapfile.

### Never point staging at production's data volume

`staging.yml` was originally copied from `app.yml`, which mounts
`/var/discourse/shared/standalone` — production's postgres data and uploads.
Bootstrapping with that path writes a second Discourse installation into the
live forum's database and upload directories.

The committed `staging.yml` uses `/var/discourse/shared/staging`. **If you ever
regenerate staging config from `app.yml`, change the volume paths again before
bootstrapping.** This is the single most destructive mistake available here.

## Local Development

Requires Ruby 3.3+, PostgreSQL 13+ and Redis 7+. On Windows, run this under WSL2
with the repository cloned inside the WSL filesystem — working across `/mnt/c`
makes Rails and file watching extremely slow.

```bash
git checkout accessibility
pnpm dev                    # Ember CLI + Rails, http://localhost:4200
```

### Frontend-only checks

The Ember build needs no Ruby, Postgres or Redis, so it runs anywhere Node does.
It is the fastest way to confirm a merge has not broken imports or templates:

```bash
pnpm build                  # compiles the frontend, catches missing exports
pnpm lint                   # eslint + stylelint + prettier
```

This verifies that code compiles. It does not verify that keyboard navigation
works — that needs a running instance.

## Deploying to Staging

### 1. Push the branch

```bash
git checkout accessibility
git push origin accessibility
```

The fork must stay public, or the container needs SSH keys to clone it.

### 2. Pin the commit

`staging.yml` inherits an `after_code` hook from `app.yml` that checks out the
fork and resets to the branch tip:

```yaml
hooks:
  after_code:
    - exec:
        cd: $home
        cmd:
          - git remote set-url origin https://github.com/Electro-Jam-Instruments/discourse.git
          - git fetch origin
          - git checkout accessibility || git checkout -b accessibility origin/accessibility
          - git reset --hard origin/accessibility
```

Tracking the tip means what gets built depends on when the bootstrap runs. For
staging, pin the exact commit instead, so the thing you tested is the thing you
promote:

```yaml
          - git reset --hard 8d33ab9fecd    # replace with the commit under test
```

### 3. Disable outbound email — before bootstrapping

Staging can hold a copy of production data. Without this, creating a test topic
emails the real community.

```yaml
env:
  DISCOURSE_DISABLE_EMAIL: "yes"
  DISCOURSE_SMTP_ADDRESS: ""
  DISCOURSE_SMTP_USER_NAME: ""
  DISCOURSE_SMTP_PASSWORD: ""
```

Confirm once the container is up:

```bash
sudo docker exec staging rails runner 'puts SiteSetting.disable_emails'   # => yes
```

### 4. Size it to co-exist with production

```yaml
env:
  UNICORN_WORKERS: 2
  db_shared_buffers: "128MB"
```

Bootstrap is the memory-hungry step, not runtime. Because this is a fork,
Discourse's prebuilt assets return 404 and every bootstrap runs a full Ember
build, which peaks around 2-4 GiB. There is headroom for that, but avoid
bootstrapping during busy periods on the live forum.

### 5. Bootstrap and start

```bash
sudo /var/discourse/launcher bootstrap staging      # 10-20 minutes
sudo /var/discourse/launcher start staging
sudo /var/discourse/launcher logs staging
```

### 6. Verify

| Check | How |
|---|---|
| Migrations completed | `launcher logs staging`, look for migration errors |
| Correct commit built | `sudo docker exec staging git -C /var/www/discourse rev-parse HEAD` |
| Email disabled | `SiteSetting.disable_emails` returns `yes` |
| Grid roles present | DevTools: `role="grid"` on topic list, `role="toolbar"` on nav, `role="tree"` on sidebar |
| Keyboard navigation | Arrow keys through topic list and post stream |
| Dropdown menus | Arrow keys, Home/End, Escape within an open menu |
| Console clean | No `[A11Y-NAV]` output — those are gated behind `DEBUG_NAV` |
| Screen reader | NVDA: row labels, position announcements, post content |

### 7. Tear down when finished

```bash
sudo /var/discourse/launcher destroy staging
sudo rm -rf /var/discourse/shared/staging
```

Ask Brett to remove the DNS record; the vhost and certificate get dropped
separately.

## Deploying to Production

Only after staging has been verified.

```bash
cd /var/discourse
./launcher rebuild app
```

Take a snapshot or database backup first. Recent deploy logs show pre-deploy
backups being written to
`/var/discourse/shared/standalone/backups/default/` — keep that habit.

### If a rebuild fails

Never delete `postgres_data`. An empty `postgres_data/` directory triggers a
broken upgrade path in the launcher that corrupts triggers and WAL, and recovery
means manual postgres initialisation and a backup restore. See
`.claude/agents/discourse-deployer.md`.

```bash
./launcher logs app
```

## Debug Logging

`frontend/discourse/app/modifiers/post-stream-navigation.js` carries detailed
focus and cloaking traces behind a constant:

```javascript
const DEBUG_NAV = false;
```

Set it to `true` locally when investigating focus behaviour. Leave it `false` in
anything deployed — there are 51 call sites, including call stacks.

## Lint Notes

`eslint.config.mjs` disables three template rules for the 18 files implementing
the WAI-ARIA grid and tree patterns. They report false positives there:
`role="grid"` on a `<table>` is not redundant, cell and tree roles cross
component boundaries, and grid cells are required to contain interactive
elements.

**Do not run `eslint --fix` on those files.** The autofix for
`ember/template-no-redundant-role` strips `role="grid"`, which silently breaks
grid keyboard navigation. `sort-class-members --fix` also detaches comment
blocks from the properties they document.

## SSH Access

`.mcp.json` configures the `ssh-mcp` server used for deployment. Note that
`ssh-mcp` takes credentials from environment variables or
`%APPDATA%\ssh-mcp\config.toml` — a `--key=` argument is ignored, and the server
then starts unconfigured and refuses every call, which surfaces as a connection
timeout rather than an authentication error.

The account is `jsagent`, not `root`.

## Security

While running a custom branch:

- Automatic security updates do not apply
- Merge upstream `main` regularly
- Watch [Discourse Security](https://meta.discourse.org/c/security)

## References

- [Discourse Docker](https://github.com/discourse/discourse_docker)
- [Install guide](https://github.com/discourse/discourse/blob/main/docs/INSTALL.md)
- Accessibility patterns: `docs/accessibility/00-index.md`

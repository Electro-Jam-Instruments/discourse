# Discourse Accessibility Branch - Installation Troubleshooting

## Issues Encountered (January 2026)

### Issue 1: Template Syntax Error in categories-only.gjs

**Error:**
```
Parse error on line 147: Expecting 'EOF', got 'OPEN_ENDBLOCK'
```

**Cause:**
- Orphan `{{/if}}` tag on line 260 of `frontend/discourse/app/components/categories-only.gjs`
- Imbalance between `{{#if}}` and `{{/if}}` blocks

**Solution:**
- Removed the orphan `{{/if}}` tag
- Commit: `cf9f14ca8a` - "Fix template syntax error in categories-only.gjs"

**Prevention:**
- Count opening and closing template blocks when editing `.gjs` files
- Run `pnpm lint:hbs` locally before pushing

---

### Issue 2: Babel Plugin Missing Error

**Error:**
```
Cannot find module '@babel/plugin-proposal-class-properties'
```

**Cause:**
- Fork's `package.json` had an override:
  ```json
  "@babel/plugin-proposal-class-properties": "npm:@babel/plugin-transform-class-properties@^7.27.1"
  ```
- The `pnpm-lock.yaml` was never regenerated after adding this override
- The lockfile didn't contain the aliased package

**Solution:**
- Removed the override from `package.json` (line 82)
- Commit: `70fd987bb0` - "Remove Babel plugin-proposal-class-properties override"

**Note:** The `@babel/plugin-proposal-class-properties` package is deprecated but still functional. Upstream Discourse uses it directly without the override.

---

### Issue 3: pnpm Lockfile Config Mismatch

**Error:**
```
ERR_PNPM_LOCKFILE_CONFIG_MISMATCH: Cannot proceed with the frozen installation
The current "overrides" configuration doesn't match the value found in the lockfile
```

**Cause:**
- After removing the Babel override from `package.json`, the lockfile still recorded the old override configuration
- pnpm's `--frozen-lockfile` flag (used in production builds) detected the mismatch

**Solution:**
- Regenerated the lockfile locally: `pnpm install --lockfile-only`
- Committed the updated lockfile
- Commit: `dcb3edb79a` - "Regenerate pnpm lockfile to match package.json overrides"

**Prevention:**
- Always run `pnpm install --lockfile-only` after modifying `package.json` overrides
- Test builds locally before pushing to ensure lockfile consistency

---

### Issue 4: Docker Commit Hanging (CONFIRMED)

**Status:** Persisting - requires server-level investigation

**Symptom:**
- Build completes all phases successfully (pnpm, bundle, assets, db:migrate)
- Container shuts down cleanly ("Terminating async processes")
- `docker commit` process hangs indefinitely (15+ minutes without progress)

**Server State at Time of Issue:**
- Disk space: 253GB available (13% used) - NOT the issue
- Memory: 13GB available - NOT the issue
- Docker version: 29.1.3
- Storage driver: overlayfs
- Docker logs: No errors during hang

**What Completed Successfully Before Hang:**
1. Git checkout - accessibility branch dcb3edb79a
2. pnpm install - SUCCESS (lockfile matched)
3. bundle install - SUCCESS
4. db:migrate - SUCCESS
5. assets:precompile - SUCCESS (Webpack + RTL)
6. Container shutdown - SUCCESS

**Recovery Steps (Tried Multiple Times):**
1. Kill stuck processes:
   ```bash
   sudo pkill -9 "launcher"
   sudo pkill -9 -f "docker commit"
   ```
2. Clean up stale files:
   ```bash
   cd /var/discourse
   ./launcher destroy app
   rm -f cids/app*.cid
   rm -f shared/standalone/postgres_run/.s.PGSQL.5432
   ```
3. Restart rebuild:
   ```bash
   ./launcher rebuild app
   ```

**Possible Root Causes (Needs Investigation):**
- Docker daemon issue (process appears stuck in syscall)
- Docker storage driver corruption
- Container filesystem issues
- Server kernel issue with overlayfs

**Next Steps to Try:**
1. Restart Docker daemon: `sudo systemctl restart docker`
2. Server reboot if daemon restart doesn't help
3. Check Docker storage: `docker system df` and `docker system prune -a`
4. Consider switching storage driver if persistent

---

## Key Build Phases

1. **Git Checkout** - Pulls accessibility branch from GitHub
2. **pnpm install** - Installs Node.js dependencies (uses `--frozen-lockfile`)
3. **bundle install** - Installs Ruby gems
4. **assets:precompile** - Compiles Ember.js frontend assets
5. **docker commit** - Creates new Docker image from build container
6. **Container Start** - Starts the new container

---

## Useful Commands

### Check Build Status
```bash
tail -50 /tmp/discourse-rebuild.log
ps aux | grep "launcher rebuild"
```

### Search for Errors
```bash
grep -i "error\|failed" /tmp/discourse-rebuild.log | tail -20
```

### Container Status
```bash
docker ps -a --filter "name=app"
```

### Fresh Rebuild
```bash
cd /var/discourse
./launcher destroy app
rm -f cids/app*.cid
./launcher rebuild app
```

---

## File Relationships

| File | Purpose |
|------|---------|
| `package.json` | Root package config with pnpm overrides |
| `pnpm-lock.yaml` | Locked dependency versions - MUST match package.json |
| `/var/discourse/containers/app.yml` | Server deployment config |
| `/var/discourse/templates/web.template.yml` | Build template (contains `--frozen-lockfile` flag) |

---

## Commits for This Fix Session

1. `cf9f14ca8a` - Fix template syntax error in categories-only.gjs
2. `70fd987bb0` - Remove Babel plugin-proposal-class-properties override
3. `dcb3edb79a` - Regenerate pnpm lockfile to match package.json overrides

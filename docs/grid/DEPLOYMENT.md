# Deployment Guide

This document covers deploying accessibility changes from the `accessibility` branch to development and production environments.

## Branch Strategy

```
accessibility branch (your work)
    ↓
Push to your GitHub fork
    ↓
Deploy to staging server for testing
    ↓
PR to upstream main (when ready)
    ↓
Merge and release cycle
```

## Local Development

Run directly from your branch with hot reload:

```bash
git checkout accessibility
pnpm dev                    # Runs Ember CLI + Rails server
```

Access at `http://localhost:4200`

## Docker Development Container

For isolated development environment:

```bash
# From your accessibility branch
d/boot_dev --init
d/rails s
```

## Remote Server Deployment

### Prerequisites

- SSH access to server running Discourse Docker
- Your fork pushed to GitHub with `accessibility` branch
- Server has `/var/discourse` installation

### Step 1: Push Your Branch

```bash
# Local machine
git checkout accessibility
git push origin accessibility
```

### Step 2: Configure Server

Edit `/var/discourse/containers/app.yml` on your server:

```yaml
hooks:
  after_code:
    - exec:
        cd: $home/plugins
        cmd:
          - mkdir -p plugins
          - git clone https://github.com/discourse/docker_manager.git
    - exec:
        cd: $home
        cmd:
          # Remove default origin and add your fork
          - git remote remove origin
          - git remote add origin https://github.com/YOUR_GITHUB_USERNAME/discourse.git
          - git fetch origin
          # Checkout accessibility branch
          - git checkout -b accessibility origin/accessibility
          - git reset --hard origin/accessibility
```

**Important:** Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

**YAML Warning:** Use spaces only, no tabs. Wrong indentation breaks the configuration.

### Step 3: Rebuild Container

```bash
cd /var/discourse
./launcher rebuild app
```

This pulls your latest `accessibility` branch and rebuilds.

### Step 4: Verify Deployment

1. Access your Discourse instance
2. Open browser DevTools
3. Check for `role="toolbar"` on navigation bar
4. Check for `role="grid"` on topic list
5. Test keyboard navigation (arrow keys)

## Update Cycle

When you push new changes:

```bash
# Local: commit and push
git add .
git commit -m "A11Y: Add grid keyboard navigation"
git push origin accessibility

# Server: rebuild to pull changes
cd /var/discourse
./launcher rebuild app
```

## Reverting to Standard Discourse

To return to official Discourse:

1. Remove the custom hooks from `app.yml`
2. Rebuild: `./launcher rebuild app`

## Feature Flag Option

For gradual rollout, add a site setting toggle:

**config/site_settings.yml:**
```yaml
accessibility:
  enable_grid_keyboard_navigation:
    default: false
    client: true
    description: "Enable keyboard navigation for topic list grid"
```

**Usage in code:**
```javascript
// JavaScript
if (this.siteSettings.enable_grid_keyboard_navigation) {
  // Apply grid navigation
}
```

```ruby
# Ruby
if SiteSetting.enable_grid_keyboard_navigation
  # Apply changes
end
```

## Testing Checklist

Before deploying to production:

| Test | Method |
|------|--------|
| Unit tests pass | `bin/qunit` |
| System specs pass | `bin/rspec spec/system/` |
| Linting passes | `bin/lint --fix --recent` |
| Keyboard navigation works | Manual testing |
| Screen reader announces correctly | NVDA/VoiceOver testing |
| No regressions | Full test suite |

## CI/CD Integration

All PRs to `main` automatically run:

- Backend tests (RSpec)
- Frontend tests (QUnit)
- System tests (Capybara/Playwright)
- Linting (ESLint, Rubocop, Prettier)

Commit message prefix: `A11Y:` for accessibility changes.

## Security Considerations

**While on a custom branch:**
- You won't receive automatic security updates
- Regularly merge upstream `main` into your branch
- Monitor [Discourse Security](https://meta.discourse.org/c/security) for announcements

**Recommended:** Keep custom branch deployments short-term for testing only.

## Troubleshooting

### Rebuild Fails

```bash
# Check logs
./launcher logs app

# Try destroying and bootstrapping fresh
./launcher destroy app
./launcher bootstrap app
./launcher start app
```

### Branch Not Updating

```bash
# SSH into container
./launcher enter app

# Check git status
cd /var/www/discourse
git remote -v
git branch -a
git log --oneline -5
```

### Permission Issues

Ensure your GitHub repo is public, or configure SSH keys for private repo access.

## References

- [Discourse Docker](https://github.com/discourse/discourse_docker)
- [Custom repo hooks](https://gist.github.com/scossar/035c8a6068604bd420fc)
- [Install guide](https://github.com/discourse/discourse/blob/main/docs/INSTALL.md)

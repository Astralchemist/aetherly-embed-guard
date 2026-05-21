# Contributing

Thanks for considering a contribution.

## Quick setup

```bash
git clone https://github.com/Astralchemist/aetherly-embed-guard.git
cd aetherly-embed-guard
npm install
npm run typecheck
npm run build
```

## What this package is (and isn't)

A **headless** reverse-proxy + injected guard script. It exposes Web Fetch handlers and host-classification helpers — it does **not** ship React or Vue components. Use it from any UI you like.

## Good first contributions

- **New provider host rules.** Adding domains to `DEFAULT_PROVIDER_HOST_RULES` is welcome, but please verify the host is alive (probe it with `dig` or `curl`) and explain what content it serves in the PR description.
- **Guard-script hardening.** The inline script catches `window.open`, anchor clicks, form submissions, `location.assign/replace`, and `fetch`/`XHR`. If you've spotted a new ad-injection pattern that escapes it, a PR with a regression case is welcome.
- **Tests.** A unit test that loads the guard script in jsdom and asserts that `window.open` returns the fake-window, that cross-origin anchor clicks are cancelled, etc.

## What probably won't be merged

- Removing the host allowlist. Without it this becomes an open HTTP proxy.
- Bundling a React/Vue/Svelte player component. Out of scope; ship those as separate packages that consume this one.
- Anything that disables the sandbox in the injected guard (the guard is meant to run *inside* the sandboxed iframe).

## PR checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] New host rules include a brief note in the PR about what content they serve
- [ ] Commit messages are imperative, descriptive, and under 72 chars on the subject line

## Security disclosures

For security issues, please open a private security advisory on GitHub rather than a public issue.

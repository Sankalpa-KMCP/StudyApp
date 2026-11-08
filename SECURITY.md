# Security policy

## Scope

Study Dashboard is a local-first browser application. Study data lives entirely in your
browser (IndexedDB and `localStorage`); there are no user accounts, no backend server, and no
cloud storage. As a result, the realistic security surface is limited to:

- the application code itself (for example cross-site scripting or CSP bypasses),
- the backup import/export path (for example a crafted file causing validation to be skipped),
- browser-origin storage behavior described in
  [docs/storage-isolation.md](docs/storage-isolation.md).

There is no server-side component to report vulnerabilities in.

## How to report

Private vulnerability reporting is **enabled** on this repository.

- **Preferred:** use GitHub's private reporting flow — on the repository's **Security** tab,
  choose **Report a vulnerability**. The report goes only to the repository maintainer, is
  not publicly visible, and allows a fix to be coordinated before any public disclosure.
  Include what you did, what you observed, the affected area (e.g. "backup import"), and the
  browser and operating system used. Please do not test against the live Pages deployment in
  ways that could affect other visitors.
- **If you cannot use the private flow:** do not post detailed exploit steps publicly. Open a
  [GitHub Issue](https://github.com/sankalpa-kmcp/StudyApp/issues) that says only that a
  security concern exists, which area it affects, and how to reach you for follow-up. The
  maintainer will respond there and arrange detail exchange.
- For non-sensitive hardening suggestions, a normal issue with full detail is fine.

## Supported versions

Security fixes are applied to the current `master` branch and released through the normal
release channel. The published beta release (`v1.5.0-beta.1`) receives the same fixes via the
next release; older tags are not maintained separately.

## Related documentation

- [docs/storage-isolation.md](docs/storage-isolation.md) — how browser origins scope local
  storage on GitHub Pages, CSP details, and deployment-isolation guidance
- [docs/data-management.md](docs/data-management.md) — backup format and import validation

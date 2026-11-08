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

This repository does not currently have a private vulnerability-reporting channel enabled.

- **If you believe you found a security problem, please do not post detailed exploit steps
  publicly.** Open a [GitHub Issue](https://github.com/sankalpa-kmcp/StudyApp/issues) that
  says only that a security concern exists, which area it affects (e.g. "backup import"),
  and how to reach you for follow-up. The maintainer will respond there and arrange detail
  exchange.
- For non-sensitive hardening suggestions, a normal issue with full detail is fine.

This file will be updated if a private reporting channel (such as GitHub's private
vulnerability reporting for this repository) is enabled.

## Supported versions

Security fixes are applied to the current `master` branch and released through the normal
release channel. The published beta release (`v1.5.0-beta.1`) receives the same fixes via the
next release; older tags are not maintained separately.

## Related documentation

- [docs/storage-isolation.md](docs/storage-isolation.md) — how browser origins scope local
  storage on GitHub Pages, CSP details, and deployment-isolation guidance
- [docs/data-management.md](docs/data-management.md) — backup format and import validation

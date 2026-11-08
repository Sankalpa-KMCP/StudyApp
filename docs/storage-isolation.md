# Storage isolation and security notes

Study Dashboard is a local-first application that stores study data, settings, and journal
entries entirely in browser-local storage (IndexedDB and `localStorage`). There are no user
accounts, passwords, or server-side databases.

## Browser origin boundary on GitHub Pages

When deployed as a standard GitHub Pages project site:

- URLs such as `https://<account>.github.io/StudyApp/` and
  `https://<account>.github.io/AnotherProject/` share the same browser origin:
  `https://<account>.github.io`.
- Browser security boundaries (the Same-Origin Policy) scope IndexedDB and `localStorage` to
  the full origin `(scheme, host, port)`, **not** to URL pathname prefixes.
- Consequently, any script executing within another project hosted on the **same GitHub Pages
  account host** shares access to the origin's IndexedDB databases and `localStorage` keys.
- **Attack prerequisite:** Storage access requires script execution on a page served from that
  specific same account host. Unrelated websites across the internet and other GitHub Pages
  account hosts (for example, `https://other-user.github.io`) are separate origins and cannot
  access your data.

## True origin isolation

If you host other projects under your personal GitHub Pages account that contain experimental,
untrusted, or multi-tenant code, you can achieve complete storage isolation by deploying Study
Dashboard on a dedicated origin:

- **Dedicated custom domain or subdomain:** Deploying to a custom domain (e.g.,
  `https://study.example.com` or `https://studyapp.dev`) gives the application its own
  isolated origin.
- **Dedicated GitHub account or organization:** Hosting the repository under a dedicated
  GitHub account/organization whose Pages host is used exclusively for Study Dashboard
  isolates its storage (provided no untrusted projects are subsequently added to that same
  account).

*Note:* Simply renaming the repository or altering the URL path does not change the browser
origin and provides no storage isolation.

## Content Security Policy (CSP)

Study Dashboard delivers a strict Content Security Policy (`default-src 'self'`,
`script-src 'self' 'sha256-...'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`,
`font-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'self'`,
`form-action 'self'`) as defense-in-depth against unauthorized network tracking, cross-site
scripting, and external resource injection within the application itself. However, CSP
enforces boundaries only within its own document context; it does not alter browser-level
origin scoping and cannot prevent separate pages on the same origin from opening same-origin
IndexedDB databases.

## Deployment guidance

- **Default GitHub Pages deployment** is safe and appropriate for users who control and trust
  all code hosted under their `<account>.github.io` domain.
- **Dedicated origin deployment** (custom subdomain or dedicated host) is recommended for
  users who host untrusted, public-submission, or third-party web projects on the same GitHub
  Pages account.

## Reporting

See [SECURITY.md](../SECURITY.md) for how to report security concerns.

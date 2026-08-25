# Staging Architecture & Recovery Guide

This document describes the authoritative staging architecture, setup, verification, recovery, and production-isolation for the v1.5.0 release-candidate environment.

## Architecture

- GitHub Actions is the sole deployment authority.
- Stable release-candidate source branch is `V2`.
- Pull requests, fork pull requests, `master`, tags, and manual dispatches do not deploy staging.
- Staging deploys only after the complete `check` job succeeds.
- Production and staging use separate artifacts, jobs, environments, concurrency groups, credentials, hosts, and base paths.
- Netlify CLI `--prod` refers to the dedicated Netlify staging site’s stable URL; it does not deploy the StudyApp production site.

## Artifact flow

- Production artifact: `github-pages-dist`, base `/StudyApp/`.
- Staging artifact: `netlify-staging-dist`, base `/`.
- Both artifacts have a one-day retention limit.
- `staging-build.json` stores commit, ref, and run metadata.
- Same-run artifact download and integrity checks strictly validate metadata before deployment.
- Failure or cancellation of `check` prevents staging deployment.

## Routing, storage, and PWA

- `public/_redirects` and emitted `dist/_redirects` govern server routing rules.
- Direct-route rewrite is enforced as `/* /index.html 200`.
- Staging uses root-relative assets, manifest, and service worker references.
- IndexedDB and service-worker isolation are protected by standard browser origin policies.
- Staging data is separate from production data.
- Live PWA, offline, update, and stale-cache behavior remains unverified until S0.4e.

## Owner setup

The following exact manual steps must be performed by the repository owner:

1. Create or select a Netlify site dedicated only to staging.
2. Disable or avoid native Netlify Git auto-publishing.
3. Obtain the site API ID.
4. Create a deployment token with the minimum practical permissions.
5. Create the GitHub environment `staging`.
6. Add `NETLIFY_SITE_ID` and `NETLIFY_AUTH_TOKEN` as environment secrets, preferably scoped to `staging`.
7. Add required reviewers or approval protection where available.
8. Record the resulting staging URL using a placeholder until verified.
9. Do not place token values in documentation, files, logs, commands, commits, or issue bodies.

*Note: Provider/account-dependent UI wording and least-privilege capabilities require owner verification.*

## First deployment procedure

Execute the first deployment strictly in this controlled order:

- Complete owner setup.
- Ensure the intended release-candidate commit is on `V2`.
- Push only after explicit owner approval.
- Observe `check`.
- Confirm `netlify-staging-dist`.
- Approve the `staging` environment if protection is enabled.
- Observe `deploy-staging`.
- Record workflow run, commit SHA, deployment URL, and deployment result.
- Do not merge or promote automatically.

## Live verification checklist

Prepare S0.4e checks for the following:

- Deployed SHA matches intended `V2` commit.
- `/`, `/tasks`, `/notes`, `/subjects`, `/calendar`, `/flashcards`, `/progress`, `/goals`, and `/settings`.
- Direct navigation and browser refresh on routes.
- Assets, manifest, and service-worker registration.
- Installability where supported.
- Offline reload after initial caching.
- Update behavior after a second deployment.
- Stale service-worker/cache behavior.
- IndexedDB create, reload, export, import, and origin isolation.
- English-only UI.
- Production GitHub Pages remains available and was not redeployed.
- `V2` cannot invoke the production deployment job.

## Recovery and removal

In the event of failure or compromise:

- Stop deployment by disabling the workflow job or protecting/removing staging secrets.
- Revoke and rotate the Netlify token.
- Rollback or redeploy a known commit through a separately approved action.
- Disconnect or delete the dedicated staging site.
- Remove GitHub environment secrets.
- Disable native Netlify Git publishing if accidentally enabled.
- Inspect GitHub Actions and Netlify logs without exposing secrets.
- Repository rollback commits for the staging workflow and `_redirects`.
- Production GitHub Pages remains independent throughout recovery.

*Warning: Avoid irreversible instructions without a confirmation and recovery warning.*

## Known limitations

- No live deployment evidence yet.
- Provider settings and permissions are not repository-verifiable.
- The staging URL is unknown until owner setup.
- Real browser/device validation is handled in S0.5.
- Staging does not by itself complete the Phase 0 release gate.

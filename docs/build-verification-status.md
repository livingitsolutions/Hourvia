# Build verification status — Sprint 0.2

**BUILD NOT VERIFIED.** Published foundation deployment verified; automatic build's own terminal status/logs unavailable. No build failure was established.

## Evidence observed

Read-only authorized-interface attempts completed on October 14, 2026, at 21:26:40.694 UTC. `getDeploy` and `listSiteDeploys` returned usable deployment metadata. `getSiteBuild` for the production build and `listSiteBuilds` for the site both returned unauthorized/401 diagnostics; raw credential-bearing CLI output was withheld.

| Record | Observed evidence |
| --- | --- |
| Production deployment | `6acfda088b7a1fd46e470565`; `ready`; `main`; exact baseline commit |
| Associated production build | `6acfda088b7a1fd46e470563`; own status/logs unavailable |
| Baseline source commit | `daaaf00a3aeec7e6a2729d7b15d0bfd2d50871ae` |
| Published time | October 14, 2026, 19:38:05.373 UTC |
| Existing preview deployment | `6acfd9df861f64e466e3f1ee`; `ready`; commit `0e734aba18442574c26af414d57980e12fd03576` |
| Associated preview build | `6acfd9df861f64e466e3f1ec`; own status not retrieved |
| Exact deployed health function | GET 200; Sprint 0, authentication disabled, persistence not connected |
| Unimplemented workspace API | GET 404; not a 401/403 middleware certification |

The prior Sprint 0.1 public GitHub checks had no commit statuses/check runs and did not supply a build result; they were not rerun in Sprint 0.2. Existing `dist` files had unverified provenance. Neither replaces a build record. No local production build or Netlify build/bundling command was executed.

## Records an authorized reviewer must supply manually

For production build `6acfda088b7a1fd46e470563` and deployment `6acfda088b7a1fd46e470565`, supply a redacted Netlify Deploy details/build-log export or authorized API record showing:

1. Site/project `hourvia`, deployment/build IDs, `main` production context, exact commit SHA, creation/start/end times, and terminal **build** status. Explain whether this was an automatic hosting build, imported/API-produced bundle, or another workflow; publication alone is insufficient.
2. The resolved base directory, build command and publish directory, dependency-install result, runtime/tool versions, and command exit status. Repository configuration expects `npm run build`, `dist`, and the configured function directory, but the record must show what actually ran.
3. The relevant log section for TypeScript checking and the Vite production bundle, followed by Netlify function discovery/bundling for `health.mts`, bundler output, and overall successful completion. A frontend-only success does not verify function bundling.
4. If a phase failed, its name, first actionable error, exit code, and bounded surrounding log context; if it succeeded, the terminal success record. Redact credentials, environment values, connection strings, request tokens, and personal data before sharing. Do not send an unredacted site-configuration export.
5. Optional preview evidence for build `6acfd9df861f64e466e3f1ec`, clearly labeled with its different commit/context. It cannot stand in for production/current-commit evidence.

The reviewer must correlate each artifact to the exact IDs/commit rather than a later unrelated successful deploy. Automatic validation after these documentation edits is a separate, not-yet-observed event. This record must be updated only when new evidence is actually available.

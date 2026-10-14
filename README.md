# Hourvia

**Hourvia by Living IT Solutions**

Time tracked. Progress made.

Hourvia's Sprint 0 foundation is a responsive, accessible brand and application shell. It intentionally contains no time-tracking, project-management, reporting, authentication, or persistence features.

## Run locally

Serve the `public` directory with a static HTTP server. In the Netlify environment, use `netlify dev --port 8889`. No dependency installation or compilation is required. Netlify publishes `public` directly using `netlify.toml`.

## Structure

- `public/brand.js`: reusable brand identity, independent of business logic.
- `public/styles.css`: semantic light/dark tokens, typography, spacing, buttons, cards, navigation, and form styles.
- `public/index.html`: responsive shell, overview, design-system specimens, metadata, and brand mark.
- `public/app.js`: presentation-only navigation, theme selection, mobile menu, and accessible about dialog.
- `docs/sprint-0-final-report.md`: scope, branding decisions, validation, and outstanding decisions.

The overview and design system use hash navigation with working back/forward navigation and direct links. Product navigation is explicitly disabled and labeled “Soon.” The interface contains no fabricated work metrics or records. The form specimen is read-only.

## Design principles

Deep navy `#0C2530`, emerald `#087F5B`, soft mint `#7BD9B0`, and white form the core palette. Semantic neutral colors adapt to light and dark themes. Manrope is the preferred font, with local fallbacks if Google Fonts is unavailable. Spacing follows a 4px rhythm. Focus indicators, reduced-motion support, labeled controls, and responsive layouts are shared across the shell.

The default theme follows the device setting. The header toggles light/dark; the design-system page also offers system mode. Manual theme choices last only for the current page session. No user preference is stored or sent to a server.

## Deployment identity

Project identifier: `hourvia`. Proposed production address: `hourvia.livingitsolutions.com`. The custom domain is a proposal, not a configured or verified deployment. Canonical URL metadata must be added only once the production domain is confirmed. This sprint does not change DNS, provision infrastructure, or select an application framework or backend architecture.

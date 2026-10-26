# Ishaanya Interiors 3D Refresh

## Direction
**Design movement:** warm editorial 3D showroom — a premium kitchen studio expressed through depth, material, and soft architectural lighting.

**Core principles:** preserve the existing public content and CMS; make the hero feel like a designed space; add tactile depth without heavy assets; keep conversion CTAs obvious and mobile-safe.

**Color philosophy:** charcoal and warm ivory create a calm architectural canvas; the signature brass-gold accent signals craftsmanship and premium detailing rather than generic luxury.

**Layout paradigm:** layered editorial composition with an image-led hero, floating material cards, and offset content planes instead of a flat centered grid.

**Signature elements:** perspective image frames, soft brass glow lines, and floating glass/stone spec cards.

**Interaction philosophy:** restrained motion—cards lift and tilt on hover, ambient shapes drift slowly, and reduced-motion users receive a static fallback.

**Animation:** 3D tilt is pointer-driven on desktop, ambient depth uses transform-only keyframes, and all motion is disabled under `prefers-reduced-motion`.

**Typography:** Cormorant Garamond for editorial headlines, Poppins for navigation and conversion copy.

**Brand essence:** bespoke modular kitchens for Dehradun homes, combining design imagination with factory-made execution. Personality: refined, warm, assured.

**Brand voice:** specific, tactile, confident. Example lines: “A kitchen composed around the way you live.” / “See your everyday space in a new dimension.”

**Wordmark & mark:** keep the supplied Ishaanya wordmark; pair it with a minimal orbit/architectural-line motif in the hero.

**Signature brand color:** antique brass `#C8A96A`.

## Implementation
- Preserve `src/app-bundle.js` and its CMS/admin functionality.
- Add a lightweight enhancement layer from `src/main.tsx` that decorates only public-facing routes after the existing React app mounts.
- Add scoped CSS to `src/index.css` for hero depth, ambient layers, perspective cards, image hover treatment, and mobile/reduced-motion fallbacks.
- Reuse existing user-supplied kitchen imagery; no new external assets are required.
- Add the route manifest required by the web runtime.

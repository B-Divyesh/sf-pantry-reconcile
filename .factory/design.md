# Pantry Check — visual thesis

## Direction: luminous glass data landscape

Pantry Check treats household stock as a landscape of *confidence*, not a ledger of perfect counts. The interface is a dark, quiet kitchen at first light: translucent shelves, soft cyan edge light, and small amber signals where attention is needed. Glass is used to explain recency and depth—the freshest confirmations sit clear and bright; uncertain items recede and haze. It is not decorative “glassmorphism”: every layer maps to a zone, a confidence state, or the current reconcile pass.

The hero image establishes this world as an abstract still life of three pantry zones. The working UI then carries the same visual language with restrained translucent surfaces, crisp labels, and a faint shelf grid. No stock photography, gradients-as-hero, retailer imagery, or fake product UI.

## Palette

The app is explicitly single-mode (a dark utility optimised for quick kitchen checks). It paints every background; native controls use `color-scheme: dark`.

| Token | Value | Role |
| --- | --- | --- |
| Midnight | `#07131B` | page background; the quiet room around the task |
| Deep shelf | `#0D2029` | solid fallback and raised surfaces |
| Glass | `rgba(19, 48, 59, .72)` | zones and independent records |
| Frost line | `#315563` | boundaries and inactive UI |
| Porcelain | `#F3F8F5` | primary text |
| Mist | `#AFC3C5` | supporting text (7.3:1 on Midnight) |
| Lumen | `#77F2D2` | primary action and confirmed state |
| Ink | `#06231D` | text on Lumen |
| Sunlit amber | `#FFC46B` | ageing / review-needed state |
| Coral | `#FF8E83` | expiry / destructive state |
| Sky | `#8DCBFF` | informative / shopping delta state |

Contrast is designed above WCAG AA for normal text. Status always has a word or icon in addition to colour.

## Typography

- **Display:** `Fraunces`, self-hosted variable subset, 600 weight. Its soft, pantry-label shapes make the product human and domestic without becoming nostalgic.
- **Utility:** `Inter`, self-hosted variable subset, 400–700. It stays legible at arm’s length and supports tabular numerals for age and counts.
- Scale: 14px metadata, 16px body minimum, 18px lead, 22px section, 34–52px display. Long copy is capped at 68 characters.

## Spacing and shape

- Base rhythm: 4px; primary steps: 8, 12, 16, 24, 32, 48, 64.
- Controls are at least 44px; touch actions in reconcile mode are 56px.
- Radius family: 10px controls, 18px item surfaces, 28px landscape panels. Hairlines use translucent Frost.
- Desktop uses an asymmetric 5/7-column landscape; mobile collapses into one task stream and keeps the bottom action dock inside safe areas.

## Interaction grammar

- **Confirm:** mint light fills from the action origin and the item becomes optically clearer.
- **Used:** the record steps down into the shopping delta; the action is reversible through an undo toast.
- **Expired:** coral edge light marks the record, with explicit advisory language. The item enters the shopping delta only when the household confirms it should.
- **Review order:** uncertainty first, then oldest confirmation. “Low confidence” means old or never checked; it does not claim food safety.
- Keyboard shortcuts during a pass: `S` seen, `U` used, `E` expired; buttons remain fully labelled and reachable.

## Motion policy

UI transitions take 180–260ms and only animate transform and opacity. The active record rises 4px when it enters; confirmed records settle toward their zone. The hero uses one slow, non-looping reveal. Under `prefers-reduced-motion: reduce`, transforms and smooth scrolling are removed, progress changes are instant, and meaning survives through type, borders, and labels.

## Original asset plan and provenance

- `src/images/pantry-landscape*.webp`: original AI-generated abstract kitchen still life, used as a meaningful visual explanation of zones and uncertainty. Vite fingerprints the shipped variants for immutable caching. It is reviewed for stray text, brands, visual seams, or misleading capabilities and exported at explicit dimensions; mobile payload stays below 300 KB.
- `public/social-preview.webp`: deterministic 1200×630 center crop of the reviewed desktop landscape, made locally on 2026-08-28 for Open Graph and Twitter cards. It contains no added text, brands, or claims.
- App icons and UI symbols are hand-authored SVGs/CSS by the project; no icon library or third-party runtime assets.
- Generation model: Azure OpenAI factory deployment `factory-image` via `/opt/fleet/lib/gen-image.sh`.
- Generation date: 2026-08-28.
- License/provenance: generated specifically for Pantry Check; original project asset, MIT-distributed with the repository.

### Prompt sheet

**Use case:** stylized-concept. **Asset:** wide PWA landing/empty-state illustration. **Subject:** an abstract pantry landscape made from three translucent glass shelf structures suggesting a refrigerator, freezer, and dry pantry; a few simple unbranded food silhouettes; small glowing markers that move from hazy amber to clear mint, visualising uncertainty becoming confidence. **World/materials:** luminous smoked glass, frosted acrylic, condensation, softly machined metal shelf edges, subtle data-like refractions. **Light/lens:** cinematic low-key kitchen dawn, oblique wide composition, gentle depth of field, crisp foreground, generous dark negative space on the left for interface copy. **Palette words:** deep midnight teal, porcelain, mint lumen, sunlit amber, restrained coral. **Negative list:** no people, hands, text, letters, numbers, logos, brands, barcode, shopping carts, phone mockup, generic blue-purple gradient, excessive bloom, clutter, food spoilage, watermark.

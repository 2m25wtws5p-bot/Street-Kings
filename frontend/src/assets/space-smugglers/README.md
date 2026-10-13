# Space Smugglers illustration assets

Original artwork generated with the built-in `image_gen.imagegen` tool (not the CLI), then copied unchanged into this asset folder. No external media, franchise references or image crops were used. The card draft was regenerated with a corrected portrait-cell composition using the built-in editing tool. Generated PNG originals are retained locally; the app ships losslessly encoded WebPs, with exact decoded RGBA equality verified. The WebP `cards-atlas.webp` uses `cards-atlas-v2.png`, not the initial draft.

## Files and atlas mapping

| Source | Dimensions | Mapping |
| --- | --- | --- |
| `cards-atlas-v2.png` | 1619 × 971 | Selected five-column, two-row atlas with portrait cells; CSS uses percentage cell boundaries. |
| `cards-atlas.png` | 1983 × 793 | Preserved initial draft with square cells; not shipped. |
| `portraits-atlas.png` | 1774 × 887 | Six columns by three rows, 18 portraits; CSS uses percentage cell boundaries. |
| `orbital-deck.png` | 1672 × 941 | Wide observation-deck playfield background. |

Card slots, left to right:

1. Top: RED patrol alarm; YELLOW rare-goods market; BLUE credits/navigation; GREEN cargo and alien plants; RED fleet admiral.
2. Bottom: GREEN tracking beacon; YELLOW alien diplomat; BLUE shield drone; GREEN reactor core; NEUTRAL courier drone.

Portrait slots, left to right:

1. Top: captain; engineer; cyan navigator; pilot; mechanic; silver robot.
2. Middle: radio operator; amber trader; cargo runner; scientist; white android; green botanist.
3. Bottom: courier; space cook; lavender diplomat; star mapper; copper robot; navy-blue medic.

## Provenance

Generation session: `01a13557-3d7d-71f0-9109-ead0365e5668`.

- Cards artifact: `exec-36cd29a8-ec58-4a60-82e0-01a7fc04642f.png`.
- Portraits artifact: `exec-c834cffc-a98a-4ddb-ba20-add5980408cd.png`.
- Background artifact: `exec-d7bc4e81-d2ec-4304-9f62-71eff0fd3d30.png`.
- Selected portrait-cell card revision: `exec-f8d0f0cb-f7ea-45bd-af51-950daf5b4152.png`, generated using the initial atlas as a style/subject reference. Main inspected all outputs; the selected revision is 5:3 overall with naturally composed portrait cells.

### Selected card revision prompt (verbatim)

Use case: stylized-concept. Asset type: revised sci-fi card-game sprite atlas. Image 1 is the artwork/style reference, NOT a finished game interface. Recreate these same ten original sci-fi subjects in the same exact row-major slot order and same dominant suit palettes, BUT change composition to a LANDSCAPE CANVAS ASPECT RATIO FIVE TO THREE (5:3, about 1500x900) containing an EXACT regular grid of FIVE COLUMNS and TWO ROWS. Each individual cell MUST be PORTRAIT, roughly two wide by three tall, NOT square. Equal full-bleed cells touch edge-to-edge with absolutely NO gutter, NO border/frame/separator. Every subject is re-composed naturally for a portrait slot, not vertically stretched. Illustrated graphic-novel spacecraft adventure; distinct red/yellow/blue/green color identities. Row1: red patrol scanner/beacon; yellow alien market amber contraband gems/crate; blue holographic credits/navchips; green cargo canisters/alien plants; red-uniform original human fleet admiral. Row2: green tracking beacon tiny red signal; yellow friendly original diplomatic alien; blue shield drone inside energybubble; green glowing reactor core tinyredstatus; silverneutral courier drone with parcel. Keep the main subject in upper-middle and leave upper-left and lower strip visually calm for code-overlaid numbers and labels. Preserve the original reference's material richness, colors and brand-free atmosphere; no recognizable franchise characters or logos. NO text, letters, numbers, logos, watermark, card UI, pips or banners baked in. Critical: overall canvas 5:3, each of ten cells portrait.

Visual inspection: all three saved originals were opened and reviewed. The ten card scenes appear in the specified order with clearly distinct dominant suit colors and no drawn text, gutters or card frames. The atlas uses square source cells, which the existing card-art component fits into its fixed portrait card footprint; rendered-card QA should confirm the final presentation. The portrait atlas has 18 different friendly human, alien and robot faces in the specified 6 × 3 arrangement. The background has a calm dark floor and central area, restrained edge equipment, and a high small planet. No known franchise designs, explicit weapons, gore, city/graffiti or woodland motif were observed. The instructions requested quiet corners for code pips; some scenes remain richly detailed, so the app's opaque pip and label surfaces are important for legibility.

## Exact prompts

### Cards

```text
Use case: stylized-concept
Asset type: production game-card illustration sprite atlas, ten full-bleed illustrations.
Primary request: create one landscape image tiled into EXACTLY five equal columns and two equal rows: 10 separate portrait-proportion rectangular artworks. Every cell touches its neighbors and the image edges: no gutters, borders, frames, dividing lines, margin, typography, numbers, logos or watermark. Every cell must be equally sized. These will be cut by code at exact 20% horizontal / 50% vertical boundaries.
Style/medium: original retro-futurist space-smuggling adventure, painterly graphic-novel science fiction, crisp readable silhouettes and rich brushed details, inviting adventurous mood. Spacecraft interiors, teal/indigo metal and amber controls. Brand-free original characters and objects, nothing resembling any known film or game franchise.
Composition: each cell is an independent close-up portrait scene. Keep essential subject in center/right, with upper-left corner quiet for a small value pip, lower 22% visually simple for overlaid game labels. Subjects remain recognizable in tiny card thumbnails.
Color identity: strong distinct RED, golden YELLOW, BLUE and GREEN panels; each indicated suit color must dominate the corresponding cell, not just a tiny accent.
EXACT artwork ordering left to right:
TOP ROW, cell 1: RED spacecraft warning beacon and circular patrol scanner, scarlet light, no text or symbols resembling letters.
TOP ROW, cell 2: golden YELLOW alien market crate opened to rare amber gems and exotic sealed trade goods, warm alien bazaar hints.
TOP ROW, cell 3: BLUE holographic credit chips and abstract navigation circuitry on a spacecraft console, luminous cobalt shapes with no readable glyphs.
TOP ROW, cell 4: GREEN sealed cargo canisters alongside alien plants in a space freighter hold.
TOP ROW, cell 5: RED stern but not threatening original fleet admiral, woman in a red futuristic uniform, no weapon.
BOTTOM ROW, cell 1: GREEN small electronic tracking beacon on cargo, tiny red signal light, restrained green freight environment.
BOTTOM ROW, cell 2: golden YELLOW friendly diplomatic alien, original turquoise skin and four soft head ridges, amber jacket, confident welcoming expression.
BOTTOM ROW, cell 3: BLUE cute compact shield drone inside a projected translucent blue protective bubble.
BOTTOM ROW, cell 4: GREEN luminous reactor core in a secure transparent capsule, small red status light, no weapon.
BOTTOM ROW, cell 5: NEUTRAL silver friendly courier drone carrying a parcel, cool gray spacecraft background, charming round optic.
Constraints: exactly 5 by 2 equal seamless cells, no text, no numbers, no labels, no borders, no gutters, no card-shaped frames, no branding, no known franchise designs, no gore, no explicit weapons. The whole output is filled by these ten adjacent artworks.
```

### Portraits

```text
Use case: stylized-concept
Asset type: production game avatar sprite atlas: eighteen original head-and-shoulders portraits.
Primary request: one LANDSCAPE image arranged into EXACTLY SIX equal columns and THREE equal rows, 18 distinct equally sized square cells, perfectly tiled edge-to-edge with NO gutter, dividing lines, border, frame, margin or whitespace. Code will cut at exact 1/6 width and 1/3 height boundaries.
Style/medium: original retro-futurist space-smuggling adventure, painterly graphic-novel science fiction. Expressive friendly adventurous faces, crisp silhouettes readable at very small circular-avatar sizes. Coherent teal/indigo spacecraft metal, amber control lighting, lightly brushed texture; not photorealistic, not watercolor, not woodland or streetwear.
Composition: every cell holds one unique centered large head-and-shoulders portrait, entire head visible with slight breathing room, calm background, eye contact. Each character clearly distinct in silhouette, face, skin/hair or robot material, clothes and color accents. No helmets obscuring faces.
EXACT left-to-right portrait order:
TOP ROW: 1 confident Black woman freighter captain, short natural hair, teal flight jacket; 2 cheerful Asian man engineer, copper goggles on forehead; 3 friendly original cyan alien navigator with four soft head ridges; 4 weathered Latino man pilot, salt-and-pepper beard, indigo suit; 5 resourceful brown-skinned woman mechanic with red braided hair; 6 rounded silver robot with friendly turquoise optic eyes.
MIDDLE ROW: 1 young pale-skinned woman radio operator, short violet hair; 2 thoughtful amber-skinned alien trader with small rounded horns; 3 smiling Black man cargo runner with warm orange vest; 4 elderly East Asian woman scientist, silver hair; 5 pearly white small android with wide blue eyes; 6 original green alien botanist with soft leaflike head fins.
BOTTOM ROW: 1 cheerful dark-skinned woman courier, tightly curled hair; 2 broad-shouldered white man space cook, ginger mustache; 3 original lavender alien diplomat with long rounded ears; 4 South Asian nonbinary star mapper, wavy hair and indigo jacket; 5 compact copper robot with asymmetric harmless antennas; 6 original navy-blue alien ship medic with softly glowing turquoise markings.
Constraints: exact6x3 equal cells, centered small-avatar readability, no text, no numbers, no logos, no badges with lettering, no card outlines, no gutters, no weapons, no gore, no recognizable characters or designs from any known franchise. No cartoon animal heads.
```

### Background

```text
Use case: stylized-concept
Asset type: wide 16:9 background illustration for the entire playfield of an original space-themed digital card game.
Primary request: interior of a spacious orbital observation deck on an independent cargo spacecraft, panoramic window overlooking a small distant planet, scattered stars and a delicate teal-violet nebula.
Style/medium: original retro-futurist painterly graphic-novel science fiction, carefully painted matte spacecraft metal, subtle brushed details, coherent welcoming adventurous mood, sophisticated but legible, clearly different from a woodland children's-book world or any city/street setting.
Composition/framing: WIDE LANDSCAPE 16:9. A calm deep-indigo central and lower region occupies at least 60% of the image for overlaying game UI. Frame the view with modest indigo/teal structural ribs, subdued amber consoles and small cargo-deck equipment at far left and far right edges only. The window's small planet sits high and off center, not a giant foreground focal point. The lower deck is simple, dim blue, with almost no busy details. Depth without clutter. No people, aliens, robots, ships or large objects in the foreground.
Lighting/mood: restrained cyan edge glow, a few warm amber indicator lights, dark navy/indigo and muted teal, atmosphere of peaceful space travel. Low-contrast central background, no harsh spotlight or white flare.
Constraints: no text, no numbers, no letters on displays, no logos, no watermark, no recognizable franchise interiors or designs, no weapons, no emergency/red alarms, no graffiti, no animal/forest/city motif, no borders or decorative frame. This is a background, not a card or app screenshot.
```


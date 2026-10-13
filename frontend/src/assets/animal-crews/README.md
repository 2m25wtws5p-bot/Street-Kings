# Animal Crews artwork provenance

Generated on 2026-10-13 with the built-in `image_gen.imagegen` tool. No CLI/API fallback and no image editing or cropping. Originals preserved; copied non-destructively into project assets.

## Cards

Saved project asset: `frontend/src/assets/animal-crews/cards-atlas.png`

Original local artifact: `exec-cea16245-f279-48e1-8b97-d096278f68d2.png` in the generator's local image archive.

Prompt: Use case: illustration-story. Asset type: production game artwork sprite atlas for Animal Crews, an original comic-noir anthropomorphic street-animal card game. Create one detailed 10-panel illustration atlas, EXACT grid of 5 equal columns by 2 equal rows, every cell full bleed, edge-to-edge, with no gutters and no borders. Landscape canvas ratio 5:3; each individual cell is a portrait scene. Bold ink contours, expressive adult anthropomorphic animals in streetwear, original hand-drawn comic art, understated halftone and paper texture. Not realistic, not emoji. Recognizable faces in upper-middle of each cell; leave upper-left and bottom visually quiet for game pips and banners that will be overlaid by code. Row 1, left to right: (1) RED wolf street enforcer, red varsity jacket, brick alley; (2) YELLOW raccoon black-market merchant at golden street stall; (3) BLUE badger cash courier, blue hoodie and money case; (4) GREEN beaver smuggler, green overalls and crates; (5) RED raven kingpin boss in red coat with a tiny crown pin. Row 2, left to right: (1) GREEN rat informant in green hood with small red scarf; (2) YELLOW hyena briber in gold coat holding a coin; (3) BLUE fox fixer, calm blue coat, lock/key/contact book; (4) GREEN owl godmother, elegant green velvet with small red brooch; (5) NEUTRAL rabbit runner in gray messenger jacket. Four card palettes distinctly saturated red, golden yellow, blue, green. Rat informant and owl godmother scenes must remain GREEN with small red risk details, never red overall. All ten scenes consistent style and equal geometry. NO text, NO letters, NO numbers, NO logos, NO watermarks anywhere.

Visual inspection: correct 5×2 edge-to-edge grid, all requested subjects and palettes, no text/logos, green risk figures remain green with small red accents.

## Portraits

Saved project asset: `frontend/src/assets/animal-crews/portraits-atlas.png`

Original local artifact: `exec-b543d703-5030-4bfb-8bb6-f30a5c9d6673.png` in the generator's local image archive.

Prompt: Use case: illustration-story. Asset type: production portrait sprite atlas for Animal Crews, an original comic-noir anthropomorphic street-animal game. Create exactly 18 unique head-and-shoulders closeup portraits, arranged in an EXACT regular grid of 6 equal columns by 3 equal rows, all cells equal, full bleed edge-to-edge with NO gutters or borders. Landscape canvas ratio 2:1. Each animal face centered in its own cell with a consistently large crop and generous headroom, fully recognizable ears/head not cropped. Expressive adult comic-noir characters, bold hand-drawn ink contours, subtle halftone and paper texture, detailed original illustrated streetwear, NOT photorealistic, NOT emoji. Row 1, left to right: raven boss in burgundy coat; raccoon dealer in golden hoodie; wolf driver in worn leather jacket; beaver smuggler in green overalls; fox hacker in blue hoodie; owl lawyer in elegant coat. Row 2, left to right: rat informant; hyena; rabbit messenger; panther; bear; lynx. Row 3, left to right: coyote; badger courier; otter; red panda; boar; magpie. All 18 clearly different faces, ages, streetwear and small accessories, consistent art direction. Simple muted dark-teal or ochre brick backdrops behind each. NO text, NO labels, NO letters, NO numbers, NO logos, NO watermarks anywhere. Portrait atlas only; exact 6-column by 3-row cell alignment is essential for code cropping.

Visual inspection: correct 6×3 grid, eighteen distinct centered faces, no labels/logos.

## Background

Saved project asset: `frontend/src/assets/animal-crews/backstreet.png`

Original local artifact: `exec-0facf2c0-35e2-4403-ad7c-5e2639128731.png` in the generator's local image archive.

Prompt: Use case: illustration-story. Asset type: production background for Animal Crews, an original comic-noir anthropomorphic street-animal card game. Create an original hand-drawn comic-noir gritty New York backstreet at dusk. Brick tenements, fire escapes, worn shutters, subtle paw and crow graffiti symbols without words. Wet asphalt catches a few warm window lights. Wide 16:9 composition. Muted petrol teal, charcoal and ochre palette, bold but organic ink contours, understated halftone/paper texture. The center and lower central area must stay open and visually calm for a game interface; frame architectural detail along left and right edges, keep background atmospheric and secondary to foreground cards. Street feels lived-in by animal crews, not cute, but no people and no foreground animal characters. NO readable text, NO letters, NO logos, NO watermark. Not photorealistic, not cyberpunk, no glowing neon. Consistent sophisticated illustrated graphic-novel aesthetic.

Visual inspection: calm open center/lower area, detailed framed tenements, muted teal/ochre, paw/crow graffiti, no readable text/logos.
## Final published assets and atlas mapping

The original PNG files remain local and unchanged. The final published files use lossless WebP encoding with decoded RGBA pixel equality verified by the main agent (no cropping, recoloring, or visual alteration):

- `frontend/src/assets/animal-crews/cards-atlas.webp` — same pixel content as `cards-atlas.png`.
- `frontend/src/assets/animal-crews/portraits-atlas.webp` — same pixel content as `portraits-atlas.png`.
- `frontend/src/assets/animal-crews/backstreet.webp` — same pixel content as `backstreet.png`.

The cards atlas has five columns and two rows. Zero-based cell mapping: `RED:0`, `YELLOW:1`, `BLUE:2`, `GREEN:3`, `kingpin:4`, `informant:5`, `briber:6`, `fixer:7`, `godmother:8`, `runner:9`.

The portrait atlas has six columns and three rows. Zero-based avatar mapping: `boss:0` (raven), `dealer:1` (raccoon), `driver:2` (wolf), `smuggler:3` (beaver), `hacker:4` (fox), `lawyer:5` (owl), followed by `street-01` through `street-12` mapped to cells 6–17: rat, hyena, rabbit, panther, bear, lynx, coyote, badger, otter, red panda, boar, magpie.

Artwork is decorative only. Card suit, value, special identifier and game rules are unchanged by a theme.


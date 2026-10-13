# Friendly Animal Crews artwork provenance

Generated on 2026-10-13 with the built-in `image_gen.imagegen` tool. New original child-friendly raster illustrations; no CLI/API fallback. Old comic-noir assets were left unchanged. No cropping, recoloring or image editing was performed on these PNG files. Generated originals were preserved and copied non-destructively into the project.

## Cards

Project PNG: `frontend/src/assets/animal-crews/cards-friendly.png`

Original generation artifact: `exec-08d3ddad-2054-425a-950b-8addc4bbbede.png`

Exact generation prompt:

Use case: illustration-story. Asset type: original children's-book animal card-game sprite atlas. Create exactly TEN illustrations arranged in an EXACT regular grid of FIVE equal columns by TWO equal rows. Full bleed equal cells, edge-to-edge, NO gutters, NO borders. Landscape canvas ratio 5:3, each cell a portrait composition. Style: playful hand-painted gouache and soft colored-pencil children's-book art, warm bright light, friendly rounded shapes, expressive large eyes, authentic recognizable animals, no monster features, no imitation of any named character or brand. Clearly distinguish RED, YELLOW, BLUE and GREEN card palettes, with one dominant color per cell. Animals clearly visible in upper-middle; keep upper-left and bottom visually calm for code-overlaid card numbers and banners. Row 1 left to right: (1) RED friendly wolf playing on a meadow, red neckerchief and colorful play ribbons; (2) YELLOW cheerful raccoon with a yellow picnic basket of berries and cookies; (3) BLUE kind badger with a blue watering can beside a pond; (4) GREEN happy beaver planting a seedling among leaves; (5) RED charming silly raven making a harmless whirlwind of red ribbons and confetti. Row 2 left to right: (1) GREEN curious little mouse beside a flowerpot, a small red accent, playfully scattered leaves; (2) YELLOW joyful hyena with a yellow blossom, helping tidy up; (3) BLUE gentle fox holding a blue umbrella with soft water droplets, calming and kind; (4) GREEN friendly wise owl with a tiny red bow and swirling leaves; (5) NEUTRAL white-gray rabbit carrying a blank postcard in a flower garden. The mouse and owl cells must remain GREEN overall, only a tiny red accent. All ten scenes consistent whimsical picture-book art direction, natural fur/feathers and welcoming faces. Avoid ALL gangster clothing, weapons, money, cigarettes, crime, graffiti, cities, streets, neon, gloomy or threatening expressions. NO text, NO numbers, NO letters, NO logos, NO watermark anywhere.

Visual inspection: correct five-column, two-row grid, all ten requested friendly animals and activities. Distinct red/yellow/blue/green themes; mouse and owl remain green with small red accents. No gangster clothing or objects. Thin approximately one-pixel pale separator hairlines exist between cells despite the no-border prompt; no broad gutters. Verify their appearance within rendered card frames.

Card mapping, zero-based row-major cells: `RED:0` wolf, `YELLOW:1` raccoon, `BLUE:2` badger, `GREEN:3` beaver, `kingpin:4` playful raven, `informant:5` curious mouse, `briber:6` helpful hyena, `fixer:7` calming fox, `godmother:8` wise owl, `runner:9` rabbit.

## Portraits

Project PNG: `frontend/src/assets/animal-crews/portraits-friendly.png`

Original generation artifact: `exec-f58dd8f5-78c8-4d10-97ec-36f0789769b9.png`

Exact generation prompt:

Use case: illustration-story. Asset type: original friendly children's-book animal portrait sprite atlas for a family card game. Create exactly EIGHTEEN unique friendly animal head-and-shoulders portraits in an EXACT regular grid of SIX equal columns by THREE equal rows. Landscape canvas ratio 2:1. Equal full-bleed cells touch edge-to-edge; absolutely NO gutters, NO white separator lines, NO borders or frames. Center each face consistently with generous ear/head room; authentic recognizable animals, soft rounded silhouettes, large expressive kind eyes, natural fur/feather texture, playful painted gouache and colored-pencil children's-book illustration. Warm bright cheerful light, pastel colors, simple pale sky and flower backgrounds. Only tiny harmless flowers or small neckerchiefs as accessories, no heavy clothing. Row 1 left to right: raven, raccoon, wolf, beaver, fox, owl. Row 2 left to right: little mouse, hyena, white-gray rabbit, black panther, bear, lynx. Row 3 left to right: coyote, badger, otter, red panda, wild boar, magpie. All eighteen clearly distinct, friendly and welcoming, no scary snarls or menace. Original characters only, not based on Disney or any brand. Avoid ALL gangster clothes, weapons, money, cigarettes, criminal imagery, graffiti, city scenes, streets, neon, dark or threatening expressions. NO text, NO numbers, NO letters, NO labels, NO logos, NO watermark.

Visual inspection: correct six-column, three-row grid, eighteen distinct friendly animal faces with bright natural backgrounds. No street/gangster clothing or objects.

Portrait mapping, zero-based row-major cells: `boss:0` raven, `dealer:1` raccoon, `driver:2` wolf, `smuggler:3` beaver, `hacker:4` fox, `lawyer:5` owl, then `street-01` through `street-12` map to cells 6–17: mouse, hyena, rabbit, panther, bear, lynx, coyote, badger, otter, red panda, wild boar, magpie. These technical identity keys remain unchanged; their visible labels are theme-specific.

## Meadow

Project PNG: `frontend/src/assets/animal-crews/meadow.png`

Original generation artifact: `exec-178991b7-e885-4cac-b96a-4d36a5f917ce.png`

Exact generation prompt:

Use case: illustration-story. Asset type: original background for a playful child-friendly animal card game. A sunny open woodland meadow and gentle nature-play clearing beside a small pond, soft rounded trees and cheerful flowers framing the left and right edges, warm cream, light mint green, apricot and sky-blue palette. Hand-painted gouache and colored-pencil children's-book art with friendly organic forms, soft paper texture, bright warm daylight. Wide landscape 16:9 composition. Leave a generous quiet open middle and lower-middle meadow for the game's interface; decorative detail at the edges, no objects dominating the center. Natural and welcoming, entirely away from street/gangster aesthetics. NO buildings, NO roads, NO city, NO graffiti, NO neon, NO foreground characters or people, NO weapons or crime imagery, NO text, NO letters, NO logos, NO watermark. Original illustration, no named brands or recognizable franchise characters.

Visual inspection: sunny open meadow beside a pond, trees and flowers framing the edges, quiet open center, no buildings/roads/graffiti/characters/text.

## Integration

Artwork is presentation-only. Existing suit values, special identifiers, scoring and all gameplay functions remain unchanged. Lossless WebP encodings (`cards-friendly.webp`, `portraits-friendly.webp`, `meadow.webp`) were verified against the original PNGs with exact decoded RGBA equality. Local original PNGs were preserved; only WebP assets are shipped.


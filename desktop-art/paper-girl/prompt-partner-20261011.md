# Paper Girl desktop revision

OpenAI Codex (GPT-6), 2026-10-11. Built-in image generation only; no paid API or CLI call. Owner requested removal of NEWS and eyes matching File Master. Existing newspaper identity and nine moods preserved. This art remains a draft for owner preference review.

## Main edit prompt

Use case: precise-object-edit.
Asset type: desktop pet sprite sheet, 3 columns by 3 rows, nine expressions.
Image 1 is the edit target, the pink newspaper Paper Girl. Image 2 is a reference only for eye style, the yellow folder File Master.
Edit Paper Girl, not File Master. Preserve her pink folded newspaper silhouette, top-right folded corner, layered paper edges, abstract gray horizontal columns, black pixel outline, soft pink palette, small rosy cheek accents and all nine expressions in their current order. She has no arms or legs in the existing image; keep that silhouette.
Two requested face/text changes: Remove NEWS completely from ALL NINE newspapers. Leave a pink space with simple abstract gray rule/column marks if needed; absolutely no words, letters, readable text or symbols anywhere. Replace giant glossy circular eyes and eyelashes with File Master's small vertical black pixel rectangle/dot eyes, each open eye containing just one tiny square white highlight. They must be much smaller than old Paper Girl eyes, precisely in File Master's restrained eye style. No lashes. Closed-eye expressions use short small black horizontal strokes.
Moods row-major: idle gentle smile; blink eyes closed; happy; curious; worried; sad; sick; alarmed; asleep. Change only eyes, eyebrows and mouth for moods. No floating question marks, sweat, tears, Z letters, badges or decorative symbols.
Composition: exactly 3x3 equal cells, one fully visible pink newspaper centered in each cell, consistent character size, consistent proportions and uniform generous empty transparent margins. Do not clip any paper. No grid lines or labels. Crisp thin black pixel outline around sprite. This is actual transparent RGBA sprite art: ALL space outside silhouettes and gutters must be truly transparent alpha=0, no dark background, no black rectangles, no checkerboards, no glow or halo, no shadows. Preserve black outline, preserve pink newspaper; remove the entire dark background of reference.

## Transparency refinement prompt

Use case: background-extraction. Remove the entire dark/pink glowing background from this nine-frame 3x3 sprite sheet. It MUST have genuine clean RGBA transparency around each newspaper with alpha=0 all the way right up to its outer black silhouette. There must be no partial-alpha halo or shadow whatsoever, and no glow. Each pink newspaper and all its black outlines must be fully opaque, alpha=255, except for narrow edge antialiasing. Preserve ALL existing pixel details and the position, scale and shape of all nine paper characters exactly. Do not change small black rectangular white-highlight eyes, mouths, expression, corners, pink color, black outlines, layout or graphic newspaper columns. No text. No background design, no color field, no smoky darkness, no backdrop, no checkerboard. This is a clean transparent cutout of nine separate illustrated newspapers.

## Final square-layout prompt

Recreate the nine identical-character sprites from the reference as a SQUARE sprite sheet (square aspect ratio, 1024x1024), with 3 equal columns and 3 equal rows.
Use the reference strictly for the pink folded newspaper character identity and its nine expressions. The sprite sheet background must be true transparent RGBA, alpha=0, no colored or dark background and no glow. Each character floats separately in its own evenly spaced invisible cell, centered with generous blank TRANSPARENT margins on all four sides. All sprites same size and fully contained with lots of space between rows. Imagine a tic-tac-toe grid: one sprite centered in each square without touching invisible gridlines. Do NOT reuse the rectangular reference canvas or placement. New square composition. No drawn gridlines.
Preserve pink newspaper with top-right folded corner, black pixel-art outline, abstract gray columns, rosy cheeks. No NEWS, NO TEXT OR LETTERS anywhere. Small vertical black rectangle eyes with one tiny square white highlight, NO lashes, NO giant glossy eyes. No limbs.
Mood positions: top-left idle smile, top-center blink, top-right happy; middle-left curious, middle-center worried, middle-right sad; bottom-left sick, bottom-center alarmed, bottom-right sleep. No floating symbols. Preserve design details, adjust layout to SQUARE and wide transparent gutters. Flat clean pixel sprites, no shadow, no halo.

## Output and slicing

Original active assets were preserved locally in `bin/paper-girl-before-partner-20261011/`. The selected generated sheet replaces the existing `sheet-20261011.png`; nine transparent 256px frames are derived using the existing `scripts/build-desktop-art-20261011.mjs paper-girl` without altering the generated artwork. Alpha is retained; RGB values behind alpha-zero pixels are invisible in the actual desktop renderer.

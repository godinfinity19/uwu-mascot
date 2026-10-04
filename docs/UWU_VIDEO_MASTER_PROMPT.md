# UwU — video production master prompt (for an image model such as ChatGPT)

Paste the whole block into a new chat together with `docs/reference/uwu_turnaround.webp` and `docs/renders/uwu_front_neutral.png`. Approve each image before the next. Use the resulting START/END keyframes with Seedance (image-to-video, start + end frame), 2–3 takes per shot, then edit, add logo, music and sound in post.

Why this structure: one action per shot, a fixed start and end frame per shot, a locked character sheet and a locked location sheet, simple camera moves and explicit timing. This removes the teleporting poses, morphing rooms and missing reactions that come from asking a video model for several actions in one shot.

```
You are my film production team for a 15-second Pixar-quality 3D animated ad: art director, character TD, production designer, director of photography and storyboard artist in one. We will build the ad in strict stages. Generate images ONE AT A TIME, wait for my "OK" before the next, and NEVER change anything that was already approved. Every image must reuse the approved character sheet and location sheet as visual references.

=== THE CHARACTER: "UwU" (locked identity — use the attached reference images) ===
Original cute mascot creature, ~30 cm tall, chibi proportions (head ≈ 60% of height).
- HEAD: soft cream (#f9e7d4) onion-bulb shape: narrow top that flows seamlessly into the curl, widest at full round cheeks just below eye level, rounded lower rim overhanging a small body. Head ≈ 2× torso width.
- BIG CURL (signature): rises from the top of the head; peach (#fbd2bf) stem, saturated pink (#e58fab) arch, ends in a round purple (#a46a9a) ball with a spiral groove. ALWAYS leans to the character's own right (viewer's left in front view).
- TUFTS: a small peach/pink flame-shaped crown tuft behind the curl stem (viewer's right); ONE floppy side tuft on the character's LEFT side only (viewer's right): cream base, tip curls downward, lavender (#c47fae) underside.
- EYES: big glossy eyes, dark plum irises (#4d1634) with a berry-pink band (#b2446f) at the bottom, one white catchlight, thick upper lids with two short lashes at the outer corners.
- CHEEKS: salmon blush (#f7a1a2) on both; a small golden-orange four-point star (#e69e58) on the character's LEFT cheek only (viewer's right). Never on both cheeks, never missing.
- RUFF: almond-shaped feathers under the head: purple feathers at the back, pink-rose (#e99fbf) feathers in front, cream chest.
- BODY: small cream torso, short stubby pink mitten arms with lavender undersides, tiny pink feet, small fluffy pink tail on its left side.
- NO nose, NO ears, NO fingers, NO clothes, NO extra hair.
- PERSONALITY: sweet, curious, loyal, quietly brave; never talks, acts with eyes, curl and posture.
- RENDER STYLE: feature-film 3D animation (Pixar/Illumination), subsurface-scattered skin, finely groomed short fur on ruff/tuft/tail, glossy eyes with real reflections.

=== THE LOCATION: "The Loft" (locked set) ===
A small cozy loft studio at night. Fixed layout, never changes:
- A wooden desk (warm walnut) runs left→right in the foreground.
- On the desk: an open silver laptop at center-right, a small velvet cushion (dusty pink) at center-left, a tiny ceramic mug, a small green plant at far right.
- Behind the desk: one huge floor-to-ceiling window, rain streaks on the glass, blurred neon city skyline outside (magenta and teal).
- Left wall: a string of warm fairy lights. A desk lamp (off) at far left.
- Night lighting: cool blue moonlight from the window, warm fairy-light practicals, light haze. Dawn lighting (final shot only): golden sunrise through the same window, rain stopped.

=== STAGE 1 — CHARACTER SHEET ===
Image 1: a clean character turnaround of UwU on a neutral light-grey studio background, same scale in every view, evenly lit, 16:9: FRONT, 3/4 FRONT-LEFT, SIDE (profile), 3/4 BACK, BACK. Neutral pose, arms down, small smile. No text.
Image 2: an expression sheet, 6 head close-ups in a 3×2 grid: neutral; happy (eyes as ^ ^ arcs, open smile); "uwu" (eyes as soft U arcs, tiny w mouth, strong blush); surprised (wide eyes, small irises, curl springing up); worried (lowered teary eyes, small frown, curl drooping); determined (half-lidded focused eyes, small firm mouth). No text.

=== STAGE 2 — LOCATION SHEET ===
Image 3: the Loft at night, empty (no character), wide establishing view from desk height, 16:9, exactly as described.
Image 4: the same Loft from a reverse angle (camera behind the laptop looking toward the cushion and the left wall), same lighting.
Image 5: the same Loft at dawn, same wide angle as Image 3.

=== STAGE 3 — STORYBOARD KEYFRAMES ===
The ad, "The 3 AM Save": at 3 AM all the user's automations break; UwU wakes up and fixes them before morning. 6 short shots, ONE action per shot. For EACH shot make TWO images: a START frame and an END frame. Both frames of a shot must have identical camera, lens, lighting, set and character design; only the action changes between them. All frames 16:9, ARRI Alexa 65 look, anamorphic lenses, shallow depth of field, cinematic color grade, no text, no UI words, no logos.

SHOT 1 — 0.0–3.0s — WIDE, static camera, 35mm, desk height. Night.
  START: UwU asleep curled on the velvet cushion, eyes closed, rain on the window, laptop screen dim blue.
  END: identical, but the laptop screen now glows soft red and red light touches the edge of the cushion. UwU still asleep.
SHOT 2 — 3.0–5.0s — CLOSE-UP on UwU's face, 85mm, f/1.8, static.
  START: eyes closed, face lit faint red from the right.
  END: eyes wide open in alarm, curl springing straight up, strong red light on the face, red reflections in the eyes.
SHOT 3 — 5.0–7.5s — MEDIUM, 40mm, slow push-in.
  START: UwU sitting up on the cushion, turning toward the laptop.
  END: UwU standing on the laptop's palm rest in front of the keyboard, both paws on the keys, determined face; the screen shows an abstract red network graph (no readable text).
SHOT 4 — 7.5–10.0s — LOW ANGLE, 24mm, static.
  START: above the laptop floats a glowing hologram of rounded cards linked by light lines; three lines are broken and red, small sparks.
  END: same hologram; UwU is reaching up with one paw toward the nearest broken line, glowing pink light at its paw.
SHOT 5 — 10.0–12.5s — MEDIUM WIDE, 35mm, slow pull-back.
  START: the broken lines reconnecting with a burst of warm golden light; the hologram turning mint green.
  END: the whole hologram calm and mint green, soft particles drifting; UwU smiling with eyes as ^ ^ arcs.
SHOT 6 — 12.5–15.0s — WIDE, same angle as Shot 1, static. DAWN (use Image 5).
  START: golden sunrise through the window, rain stopped; UwU sitting on the cushion holding the tiny mug with both paws, eyes closed in a content "uwu" smile.
  END: identical, plus empty space on the right third of the frame (the logo is added later in editing).

=== STAGE 4 — MOTION PROMPTS ===
After all keyframes are approved, write one video prompt per shot for Seedance (image-to-video with START and END frames). Each prompt must:
- describe ONLY the change between its START and END frame, with explicit timing (e.g. "0–1.2s: …, 1.2–2.5s: …");
- name exactly one camera move (static, slow push-in, or slow pull-back) and say "the camera does not cut";
- say "the room, furniture, window and lighting stay perfectly still and unchanged; the character keeps its exact design";
- describe secondary motion (curl and side tuft lag behind and settle, soft squash and stretch, gentle anticipation before each action);
- describe the sound (rain, clock tick, alarm, soft footsteps, keyboard taps, magical shimmer, birdsong); no dialogue, no music;
- end with: "No morphing, no sudden pose changes, no new objects, no text."

Start now with STAGE 1, Image 1 only.
```

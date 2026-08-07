# Inside the Internet

A scroll-driven cinematic experience built on two 10-second films: from the physical
infrastructure of the internet to the global network around the Earth. One continuous
screen, no page sections, no cyberpunk UI — the footage is the subject.

```bash
npm install
npm run dev      # http://localhost:5177
npm run build    # tsc -b && vite build
npm run preview
```

## Structure

```
public/video/desktop/   1920x1080, 24 fps, GOP=1   (used at >= 900 px)
public/video/mobile/    1280x720,  24 fps, GOP=1   (used at <  900 px)
public/images/          transition-chip.png, final-earth.png
preview/                20 s linear reference cut (not shipped, git-ignored)

src/lib/timeline.ts     the whole scroll timeline, expressed in vh
src/lib/scrub.ts        playhead smoothing / seek throttling
src/lib/media.ts        which film variant this device gets
src/data/script.ts      every line of copy and where it appears
src/components/         Experience (scroll route), StillJourney (reduced motion), Loader
```

## The scroll timeline

One spacer element defines the whole journey; everything visible is `position: fixed`.
All lengths are in `vh`, so the mapping from scroll position to story position is
identical on every viewport height.

| act | length | what happens |
| --- | --- | --- |
| intro | 120vh | first frame of film 1 held at 24% opacity, title card fades out |
| chapter 01 | 500vh | film 1 scrubs 0 → 10.0 s, four cues |
| handoff | 14vh | film 2 fades in over film 1 |
| chapter 02 | 500vh | film 2 scrubs 0 → 10.0 s, four cues |
| finale | 220vh | film 2 holds its last frame, closing card |

A chapter's length is really a statement about how much picture moves per pixel
scrolled. At 500vh a 10 s / 24 fps film advances one frame roughly every 19 px, which
keeps the image alive under a slow scroll. The 800vh the brief suggested worked out at
30 px per frame, where the footage visibly crawls and the motion reads as stepping
rather than movement — that, rather than the easing, is what makes a scrubbed film feel
sluggish. Cue positions are expressed in chapter progress, so they follow the length
automatically.

## How the playhead is driven

`ScrollTrigger` writes raw scroll progress into a ref — never into React state. A single
`gsap.ticker` callback eases that value through a **critically damped spring**
(`SCROLL_STIFFNESS` in `src/components/Experience.tsx`, 14 rad/s) and renders
*everything* from the eased result: both playheads, the copy, the rail, the opening dim.

Two properties come out of that:

- **One object.** Because the whole scene reads the same eased progress, it decelerates
  together when the scroll stops. Smoothing only the film would make it look like the
  film is lagging behind the text rather than like the scene has weight.
- **A real glide.** The spring carries velocity, so it keeps moving after the target
  stops. A plain exponential ease cannot: at ordinary scroll speeds it is already within
  half a frame of the target, so it halts in the same instant the scroll does.

Integration is closed form, so any frame duration is stable — a dropped frame or a
backgrounded tab cannot produce a wild step — and an overshoot guard keeps the value
from sailing past the target, which would read as the story briefly running backwards.

`src/lib/scrub.ts` then turns the eased position into seeks, and **snaps every seek to
an exact frame boundary**. This matters more than the easing: a sub-frame seek costs the
decoder a full seek but often shows the very same picture, so the visible cadence comes
out uneven — one frame, nothing, one frame, nothing, nothing. On frame boundaries every
step is one visible frame and a decelerating playhead reads as a clean 3-2-2-1-1 ramp.
Speed is capped at 7.5× realtime, and 30× once the gap exceeds 1.5 s so a replay or a
flick past a whole chapter is caught up rather than cut to.

`SCROLL_STIFFNESS` is the one knob for the feel — lower is heavier and slower to settle,
higher is tighter and more literal. Measured at 14 rad/s, chapter 01, 1440×900:

| scroll speed | film trails by | glides to a stop over | frame steps while stopping |
| --- | --- | --- | --- |
| slow (480 px/s) | 0.10 s | ~320 ms | 1-1-1 |
| brisk (1440 px/s) | 0.29 s | ~335 ms | 3-2-2-1-1-1 |
| fast flick (3600 px/s) | 0.65 s | ~400 ms | 6-9-6-4-1-1 |

Nothing is ever `play()`-ed during scrolling. The films are played and paused exactly
once, behind the loader, because mobile Safari will not paint a frame from a video that
has never started.

Seekability is read from the element every tick rather than latched in an event handler:
Chrome drops `readyState` back below `HAVE_CURRENT_DATA` while a seek is in flight, so a
flag set from `loadeddata` can end up stuck on the wrong value.

## The cut between the films

The last frame of film 1 and the first frame of film 2 are nearly identical (measured
mean difference over a 32×18 luma grid: ~4/255).

Both films are stacked in the same box. Entering the 14vh handoff band, film 1 is
snapped to its exact final frame and film 2 to frame 0, then **film 2 fades in on top
while film 1 stays fully opaque underneath**. Because nothing ever fades *out*, the page
background can never show through — no black frame, no flash, and the same in reverse.
If film 2 is not decodable yet, it simply does not fade in and film 1's own final frame
holds the screen, which is the same image as `transition-chip.png` without the download.

## Device variants

The `src` is chosen in JavaScript from `matchMedia('(min-width: 900px)')` and resolved
once on mount, so only one variant is ever requested and a resize never re-downloads a
film. Film 2 is attached once film 1 is buffered, and at the latest at 50% of chapter 01.

Scrolling is locked until film 1 can actually be seeked. Before the bundle even arrives,
`index.html` paints a static black title card so the first paint is never an empty page.

## Reduced motion

`prefers-reduced-motion: reduce` renders a different route entirely: the two key still
frames, every line of copy, ordinary page scrolling, and **no video request at all**.

## Verified

Against both the dev server and the production build, at 1920/1440/1280/834/390/360 px:

- both films report exactly 10.0 s and scrub from the first to the last frame,
- the playhead lands within ±0.06 s of the target at every checkpoint,
- 60 fps median (p95 ≈ 54–56 fps) sweeping the entire timeline slowly and quickly, in
  both directions, with no frame where the playhead moves against the scroll,
- no black or blank frame anywhere across the cut, forwards or backwards,
- a jump from 5% to 90% of chapter 01 is caught up in ~0.6 s,
- every seek lands on an exact frame boundary, and the interval between visible frame
  changes is even (jitter 0.17–0.20 across slow, medium and brisk scrolling),
- never more than one cue on screen, sampled every 8vh across both chapters,
- resize and orientation change preserve the position in the story, not in pixels,
- phones request only the 720p files, desktops only the 1080p files,
- native browser scrollbars hidden in favor of custom gold minimalist progress rail (`.rail`),
- interactive "Scroll to enter" button triggers smooth scroll into Chapter 01,
- premium Share button with Web Share API and gold clipboard feedback on finale,
- no horizontal overflow at any width, and no console errors or warnings.

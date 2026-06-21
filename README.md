# Ledger Biolink

A single-page "link in bio" site: full-bleed background video + music, three
crypto entries (BTC / ETH / LTC) styled as ledger line-items that copy your
address on click, and a transparent, rotate-only 3D viewer for your Ledger
device `.glb`. Plain HTML/CSS/JS — no build step, no framework.

## 1. Drop in your assets

Put these three files in `assets/` (exact filenames, or update the `src`
paths in `index.html`):

```
assets/background.mp4   — looping background video (silent is fine, it's muted anyway)
assets/song.mp4          — your audio track (an MP4 with just an audio stream works in <audio>)
assets/ledger.glb        — your Ledger device model (you already have this)
```

Keep `background.mp4` reasonably small/compressed (a few MB, 1080p max,
no audio needed) — it autoplays on load and Vercel's free tier has
bandwidth limits.

## 2. Set your wallet addresses

Open `js/main.js` and edit the top of the file:

```js
const ADDRESSES = {
  btc: "YOUR_BTC_ADDRESS_HERE",
  eth: "YOUR_ETH_ADDRESS_HERE",
  ltc: "YOUR_LTC_ADDRESS_HERE",
};
```

That's the only place you need to touch — the HTML pulls from this object
automatically.

## 3. Set your name / bio

In `index.html`, edit:

```html
<h1 class="title">Your Name Here</h1>
<p class="subtitle">accepting tips · on-chain · cold storage verified</p>
```

## 4. About the 3D viewer

- Built with `<model-viewer>` (loaded from a CDN, no install needed).
- **Transparent**: the canvas background is transparent, so only the model
  itself renders — no backing plate/skybox behind it. If your GLB's own
  materials use alpha/transmission, that transparency will show through too,
  since this is rendering the model exactly as authored.
- **Rotate-only, by design**: the built-in `camera-controls` attribute is
  intentionally *not* used, because it ships zoom + pan gestures. Instead,
  `js/main.js` listens for pointer drags and rotates the camera manually via
  `cameraOrbit`, with the distance (radius) locked right after the model
  loads. Scroll/wheel and pinch are explicitly blocked inside the viewer.
  Net result: drag = rotate, nothing else.
- If the model looks tiny/huge or off-center, adjust `camera-orbit` and
  `field-of-view` on the `<model-viewer>` tag in `index.html`, or set
  `camera-target` to your model's center point.

## 5. Run locally

Any static server works, e.g.:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open the printed local URL. (Opening `index.html` directly via
`file://` will break the GLB load and clipboard copy in most browsers —
always serve it over http.)

## 6. Deploy to Vercel

```bash
npm i -g vercel   # if you don't have the CLI
vercel             # from inside this project folder, follow the prompts
vercel --prod      # promote to production
```

No build settings needed — this is a static site, Vercel will serve it
as-is. `vercel.json` just adds correct caching/content-type headers for
the video and `.glb` files.

## File map

```
index.html        structure: gate, background, ledger card, entries, 3D viewer
css/style.css      all styling + animation (tokens at the top of the file)
js/main.js         gate/autoplay logic, mute toggle, clipboard copy, rotate-only model controls
vercel.json        headers for video/glb caching + content-type
assets/            put background.mp4, song.mp4, ledger.glb here
```

## Browser notes

- Autoplay-with-sound is blocked by every modern browser until a user
  gesture happens — that's why there's a "break the seal" entry screen.
  Clicking it starts both the video and the audio together.
- Clipboard copy (`navigator.clipboard`) requires a secure context (https,
  or localhost). It's used everywhere on Vercel by default. A legacy
  fallback is included for older browsers.

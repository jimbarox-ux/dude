# LARP — biolink

A single-page "link in bio" site, guns.lol style: dark glass card over a
dimmed background video, an auto-discovered/auto-switching music playlist
with volume + bass EQ, a live Discord status badge (avatar, badges, status),
three crypto rows (BTC / ETH / LTC) with live 24h sparklines that copy your
address on click, and a rotate-and-zoom 3D viewer for your Ledger `.glb`.
Plain HTML/CSS/JS — no build step, no framework (one tiny Node script is
used only to regenerate the music playlist list, see below).

## 1. Drop in your assets

```
assets/background.mp4    — looping background video (silent is fine, it's muted anyway)
assets/ledger.glb         — your Ledger device model
assets/songs/*.mp3        — as many mp3s as you want, named however you want
```

After adding/removing mp3s in `assets/songs/`, run:

```bash
node scripts/build-songs-manifest.js
```

This rewrites `assets/songs/songs.json` to match what's actually in that
folder. **Why this extra step exists:** a static host like Vercel has no
API for client-side JS to ask "what files are in this folder" — there's no
directory listing over plain HTTP. So instead of you hand-typing filenames
into the site's JS (which you explicitly didn't want), this script does the
listing for you, once, and the site just reads the resulting JSON at
runtime. Re-run it any time the song folder changes, then commit/redeploy.

Track display names come from the filename (`lo-fi_chill_v2.mp3` →
"lo fi chill v2"). Rename files however you want them to read, or hand-edit
the `"title"` field in `songs.json` afterward.

## 2. Set your wallet addresses

Top of `js/main.js`:

```js
const ADDRESSES = {
  btc: "YOUR_BTC_ADDRESS_HERE",
  eth: "YOUR_ETH_ADDRESS_HERE",
  ltc: "YOUR_LTC_ADDRESS_HERE",
};
```

## 3. Set your name

In `index.html`:

```html
<h1 class="display-name">Your Name Here</h1>
```

## 4. Discord — avatar, live status, badges, bio

Powered by **[Lanyard](https://github.com/Phineas/lanyard)**, a free
service that exposes Discord presence over a public REST API — no bot
token, no auth required to *read* it.

**Requirement: the Discord account has to have joined the Lanyard Discord
server at least once** — that membership is what lets Lanyard see the
account's presence at all: **https://discord.gg/lanyard**

Your ID is already set in `js/main.js`:
```js
const DISCORD_USER_ID = "1168690960625041462";
```

**Avatar**: fetched from Discord's CDN using the avatar hash Lanyard
returns. If the account has no custom avatar, it falls back to Discord's
own default avatar instead of staying blank. If presence hasn't synced
yet (can take a minute or two right after joining the Lanyard server, or
needs a presence change to trigger the first sync), the widget retries a
few times before settling into a placeholder.

**Badges**: Discord doesn't send badge icons directly — it sends a
`public_flags` bitfield. This site decodes that bitfield client-side
(Staff, Partner, HypeSquad, Bug Hunter, Early Supporter, Active Developer,
etc.) and renders a small star-glyph badge per flag, tinted to that badge's
color. No extra API call needed.

**"Bio"**: this is the one item worth being upfront about — **Discord's
API does not expose "About Me" text anywhere, to bots or otherwise.**
Lanyard can't fetch something Discord doesn't send. The closest real
substitute is **Lanyard's KV store** — a small key/value store tied to
your account that *you* set, which then displays live on the site exactly
like a bio would:

1. DM the Lanyard bot `.apikey` to get your personal API key.
2. Set a value:
   ```bash
   curl -X PUT https://api.lanyard.rest/v1/users/YOUR_DISCORD_ID/kv/bio \
     -H "Authorization: YOUR_API_KEY" \
     -d "available for work · est. 2021"
   ```
3. The site automatically shows that text in place of the status word,
   any time `kv.bio` is present. If you never set it, the status line
   just shows your live status ("online" / "idle" / "do not disturb" /
   "offline") like before.

## 5. Audio menu (top-right note icon on the card)

- **Track switcher**: shows the current track name, with prev/next skip
  buttons. Auto-advances to the next track when one ends, wrapping back
  to the first after the last.
- **Volume slider**: 0–100, applied directly to the `<audio>` element.
- **Bass slider**: -12dB to +12dB, applied via a real Web Audio API
  low-shelf filter at 200Hz — this actually reshapes the sound, unlike
  just changing playback volume. Built on a lazily-created `AudioContext`
  (created on the entry-gate click, since browsers require a user gesture
  before audio context can run).
- Music starts automatically the moment you click through the entry gate
  (the gate itself still exists because no browser allows audio-with-sound
  to autoplay before any user interaction — that's a platform restriction,
  not a choice this code makes).

## 6. About the 3D viewer

- Rotate **and zoom** now: drag to orbit, scroll/pinch to zoom in and out
  (clamped between 40%–200% of the default distance via `min-camera-orbit`
  / `max-camera-orbit` in `index.html`, so it can't zoom to nothing or
  fly off into space).
- **Pan is still blocked** — two-finger drag and right-click-drag (the
  gestures model-viewer normally maps to panning the camera target) are
  intercepted and suppressed, so rotate + zoom are the only ways to move
  the view.
- The canvas background stays transparent — nothing renders behind the
  model itself.

## 7. Run locally

```bash
npx serve .
# or
python3 -m http.server 8080
```

Always serve over http — opening `index.html` via `file://` breaks the GLB
load, the Lanyard/CoinGecko/songs.json fetches, and clipboard copy.

## 8. Deploy to Vercel

**Via CLI:**
```bash
npm i -g vercel
vercel
vercel --prod
```

**Via GitHub:** push the whole folder (assets included) to a repo, then in
Vercel: **Add New Project → Import Git Repository** → pick it → leave the
framework preset as "Other"/static, no build command needed → Deploy.

Remember to run `node scripts/build-songs-manifest.js` and commit the
resulting `songs.json` *before* pushing — it's a plain static file, not
generated at deploy time.

GitHub has a 100MB-per-file limit — compress `background.mp4` /
`ledger.glb` or use Git LFS if either is close to that.

## File map

```
index.html                       structure: gate, audio menu, profile, entries, 3D viewer
css/style.css                     all styling + animation
js/main.js                        gate, audio engine (playlist/volume/EQ), copy-to-clipboard,
                                   rotate+zoom model controls, Lanyard fetch + badges + KV bio,
                                   CoinGecko sparkline rendering
scripts/build-songs-manifest.js   regenerates assets/songs/songs.json from whatever mp3s are present
vercel.json                       headers for video/glb caching + content-type
assets/background.mp4             your background video
assets/ledger.glb                 your Ledger device model
assets/songs/*.mp3 + songs.json   your music + its auto-generated manifest
```

## What changed in this revision

- Fixed: Discord avatar not loading — added a CDN-default-avatar fallback
  and a few retry passes for cases where Lanyard hasn't finished syncing
  presence yet.
- Added: Discord badges, decoded from `public_flags` client-side.
- Replaced the old mute toggle with a compact audio menu (top-right note
  icon) containing a volume slider and a bass EQ slider.
- Profile block nudged down slightly so it doesn't sit flush against the
  audio menu.
- Status line now shows a Lanyard KV `bio` value if you've set one, with
  a clear explanation above for why a literal Discord bio isn't fetchable
  at all — Discord's API doesn't expose that field to anyone.
- Music now starts automatically right after the entry gate (no separate
  manual play step), pulls from an auto-discovered playlist instead of a
  single hardcoded `song.mp4`, and auto-advances between tracks.
- Added `scripts/build-songs-manifest.js` so you never type filenames
  into the JS — drop mp3s in, run one command.
- Ledger model is now zoomable (scroll/pinch), while pan stays blocked.
- Added a soft two-tone ambient glow behind the card and a thin accent
  hairline at its top edge, to give the glass card some depth instead of
  reading as a flat dark rectangle over the video.

#!/usr/bin/env node
/**
 * Regenerates assets/songs/songs.json by listing every .mp3 file
 * actually present in assets/songs/.
 *
 * Why this exists: a static host (Vercel included) has no API for a
 * browser to ask "what files are in this folder" — there's no
 * client-side directory listing over plain HTTP. So instead of hand-
 * typing filenames into the site's JS (which is what you explicitly
 * asked to avoid), this script does the listing for you at build/
 * deploy time and writes the result to a small JSON manifest that the
 * site fetches at runtime.
 *
 * Usage:
 *   node scripts/build-songs-manifest.js
 *
 * Run it any time you add/remove/rename mp3 files in assets/songs/,
 * then commit the updated songs.json alongside your songs.
 *
 * Track titles are derived from the filename (dashes/underscores ->
 * spaces, extension stripped). Rename files however you'd like them
 * to display, or hand-edit the "title" field in songs.json afterward.
 */
const fs = require("fs");
const path = require("path");

const SONGS_DIR = path.join(__dirname, "..", "assets", "songs");
const OUTPUT_FILE = path.join(SONGS_DIR, "songs.json");

function prettify(filename) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function main() {
  if (!fs.existsSync(SONGS_DIR)) {
    console.error(`Folder not found: ${SONGS_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(SONGS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".mp3"))
    .sort((a, b) => a.localeCompare(b));

  const songs = files.map((f) => ({
    title: prettify(f),
    url: `assets/songs/${f}`,
  }));

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ songs }, null, 2) + "\n");

  console.log(`Wrote ${songs.length} track(s) to ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  songs.forEach((s) => console.log(`  - ${s.title}`));
}

main();

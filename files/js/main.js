(() => {
  "use strict";

  /* ===================================================================
     EDIT THESE
     =================================================================== */
  const ADDRESSES = {
    btc: "YOUR_BTC_ADDRESS_HERE",
    eth: "YOUR_ETH_ADDRESS_HERE",
    ltc: "YOUR_LTC_ADDRESS_HERE",
  };

  const DISCORD_USER_ID = "1168690960625041462";

  // Songs are NOT hardcoded by filename. Static hosts (Vercel included)
  // can't list a folder's contents from client-side JS — there is no
  // directory API over plain HTTP. Instead this manifest file lists
  // what's in assets/songs/. Regenerating it is one line, see README.
  const SONGS_MANIFEST_URL = "assets/songs/songs.json";

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    setYear();
    wireAddressesIntoDom();
    initGate();
    initCopyButtons();
    initLedgerModel();
    initDiscordPresence();
    initCoinCharts();
    initAudioSystem(); // playlist + volume + EQ, replaces the old single-track player
  }

  function setYear() {
    const el = document.getElementById("year");
    if (el) el.textContent = new Date().getFullYear();
  }

  function wireAddressesIntoDom() {
    document.querySelectorAll(".entry").forEach((row) => {
      const coin = row.dataset.coin;
      if (ADDRESSES[coin]) row.dataset.address = ADDRESSES[coin];
    });
  }

  /* ===================================================================
     ENTRY GATE
     =================================================================== */
  function initGate() {
    const gate = document.getElementById("gate");
    const sealBtn = document.getElementById("sealBtn");
    const bgVideo = document.getElementById("bgVideo");

    if (!gate || !sealBtn) return;

    const alreadyEntered = sessionStorage.getItem("ledger-entered") === "1";

    if (alreadyEntered) {
      gate.classList.add("is-open");
      gate.style.display = "none";
      if (bgVideo) {
        bgVideo.muted = true;
        bgVideo.play().catch(() => {});
      }
      window.dispatchEvent(new CustomEvent("larp:resume-audio"));
      return;
    }

    sealBtn.addEventListener("click", enter, { once: true });

    function enter() {
      gate.classList.add("is-breaking");

      if (bgVideo) {
        bgVideo.muted = true;
        bgVideo.play().catch(() => {});
      }
      window.dispatchEvent(new CustomEvent("larp:start-audio"));

      window.setTimeout(() => {
        gate.classList.add("is-open");
        sessionStorage.setItem("ledger-entered", "1");
      }, 450);

      window.setTimeout(() => {
        gate.style.display = "none";
      }, 1200);
    }
  }

  /* ===================================================================
     COPY-TO-CLIPBOARD
     =================================================================== */
  function initCopyButtons() {
    document.querySelectorAll(".entry").forEach((row) => {
      const btn = row.querySelector(".copy-btn");
      const tooltip = row.querySelector(".entry__tooltip");
      if (!btn) return;

      let resetTimer = null;

      btn.addEventListener("click", async () => {
        const address = row.dataset.address || "";
        const ok = await copyText(address);

        if (tooltip) tooltip.textContent = ok ? "Copied!" : "Couldn't copy";
        row.classList.toggle("is-copied", ok);

        window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(() => {
          row.classList.remove("is-copied");
          if (tooltip) tooltip.textContent = "Copy Address";
        }, 1800);
      });

      row.addEventListener("mouseleave", () => {
        if (!row.classList.contains("is-copied") && tooltip) {
          tooltip.textContent = "Copy Address";
        }
      });
    });
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      /* fall through */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  /* ===================================================================
     LEDGER 3D MODEL — rotate + zoom, pan still blocked
     model-viewer's built-in camera-controls is now enabled (needed for
     pinch/scroll zoom), with min/max-camera-orbit radius limits set in
     the HTML so zoom can't go absurdly far in or out. Two-finger/
     right-click PAN is the one gesture we still actively suppress,
     since nothing in the brief asked for panning around the device.
     =================================================================== */
  function initLedgerModel() {
    const viewport = document.getElementById("vaultViewport");
    const modelViewer = document.getElementById("ledgerModel");
    if (!viewport || !modelViewer) return;

    modelViewer.addEventListener(
      "load",
      () => {
        viewport.classList.add("is-loaded");
      },
      { once: true }
    );

    // model-viewer maps two-finger drag / right-click-drag to panning
    // the camera target. We intercept at the pointer level: a second
    // simultaneous pointer, or any pointer with button === 2 (right
    // click), gets its events stopped before model-viewer's internal
    // controls see them, so only single-finger / left-click drag
    // (rotate) and wheel/pinch (zoom, handled natively) get through.
    let activePointers = 0;

    viewport.addEventListener(
      "pointerdown",
      (e) => {
        activePointers++;
        if (e.button === 2 || activePointers > 1) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true
    );

    viewport.addEventListener(
      "pointerup",
      () => {
        activePointers = Math.max(0, activePointers - 1);
      },
      true
    );

    viewport.addEventListener("contextmenu", (e) => e.preventDefault());

    viewport.style.touchAction = "pinch-zoom"; // allow pinch (zoom), block two-finger pan/scroll drag
  }

  /* ===================================================================
     DISCORD PRESENCE — Lanyard (avatar, status, badges, bio)
     =================================================================== */

  // Bit flags for Discord's `public_flags` field. Decoded client-side
  // from the Lanyard payload — no extra API needed for badges.
  const DISCORD_FLAGS = [
    { bit: 0, key: "STAFF", label: "Discord Staff", color: "#5865f2" },
    { bit: 1, key: "PARTNER", label: "Partnered Server Owner", color: "#5865f2" },
    { bit: 2, key: "HYPESQUAD", label: "HypeSquad Events", color: "#f2b93d" },
    { bit: 3, key: "BUG_HUNTER_1", label: "Bug Hunter", color: "#3ddc84" },
    { bit: 6, key: "HYPESQUAD_BRAVERY", label: "HypeSquad Bravery", color: "#9c84ef" },
    { bit: 7, key: "HYPESQUAD_BRILLIANCE", label: "HypeSquad Brilliance", color: "#f47b67" },
    { bit: 8, key: "HYPESQUAD_BALANCE", label: "HypeSquad Balance", color: "#45ddc0" },
    { bit: 9, key: "EARLY_SUPPORTER", label: "Early Supporter", color: "#ff73fa" },
    { bit: 14, key: "BUG_HUNTER_2", label: "Bug Hunter Gold", color: "#3ddc84" },
    { bit: 17, key: "VERIFIED_DEVELOPER", label: "Early Verified Bot Developer", color: "#5865f2" },
    { bit: 18, key: "CERTIFIED_MODERATOR", label: "Certified Moderator", color: "#5865f2" },
    { bit: 22, key: "ACTIVE_DEVELOPER", label: "Active Developer", color: "#3ddc84" },
  ];

  function decodeBadges(publicFlags) {
    if (!publicFlags) return [];
    return DISCORD_FLAGS.filter((f) => (publicFlags & (1 << f.bit)) !== 0);
  }

  function badgeIconSvg() {
    // Single generic glyph reused for every badge (a small star), tinted
    // per-badge via fill color — keeps this file from needing 12 bespoke
    // icon paths for every possible Discord flag.
    return '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.6 6.3 6.8.5-5.2 4.4 1.7 6.6L12 16.7l-5.9 3.6 1.7-6.6-5.2-4.4 6.8-.5L12 2.5Z"/></svg>';
  }

  function initDiscordPresence() {
    const avatarImg = document.getElementById("discordAvatar");
    const avatarPlaceholder = document.getElementById("discordAvatarPlaceholder");
    const statusDot = document.getElementById("discordStatusDot");
    const statusText = document.getElementById("discordStatusText");
    const badgesEl = document.getElementById("discordBadges");

    if (!DISCORD_USER_ID || DISCORD_USER_ID.includes("YOUR_")) {
      if (statusText) statusText.textContent = "";
      return;
    }

    let avatarRetries = 0;
    fetchPresence();
    setInterval(fetchPresence, 30000);

    async function fetchPresence() {
      try {
        const res = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("lanyard request failed");
        const json = await res.json();
        if (!json.success) throw new Error("lanyard returned failure");

        const data = json.data;
        const status = data.discord_status || "offline";
        const user = data.discord_user || {};
        const kv = data.kv || {};

        if (statusDot) {
          statusDot.dataset.status = status;
          statusDot.title = status;
        }

        // Lanyard has no access to Discord's "About Me" bio — Discord's
        // API doesn't expose that field at all, to bots or otherwise.
        // The closest real substitute: a Lanyard KV value you set
        // yourself (see README "Discord bio" section). If you've set a
        // kv.bio, show that; otherwise fall back to the live status word.
        if (statusText) {
          statusText.textContent = kv.bio ? kv.bio : formatStatus(status);
        }

        if (user.id && user.avatar && avatarImg) {
          const ext = user.avatar.startsWith("a_") ? "gif" : "png";
          const url = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=160`;
          loadAvatar(url);
        } else if (user.id && avatarImg) {
          // No custom avatar set on the account — use Discord's default
          // avatar instead of leaving the placeholder forever.
          const idx = Number((BigInt(user.id) >> 22n) % 6n);
          loadAvatar(`https://cdn.discordapp.com/embed/avatars/${idx}.png`);
        }

        if (badgesEl) renderBadges(badgesEl, user.public_flags);
      } catch (err) {
        // Avatar/badges/bio simply stay at their placeholder state.
        // Retry a couple more times in case Lanyard hasn't finished
        // syncing presence yet right after joining their server.
        avatarRetries++;
        if (statusText && avatarRetries <= 3) {
          statusText.textContent = "connecting…";
        } else if (statusText) {
          statusText.textContent = "status unavailable";
          if (statusDot) {
            statusDot.dataset.status = "offline";
            statusDot.title = "offline";
          }
        }
      }
    }

    function loadAvatar(url) {
      const probe = new Image();
      probe.onload = () => {
        avatarImg.src = url;
        avatarImg.hidden = false;
        if (avatarPlaceholder) avatarPlaceholder.style.display = "none";
      };
      probe.onerror = () => {
        /* keep placeholder visible if even the default avatar 404s */
      };
      probe.src = url;
    }

    function renderBadges(container, publicFlags) {
      const badges = decodeBadges(publicFlags);
      if (!badges.length) {
        container.innerHTML = "";
        return;
      }
      container.innerHTML = badges
        .map(
          (b) =>
            `<span class="badge" title="${b.label}" style="color:${b.color}">${badgeIconSvg()}</span>`
        )
        .join("");
      container.querySelectorAll(".badge svg").forEach((svg) => {
        svg.style.fill = "currentColor";
      });
    }

    function formatStatus(status) {
      switch (status) {
        case "online":
          return "online";
        case "idle":
          return "idle";
        case "dnd":
          return "do not disturb";
        default:
          return "offline";
      }
    }
  }

  /* ===================================================================
     LIVE COIN SPARKLINES — CoinGecko, no API key
     =================================================================== */
  function initCoinCharts() {
    const rows = Array.from(document.querySelectorAll(".entry[data-cg-id]"));
    if (!rows.length) return;

    const ids = rows.map((r) => r.dataset.cgId).join(",");

    fetchAndRender();
    setInterval(fetchAndRender, 60000);

    async function fetchAndRender() {
      try {
        const priceRes = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
        );
        if (!priceRes.ok) throw new Error("price fetch failed");
        const priceData = await priceRes.json();

        await Promise.all(
          rows.map(async (row) => {
            const cgId = row.dataset.cgId;
            const pctEl = document.getElementById(`pct-${row.dataset.coin}`);
            const change = priceData[cgId] && priceData[cgId].usd_24h_change;

            if (typeof change === "number" && pctEl) {
              const dir = change >= 0 ? "up" : "down";
              pctEl.dataset.dir = dir;
              pctEl.textContent = `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
            }

            const canvas = row.querySelector(".entry__sparkline");
            if (!canvas) return;

            try {
              const chartRes = await fetch(
                `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=1`
              );
              if (!chartRes.ok) throw new Error("chart fetch failed");
              const chartData = await chartRes.json();
              const prices = (chartData.prices || []).map((p) => p[1]);
              drawSparkline(canvas, prices, change >= 0);
            } catch (e) {
              /* leave canvas blank if rate-limited */
            }
          })
        );
      } catch (err) {
        rows.forEach((row) => {
          const pctEl = document.getElementById(`pct-${row.dataset.coin}`);
          if (pctEl) pctEl.textContent = "n/a";
        });
      }
    }
  }

  function drawSparkline(canvas, prices, isUp) {
    if (!prices || prices.length < 2) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const pad = 2;

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    ctx.clearRect(0, 0, w, h);

    const color = isUp ? "#3ddc84" : "#ff5c5c";
    const points = prices.map((price, i) => {
      const x = pad + (i / (prices.length - 1)) * (w - pad * 2);
      const y = h - pad - ((price - min) / range) * (h - pad * 2);
      return [x, y];
    });

    ctx.beginPath();
    ctx.moveTo(points[0][0], h);
    points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(points[points.length - 1][0], h);
    ctx.closePath();
    ctx.fillStyle = isUp ? "rgba(61,220,132,.12)" : "rgba(255,92,92,.12)";
    ctx.fill();

    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  /* ===================================================================
     AUDIO SYSTEM — playlist (auto-discovered + auto-switching),
     volume slider, and a compact bass EQ, all built on the Web Audio
     API so the EQ can actually shape the sound (a plain <audio>
     element's .volume can't touch frequency content).
     =================================================================== */
  function initAudioSystem() {
    const audioEl = document.getElementById("songAudio");
    const menu = document.getElementById("audioMenu");
    const trigger = document.getElementById("audioMenuTrigger");
    const panel = document.getElementById("audioPanel");
    const trackName = document.getElementById("trackName");
    const trackIndex = document.getElementById("trackIndex");
    const prevBtn = document.getElementById("trackPrev");
    const nextBtn = document.getElementById("trackNext");
    const volumeSlider = document.getElementById("volumeSlider");
    const volumeValue = document.getElementById("volumeValue");
    const bassSlider = document.getElementById("bassSlider");
    const bassValue = document.getElementById("bassValue");

    if (!audioEl) return;

    let playlist = [];
    let currentIndex = 0;
    let audioCtx = null;
    let bassFilter = null;
    let sourceNode = null;
    let started = false;

    loadPlaylist();
    wireMenuToggle();
    wireSliders();
    wireSkipButtons();

    window.addEventListener("larp:start-audio", () => startPlayback());
    window.addEventListener("larp:resume-audio", () => startPlayback());

    async function loadPlaylist() {
      try {
        const res = await fetch(SONGS_MANIFEST_URL, { cache: "no-store" });
        if (!res.ok) throw new Error("no manifest");
        const json = await res.json();
        playlist = Array.isArray(json.songs) ? json.songs : [];
      } catch (e) {
        playlist = [];
      }

      if (!playlist.length) {
        if (trackName) trackName.textContent = "no tracks found";
        if (trackIndex) trackIndex.textContent = "0/0";
        return;
      }

      currentIndex = 0;
      setTrack(currentIndex, { autoplay: false });
    }

    function setTrack(index, { autoplay }) {
      if (!playlist.length) return;
      currentIndex = ((index % playlist.length) + playlist.length) % playlist.length;
      const song = playlist[currentIndex];
      audioEl.src = song.url || song;

      const label = song.title || prettifyFilename(song.url || song);
      if (trackName) trackName.textContent = label;
      if (trackIndex) trackIndex.textContent = `${currentIndex + 1}/${playlist.length}`;

      if (autoplay) {
        audioEl.play().catch(() => {});
      }
    }

    function prettifyFilename(url) {
      const file = url.split("/").pop() || url;
      return file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    }

    // Auto-switch to the next track when one ends.
    audioEl.addEventListener("ended", () => {
      setTrack(currentIndex + 1, { autoplay: true });
    });

    function wireSkipButtons() {
      if (prevBtn) {
        prevBtn.addEventListener("click", () => setTrack(currentIndex - 1, { autoplay: true }));
      }
      if (nextBtn) {
        nextBtn.addEventListener("click", () => setTrack(currentIndex + 1, { autoplay: true }));
      }
    }

    function wireMenuToggle() {
      if (!trigger || !panel) return;
      trigger.addEventListener("click", () => {
        const isOpen = panel.classList.toggle("is-open");
        panel.hidden = !isOpen;
        trigger.setAttribute("aria-expanded", String(isOpen));
      });
      document.addEventListener("click", (e) => {
        if (!menu.contains(e.target)) {
          panel.classList.remove("is-open");
          panel.hidden = true;
          trigger.setAttribute("aria-expanded", "false");
        }
      });
    }

    function wireSliders() {
      if (volumeSlider) {
        updateSliderFill(volumeSlider);
        volumeSlider.addEventListener("input", () => {
          const v = Number(volumeSlider.value);
          audioEl.volume = v / 100;
          if (volumeValue) volumeValue.textContent = String(v);
          updateSliderFill(volumeSlider);
        });
        audioEl.volume = Number(volumeSlider.value) / 100;
      }

      if (bassSlider) {
        updateSliderFill(bassSlider);
        bassSlider.addEventListener("input", () => {
          const db = Number(bassSlider.value);
          if (bassValue) bassValue.textContent = (db > 0 ? "+" : "") + db;
          updateSliderFill(bassSlider);
          ensureAudioGraph();
          if (bassFilter) bassFilter.gain.value = db;
        });
      }
    }

    function updateSliderFill(slider) {
      const min = Number(slider.min);
      const max = Number(slider.max);
      const val = Number(slider.value);
      const pct = ((val - min) / (max - min)) * 100;
      slider.style.setProperty("--fill", `${pct}%`);
    }

    // Web Audio graph is created lazily, on the user gesture that
    // starts playback — browsers require an interaction before an
    // AudioContext is allowed to run anyway.
    function ensureAudioGraph() {
      if (audioCtx) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctx();
        sourceNode = audioCtx.createMediaElementSource(audioEl);
        bassFilter = audioCtx.createBiquadFilter();
        bassFilter.type = "lowshelf";
        bassFilter.frequency.value = 200;
        bassFilter.gain.value = bassSlider ? Number(bassSlider.value) : 0;

        sourceNode.connect(bassFilter);
        bassFilter.connect(audioCtx.destination);
      } catch (e) {
        // Web Audio unsupported/blocked — audio still plays via the
        // plain <audio> element, just without the EQ shaping.
      }
    }

    function startPlayback() {
      if (started) {
        audioEl.play().catch(() => {});
        return;
      }
      started = true;
      ensureAudioGraph();
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      if (!audioEl.src && playlist.length) {
        setTrack(0, { autoplay: true });
      } else {
        audioEl.play().catch(() => {});
      }
    }
  }
})();

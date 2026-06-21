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

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    setYear();
    wireAddressesIntoDom();
    initGate();
    initVolumeSwitch();
    initCopyButtons();
    initLedgerModel();
    initDiscordPresence();
    initCoinCharts();
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
     Fix vs. previous version: media playback was only ever started
     inside the click handler. On a hard refresh mid-session,
     sessionStorage still said "entered", so the gate hid itself
     immediately WITHOUT ever calling playMedia() — silence. Now the
     "already entered" branch also calls playMedia(), and if the
     browser still blocks the unprompted autoplay (it often will,
     since a refresh is not a user gesture either), we fall back to
     a small one-tap "resume audio" pill instead of silently failing.
     =================================================================== */
  function initGate() {
    const gate = document.getElementById("gate");
    const sealBtn = document.getElementById("sealBtn");
    const bgVideo = document.getElementById("bgVideo");
    const songAudio = document.getElementById("songAudio");

    if (!gate || !sealBtn) return;

    const alreadyEntered = sessionStorage.getItem("ledger-entered") === "1";

    if (alreadyEntered) {
      gate.classList.add("is-open");
      gate.style.display = "none";
      attemptAutoResume(bgVideo, songAudio);
      return;
    }

    sealBtn.addEventListener("click", enter, { once: true });

    function enter() {
      gate.classList.add("is-breaking");
      playMedia(bgVideo, songAudio);

      window.setTimeout(() => {
        gate.classList.add("is-open");
        sessionStorage.setItem("ledger-entered", "1");
      }, 450);

      window.setTimeout(() => {
        gate.style.display = "none";
      }, 1200);
    }
  }

  function playMedia(bgVideo, songAudio) {
    if (bgVideo) {
      bgVideo.muted = true; // background video is always silent — visual only
      bgVideo.play().catch(() => {});
    }
    if (songAudio) {
      songAudio.muted = false;
      songAudio.volume = 0.85;
      songAudio.play().catch(() => {});
    }
  }

  // After a refresh, try to resume both tracks immediately. If the
  // browser blocks the audio (no fresh user gesture this page-load),
  // show a small floating "tap for sound" pill that starts it on tap —
  // so the song never just silently stays paused with no way back in.
  function attemptAutoResume(bgVideo, songAudio) {
    if (bgVideo) {
      bgVideo.muted = true;
      bgVideo.play().catch(() => {});
    }
    if (!songAudio) return;

    songAudio.muted = false;
    songAudio.volume = 0.85;

    const playPromise = songAudio.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise.catch(() => showResumePill(songAudio));
    }
  }

  function showResumePill(songAudio) {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.textContent = "tap for sound";
    pill.style.cssText = [
      "position:fixed", "bottom:18px", "left:50%", "transform:translateX(-50%)",
      "z-index:45", "padding:10px 18px", "border-radius:999px",
      "background:#f2f2f5", "color:#060608", "font-family:'JetBrains Mono',monospace",
      "font-size:11px", "font-weight:700", "letter-spacing:.04em",
      "border:none", "cursor:pointer", "box-shadow:0 10px 30px rgba(0,0,0,.5)",
    ].join(";");
    pill.addEventListener(
      "click",
      () => {
        songAudio.play().catch(() => {});
        pill.remove();
      },
      { once: true }
    );
    document.body.appendChild(pill);
  }

  /* ===================================================================
     VOLUME SWITCH
     =================================================================== */
  function initVolumeSwitch() {
    const btn = document.getElementById("volSwitch");
    const songAudio = document.getElementById("songAudio");
    if (!btn || !songAudio) return;

    btn.addEventListener("click", () => {
      songAudio.muted = !songAudio.muted;
      const unmuted = !songAudio.muted;
      btn.setAttribute("aria-pressed", String(unmuted));
      btn.setAttribute(
        "aria-label",
        unmuted ? "Mute background music" : "Unmute background music"
      );
    });
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
     LEDGER 3D MODEL — ROTATE ONLY (no zoom, no pan)
     Fix vs. previous version: dragging right was rotating the model
     to the LEFT. model-viewer's theta increases counter-clockwise
     when viewed from above, so a naive "+dx" mapping turns the visual
     rotation backwards from what a drag gesture should feel like
     (drag right -> object turns to face right, like spinning a box on
     a table with your finger). Flipping the sign on dx fixes that.
     =================================================================== */
  function initLedgerModel() {
    const viewport = document.getElementById("vaultViewport");
    const modelViewer = document.getElementById("ledgerModel");
    if (!viewport || !modelViewer) return;

    let theta = 0;
    let phi = 75;
    let radius = null;
    const PHI_MIN = 35;
    const PHI_MAX = 130;
    const DRAG_SENSITIVITY = 0.35;

    modelViewer.addEventListener(
      "load",
      () => {
        viewport.classList.add("is-loaded");
        const orbit = modelViewer.getCameraOrbit();
        radius = `${orbit.radius}m`;
        applyOrbit();
        autoIntroSpin();
      },
      { once: true }
    );

    function applyOrbit() {
      const r = radius || "105%";
      modelViewer.cameraOrbit = `${theta}deg ${phi}deg ${r}`;
    }

    function autoIntroSpin() {
      const start = performance.now();
      const duration = 1100;
      const from = 50;
      const to = 0;
      function tick(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        theta = from + (to - from) * eased;
        applyOrbit();
        if (t < 1) requestAnimationFrame(tick);
        else {
          theta = to;
          applyOrbit();
        }
      }
      requestAnimationFrame(tick);
    }

    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    viewport.addEventListener("pointerdown", (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      viewport.classList.add("is-dragging");
      viewport.setPointerCapture(e.pointerId);
    });

    viewport.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      // Negative dx: dragging right turns the model to face right,
      // matching "grab and spin" intuition instead of the inverted feel.
      theta -= dx * DRAG_SENSITIVITY;
      phi -= dy * DRAG_SENSITIVITY;
      phi = Math.min(PHI_MAX, Math.max(PHI_MIN, phi));

      applyOrbit();
    });

    function stopDrag(e) {
      dragging = false;
      viewport.classList.remove("is-dragging");
      if (e && e.pointerId !== undefined) {
        try {
          viewport.releasePointerCapture(e.pointerId);
        } catch (err) {
          /* noop */
        }
      }
    }

    viewport.addEventListener("pointerup", stopDrag);
    viewport.addEventListener("pointercancel", stopDrag);
    viewport.addEventListener("pointerleave", stopDrag);

    viewport.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
      },
      { passive: false }
    );

    viewport.style.touchAction = "none";
  }

  /* ===================================================================
     DISCORD PRESENCE — via Lanyard (api.lanyard.rest)
     Requires the Discord account to have joined the Lanyard Discord
     server at least once; that's what lets Lanyard see presence at
     all. See README for the invite link. Fails gracefully to a
     generic placeholder + "offline" if the API call doesn't resolve.
     =================================================================== */
  function initDiscordPresence() {
    const avatarImg = document.getElementById("discordAvatar");
    const avatarPlaceholder = document.getElementById("discordAvatarPlaceholder");
    const statusDot = document.getElementById("discordStatusDot");
    const statusText = document.getElementById("discordStatusText");
    if (!DISCORD_USER_ID || DISCORD_USER_ID.includes("YOUR_")) {
      if (statusText) statusText.textContent = "";
      return;
    }

    fetchPresence();
    // Lanyard's REST snapshot is a point-in-time read; poll it so the
    // dot/status stay reasonably live without needing a WebSocket.
    setInterval(fetchPresence, 30000);

    async function fetchPresence() {
      try {
        const res = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`);
        if (!res.ok) throw new Error("lanyard request failed");
        const json = await res.json();
        if (!json.success) throw new Error("lanyard returned failure");

        const data = json.data;
        const status = data.discord_status || "offline";
        const user = data.discord_user || {};

        if (statusDot) {
          statusDot.dataset.status = status;
          statusDot.title = status;
        }
        if (statusText) {
          statusText.textContent = formatStatus(status);
        }

        if (user.id && user.avatar && avatarImg) {
          const ext = user.avatar.startsWith("a_") ? "gif" : "png";
          avatarImg.src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
          avatarImg.alt = user.global_name || user.username || "Discord avatar";
          avatarImg.hidden = false;
          if (avatarPlaceholder) avatarPlaceholder.style.display = "none";
        }
      } catch (err) {
        if (statusText) statusText.textContent = "status unavailable";
        if (statusDot) {
          statusDot.dataset.status = "offline";
          statusDot.title = "offline";
        }
      }
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
     LIVE COIN SPARKLINES — via CoinGecko (no API key required)
     Draws a small canvas sparkline + 24h % change per row, refreshed
     periodically. This replaces the old static divider between the
     coin name and the copy button.
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
              /* leave canvas blank if the chart endpoint fails/rate-limits */
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

    // filled area under the line, faint
    ctx.beginPath();
    ctx.moveTo(points[0][0], h);
    points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(points[points.length - 1][0], h);
    ctx.closePath();
    ctx.fillStyle = isUp ? "rgba(61,220,132,.12)" : "rgba(255,92,92,.12)";
    ctx.fill();

    // line
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }
})();

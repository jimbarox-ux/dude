(() => {
  "use strict";

  /* ===================================================================
     EDIT THESE — your wallet addresses
     =================================================================== */
  const ADDRESSES = {
    btc: "YOUR_BTC_ADDRESS_HERE",
    eth: "YOUR_ETH_ADDRESS_HERE",
    ltc: "YOUR_LTC_ADDRESS_HERE",
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    setYear();
    setEntryDate();
    wireAddressesIntoDom();
    initGate();
    initVolumeSwitch();
    initCopyButtons();
    initLedgerModel();
  }

  function setYear() {
    const el = document.getElementById("year");
    if (el) el.textContent = new Date().getFullYear();
  }

  function setEntryDate() {
    const el = document.getElementById("entryDate");
    if (!el) return;
    const d = new Date();
    el.textContent = d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }

  // Pull addresses from ADDRESSES into the data-address attributes,
  // so you only have to edit the object above (HTML can stay as-is).
  function wireAddressesIntoDom() {
    document.querySelectorAll(".entry").forEach((row) => {
      const coin = row.dataset.coin;
      if (ADDRESSES[coin]) row.dataset.address = ADDRESSES[coin];
    });
  }

  /* ===================================================================
     ENTRY GATE — wax seal click starts video + audio (required for
     autoplay-with-sound in every modern browser) then reveals the page.
     =================================================================== */
  function initGate() {
    const gate = document.getElementById("gate");
    const sealBtn = document.getElementById("sealBtn");
    const bgVideo = document.getElementById("bgVideo");
    const songAudio = document.getElementById("songAudio");

    if (!gate || !sealBtn) return;

    // If the user has already "entered" earlier in this tab session,
    // skip the gate so reloads aren't annoying mid-browsing.
    if (sessionStorage.getItem("ledger-entered") === "1") {
      gate.classList.add("is-open");
      gate.style.display = "none";
      playMedia(bgVideo, songAudio);
      return;
    }

    sealBtn.addEventListener("click", enter, { once: true });

    function enter() {
      gate.classList.add("is-breaking");
      playMedia(bgVideo, songAudio);

      window.setTimeout(() => {
        gate.classList.add("is-open");
        sessionStorage.setItem("ledger-entered", "1");
      }, 650);

      window.setTimeout(() => {
        gate.style.display = "none";
      }, 1600);
    }
  }

  function playMedia(bgVideo, songAudio) {
    if (bgVideo) {
      bgVideo.muted = true; // background video is always silent — it's purely visual
      bgVideo.play().catch(() => {});
    }
    if (songAudio) {
      songAudio.muted = false;
      songAudio.volume = 0.85;
      songAudio.play().catch(() => {});
    }
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
     COPY-TO-CLIPBOARD STAMP BUTTONS
     =================================================================== */
  function initCopyButtons() {
    document.querySelectorAll(".entry").forEach((row) => {
      const stamp = row.querySelector(".stamp");
      const tooltip = row.querySelector(".entry__tooltip");
      if (!stamp) return;

      let resetTimer = null;

      stamp.addEventListener("click", async () => {
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

      // reset tooltip text on mouse leave if not mid "copied" state
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
      /* fall through to legacy method */
    }
    // Legacy fallback for non-secure contexts / older browsers
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
     We deliberately do NOT use model-viewer's built-in camera-controls
     attribute, since that ships zoom + pan gestures we don't want.
     Instead we drive `cameraOrbit` ourselves from pointer drag deltas,
     and lock the radius (distance) permanently after first load.
     =================================================================== */
  function initLedgerModel() {
    const viewport = document.getElementById("vaultViewport");
    const modelViewer = document.getElementById("ledgerModel");
    const loader = document.getElementById("vaultLoader");
    if (!viewport || !modelViewer) return;

    let theta = 0; // azimuth, degrees — unrestricted, wraps freely
    let phi = 75; // polar angle, degrees — clamped so it can't flip over
    let radius = null; // locked once known, e.g. "105%"
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
        // gentle one-time idle spin-in so the device doesn't look static on load
        autoIntroSpin();
      },
      { once: true }
    );

    modelViewer.addEventListener("error", () => {
      if (loader) {
        loader.querySelector(".vault__loader-text").textContent =
          "couldn't load device — check assets/ledger.glb";
      }
    });

    function applyOrbit() {
      const r = radius || "105%";
      modelViewer.cameraOrbit = `${theta}deg ${phi}deg ${r}`;
    }

    // Sweeps in from -50deg to 0deg on load so the device doesn't look static.
    function autoIntroSpin() {
      const start = performance.now();
      const duration = 1100;
      const from = -50;
      const to = 0;

      function tick(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
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

    // ---- pointer drag => rotate only ----
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

      theta += dx * DRAG_SENSITIVITY;
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

    // Explicitly swallow wheel events so page-level pinch/scroll-zoom
    // never reaches the model — rotation is the only interaction.
    viewport.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
      },
      { passive: false }
    );

    // Prevent default touch scrolling while dragging the model on mobile
    viewport.style.touchAction = "none";
  }
})();

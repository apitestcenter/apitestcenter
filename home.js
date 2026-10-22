// The home page's motion: the cycling line, the terminal and chat in the hero, requests pulsing
// between the panes, the response-time trace, depth on scroll and pointer, and the scroll tour.
// With "reduce motion" on, everything is shown as it ends and nothing moves.
(() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const onView = (el, fn, opts = { threshold: 0.35 }) => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && (fn(e.target), io.unobserve(e.target))), opts);
    io.observe(el);
  };

  // Copy "npx apitestcenter ui".
  $$("[data-copy]").forEach((b) =>
    b.addEventListener("click", async () => {
      const label = $("[data-copy-label]", b);
      try {
        await navigator.clipboard.writeText(b.dataset.copy);
        if (label) label.textContent = "Copied";
      } catch {
        if (label) label.textContent = "Select it";
      }
      setTimeout(() => label && (label.textContent = "Copy"), 1800);
    }),
  );

  // Reveal sections as they come into view.
  $$(".home main section:not(.hx) .wrap > *").forEach((el) => {
    el.setAttribute("data-reveal", "");
    if (still) el.classList.add("is-in");
    else onView(el, (t) => t.classList.add("is-in"), { threshold: 0.12 });
  });

  // Bars of the load card: each its own height and delay.
  $$(".bars i").forEach((bar, i) => {
    bar.style.setProperty("--i", i);
    bar.style.setProperty("--h", `${Math.round(35 + 55 * Math.sin((i / 11) * Math.PI * 0.9) + Math.random() * 8)}%`);
  });

  // The terminal and the chat, once; with less motion they're simply there.
  const TERM = [
    ["p", "$ "], ["b", 'npx apitestcenter suite "Orders API" --env UAT', true], ["", "\n"],
    ["m", "suite  Orders API · 4 requests · UAT\n"],
    ["g", "  ✓ "], ["", "POST   Sign in        200  86 ms\n"],
    ["g", "  ✓ "], ["", "GET    List orders    200  31 ms\n"],
    ["g", "  ✓ "], ["", "POST   Create order   201  48 ms\n"],
    ["g", "  ✓ "], ["", "GET    Order by id    200  22 ms\n"],
    ["", "\n"], ["g", "PASS  4 of 4 passed"],
  ];
  const term = $("[data-term] code");
  const chatMsgs = $$(".layer-chat .msg");
  const span = (cls, text) => {
    const s = document.createElement("span");
    if (cls) s.className = cls;
    s.textContent = text;
    return s;
  };
  async function playTerminal() {
    if (!term) return;
    term.replaceChildren();
    const cursor = span("cursor", "");
    for (const [cls, text, typed] of TERM) {
      const s = span(cls, "");
      term.append(s, cursor);
      if (still) {
        s.textContent = text;
        continue;
      }
      if (typed) for (const ch of text) { s.textContent += ch; await wait(14 + Math.random() * 22); }
      else { s.textContent = text; await wait(text.includes("✓") ? 40 : 140); }
    }
  }
  async function playChat() {
    for (const m of chatMsgs) {
      m.classList.add("is-in");
      if (!still) await wait(900);
    }
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // Both at once: neither pane sits empty while the other plays.
  (async () => {
    if (!still) await wait(500);
    await playTerminal();
  })();
  (async () => {
    if (!still) await wait(900);
    await playChat();
  })();

  // The cycling line.
  const items = $$(".ticker-item");
  if (items.length > 1 && !still) {
    let i = 0;
    setInterval(() => {
      const cur = items[i];
      i = (i + 1) % items.length;
      cur.classList.remove("is-on");
      cur.classList.add("is-out");
      items[i].classList.remove("is-out");
      items[i].classList.add("is-on");
      setTimeout(() => cur.classList.remove("is-out"), 650);
    }, 2600);
  }

  // Requests pulsing from the terminal and the chat into the app, and out to the API.
  const stage = $("[data-stage]");
  const pulses = $("[data-pulses]");
  if (stage && pulses && !still) {
    const NS = "http://www.w3.org/2000/svg";
    const routes = ["M520 170 C 470 220, 420 230, 360 250", "M470 380 C 430 340, 400 310, 330 290", "M240 420 C 260 470, 380 470, 600 460"];
    const paths = routes.map((d) => {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", d);
      pulses.append(p);
      return p;
    });
    const fire = () => {
      if (document.hidden) return;
      const path = paths[Math.floor(Math.random() * paths.length)];
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("r", "3.2");
      pulses.append(dot);
      const len = path.getTotalLength();
      const t0 = performance.now();
      const dur = 900 + Math.random() * 500;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        const pt = path.getPointAtLength(len * (1 - Math.pow(1 - k, 2)));
        dot.setAttribute("cx", pt.x);
        dot.setAttribute("cy", pt.y);
        dot.style.opacity = String(k < 0.1 ? k * 10 : k > 0.85 ? (1 - k) / 0.15 : 1);
        if (k < 1) requestAnimationFrame(step);
        else dot.remove();
      };
      requestAnimationFrame(step);
    };
    setInterval(fire, 260);

    // Depth: the panes follow the pointer a little, and fan apart as you scroll past.
    const layers = $$(".layer", stage);
    let px = 0, py = 0, scroll = 0, raf = 0;
    const apply = () => {
      raf = 0;
      for (const layer of layers) {
        const d = Number(layer.dataset.depth || 1);
        const tx = px * d * 8;
        const ty = py * d * 6 - scroll * d * 40;
        const z = (d - 2) * 50 + scroll * d * 60;
        layer.style.transform = `translate3d(${tx}px, ${ty}px, ${z}px) rotateY(${-6 + px * 4}deg) rotateX(${4 - py * 3}deg)`;
      }
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(apply); };
    addEventListener("pointermove", (e) => {
      px = e.clientX / innerWidth - 0.5;
      py = e.clientY / innerHeight - 0.5;
      queue();
    }, { passive: true });
    addEventListener("scroll", () => {
      scroll = Math.min(1, Math.max(0, scrollY / (innerHeight * 0.9)));
      queue();
    }, { passive: true });
    apply();
  }

  // The response-time trace: a calm line with the odd spike, scrolling left, with live readings.
  const trace = $("[data-trace]");
  if (trace) {
    const line = $(".trace-line", trace);
    const fill = $(".trace-fill", trace);
    const N = 120;
    const W = 1200;
    const H = 120;
    let pts = Array.from({ length: N }, (_, i) => 70 + Math.sin(i / 7) * 6);
    let tick = 0;
    const draw = () => {
      const step = W / (N - 1);
      let d = "";
      pts.forEach((y, i) => (d += `${i ? "L" : "M"}${(i * step).toFixed(1)} ${y.toFixed(1)}`));
      line.setAttribute("d", d);
      fill.setAttribute("d", `${d} L${W} ${H} L0 ${H} Z`);
    };
    const p95 = $("[data-p95]");
    const rps = $("[data-rps]");
    const next = () => {
      tick++;
      const base = 72 + Math.sin(tick / 9) * 7 + (Math.random() - 0.5) * 9;
      const spike = Math.random() < 0.022 ? -30 - Math.random() * 20 : 0;
      pts = [...pts.slice(1), Math.max(12, Math.min(108, base + spike))];
      draw();
      if (tick % 6 === 0) {
        if (p95) p95.textContent = String(Math.round(196 + Math.random() * 34));
        if (rps) rps.textContent = String(Math.round(398 + Math.random() * 28));
      }
    };
    draw();
    if (!still) setInterval(() => !document.hidden && next(), 90);
  }

  // Cards lean towards the pointer around their own middle, with a soft light under it.
  if (!still) $$("[data-tilt]").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.transform = `perspective(900px) rotateY(${(x - 0.5) * 8}deg) rotateX(${(0.5 - y) * 8}deg)`;
      card.style.setProperty("--mx", `${x * 100}%`);
      card.style.setProperty("--my", `${y * 100}%`);
    });
    card.addEventListener("pointerleave", () => (card.style.transform = ""));
  });

  // Recordings load when they come near the screen and play while they're on it; with less
  // motion they show their poster frame and controls instead.
  const lazy = $$("video[data-src]");
  const load = (v) => {
    if (!v.getAttribute("src") && v.dataset.src) v.src = v.dataset.src;
  };
  if (still) lazy.forEach((v) => { if (!v.closest(".layer")) v.controls = true; load(v); });
  else {
    const seen = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const v = e.target;
        if (v.closest(".tour-shots")) continue; // the tour plays the step on screen
        if (e.isIntersecting) { load(v); v.play().catch(() => {}); }
        else v.pause();
      }
    }, { rootMargin: "200px 0px" });
    lazy.forEach((v) => seen.observe(v));
  }

  // The scroll tour: the step in the middle of the screen picks the demo; the step buttons
  // under it jump there, and the active one fills as its clip plays.
  const steps = $$(".tour-step");
  const shots = $$(".tour-shots > *");
  const navs = $$(".tour-nav button");
  const title = $("[data-tour-title]");
  let current = 0;
  if (steps.length && shots.length) {
    const show = (n) => {
      current = n;
      steps.forEach((s, i) => s.classList.toggle("is-on", i === n));
      shots.forEach((s, i) => {
        s.classList.toggle("is-on", i === n);
        if (s.tagName !== "VIDEO" || still) return;
        if (i === n) {
          load(s);
          s.currentTime = 0;
          s.play().catch(() => {});
        } else s.pause();
      });
      navs.forEach((b, i) => {
        b.classList.toggle("is-on", i === n);
        b.classList.toggle("is-done", i < n);
        if (i === n) b.setAttribute("aria-current", "step");
        else b.removeAttribute("aria-current");
        const bar = $(".tn-bar i", b);
        // A picture's step is simply full; a clip's fills as it plays.
        if (bar) bar.style.setProperty("--p", i < n || (i === n && shots[i]?.tagName !== "VIDEO") ? "1" : "0");
      });
      if (title) title.textContent = steps[n].dataset.title || "";
    };
    shots.forEach((s, i) => {
      if (s.tagName !== "VIDEO") return;
      s.addEventListener("timeupdate", () => {
        if (i !== current || !s.duration) return;
        $(".tn-bar i", navs[i])?.style.setProperty("--p", String(Math.min(1, s.currentTime / s.duration)));
      });
    });
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) show(Number(e.target.dataset.step));
    }, { rootMargin: "-45% 0px -45% 0px" });
    steps.forEach((s) => io.observe(s));
    navs.forEach((b) => b.addEventListener("click", () => {
      const n = Number(b.dataset.go);
      steps[n]?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
      show(n);
    }));
    show(0);
  }

  // The enlarged view: a demo or picture fills the browser window (not the whole screen),
  // growing out of where it was. ← → go through all of them; Esc, ✕ or a click outside closes.
  const zoomable = () => $$("[data-zoom]").filter((el) => el.offsetParent !== null || el.closest(".tour-shots"));
  let lb = null;
  let at = 0;
  let from = null;
  let lastFocus = null;
  const build = () => {
    lb = document.createElement("div");
    lb.className = "lb";
    lb.hidden = true;
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Enlarged view");
    lb.innerHTML = `<div class="lb-backdrop"></div>
      <figure class="lb-fig"><div class="lb-media"></div><figcaption></figcaption></figure>
      <span class="lb-count"></span>
      <button type="button" class="lb-btn lb-prev" aria-label="Previous">‹</button>
      <button type="button" class="lb-btn lb-next" aria-label="Next">›</button>
      <button type="button" class="lb-btn lb-close" aria-label="Close">✕</button>`;
    document.body.append(lb);
    $(".lb-backdrop", lb).addEventListener("click", close);
    $(".lb-close", lb).addEventListener("click", close);
    $(".lb-prev", lb).addEventListener("click", () => go(-1));
    $(".lb-next", lb).addEventListener("click", () => go(1));
    lb.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "Tab") {
        // Keep the keyboard inside the enlarged view.
        const f = $$("button, video[controls]", lb);
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length]?.focus();
      }
    });
  };
  // The biggest 16:10 box that fits the window, leaving room for the buttons and the caption.
  const box = () => {
    const w = Math.min(innerWidth - (innerWidth < 600 ? 24 : 150), (innerHeight - 130) * 1.6);
    return { w, h: w / 1.6 };
  };
  const fill = (el) => {
    const media = $(".lb-media", lb);
    media.replaceChildren();
    let node;
    if (el.tagName === "VIDEO") {
      node = document.createElement("video");
      node.src = el.dataset.src || el.currentSrc || el.src;
      if (el.poster) node.poster = el.poster;
      Object.assign(node, { muted: true, loop: true, playsInline: true, controls: true, autoplay: !still });
      if (el.currentTime && el.closest(".tour-shots, .layer")) node.currentTime = el.currentTime;
    } else {
      node = document.createElement("img");
      node.src = el.currentSrc || el.src;
      node.alt = el.alt || "";
    }
    media.append(node);
    const { w, h } = box();
    media.style.width = `${w}px`;
    media.style.height = `${h}px`;
    $("figcaption", lb).textContent = el.dataset.caption || el.getAttribute("aria-label") || el.alt || "";
    const list = zoomable();
    $(".lb-count", lb).textContent = `${at + 1} / ${list.length}`;
    if (node.tagName === "VIDEO" && !still) node.play().catch(() => {});
  };
  // Move the figure so it sits exactly over `rect` (a thumbnail), or back to its own place.
  const flip = (rect) => {
    const fig = $(".lb-fig", lb);
    const media = $(".lb-media", lb);
    if (!rect || still) {
      fig.style.transform = "";
      return;
    }
    const target = media.getBoundingClientRect();
    const sx = rect.width / target.width;
    const sy = rect.height / target.height;
    fig.style.transition = "none";
    fig.style.transform = `translate(${rect.left - target.left}px, ${rect.top - target.top}px) scale(${sx}, ${sy})`;
    void fig.offsetWidth;
    fig.style.transition = "";
    requestAnimationFrame(() => (fig.style.transform = ""));
  };
  function open(el) {
    if (!lb) build();
    const list = zoomable();
    at = Math.max(0, list.indexOf(el));
    from = el;
    lastFocus = document.activeElement;
    lb.hidden = false;
    document.documentElement.style.overflow = "hidden";
    fill(el);
    flip(el.getBoundingClientRect());
    requestAnimationFrame(() => lb.classList.add("is-open"));
    $(".lb-close", lb).focus();
  }
  function go(step) {
    const list = zoomable();
    if (!list.length) return;
    at = (at + step + list.length) % list.length;
    from = list[at];
    fill(from);
  }
  function close() {
    if (!lb || lb.hidden) return;
    lb.classList.remove("is-open");
    const fig = $(".lb-fig", lb);
    const rect = from?.offsetParent !== null ? from?.getBoundingClientRect() : null;
    if (rect && rect.width && !still) {
      const target = $(".lb-media", lb).getBoundingClientRect();
      fig.style.transform = `translate(${rect.left - target.left}px, ${rect.top - target.top}px) scale(${rect.width / target.width}, ${rect.height / target.height})`;
    } else fig.style.opacity = "0";
    setTimeout(() => {
      lb.hidden = true;
      fig.style.transform = "";
      fig.style.opacity = "";
      $(".lb-media", lb).replaceChildren();
      document.documentElement.style.overflow = "";
      lastFocus?.focus?.();
    }, still ? 0 : 340);
  }
  addEventListener("resize", () => {
    if (!lb || lb.hidden) return;
    const { w, h } = box();
    Object.assign($(".lb-media", lb).style, { width: `${w}px`, height: `${h}px` });
  });
  // What opens it: any picture or clip marked data-zoom, the tour's window (its current demo),
  // and the toolbox cards (their clip).
  document.addEventListener("click", (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t || t.closest(".lb")) return;
    if (t.closest("[data-zoom-current]")) {
      e.preventDefault();
      open(shots[current]);
      return;
    }
    const card = t.closest(".see-play");
    if (card) {
      open($("video", card));
      return;
    }
    const z = t.closest("[data-zoom]");
    if (z) open(z);
  });

  // "Tell me when Pro launches".
  const form = $("[data-notify]");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $(".notify-msg", form);
    const button = $("button[type=submit]", form);
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const say = (text, good) => {
      msg.textContent = text;
      msg.classList.toggle("is-ok", good);
      msg.classList.toggle("is-bad", !good);
    };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say("Please enter your email address.", false);
    if (!data.get("consent")) return say("Please tick the box to say we may email you.", false);
    button.disabled = true;
    try {
      const res = await fetch("https://usage.apitestcenter.com/v1/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, plan: data.get("plan"), consent: true, website: data.get("website") || "" }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Something went wrong");
      form.classList.add("is-done");
      say("You're on the list — we'll email you when Pro launches. Thank you!", true);
    } catch (err) {
      say(`${err.message === "Failed to fetch" ? "Couldn't reach us just now" : err.message}. Try again, or write to hello@apitestcenter.com.`, false);
    } finally {
      button.disabled = false;
    }
  });

  // Install tabs.
  const tabs = $$(".install-tabs [role=tab]");
  const pick = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => pick(t));
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      pick(next);
      next.focus();
    });
  });
  // Mac visitors see Homebrew first; Windows visitors winget; everyone else npm.
  const mac = /Mac/.test(navigator.platform || navigator.userAgent);
  if (tabs.length) pick(tabs[mac ? 2 : /Win/.test(navigator.platform || navigator.userAgent) ? 1 : 0]);
})();

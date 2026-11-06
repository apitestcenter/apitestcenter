// APITestCenter website: theme toggle, the download for the visitor's system, and the list of
// versions. Release details come from releases.json, published with the site; the download
// links work without it.

/** Public repo that holds the website and the release downloads. */
const REPO = "apitestcenter/apitestcenter";
const FILES = {
  setup: "APITestCenter-Setup.exe",
  portable: "APITestCenter-Portable.exe",
  macArm: "APITestCenter-mac-arm64.dmg",
  macIntel: "APITestCenter-mac-x64.dmg",
  appimage: "APITestCenter-linux-x64.AppImage",
  deb: "APITestCenter-linux-x64.deb",
};

for (const [kind, name] of Object.entries(FILES)) {
  document.querySelectorAll(`[data-download="${kind}"]`).forEach((a) => {
    a.href = `https://github.com/${REPO}/releases/latest/download/${name}`;
  });
}
document.querySelectorAll("[data-releases]").forEach((a) => (a.href = `https://github.com/${REPO}/releases`));
document.querySelectorAll("[data-issues]").forEach((a) => (a.href = `https://github.com/${REPO}/issues`));
// Links to other websites open in a new tab, so a visitor keeps their place here. Pages of this
// site (the guide, What's new) open normally, and downloads stay put — a file download doesn't
// leave the page. Runs again for links added later (the version list).
function externalLinksInNewTab(scope = document) {
  scope.querySelectorAll("a[href]").forEach((a) => {
    if (a.hasAttribute("data-download") || a.hasAttribute("data-primary") || a.closest(".dl-table")) return;
    let url;
    try {
      url = new URL(a.getAttribute("href") || "", location.href);
    } catch {
      return;
    }
    if (!/^https?:$/.test(url.protocol) || url.origin === location.origin) return;
    a.target = "_blank";
    a.rel = "noopener";
  });
}
externalLinksInNewTab();
document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = String(new Date().getFullYear())));

// Guide pages: on a phone the page menu starts folded so the guide itself comes first.
if (matchMedia("(max-width: 760px)").matches) document.querySelectorAll(".docs-menu").forEach((d) => (d.open = false));

// The demo video plays by itself unless the visitor asked for less motion.
if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.querySelectorAll("video.demo").forEach((v) => {
    v.removeAttribute("autoplay");
    v.pause();
    v.controls = true;
  });
}

// Theme: follow the system until the visitor picks one.
const root = document.documentElement;
const btn = document.querySelector(".theme-btn");
const stored = (() => {
  try {
    return localStorage.getItem("atc-site-theme");
  } catch {
    return null;
  }
})();
if (stored === "light" || stored === "dark") root.dataset.theme = stored;
const current = () => root.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
const label = () => {
  if (!btn) return;
  const next = current() === "dark" ? "light" : "dark";
  btn.textContent = next === "light" ? "☀" : "☾";
  btn.setAttribute("aria-label", `Switch to ${next} theme`);
  btn.title = `Switch to ${next} theme`;
};
label();
btn?.addEventListener("click", () => {
  root.dataset.theme = current() === "dark" ? "light" : "dark";
  try {
    localStorage.setItem("atc-site-theme", root.dataset.theme);
  } catch {
    /* private mode */
  }
  label();
});

// Which download to put first: the visitor's own system (a Mac can't tell Apple Silicon from
// Intel in the browser, so Apple Silicon goes first with an "Intel Mac?" link next to it).
const system = (() => {
  const p = String(navigator.userAgentData?.platform || navigator.platform || "").toLowerCase();
  if (p.includes("mac") || /Macintosh/.test(navigator.userAgent)) return "mac";
  if (p.includes("linux") && !/Android/i.test(navigator.userAgent)) return "linux";
  return "windows";
})();
const PRIMARY = {
  windows: { kind: "setup", label: "Download for Windows", alt: ["portable", "Portable version"] },
  mac: { kind: "macArm", label: "Download for Mac", alt: ["macIntel", "Intel Mac?"] },
  linux: { kind: "appimage", label: "Download for Linux", alt: ["deb", ".deb for Ubuntu and Debian"] },
}[system];
document.querySelectorAll("[data-primary]").forEach((a) => {
  a.href = `https://github.com/${REPO}/releases/latest/download/${FILES[PRIMARY.kind]}`;
  a.querySelectorAll("[data-primary-label]").forEach((el) => (el.textContent = PRIMARY.label));
});
document.querySelectorAll("[data-primary-alt]").forEach((el) => {
  const link = document.createElement("a");
  link.href = `https://github.com/${REPO}/releases/latest/download/${FILES[PRIMARY.alt[0]]}`;
  link.textContent = PRIMARY.alt[1];
  el.replaceChildren(link);
});

const mb = (bytes) => `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;
const day = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
};

function filesTable(files) {
  const rows = files.map((f) =>
    el("tr", {}, [
      el("td", { class: "dl-platform", text: f.platform }),
      el("td", {}, [el("strong", { text: f.label }), el("span", { class: "dl-detail", text: f.detail })]),
      el("td", { class: "dl-size", text: mb(f.size) }),
      el("td", { class: "dl-get" }, [el("a", { class: "btn btn-ghost btn-sm", href: f.url, text: "Download" })]),
    ]),
  );
  return el("div", { class: "dl-table-wrap" }, [el("table", { class: "dl-table" }, [el("tbody", {}, rows)])]);
}

/** One version on the What's new page: notes, then its files (folded for older versions). */
function releaseArticle(r) {
  const head = el("header", { class: "release-head" }, [
    el("h2", { id: `v${r.version}`, text: `Version ${r.version}` }),
    ...(r.latest ? [el("span", { class: "badge", text: "Latest" })] : [el("span", { class: "badge badge-old", text: "Older" })]),
    el("time", { datetime: r.date, text: day(r.date) }),
  ]);
  const notes = el("div", { class: "release-notes" });
  // Generated by scripts/site-releases.mjs from our own release notes, with every value escaped.
  notes.innerHTML = r.notesHtml || "<p>No notes for this version.</p>";
  const files = r.files.length ? filesTable(r.files) : el("p", { class: "soon", text: "No downloads listed." });
  const body = r.latest
    ? el("div", {}, [el("h3", { text: "Downloads" }), files])
    : el("details", {}, [el("summary", { text: `Downloads for ${r.version}` }), files]);
  return el("article", { class: "release" }, [head, notes, body]);
}

// Release data published with the website (no call to GitHub's API from the visitor's browser).
if (document.querySelector("[data-version], [data-size], [data-release-list]")) fetch("releases.json", { cache: "no-cache" })
  .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
  .then(({ releases }) => {
    const latest = releases?.[0];
    if (!latest) return;
    document.querySelectorAll("[data-version]").forEach((node) => (node.textContent = `Version ${latest.version}`));
    const byKind = new Map(latest.files.map((f) => [f.kind, f]));
    for (const kind of Object.keys(FILES)) {
      const file = byKind.get(kind);
      document.querySelectorAll(`[data-size="${kind}"]`).forEach((node) => (node.textContent = file ? mb(file.size) : ""));
      // A system without a file in the latest release is not offered.
      document.querySelectorAll(`[data-row="${kind}"]`).forEach((row) => (row.hidden = !file));
      // Straight to this version's file: skips GitHub working out which release is "latest" (a slow redirect).
      if (file?.url) {
        document.querySelectorAll(`[data-download="${kind}"]`).forEach((link) => (link.href = file.url));
        if (kind === PRIMARY.kind) document.querySelectorAll("[data-primary]").forEach((link) => (link.href = file.url));
        if (kind === PRIMARY.alt[0]) document.querySelectorAll("[data-primary-alt] a").forEach((link) => (link.href = file.url));
      }
    }
    document.querySelectorAll("[data-release-list]").forEach((list) => {
      list.replaceChildren(...releases.map(releaseArticle));
      externalLinksInNewTab(list);
      if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
    });
  })
  .catch(() => {
    /* Offline or no data yet: the buttons still point at the latest release. */
  });

// One anonymous page view (see privacy.html): the page, the site that linked here, phone or not.
// Not sent when the browser asks not to be tracked, from a test browser, or off the real site.
(() => {
  const optedOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1" || window.doNotTrack === "1";
  if (optedOut || navigator.webdriver || !/(^|\.)apitestcenter\.com$/.test(location.hostname)) return;
  const body = JSON.stringify({ p: location.pathname, r: document.referrer || "", m: matchMedia("(max-width: 760px)").matches });
  try {
    if (!navigator.sendBeacon?.("https://usage.apitestcenter.com/v1/visit", body)) throw new Error("no beacon");
  } catch {
    fetch("https://usage.apitestcenter.com/v1/visit", { method: "POST", body, keepalive: true, mode: "no-cors" }).catch(() => {});
  }
})();

// The file comes from GitHub, which can take a few seconds to start — longer through a company
// proxy that checks downloads first. Say at once that it's on its way, so a click doesn't look ignored.
document.addEventListener("click", (e) => {
  const a = e.target instanceof Element ? e.target.closest("a[data-download], a[data-primary], [data-primary-alt] a") : null;
  if (!a || a.dataset.starting) return;
  a.dataset.starting = "1";
  const label = a.querySelector("[data-primary-label]") ?? (a.children.length ? null : a);
  const before = label?.textContent;
  if (label) label.textContent = "Starting your download…";
  a.classList.add("is-starting");
  const note = document.querySelector("[data-download-note]");
  window.setTimeout(() => {
    if (label) label.textContent = before;
    a.classList.remove("is-starting");
    delete a.dataset.starting;
    if (note) note.hidden = false;
  }, 6000);
});

// Phones: the menu button opens the links.
(() => {
  const menu = document.querySelector(".menu-btn");
  const links = document.getElementById("site-menu");
  if (!menu || !links) return;
  const set = (open) => {
    links.classList.toggle("open", open);
    menu.setAttribute("aria-expanded", String(open));
  };
  menu.addEventListener("click", (e) => {
    e.stopPropagation();
    set(!links.classList.contains("open"));
  });
  links.addEventListener("click", (e) => e.target.closest("a") && set(false));
  document.addEventListener("click", (e) => !links.contains(e.target) && set(false));
  document.addEventListener("keydown", (e) => e.key === "Escape" && set(false));
})();

// Signed in (on the account page): Sign in becomes a round badge with the email's first letter
// and a menu (your account, sign out); the owner also gets "Admin dashboard ↗" first in the
// links (Cloudflare still checks who you are there). The account page calls
// window.atcHeader.refresh() when you sign in or out, so it changes at once.
(() => {
  const ADMIN = "https://admin.apitestcenter.com";
  const signin = document.querySelector(".nav-signin");
  if (!signin) return;
  const href = signin.getAttribute("href");
  const links = document.getElementById("site-menu");
  let badge = null;
  let admin = null;
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem("atc-account") ?? "null");
    } catch {
      return null;
    }
  };
  const make = (tag, props = {}, attrs = {}) => {
    const n = Object.assign(document.createElement(tag), props);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };

  function build(session) {
    const wrap = make("div", { className: "acct-menu" });
    const button = make("button", { type: "button", className: "avatar", textContent: session.email[0].toUpperCase() }, { "aria-haspopup": "menu", "aria-expanded": "false", "aria-label": `Your account (${session.email})` });
    const pop = make("div", { className: "acct-pop", hidden: true }, { role: "menu" });
    pop.append(make("div", { className: "acct-who", textContent: session.email }), make("a", { textContent: "Your account" }, { role: "menuitem", href }));
    const out = make("button", { type: "button", textContent: "Sign out" }, { role: "menuitem" });
    out.addEventListener("click", async () => {
      try {
        await fetch("https://license.apitestcenter.com/v1/auth/signout", { method: "POST", headers: { authorization: `Bearer ${session.token}` } });
      } catch {
        /* signed out here anyway */
      }
      try {
        localStorage.removeItem("atc-account");
      } catch {
        /* storage blocked */
      }
      location.href = href;
    });
    pop.append(out);
    const toggle = (open) => {
      pop.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      if (open) pop.querySelector("[role=menuitem]")?.focus();
    };
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle(pop.hidden);
    });
    document.addEventListener("click", (e) => !wrap.contains(e.target) && toggle(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !pop.hidden) {
        toggle(false);
        button.focus();
      }
    });
    wrap.append(button, pop);
    return wrap;
  }

  function refresh() {
    const session = read();
    const signedIn = Boolean(session?.token && session.email);
    if (badge) badge.remove();
    badge = null;
    if (signedIn) {
      badge = build(session);
      signin.after(badge);
    }
    signin.hidden = signedIn;
    if (signedIn && session.admin && links && !admin) {
      admin = make("a", { className: "nav-admin", href: ADMIN, innerHTML: 'Admin dashboard <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>' });
      links.prepend(admin);
    } else if (!(signedIn && session.admin) && admin) {
      admin.remove();
      admin = null;
    }
  }
  window.atcHeader = { refresh };
  refresh();
})();

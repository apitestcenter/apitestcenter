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
// Links that leave the page open in a new tab, so a visitor reading the page keeps their place.
// In-page jumps (#…), email links, and the logo (home) stay in the same tab.
document.querySelectorAll("a[href]").forEach((a) => {
  const href = a.getAttribute("href") || "";
  if (href.startsWith("#") || href.startsWith("mailto:") || a.classList.contains("brand")) return;
  a.target = "_blank";
  a.rel = "noopener";
});
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
    }
    document.querySelectorAll("[data-release-list]").forEach((list) => {
      list.replaceChildren(...releases.map(releaseArticle));
      if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
    });
  })
  .catch(() => {
    /* Offline or no data yet: the buttons still point at the latest release. */
  });

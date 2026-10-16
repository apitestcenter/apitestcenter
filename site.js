// APITestCenter website: theme toggle and the latest-release details.
// The only outside request is to GitHub's public API, for the version number; the
// download links work without it.

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
/** Which download cards need which file before they are shown. */
const PLATFORM_FILES = { mac: [FILES.macArm, FILES.macIntel], linux: [FILES.appimage] };

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

// Version and file size of the latest release.
fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } })
  .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
  .then((release) => {
    const version = String(release.tag_name || "").replace(/^v/, "");
    document.querySelectorAll("[data-version]").forEach((el) => (el.textContent = version ? `Version ${version}` : ""));
    const names = new Set((release.assets || []).map((a) => a.name));
    let shown = 0;
    for (const [platform, files] of Object.entries(PLATFORM_FILES)) {
      if (!files.some((f) => names.has(f))) continue;
      document.querySelectorAll(`[data-platform="${platform}"]`).forEach((el) => (el.hidden = false));
      shown++;
    }
    if (shown) document.querySelectorAll("[data-platform-note]").forEach((el) => (el.textContent = "macOS and Linux builds are previews — tell us how they work for you."));
    for (const asset of release.assets || []) {
      const kind = Object.keys(FILES).find((k) => FILES[k] === asset.name);
      if (!kind) continue;
      const mb = `${Math.round(asset.size / 1024 / 1024)} MB`;
      document.querySelectorAll(`[data-size="${kind}"]`).forEach((el) => (el.textContent = mb));
    }
  })
  .catch(() => {
    /* No release yet, or offline: the buttons still point at the latest release. */
  });

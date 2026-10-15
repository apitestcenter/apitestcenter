// APITestCenter website: theme toggle and the latest-release details.
// The only outside request is to GitHub's public API, for the version number; the
// download links work without it.

/** Public repo that holds the website and the release downloads. */
const REPO = "apitestcenter/apitestcenter";
const FILES = { setup: "APITestCenter-Setup.exe", portable: "APITestCenter-Portable.exe" };

for (const [kind, name] of Object.entries(FILES)) {
  document.querySelectorAll(`[data-download="${kind}"]`).forEach((a) => {
    a.href = `https://github.com/${REPO}/releases/latest/download/${name}`;
  });
}
document.querySelectorAll("[data-releases]").forEach((a) => (a.href = `https://github.com/${REPO}/releases`));
document.querySelectorAll("[data-issues]").forEach((a) => (a.href = `https://github.com/${REPO}/issues`));
document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = String(new Date().getFullYear())));

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

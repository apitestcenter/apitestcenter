// The account page. Sign in with an emailed code or the link in the same email; then Profile
// (change the email), Plan & billing, Team (or Ask for access), Devices (every computer and
// browser, sign out one or all), Emails (which ones to get) and Delete account. All of it is the
// license server's (services/license-worker); this page only shows it. A website sign-in lasts
// 90 days and isn't one of the 3 computers.
(() => {
  const LICENSE_SERVER = "https://license.apitestcenter.com";
  const STORE = "atc-account";
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  const saved = () => {
    try {
      return JSON.parse(localStorage.getItem(STORE) ?? "null");
    } catch {
      return null;
    }
  };
  const keep = (value) => {
    try {
      if (value) localStorage.setItem(STORE, JSON.stringify(value));
      else localStorage.removeItem(STORE);
    } catch {
      /* storage blocked: signed in until the page closes */
    }
  };
  let session = saved();
  let me = null;

  function status(el, text, tone = "") {
    el.textContent = text;
    el.classList.toggle("bad", tone === "bad");
    el.classList.toggle("good", tone === "good");
  }
  const day = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");
  function ago(iso) {
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if (!(s >= 0)) return day(iso);
    if (s < 120) return "just now";
    if (s < 3600) return `${Math.round(s / 60)} minutes ago`;
    if (s < 86400) return `${Math.round(s / 3600)} hours ago`;
    if (s < 86400 * 30) return `${Math.round(s / 86400)} days ago`;
    return day(iso);
  }
  const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    n.append(...kids);
    return n;
  };

  async function call(method, path, body) {
    let res;
    try {
      res = await fetch(LICENSE_SERVER + path, {
        method,
        headers: { ...(body ? { "content-type": "application/json" } : {}), ...(session?.token ? { authorization: `Bearer ${session.token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new Error("Couldn't reach the server. Check your connection and try again.");
    }
    const out = await res.json().catch(() => ({}));
    if (res.status === 401 && session) {
      signedOut("You were signed out. Sign in again.");
      throw new Error(out.error ?? "You're signed out.");
    }
    if (!res.ok) throw Object.assign(new Error(out.error ?? "Something went wrong. Try again in a minute."), { status: res.status, wait: out.retry_after ?? 0 });
    return out;
  }
  // Runs a button's action: disabled while it works, the error in its status line.
  async function busy(button, line, fn) {
    if (button) button.disabled = true;
    try {
      await fn();
    } catch (err) {
      if (line) status(line, err.message, "bad");
    } finally {
      if (button) button.disabled = false;
    }
  }

  // "Send again": counts down the wait, and says how many codes are left this hour.
  function countdown(button, note, seconds, left) {
    clearInterval(button._timer);
    const end = Date.now() + seconds * 1000;
    const leftText = left == null ? "" : left === 0 ? "That was the last code for this hour." : `${left} more ${left === 1 ? "code" : "codes"} this hour.`;
    const tick = () => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      button.disabled = s > 0 || left === 0;
      button.textContent = s > 0 ? `Send again in ${clock(s)}` : "Send again";
      if (note) note.textContent = leftText;
      if (s <= 0) clearInterval(button._timer);
    };
    tick();
    button._timer = setInterval(tick, 1000);
  }

  function step(name) {
    for (const s of ["email", "code", "link"]) $(`step-${s}`).hidden = s !== name;
  }
  function signedOut(message = "") {
    session = null;
    me = null;
    keep(null);
    $("account").hidden = true;
    $("signin").hidden = false;
    step("email");
    status($("email-status"), message, message ? "bad" : "");
  }

  // ---- Sign in ----
  let email = "";
  async function sendCode(line) {
    try {
      const out = await call("POST", "/v1/auth/start", { email, web: true });
      $("sent-to").textContent = email;
      step("code");
      status($("code-status"), "");
      countdown($("resend"), $("resend-note"), out.resend_in ?? 60, out.codes_left);
      $("code").value = "";
      $("code").focus();
    } catch (err) {
      status(line, err.message, "bad");
      if (err.wait) countdown($("resend"), $("resend-note"), Math.min(err.wait, 3600), err.wait > 120 ? 0 : null);
      if (err.status === 429 && line === $("email-status") && err.wait <= 120) {
        // A code was just sent: go straight to typing it.
        $("sent-to").textContent = email;
        step("code");
        status($("code-status"), err.message);
      }
    }
  }
  $("email-form").addEventListener("submit", (e) => {
    e.preventDefault();
    email = $("email").value.trim().toLowerCase();
    busy(e.submitter, $("email-status"), () => sendCode($("email-status")));
  });
  $("resend").addEventListener("click", (e) => {
    e.currentTarget.disabled = true;
    sendCode($("code-status")).then(() => status($("code-status"), "A new code is on the way. The one before no longer works.", "good"));
  });
  $("other-email").addEventListener("click", () => {
    step("email");
    status($("email-status"), "");
    $("email").focus();
  });
  async function signedIn(out) {
    session = { email: out.email, token: out.token };
    keep(session);
    await show();
  }
  $("code-form").addEventListener("submit", (e) => {
    e.preventDefault();
    busy(e.submitter, $("code-status"), async () => signedIn(await call("POST", "/v1/auth/verify", { email, code: $("code").value.replace(/\s/g, ""), web: true })));
  });
  $("code").addEventListener("input", (e) => {
    const v = e.target.value.replace(/\D/g, "");
    if (v.length === 6) $("code-form").requestSubmit();
  });

  // ---- Signed in ----
  async function show() {
    me = await call("GET", "/v1/me");
    $("signin").hidden = true;
    $("account").hidden = false;
    $("menu-email").textContent = me.email;
    $("me-email").textContent = me.email;
    $("me-since").textContent = day(me.created_at) || "–";

    // Plan & billing
    const plan = me.plan;
    const ending = plan?.status === "ending";
    $("plan-name").replaceChildren(
      document.createTextNode(!plan ? (me.manages ? "Team admin" : "Free") : plan.tier === "team" ? `Team · ${plan.seats} seats` : "Pro"),
      ...(plan ? [el("span", { className: `tag ${plan.status === "past_due" || ending ? "warn" : "ok"}`, textContent: plan.status === "past_due" ? "payment failed" : ending ? "ending" : "active" })] : []),
    );
    $("plan-detail").textContent = !plan
      ? me.manages
        ? "You manage a Team plan (below). Using the app yourself? Add your own email to the Team: it takes one seat."
        : "Everything you use now stays free. Pro adds load tests, unlimited history and more."
      : me.role === "member"
        ? "On your company's Team. Your admin manages the subscription."
        : `${plan.interval === "year" ? "Yearly" : "Monthly"}. ${ending ? `Ends ${day(plan.until)}.` : plan.renews ? `Renews ${day(plan.renews)}.` : ""}${plan.status === "past_due" ? " The last payment failed: update the card in Manage subscription." : ""}`;
    const canManage = me.role === "owner" || me.manages;
    $("manage").hidden = !canManage;
    $("manage-note").hidden = !canManage;
    $("buy").hidden = Boolean(plan) || me.manages;
    if (!plan) $("buy").href = `buy.html?plan=pro&account=${encodeURIComponent(me.account)}&email=${encodeURIComponent(me.email)}`;
    $("key-box").hidden = !me.license;
    $("key").value = me.license ?? "";

    // Team, or Ask for access
    $("team").hidden = !me.manages;
    $("ask").hidden = Boolean(plan) || me.manages;
    $("nav-team").hidden = $("team").hidden && $("ask").hidden;
    $("nav-team").href = me.manages ? "#team" : "#ask";
    if (me.manages) drawTeam(await call("GET", "/v1/team"));

    $("delete-confirm").value = "";
    $("delete").disabled = true;
    await Promise.all([drawDevices(), drawPrefs()]);
    watchSections();
    const target = location.hash && document.querySelector(location.hash);
    if (target && target.closest("#account")) target.scrollIntoView();
  }

  // ---- Profile: change the email ----
  let newEmail = "";
  $("change-open").addEventListener("click", () => {
    $("change").hidden = false;
    $("change-form").hidden = false;
    $("change-code-form").hidden = true;
    $("new-email").focus();
  });
  $("change-cancel").addEventListener("click", () => {
    $("change").hidden = true;
    status($("profile-status"), "");
  });
  async function sendChange() {
    const out = await call("POST", "/v1/account/email", { email: newEmail });
    $("change-form").hidden = true;
    $("change-code-form").hidden = false;
    $("change-code").value = "";
    $("change-code").focus();
    status($("profile-status"), `${out.message} Type it here.`);
    countdown($("change-resend"), null, out.resend_in ?? 60, out.codes_left);
  }
  $("change-form").addEventListener("submit", (e) => {
    e.preventDefault();
    newEmail = $("new-email").value.trim().toLowerCase();
    busy(e.submitter, $("profile-status"), sendChange);
  });
  $("change-resend").addEventListener("click", (e) => busy(e.currentTarget, $("profile-status"), sendChange));
  $("change-code-form").addEventListener("submit", (e) => {
    e.preventDefault();
    busy(e.submitter, $("profile-status"), async () => {
      const out = await call("POST", "/v1/account/email/verify", { email: newEmail, code: $("change-code").value.replace(/\s/g, "") });
      session = { ...session, email: out.email };
      keep(session);
      $("change").hidden = true;
      await show();
      status($("profile-status"), `Done: you now sign in with ${out.email}. We've told your old address.`, "good");
    });
  });

  // ---- Team ----
  const isMe = (address) => address.trim().toLowerCase() === me?.email;
  function drawTeam(team) {
    $("team-seats").textContent = `${team.members.length} of ${team.seats} seats used.`;
    $("members").replaceChildren(
      ...team.members.map((m) => {
        const remove = el("button", { className: "btn btn-ghost btn-sm", type: "button", textContent: "Remove" });
        remove.addEventListener("click", () => {
          if (!confirm(`Remove ${m.email} from the Team? Their app goes back to Free within a day.`)) return;
          busy(remove, $("team-status"), async () => {
            drawTeam(await call("POST", "/v1/team/members/remove", { email: m.email }));
            status($("team-status"), `${m.email} removed.`, "good");
            if (isMe(m.email)) await show();
          });
        });
        return el("li", {}, el("div", { className: "what" }, el("b", { textContent: m.email }), el("small", { textContent: m.signed_in ? "Signed in to the app" : `Added ${day(m.added_at)}, not signed in yet` })), remove);
      }),
    );
  }
  $("add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    busy(e.submitter, $("team-status"), async () => {
      const who = $("add-email").value.trim();
      drawTeam(await call("POST", "/v1/team/members", { email: who }));
      $("add-email").value = "";
      status($("team-status"), isMe(who) ? "You're on the Team: sign in to the app with this email to use it." : `${who} added. We've emailed them what to do.`, "good");
      if (isMe(who)) await show();
    });
  });
  $("ask-form").addEventListener("submit", (e) => {
    e.preventDefault();
    busy(e.submitter, $("ask-status"), async () => status($("ask-status"), (await call("POST", "/v1/team/ask", { admin: $("admin-email").value.trim() })).message, "good"));
  });

  // ---- Devices ----
  const ICON = {
    app: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
    browser: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>',
  };
  async function drawDevices() {
    const { sessions, computers_allowed: allowed } = await call("GET", "/v1/sessions");
    const apps = sessions.filter((s) => s.kind === "app").length;
    $("devices-lead").textContent = `Everywhere you're signed in. The app: ${apps} of ${allowed} computers${me.plan ? "" : " (the limit applies with a plan)"}. Browsers don't count, and stay signed in for 90 days.`;
    $("sessions").replaceChildren(
      ...sessions.map((s) => {
        const ic = el("span", { className: "ic" });
        ic.innerHTML = ICON[s.kind];
        const name = el("b", { textContent: s.name });
        if (s.current) name.append(el("span", { className: "tag ok", textContent: "this browser" }));
        const detail = `${s.kind === "app" ? "The app" : "Website"} · last used ${ago(s.seen_at)} · signed in ${day(s.created_at)}${s.expires_at ? ` · until ${day(s.expires_at)}` : ""}`;
        const out = el("button", { className: "btn btn-ghost btn-sm", type: "button", textContent: "Sign out" });
        out.addEventListener("click", () =>
          busy(out, $("devices-status"), async () => {
            if (s.current) {
              await call("POST", "/v1/auth/signout", {});
              return signedOut();
            }
            await call("POST", "/v1/auth/signout", { computer: s.id });
            status($("devices-status"), `${s.name} is signed out.`, "good");
            await drawDevices();
          }),
        );
        return el("li", {}, ic, el("div", { className: "what" }, name, el("small", { textContent: detail })), out);
      }),
    );
    $("signout-others").hidden = sessions.length < 2;
  }
  $("signout-others").addEventListener("click", (e) => {
    if (!confirm("Sign out every other computer and browser? The app on them goes back to Free until it signs in again.")) return;
    busy(e.currentTarget, $("devices-status"), async () => {
      await call("POST", "/v1/auth/signout", { others: true });
      status($("devices-status"), "Signed out everywhere else.", "good");
      await drawDevices();
    });
  });

  // ---- Emails ----
  async function drawPrefs(p) {
    p = p ?? (await call("GET", "/v1/preferences"));
    $("pref-alerts").checked = p.signin_alerts;
    $("pref-news").checked = p.news;
  }
  for (const [id, key] of [["pref-alerts", "signin_alerts"], ["pref-news", "news"]]) {
    $(id).addEventListener("change", (e) => {
      const box = e.currentTarget;
      busy(box, $("emails-status"), async () => {
        await drawPrefs(await call("POST", "/v1/preferences", { [key]: box.checked }));
        status($("emails-status"), "Saved.", "good");
      });
    });
  }

  // ---- Plan buttons, sign out, delete ----
  $("manage").addEventListener("click", (e) =>
    busy(e.currentTarget, $("plan-status"), async () => {
      location.href = (await call("POST", "/v1/portal", {})).url;
    }),
  );
  $("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("key").value);
      status($("plan-status"), "Copied.", "good");
    } catch {
      $("key").select();
    }
  });
  $("signout").addEventListener("click", (e) =>
    busy(e.currentTarget, null, async () => {
      await call("POST", "/v1/auth/signout", {}).catch(() => undefined);
      signedOut();
    }),
  );
  $("delete-confirm").addEventListener("input", (e) => {
    $("delete").disabled = e.target.value.trim().toLowerCase() !== me?.email;
  });
  $("delete-form").addEventListener("submit", (e) => {
    e.preventDefault();
    busy(e.submitter, $("delete-status"), async () => {
      await call("POST", "/v1/account/delete", {});
      signedOut();
      status($("email-status"), "Your account is deleted.", "good");
    });
  });

  // The section in view lights up in the menu.
  let watcher = null;
  function watchSections() {
    if (!("IntersectionObserver" in window) || watcher) return;
    const links = [...document.querySelectorAll(".menu nav a")];
    watcher = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          for (const a of links) a.classList.toggle("on", a.getAttribute("href") === `#${e.target.id}`);
        }
      },
      { rootMargin: "-90px 0px -55% 0px" },
    );
    document.querySelectorAll(".sections > section").forEach((s) => watcher.observe(s));
  }

  // From the admin's "asks to join" email: ?add=… fills in the person to add.
  if (params.get("add")) $("add-email").value = params.get("add");

  // From the sign-in email's link: #signin=<email>&link=<token>. Taken out of the address at once.
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get("signin") && hash.get("link")) {
    email = hash.get("signin").toLowerCase();
    history.replaceState(null, "", location.pathname + location.search);
    step("link");
    call("POST", "/v1/auth/verify", { email, link: hash.get("link"), web: true })
      .then(signedIn)
      .catch((err) => {
        if (session?.token) return show().catch(() => signedOut(err.message));
        signedOut(err.message);
        $("email").value = email;
      });
  } else if (session?.token) show().catch((err) => signedOut(err.message));
})();

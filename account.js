// The account page: sign in with an emailed code, then the plan, the computers signed in to the
// app, a Team admin's people, Ask for access, and Delete my account. All of it is the license
// server's (services/license-worker); this page only shows it. A website sign-in lasts 30 days
// and isn't one of the 3 computers.
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

  function status(el, text, bad = false) {
    el.textContent = text;
    el.classList.toggle("bad", bad);
  }
  const day = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

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
    if (!res.ok) throw Object.assign(new Error(out.error ?? "Something went wrong. Try again in a minute."), { status: res.status });
    return out;
  }
  // Runs a button's action: disabled while it works, the error in its status line.
  async function busy(button, line, fn) {
    if (button) button.disabled = true;
    try {
      await fn();
    } catch (err) {
      if (line) status(line, err.message, true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function signedOut(message = "") {
    session = null;
    keep(null);
    $("signed-in").hidden = true;
    $("signin").hidden = false;
    $("email-form").hidden = false;
    $("code-form").hidden = true;
    status($("signin-status"), message, Boolean(message));
  }

  // ---- Sign in ----
  let email = "";
  $("email-form").addEventListener("submit", (e) => {
    e.preventDefault();
    busy(e.submitter, $("signin-status"), async () => {
      email = $("email").value.trim();
      const out = await call("POST", "/v1/auth/start", { email });
      status($("signin-status"), `${out.message} Check spam too.`);
      $("email-form").hidden = true;
      $("code-form").hidden = false;
      $("code").value = "";
      $("code").focus();
    });
  });
  $("other-email").addEventListener("click", () => signedOut());
  $("code-form").addEventListener("submit", (e) => {
    e.preventDefault();
    busy(e.submitter, $("signin-status"), async () => {
      const out = await call("POST", "/v1/auth/verify", { email, code: $("code").value.replace(/\s/g, ""), web: true });
      session = { email: out.email, token: out.token };
      keep(session);
      status($("signin-status"), "");
      await show();
    });
  });

  // ---- Signed in ----
  async function show() {
    const me = await call("GET", "/v1/me");
    $("signin").hidden = true;
    $("signed-in").hidden = false;
    $("me-email").textContent = me.email;
    const plan = me.plan;
    const name = plan ? (plan.tier === "team" ? `Team for ${plan.seats} people` : "Pro") : null;
    $("me-plan").textContent = !plan
      ? me.manages
        ? "You manage a Team plan below. Using the app yourself? Add your own email to the Team: it takes one seat."
        : "Free. Everything you use now stays free."
      : me.role === "member"
        ? `${name}: on your company's Team.`
        : `${name}, ${plan.interval === "year" ? "yearly" : "monthly"}${plan.status === "ending" ? `. Ends ${day(plan.until)}.` : plan.renews ? `. Renews ${day(plan.renews)}.` : "."}${plan.status === "past_due" ? " The last payment failed: update the card in Manage subscription." : ""}`;
    $("manage").hidden = me.role !== "owner" && !me.manages;
    $("buy").hidden = Boolean(plan) || me.manages;
    if (!plan) $("buy").href = `buy.html?plan=pro&account=${encodeURIComponent(me.account)}&email=${encodeURIComponent(me.email)}`;
    $("key-box").hidden = !me.license;
    $("key").value = me.license ?? "";

    const list = $("computers");
    list.replaceChildren(
      ...me.computers.map((c) => {
        const li = document.createElement("li");
        const who = document.createElement("span");
        who.className = "who";
        who.textContent = c.computer;
        const when = document.createElement("small");
        when.textContent = `last used ${day(c.seen_at)}`;
        who.append(when);
        const out = document.createElement("button");
        out.className = "btn btn-sm";
        out.type = "button";
        out.textContent = "Sign out";
        out.addEventListener("click", () => busy(out, $("me-status"), async () => {
          await call("POST", "/v1/auth/signout", { computer: c.id });
          await show();
        }));
        li.append(who, out);
        return li;
      }),
    );
    $("no-computers").hidden = me.computers.length > 0;

    $("team-card").hidden = !me.manages;
    $("ask-card").hidden = Boolean(plan) || me.manages;
    if (me.manages) drawTeam(await call("GET", "/v1/team"));
  }

  // Adding or removing yourself changes your own plan: show it again.
  const isMe = (email) => email.trim().toLowerCase() === session?.email;

  function drawTeam(team) {
    $("team-seats").textContent = `${team.members.length} of ${team.seats} seats used.`;
    $("members").replaceChildren(
      ...team.members.map((m) => {
        const li = document.createElement("li");
        const who = document.createElement("span");
        who.className = "who";
        who.textContent = m.email;
        const note = document.createElement("small");
        note.textContent = m.signed_in ? "signed in" : `added ${day(m.added_at)}, not signed in yet`;
        who.append(note);
        const remove = document.createElement("button");
        remove.className = "btn btn-sm";
        remove.type = "button";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
          if (!confirm(`Remove ${m.email} from the Team? Their app goes back to Free within a day.`)) return;
          busy(remove, $("team-status"), async () => {
            drawTeam(await call("POST", "/v1/team/members/remove", { email: m.email }));
            status($("team-status"), `${m.email} removed.`);
            if (isMe(m.email)) await show();
          });
        });
        li.append(who, remove);
        return li;
      }),
    );
  }

  $("add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    busy(e.submitter, $("team-status"), async () => {
      const who = $("add-email").value.trim();
      drawTeam(await call("POST", "/v1/team/members", { email: who }));
      $("add-email").value = "";
      status($("team-status"), isMe(who) ? "You're on the Team: sign in to the app with this email to use it." : `${who} added. We've emailed them what to do.`);
      if (isMe(who)) await show();
    });
  });
  $("ask-form").addEventListener("submit", (e) => {
    e.preventDefault();
    busy(e.submitter, $("ask-status"), async () => {
      const out = await call("POST", "/v1/team/ask", { admin: $("admin-email").value.trim() });
      status($("ask-status"), out.message);
    });
  });
  $("manage").addEventListener("click", (e) =>
    busy(e.currentTarget, $("me-status"), async () => {
      const out = await call("POST", "/v1/portal", {});
      location.href = out.url;
    }),
  );
  $("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("key").value);
      status($("me-status"), "Copied.");
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
  $("delete").addEventListener("click", (e) => {
    if (!confirm("Delete your account? Your email is removed and every computer is signed out. This can't be undone.")) return;
    busy(e.currentTarget, $("delete-status"), async () => {
      await call("POST", "/v1/account/delete", {});
      signedOut("Your account is deleted.");
      status($("signin-status"), "Your account is deleted.");
    });
  });

  // From the admin's "asks to join" email: ?add=… fills in the person to add.
  if (params.get("add")) $("add-email").value = params.get("add");
  if (session?.token) show().catch((err) => signedOut(err.message));
})();

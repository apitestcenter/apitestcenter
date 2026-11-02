// The buy page: Paddle's checkout, then the license key from license.apitestcenter.com.
// Switch ENV to "live" (and fill LIVE) when the live Paddle account is approved.
(() => {
  const ENV = "sandbox";
  const ACCOUNTS = {
    sandbox: {
      token: "test_0218bebb0caa1b630af98047006",
      prices: {
        pro: { monthly: "pri_01m677k2nzxc1gdrkc11fzes8s", yearly: "pri_01m677p3rdmb9nk1701sh6nn5k" },
        team: { monthly: "pri_01m678aa1d50qfwf6hmv37an0b", yearly: "pri_01m678btvxp7c76zx3jjjdwgde" },
      },
    },
    live: { token: "", prices: { pro: { monthly: "", yearly: "" }, team: { monthly: "", yearly: "" } } },
  };
  const LICENSE_SERVER = "https://license.apitestcenter.com";
  // US dollars before tax; the same as packages/shared/src/plan.ts.
  const USD = { pro: { monthly: 9, yearly: 90, ladder: [90, 81, 72] }, team: { monthly: 15, yearly: 150, ladder: [150, 135, 120] } };

  const $ = (id) => document.getElementById(id);
  const account = ACCOUNTS[ENV];
  const params = new URLSearchParams(location.search);
  const pick = (name) => document.querySelector(`input[name="${name}"]:checked`).value;
  const seats = () => Math.min(500, Math.max(3, Math.round(Number($("seats").value) || 3)));
  // From the signed-in app (Settings → Plan → Buy Pro): the plan goes to that account.
  const accountId = /^acc_[\w-]{8,40}$/.test(params.get("account") ?? "") ? params.get("account") : null;
  const email = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(params.get("email") ?? "") ? params.get("email") : null;

  if (ENV === "sandbox") $("test-banner").hidden = false;
  for (const name of ["plan", "billing"]) {
    const want = params.get(name);
    const input = want && document.querySelector(`input[name="${name}"][value="${CSS.escape(want)}"]`);
    if (input) input.checked = true;
  }
  if (params.get("seats")) $("seats").value = params.get("seats");

  function show() {
    const plan = pick("plan");
    const billing = pick("billing");
    const team = plan === "team";
    $("seats-row").hidden = !team;
    const n = team ? seats() : 1;
    const each = USD[plan][billing];
    const per = team ? ` per person (${n} people: $${each * n})` : "";
    $("price").textContent = billing === "yearly" ? `$${each} a year${per}` : `$${each} a month${per}`;
    // Yearly is 2 months free: twelve months at the monthly price, struck out.
    $("was").textContent = billing === "yearly" ? `$${USD[plan].monthly * 12 * n}` : "";
    $("was").hidden = billing !== "yearly";
    $("price-note").textContent =
      billing === "yearly"
        ? `Then $${USD[plan].ladder[1]} the second year and $${USD[plan].ladder[2]} from the third${team ? " (per person)" : ""}, as long as you keep renewing. Depending on your country, tax is included or added at checkout.`
        : "Depending on your country, tax is included or added at checkout. Switch to yearly any time to save.";
  }
  document.querySelectorAll("input[name=plan], input[name=billing]").forEach((i) => i.addEventListener("change", show));
  $("seats").addEventListener("input", show);
  show();

  const status = (el, text, bad = false) => {
    el.textContent = text;
    el.classList.toggle("bad", bad);
  };

  async function claim(transactionId) {
    $("choose").hidden = true;
    $("done").hidden = false;
    window.scrollTo(0, 0);
    // Paddle tells the license server a moment after the payment; try for about a minute.
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch(`${LICENSE_SERVER}/v1/license/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ transaction_id: transactionId }) });
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.team) {
          // A Team has no key: the admin adds the people, who sign in with their own email.
          $("team-box").hidden = false;
          status($("claim-status"), `Team, ${body.seats} people — paid. Now add the people who'll use it.`);
          return;
        }
        if (res.ok && body.license) {
          $("key").value = body.license;
          $("key-box").hidden = false;
          status($("claim-status"), `${body.tier === "team" ? `Team, ${body.seats} people` : "Pro"} — paid. Here is your license key.`);
          return;
        }
        if (res.status !== 409 && res.status < 500) {
          status($("claim-status"), `${body.error ?? "Couldn't get the license key."} Write to support@apitestcenter.com with this number: ${transactionId}`, true);
          return;
        }
      } catch {
        /* offline for a moment: try again */
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    status($("claim-status"), `The payment went through, but the license key is taking longer than usual. Reload this page in a minute, or write to support@apitestcenter.com with this number: ${transactionId}`, true);
  }

  $("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("key").value);
      $("copy").textContent = "Copied";
    } catch {
      $("key").select();
    }
  });
  $("download").addEventListener("click", () => {
    const blob = new Blob([`APITestCenter license key\r\n\r\n${$("key").value}\r\n\r\nSettings → Plan → Enter a license key.\r\n`], { type: "text/plain" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "APITestCenter-license.txt" });
    a.click();
    // Freed later: the browser starts the download after this returns.
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  });

  // Lost your key: the license server emails it to the address the plan was bought with.
  $("lost-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = e.submitter;
    if (button) button.disabled = true;
    status($("lost-status"), "Sending…");
    try {
      const res = await fetch(`${LICENSE_SERVER}/v1/license/lost`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: $("lost-email").value }) });
      const body = await res.json().catch(() => ({}));
      status($("lost-status"), res.ok ? body.message : (body.error ?? "Couldn't send it. Write to support@apitestcenter.com."), !res.ok);
    } catch {
      status($("lost-status"), "Couldn't reach the license server. Check your connection and try again.", true);
    } finally {
      if (button) button.disabled = false;
    }
  });

  // A reload after paying: ?txn=… gets the key again.
  if (params.get("txn")) {
    void claim(params.get("txn"));
    return;
  }

  function start() {
    if (!window.Paddle || !account.token) {
      status($("pay-status"), "The payment form couldn't load. Check your connection, or write to billing@apitestcenter.com.", true);
      return;
    }
    if (ENV === "sandbox") window.Paddle.Environment.set("sandbox");
    window.Paddle.Initialize({
      token: account.token,
      eventCallback: (event) => {
        if (event.name === "checkout.completed" && event.data?.transaction_id) {
          const id = event.data.transaction_id;
          history.replaceState(null, "", `?txn=${encodeURIComponent(id)}`);
          window.Paddle.Checkout.close();
          void claim(id);
        }
      },
    });
    $("pay").disabled = false;
    $("pay").addEventListener("click", () => {
      const plan = pick("plan");
      const billing = pick("billing");
      window.Paddle.Checkout.open({
        items: [{ priceId: account.prices[plan][billing], quantity: plan === "team" ? seats() : 1 }],
        ...(accountId ? { customData: { account_id: accountId } } : {}),
        ...(email ? { customer: { email } } : {}),
        settings: { displayMode: "overlay", theme: document.documentElement.dataset.theme === "light" ? "light" : "dark", variant: "one-page" },
      });
    });
  }
  if (window.Paddle) start();
  else window.addEventListener("load", start);
})();

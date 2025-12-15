// SkyFarm shared header — role-aware navigation (safe init)
// Requires Firebase auth + Firestore on pages that use role gating

(function (global) {
  const TOP_PAGES = [
    { href: "skyfarm-diary.html", label: "Diary" },
    { href: "skyfarm-map.html", label: "Map" },
    { href: "skyfarm-rain.html", label: "Rain" },
    { href: "skyfarm-hours.html", label: "Hours" },
    { href: "skyfarm-induction.html", label: "Induction" },
  ];

  const DATABASE_ITEMS = [
    { href: "skyfarm-livestock.html", label: "Livestock" },
    { href: "skyfarm-chemical.html", label: "Chemicals" },
    { href: "skyfarm-seeds.html", label: "Seeds" },
    { href: "skyfarm-fodder.html", label: "Fodder" },
    { href: "skyfarm-barcode.html", label: "Barcode scanner" },
    { href: "skyfarm-users.html", label: "Users & roles" },
  ];

  const ADMIN_ONLY_PAGES = [
    { href: "skyfarm-induction-admin.html", label: "Induction admin" },
  ];

  const LEGACY_REDIRECTS = {
    "skyfarm-seed.html": "skyfarm-seeds.html",
    "skyfarm-admin-users.html": "skyfarm-users.html",
  };

  function currentFile() {
    return (location.pathname.split("/").pop() || "").toLowerCase();
  }
  function isActive(href) {
    return currentFile() === href.toLowerCase();
  }
  function applyLegacyRedirect() {
    const f = currentFile();
    if (LEGACY_REDIRECTS[f]) location.replace(LEGACY_REDIRECTS[f]);
  }

  function brandHtml() {
    const logo =
      "https://raw.githubusercontent.com/Nyscat/Skyfarm/main/FF9D2A05-6AC0-45E5-95EB-659A0A11E8D0_1_105_c.jpeg";
    return `
      <a class="sf-brand" href="skyfarm-diary.html">
        <img src="${logo}" alt="SkyFarm logo">
        <span>SkyFarm</span>
      </a>
    `;
  }

  function navHtml(extraLinksHtml = "") {
    const topLinks = TOP_PAGES.map(
      (p) =>
        `<a href="${p.href}" ${isActive(p.href) ? 'aria-current="page"' : ""}>${p.label}</a>`
    ).join("");

    const dbBtn = `<button class="sf-menu-btn" type="button" aria-expanded="false">Database ▾</button>`;
    const dbList = `
      <div class="sf-menu-list">
        ${DATABASE_ITEMS.map(
          (it) =>
            `<a href="${it.href}" ${isActive(it.href) ? 'aria-current="page"' : ""}>${it.label}</a>`
        ).join("")}
      </div>
    `;

    return `
      <nav class="sf-nav">
        ${topLinks}
        ${extraLinksHtml}
        <div class="sf-menu" id="sf-menu">${dbBtn}${dbList}</div>
      </nav>
    `;
  }

  function headerHtml(extraLinksHtml = "") {
    return `
      <div class="sf-header">
        <div class="bar">
          ${brandHtml()}
          ${navHtml(extraLinksHtml)}
          <div class="sf-spacer"></div>
          <span id="sf-auth" class="sf-auth">Checking sign-in…</span>
        </div>
      </div>
    `;
  }

  function wireMenu() {
    const menu = document.getElementById("sf-menu");
    if (!menu) return;

    const btn = menu.querySelector(".sf-menu-btn");
    if (!btn) return;

    function open() {
      menu.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
    }
    function close() {
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }

    btn.onclick = (e) => {
      e.stopPropagation();
      menu.classList.contains("open") ? close() : open();
    };

    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target)) close();
    });
  }

  function firebaseReady() {
    try {
      if (!global.firebase) return false;
      if (!global.firebase.apps) return false;
      return global.firebase.apps.length > 0;
    } catch (_) {
      return false;
    }
  }

  function setAuthLabel(text) {
    const el = document.getElementById("sf-auth");
    if (el) el.textContent = text;
  }

  async function getUserRoleForEmail(email) {
    try {
      if (!firebaseReady()) return "worker";
      if (!global.firebase?.firestore) return "worker";
      if (!email) return "worker";

      const docId = String(email).toLowerCase().replace(/[^\w.-]/g, "_");
      const snap = await firebase.firestore().collection("users").doc(docId).get();
      if (snap.exists) return (snap.data()?.role || "worker");
      return "worker";
    } catch (e) {
      console.warn("Header role lookup failed", e);
      return "worker";
    }
  }

  function adminLinksHtml() {
    return ADMIN_ONLY_PAGES.map(
      (p) =>
        `<a href="${p.href}" ${isActive(p.href) ? 'aria-current="page"' : ""}>${p.label}</a>`
    ).join("");
  }

  function waitForFirebaseThen(fn, maxMs = 8000) {
    const start = Date.now();
    const t = setInterval(() => {
      if (firebaseReady()) {
        clearInterval(t);
        fn();
      } else if (Date.now() - start > maxMs) {
        clearInterval(t);
        setAuthLabel("Not connected");
      }
    }, 150);
  }

  function mount(rootId = "sf-header-root") {
    applyLegacyRedirect();

    let mountEl = document.getElementById(rootId);
    if (!mountEl) {
      mountEl = document.createElement("div");
      mountEl.id = rootId;
      document.body.insertBefore(mountEl, document.body.firstChild);
    }

    // render base header immediately
    mountEl.innerHTML = headerHtml("");
    wireMenu();
    setAuthLabel("Checking sign-in…");

    // attach auth listener only after firebase.initializeApp has run
    waitForFirebaseThen(() => {
      let lastRenderedRole = null;
      let lastRenderedEmail = null;

      firebase.auth().onAuthStateChanged(async (u) => {
        if (!u) {
          // signed out
          setAuthLabel("Not signed in");
          if (lastRenderedRole !== "signedout") {
            mountEl.innerHTML = headerHtml("");
            wireMenu();
            setAuthLabel("Not signed in");
            lastRenderedRole = "signedout";
            lastRenderedEmail = null;
          }
          return;
        }

        const email = (u.email || "").toLowerCase();
        setAuthLabel(email || "Signed in");

        // load role and re-render if needed
        const role = await getUserRoleForEmail(email);
        const isAdmin = role === "admin" || role === "manager";
        const desiredRoleKey = isAdmin ? "adminlike" : "workerlike";

        // Avoid pointless re-renders
        if (lastRenderedRole === desiredRoleKey && lastRenderedEmail === email) return;

        mountEl.innerHTML = headerHtml(isAdmin ? adminLinksHtml() : "");
        wireMenu();
        setAuthLabel(email || "Signed in");

        lastRenderedRole = desiredRoleKey;
        lastRenderedEmail = email;
      });
    });
  }

  global.SkyFarmHeader = { mount };
})(window);

// skyfarm-auth.js
// Shared auth gate + last login stamping for SkyFarm (Firebase compat)

(function (global) {
  function firebaseReady() {
    try {
      return !!global.firebase && Array.isArray(global.firebase.apps) && global.firebase.apps.length > 0;
    } catch (e) {
      return false;
    }
  }

  function safeDocIdFromEmail(email) {
    return String(email || "")
      .toLowerCase()
      .replace(/[^\w.-]/g, "_");
  }

  function ensureOverlay() {
    let el = document.getElementById("sf-authOverlay");
    if (el) return el;

    el = document.createElement("div");
    el.id = "sf-authOverlay";
    el.style.cssText = `
      position:fixed; inset:0; z-index:9999;
      background:radial-gradient(circle at top,#020617 0,rgba(15,23,42,.94) 40%,rgba(15,23,42,.97) 100%);
      display:none; align-items:center; justify-content:center;
      padding:16px;
    `;
    el.innerHTML = `
      <div style="width:min(520px,92vw); background:#fff; border-radius:16px; border:1px solid #e2e8f0; padding:20px;">
        <h2 style="margin:0 0 8px;">Sign in to SkyFarm</h2>
        <p style="margin:0 0 12px; color:#64748b; font-size:.9rem;">Email and password only.</p>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <div style="flex:1; min-width:240px;">
            <label style="display:block; font-size:.85rem; color:#475569; margin-bottom:4px;">Email</label>
            <input id="sf_siEmail" type="email" autocomplete="username" placeholder="you@example.com"
              style="width:100%; border:1px solid #cbd5e1; border-radius:10px; padding:8px 10px;">
          </div>
          <div style="flex:1; min-width:200px;">
            <label style="display:block; font-size:.85rem; color:#475569; margin-bottom:4px;">Password</label>
            <input id="sf_siPass" type="password" autocomplete="current-password" placeholder="••••••••"
              style="width:100%; border:1px solid #cbd5e1; border-radius:10px; padding:8px 10px;">
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px; margin-top:12px;">
          <button id="sf_signInBtn"
            style="border-radius:999px; border:1px solid #047857; background:#047857; color:#fff; padding:8px 12px; cursor:pointer;">
            Sign in
          </button>
          <span id="sf_authMsg" style="color:#64748b; font-size:.9rem;"></span>
          <span style="flex:1;"></span>
          <button id="sf_closeOverlayBtn"
            style="border-radius:999px; border:1px solid #cbd5e1; background:#fff; padding:8px 12px; cursor:pointer;">
            Close
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  function showOverlay(show) {
    const el = ensureOverlay();
    el.style.display = show ? "flex" : "none";
  }

  async function stampLastLogin(db, user) {
    try {
      if (!user?.email) return;

      const docId = safeDocIdFromEmail(user.email);
      const sessionKey = "sf_last_login_stamped_" + docId;

      // once per tab/session
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, "1");

      await db.collection("users").doc(docId).set(
        {
          email: user.email.toLowerCase(),
          lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastSeenAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn("stampLastLogin failed", e);
    }
  }

  function startHeartbeat(db) {
    // every 5 minutes update lastSeenAt (best-effort)
    if (global.__SF_HEARTBEAT_STARTED__) return;
    global.__SF_HEARTBEAT_STARTED__ = true;

    setInterval(async () => {
      try {
        const u = firebase.auth().currentUser;
        if (!u?.email) return;
        const docId = safeDocIdFromEmail(u.email);
        await db.collection("users").doc(docId).set(
          { lastSeenAt: firebase.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
      } catch (e) {}
    }, 5 * 60 * 1000);
  }

  function requireAuth(opts) {
    opts = opts || {};
    const maxWaitMs = Number(opts.maxWaitMs || 10000);

    const overlay = ensureOverlay();
    const emailEl = overlay.querySelector("#sf_siEmail");
    const passEl = overlay.querySelector("#sf_siPass");
    const msgEl = overlay.querySelector("#sf_authMsg");
    const signInBtn = overlay.querySelector("#sf_signInBtn");
    const closeBtn = overlay.querySelector("#sf_closeOverlayBtn");

    closeBtn.onclick = () => showOverlay(false);

    function setMsg(t) {
      msgEl.textContent = t || "";
    }

    const start = Date.now();
    const timer = setInterval(async () => {
      if (!firebaseReady()) {
        if (Date.now() - start > maxWaitMs) {
          clearInterval(timer);
          setMsg("Firebase not ready on this page.");
          showOverlay(true);
        }
        return;
      }

      clearInterval(timer);

      const auth = firebase.auth();
      const db = firebase.firestore();

      signInBtn.onclick = async () => {
        const email = (emailEl.value || "").trim();
        const pass = passEl.value || "";
        if (!email || !pass) {
          setMsg("Enter email and password.");
          return;
        }
        setMsg("Signing in…");
        try {
          await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
          await auth.signInWithEmailAndPassword(email, pass);
          setMsg("Signed in.");
          showOverlay(false);
        } catch (e) {
          console.error(e);
          setMsg(e.message || "Sign in failed.");
        }
      };

      auth.onAuthStateChanged(async (u) => {
        if (u) {
          showOverlay(false);

          // stamp login + start heartbeat
          await stampLastLogin(db, u);
          startHeartbeat(db);
        } else {
          showOverlay(true);
        }
      });
    }, 150);
  }

  global.SkyFarmAuth = { requireAuth };
})(window);

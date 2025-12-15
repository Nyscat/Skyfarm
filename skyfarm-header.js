// SkyFarm shared header — role-aware navigation
// Requires Firebase auth + Firestore on pages that use role gating

(function(global){
  const TOP_PAGES = [
    { href:'skyfarm-diary.html',     label:'Diary' },
    { href:'skyfarm-map.html',       label:'Map' },
    { href:'skyfarm-rain.html',      label:'Rain' },
    { href:'skyfarm-hours.html',     label:'Hours' },
    { href:'skyfarm-induction.html', label:'Induction' }
  ];

  const DATABASE_ITEMS = [
    { href:'skyfarm-livestock.html', label:'Livestock' },
    { href:'skyfarm-chemical.html',  label:'Chemicals' },
    { href:'skyfarm-seeds.html',     label:'Seeds' },
    { href:'skyfarm-fodder.html',    label:'Fodder' },
    { href:'skyfarm-barcode.html',   label:'Barcode scanner' },
    { href:'skyfarm-users.html',     label:'Users & roles' }
  ];

  const ADMIN_ONLY_PAGES = [
    { href:'skyfarm-induction-admin.html', label:'Induction admin' }
  ];

  const LEGACY_REDIRECTS = {
    'skyfarm-seed.html': 'skyfarm-seeds.html',
    'skyfarm-admin-users.html': 'skyfarm-users.html'
  };

  function currentFile(){
    return (location.pathname.split('/').pop() || '').toLowerCase();
  }

  function isActive(href){
    return currentFile() === href.toLowerCase();
  }

  function applyLegacyRedirect(){
    const f = currentFile();
    if (LEGACY_REDIRECTS[f]) location.replace(LEGACY_REDIRECTS[f]);
  }

  function brandHtml(){
    const logo = 'https://raw.githubusercontent.com/Nyscat/Skyfarm/main/FF9D2A05-6AC0-45E5-95EB-659A0A11E8D0_1_105_c.jpeg';
    return `
      <a class="sf-brand" href="skyfarm-diary.html">
        <img src="${logo}" alt="SkyFarm logo">
        <span>SkyFarm</span>
      </a>
    `;
  }

  function navHtml(extraLinksHtml=''){
    const topLinks = TOP_PAGES.map(p =>
      `<a href="${p.href}" ${isActive(p.href)?'aria-current="page"':''}>${p.label}</a>`
    ).join('');

    const dbBtn = `<button class="sf-menu-btn" type="button" aria-expanded="false">Database ▾</button>`;
    const dbList = `
      <div class="sf-menu-list">
        ${DATABASE_ITEMS.map(it =>
          `<a href="${it.href}" ${isActive(it.href)?'aria-current="page"':''}>${it.label}</a>`
        ).join('')}
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

  function headerHtml(extraLinksHtml=''){
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

  function wireMenu(){
    const menu = document.getElementById('sf-menu');
    if (!menu) return;

    const btn = menu.querySelector('.sf-menu-btn');
    function open(){ menu.classList.add('open'); btn.setAttribute('aria-expanded','true'); }
    function close(){ menu.classList.remove('open'); btn.setAttribute('aria-expanded','false'); }

    btn.onclick = e => {
      e.stopPropagation();
      menu.classList.contains('open') ? close() : open();
    };

    document.addEventListener('click', e=>{
      if (!menu.contains(e.target)) close();
    });
  }

  async function getUserRole(){
    if (!global.firebase?.auth || !global.firebase?.firestore) return 'worker';

    const user = firebase.auth().currentUser;
    if (!user || !user.email) return 'worker';

    const docId = user.email.toLowerCase().replace(/[^\w.-]/g,'_');

    try{
      const snap = await firebase.firestore().collection('users').doc(docId).get();
      if (snap.exists){
        return snap.data().role || 'worker';
      }
    }catch(e){
      console.warn('Header role lookup failed', e);
    }
    return 'worker';
  }

  function updateAuthLabel(){
    const el = document.getElementById('sf-auth');
    if (!el) return;

    if (!global.firebase?.auth){
      el.textContent = 'Not connected';
      return;
    }

    firebase.auth().onAuthStateChanged(u=>{
      if (u){
        el.textContent = u.email || 'Signed in';
      }else{
        el.textContent = 'Not signed in';
      }
    });
  }

  async function mount(rootId='sf-header-root'){
    applyLegacyRedirect();

    let mountEl = document.getElementById(rootId);
    if (!mountEl){
      mountEl = document.createElement('div');
      mountEl.id = rootId;
      document.body.insertBefore(mountEl, document.body.firstChild);
    }

    // Default header (no admin links yet)
    mountEl.innerHTML = headerHtml('');
    wireMenu();
    updateAuthLabel();

    // If Firebase is present, decide whether to inject admin-only links
    if (global.firebase?.auth){
      firebase.auth().onAuthStateChanged(async user=>{
        if (!user) return;

        const role = await getUserRole();
        if (role === 'admin' || role === 'manager'){
          const adminLinks = ADMIN_ONLY_PAGES.map(p =>
            `<a href="${p.href}" ${isActive(p.href)?'aria-current="page"':''}>${p.label}</a>`
          ).join('');

          mountEl.innerHTML = headerHtml(adminLinks);
          wireMenu();
          updateAuthLabel();
        }
      });
    }
  }

  global.SkyFarmHeader = { mount };
})(window);

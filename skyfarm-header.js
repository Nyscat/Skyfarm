// SkyFarm shared header — injects a consistent nav with Diary, Map, and Database menu
// Usage in each HTML file:
//   <link rel="stylesheet" href="skyfarm-shared.css">
//   <div id="sf-header-root"></div>
//   <script src="skyfarm-header.js"></script>
//   <script>SkyFarmHeader.mount();</script>

(function(global){
  const PAGES = {
    diary: { href: 'skyfarm-diary.html',  label: 'Diary' },
    map:   { href: 'skyfarm-map.html',    label: 'Map' },
  };
  // Items to live inside the Database dropdown
  const DATABASE_ITEMS = [
    { href:'skyfarm-livestock.html',   label:'Livestock' },
    { href:'skyfarm-chemical.html',    label:'Chemicals' },
    { href:'skyfarm-seed.html',        label:'Seeds' },
    { href:'skyfarm-barcode.html',     label:'Barcode Scanner' },
    { href:'skyfarm-admin-users.html', label:'Users & Roles' }
  ];

  // Back-compat redirects (optional): if an old URL is used, you can redirect here
  const LEGACY_REDIRECTS = {
    'skyfarm-chemical-inventory.html':'skyfarm-chemical.html'
  };

  function applyLegacyRedirect(){
    const path = (location.pathname.split('/').pop() || '').toLowerCase();
    if (LEGACY_REDIRECTS[path]) location.replace(LEGACY_REDIRECTS[path]);
  }

  function currentFile(){
    return (location.pathname.split('/').pop() || '').toLowerCase();
  }

  function isActive(href){
    const f = currentFile();
    return f === href.toLowerCase();
  }

  function brandHtml(){
    const logo = 'https://raw.githubusercontent.com/Nyscat/Skyfarm/main/FF9D2A05-6AC0-45E5-95EB-659A0A11E8D0_1_105_c.jpeg';
    return `<a class="sf-brand" href="index.html" title="Home">
      <img src="${logo}" alt="SkyFarm logo"><span>SkyFarm</span>
    </a>`;
  }

  function navHtml(){
    const diaryA = `<a href="${PAGES.diary.href}" ${isActive(PAGES.diary.href)?'aria-current="page"':''}>${PAGES.diary.label}</a>`;
    const mapA   = `<a href="${PAGES.map.href}"   ${isActive(PAGES.map.href)?'aria-current="page"':''}>${PAGES.map.label}</a>`;

    const dbBtn  = `<button class="sf-menu-btn" type="button" aria-expanded="${isDatabaseOpen()}">Database ▾</button>`;
    const dbList = `<div class="sf-menu-list">
      ${DATABASE_ITEMS.map(it=>`<a href="${it.href}" ${isActive(it.href)?'aria-current="page"':''}>${it.label}</a>`).join('')}
    </div>`;

    return `<nav class="sf-nav">
      ${diaryA}
      ${mapA}
      <div class="sf-menu" id="sf-menu">${dbBtn}${dbList}</div>
    </nav>`;
  }

  function isDatabaseOpen(){ return false; }

  function headerHtml(){
    return `<div class="sf-header"><div class="bar">
      ${brandHtml()}
      ${navHtml()}
      <div class="sf-spacer"></div>
      <span id="sf-auth" class="sf-auth">Connecting…</span>
    </div></div>`;
  }

  function wireMenu(){
    const menu = document.getElementById('sf-menu');
    if (!menu) return;
    const btn = menu.querySelector('.sf-menu-btn');
    const list = menu.querySelector('.sf-menu-list');
    function open(){ menu.classList.add('open'); btn.setAttribute('aria-expanded','true'); }
    function close(){ menu.classList.remove('open'); btn.setAttribute('aria-expanded','false'); }

    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      if (menu.classList.contains('open')) close(); else open();
    });
    document.addEventListener('click', (e)=>{
      if (!menu.contains(e.target)) close();
    });
    // keyboard
    btn.addEventListener('keydown', (e)=>{ if(e.key==='Escape') close(); });
  }

  function tryShowAuth(){
    try {
      if (global.firebase?.auth) {
        const el = document.getElementById('sf-auth');
        firebase.auth().onAuthStateChanged(u=>{
          el.textContent = u ? (u.isAnonymous ? 'Connected (guest)' : 'Signed in') : 'Connecting…';
        });
      }
    } catch(_) {}
  }

  function mount(rootId='sf-header-root'){
    applyLegacyRedirect();
    const mountEl = document.getElementById(rootId) || document.body.insertBefore(document.createElement('div'), document.body.firstChild);
    if (mountEl && !mountEl.id) mountEl.id = rootId;
    mountEl.innerHTML = headerHtml();
    wireMenu();
    tryShowAuth();
  }

  global.SkyFarmHeader = { mount };
})(window);

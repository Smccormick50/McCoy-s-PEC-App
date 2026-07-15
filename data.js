// PCE Estimator — app shell, routing, and rendering.
// Depends on data.js, db.js, model.js loaded first.

const state = { projects: [], currentProject: null };
let saveTimer = null;

const ICONS = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.8 12.2A2 2 0 0 1 14.2 21H9.8a2 2 0 0 1-2-1.8L7 7"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4l11-11-4-4L4 16v4z"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.2"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M12 16V5m0 0-4 4m4-4 4 4M5 20h14"/></svg>',
  duplicate: '<svg viewBox="0 0 24 24"><path d="M9 9h10v10H9zM5 15V5h10" /></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 13l4 4 10-10"/></svg>',
  print: '<svg viewBox="0 0 24 24"><path d="M6 9V4h12v5M6 18H5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1M6 14h12v6H6z"/></svg>'
};

function brandMark(caption) {
  return `<div class="brandmark">
    <img src="mccoys-logo.png" alt="McCoy's Building Supply" class="brand-logo">
    ${caption ? `<span class="brand-caption">${caption}</span>` : ''}
  </div>`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const attr = escapeHtml;

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1800);
}

function relativeDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const diffDay = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDay <= 0) return 'today';
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return diffDay + ' days ago';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function scheduleSave(project) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    touch(project);
    DB.put(project).catch(err => { console.error('Autosave failed:', err); toast("⚠️ Couldn't save changes"); });
  }, 400);
}
async function saveNow(project) {
  clearTimeout(saveTimer);
  touch(project);
  try {
    await DB.put(project);
  } catch (err) {
    console.error('Save failed:', err);
    toast("⚠️ Couldn't save changes");
  }
}

function go(hash) { location.hash = hash; }

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'view' && parts[1]) return { view: 'view', id: parts[1] };
  if (parts[0] === 'edit' && parts[1]) return { view: 'edit', id: parts[1] };
  return { view: 'list' };
}

async function renderRoute() {
  const r = parseRoute();
  const app = document.getElementById('app');
  document.body.classList.toggle('is-edit', r.view === 'edit');

  try {
    if (r.view === 'view') {
      const p = await DB.get(r.id);
      if (!p) { go('#/list'); return; }
      state.currentProject = p;
      app.innerHTML = viewTemplate(p);
      bindViewEvents(p);
    } else if (r.view === 'edit') {
      const p = await DB.get(r.id);
      if (!p) { go('#/list'); return; }
      state.currentProject = p;
      app.innerHTML = editTemplate(p);
      bindEditEvents(p);
    } else {
      state.currentProject = null;
      state.projects = await DB.getAll();
      app.innerHTML = listTemplate(state.projects);
      bindListEvents();
    }
  } catch (err) {
    console.error('Storage error:', err);
    document.body.classList.remove('is-edit');
    app.innerHTML = storageErrorTemplate(err);
    const retryBtn = document.getElementById('btnRetryStorage');
    if (retryBtn) retryBtn.addEventListener('click', () => renderRoute());
  }
  app.dataset.booted = '1';
  window.scrollTo(0, 0);
}

function storageErrorTemplate(err) {
  const detail = err ? `${err.name || ''} ${err.message || ''}`.trim() || String(err) : 'Unknown error';
  return `
  <header class="topbar">${brandMark('PCE Estimator')}</header>
  <main class="list-main">
    <div class="empty-state">
      <div class="empty-mark" style="border-color:var(--bad); color:var(--bad);">!</div>
      <h2>⚠️ Can't access local storage</h2>
      <p>This browser tab won't let the app save data — and it failed even with a fallback storage method, so this is likely <strong>Private/Incognito browsing</strong>, Safari's "Block All Cookies", an ad/privacy blocker, or a corporate IT browser policy blocking site data entirely.</p>
      <p class="muted" style="margin-top:14px;">Try a normal (non-private) window, a different browser, or a personal (non-managed) device, then tap below.</p>
      <pre style="white-space:pre-wrap;word-break:break-word;background:#fff;border:1px solid rgba(0,0,0,0.1);border-radius:6px;padding:10px;font-size:11.5px;text-align:left;margin-top:14px;">Technical detail: ${escapeHtml(detail)}</pre>
      <button class="btn" id="btnRetryStorage" style="margin:18px auto 0; max-width:200px;">Try again</button>
    </div>
  </main>`;
}

// ---------------- LIST VIEW ----------------

function listTemplate(projects) {
  const sorted = [...projects].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return `
  <header class="topbar">
    ${brandMark('PCE Estimator')}
    <button class="icon-btn" id="btnImport" title="Import JSON">${ICONS.upload}</button>
  </header>
  <main class="list-main">
    ${sorted.length === 0 ? emptyStateTemplate() : `
      <div class="list-toolbar">
        <span class="list-count">${sorted.length} project${sorted.length === 1 ? '' : 's'}</span>
        <button class="link-btn" id="btnExportAll">${ICONS.download} Export all</button>
      </div>
      <div class="card-list">${sorted.map(projectCard).join('')}</div>
    `}
    <button class="danger-link" id="btnNukeAll">⚠️ Erase All App Data (troubleshooting)</button>
  </main>
  <button class="fab" id="btnNew">${ICONS.plus}<span>New Project</span></button>
  `;
}

function emptyStateTemplate() {
  return `<div class="empty-state">
    <div class="empty-mark">PCE</div>
    <h2>🏗️ No projects yet</h2>
    <p>Start a new project cost estimate, or import a JSON file you exported earlier.</p>
  </div>`;
}

function projectCard(p) {
  const total = computeTotal(p);
  const statusLabel = p.status === 'final' ? 'FINAL' : 'DRAFT';
  return `
  <article class="card" data-id="${p.id}" data-name="${attr(p.name)}">
    <div class="card-stamp ${p.status === 'final' ? 'stamp-final' : 'stamp-draft'}">${statusLabel}</div>
    <div class="card-main" data-action="open">
      <div class="card-code">${escapeHtml(p.projectNumber || '— — — —')}</div>
      <h3 class="card-title">${escapeHtml(p.name)}</h3>
      <p class="card-sub">${escapeHtml(p.store || 'No store set')}</p>
      <div class="card-total">${formatCurrency(total)}</div>
      <div class="card-meta">Updated ${relativeDate(p.updatedAt)}</div>
    </div>
    <div class="card-actions">
      <button class="icon-btn" data-action="edit" title="Edit">${ICONS.edit}</button>
      <button class="icon-btn" data-action="duplicate" title="Duplicate">${ICONS.duplicate}</button>
      <button class="icon-btn danger" data-action="delete" title="Delete">${ICONS.trash}</button>
    </div>
  </article>`;
}

function notifyStorageError(err) {
  console.error('Storage error:', err);
  const detail = (err && (err.name || err.message)) ? `${err.name || ''} ${err.message || ''}`.trim() : String(err);
  alert("⚠️ Couldn't save — this browser tab is blocking all local storage (both IndexedDB and localStorage), which is common in Private/Incognito mode, with \"Block All Cookies\" enabled in Safari, or under some corporate IT browser policies. Try a normal window, a different browser, or a non-managed device.\n\nTechnical detail: " + detail);
}

async function nukeAllData() {
  if (!confirm("ERASE EVERYTHING?\n\nThis deletes all projects and photos saved in this browser for this app. Only use this for troubleshooting if the app won't save or load correctly.\n\nThis CANNOT be undone.")) return;
  if (!confirm('Are you absolutely sure? This is your last chance to cancel.')) return;
  try {
    await DB.nukeAll();
  } catch (err) {
    console.error('Nuke failed:', err);
  }
  alert('✅ All app data erased. The page will now reload.');
  location.reload();
}

function bindListEvents() {
  const nukeBtn = document.getElementById('btnNukeAll');
  if (nukeBtn) nukeBtn.addEventListener('click', nukeAllData);

  document.getElementById('btnNew').addEventListener('click', async () => {
    try {
      const p = newProject('Untitled Project');
      await DB.put(p);
      go('#/edit/' + p.id);
    } catch (err) { notifyStorageError(err); }
  });
  document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importInput').click());
  const exportAllBtn = document.getElementById('btnExportAll');
  if (exportAllBtn) exportAllBtn.addEventListener('click', async () => {
    try {
      exportAllProjects(await DB.getAll());
      toast('📤 Exported all projects');
    } catch (err) { notifyStorageError(err); }
  });

  document.querySelectorAll('.card').forEach(card => {
    const id = card.dataset.id;
    const name = card.dataset.name;
    card.querySelector('[data-action="open"]').addEventListener('click', () => go('#/view/' + id));
    card.querySelector('[data-action="edit"]').addEventListener('click', e => { e.stopPropagation(); go('#/edit/' + id); });
    card.querySelector('[data-action="duplicate"]').addEventListener('click', async e => {
      e.stopPropagation();
      try {
        const original = await DB.get(id);
        await DB.put(cloneProject(original));
        toast('🗂️ Project duplicated');
        renderRoute();
      } catch (err) { notifyStorageError(err); }
    });
    card.querySelector('[data-action="delete"]').addEventListener('click', async e => {
      e.stopPropagation();
      if (confirm(`Delete "${name}"? This can't be undone.`)) {
        try {
          await DB.delete(id);
          toast('🗑️ Project deleted');
          renderRoute();
        } catch (err) { notifyStorageError(err); }
      }
    });
  });
}

// ---------------- VIEW (read-only summary) ----------------

function viewTemplate(p) {
  const subtotal = computeSubtotal(p);
  const tax = computeTax(p);
  const total = computeTotal(p);
  const divSummary = computeDivisionSummary(p).filter(d => d.amount !== 0);
  const depSummary = computeDepreciationSummary(p).filter(d => d.amount !== 0);
  const images = p.photos.filter(isImageAttachment);
  const documents = p.photos.filter(ph => !isImageAttachment(ph));
  const categoryRows = p.categories.map(cat => {
    const sub = computeCategorySubtotal(cat);
    if (sub === 0) return '';
    return `<tr><td class="code">${escapeHtml(cat.code)}</td><td>${escapeHtml(cat.title)}</td><td class="amt">${formatCurrency(sub)}</td></tr>`;
  }).join('');

  return `
  <header class="topbar">
    <button class="icon-btn no-print" id="btnBack">${ICONS.back}</button>
    ${brandMark('Project Cost Estimate')}
    <button class="icon-btn no-print" id="btnEdit">${ICONS.edit}</button>
  </header>
  <main class="view-main printable">
    <span class="status-pill ${p.status === 'final' ? 'pill-final' : 'pill-draft'}">${p.status === 'final' ? 'Final' : 'Draft'}</span>
    <h2 class="proj-name">${escapeHtml(p.name)}</h2>

    <section class="info-grid">
      <div><span class="label">Store</span><span class="value">${escapeHtml(p.store) || '—'}</span></div>
      <div><span class="label">Project No.</span><span class="value">${escapeHtml(p.projectNumber) || '—'}</span></div>
      <div><span class="label">Estimator</span><span class="value">${escapeHtml(p.estimator) || '—'}</span></div>
      <div><span class="label">Date</span><span class="value">${formatDateDisplay(p.date)}</span></div>
      <div><span class="label">Approved By</span><span class="value">${escapeHtml(p.approvedBy) || '—'}</span></div>
      <div><span class="label">Approved Date</span><span class="value">${formatDateDisplay(p.approvedDate)}</span></div>
      <div><span class="label">Start</span><span class="value">${formatDateDisplay(p.startDate)}</span></div>
      <div><span class="label">End</span><span class="value">${formatDateDisplay(p.endDate)}</span></div>
    </section>

    <section class="cost-summary">
      <div class="cost-row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
      <div class="cost-row"><span>Tax (${num(p.taxRate).toFixed(2)}%)</span><span>${formatCurrency(tax)}</span></div>
      <div class="cost-row total"><span>Total</span><span>${formatCurrency(total)}</span></div>
    </section>

    <section class="ledger-block">
      <h3>🧾 Cost Categories</h3>
      <table class="ledger-table"><tbody>${categoryRows || '<tr><td class="muted">No costs entered yet.</td></tr>'}</tbody></table>
    </section>

    <section class="ledger-block">
      <h3>🏗️ CSI Division Summary</h3>
      <table class="ledger-table"><tbody>${
        divSummary.length
          ? divSummary.map(d => `<tr><td class="code">${d.code}</td><td>${escapeHtml(d.name)}</td><td class="amt">${formatCurrency(d.amount)}</td></tr>`).join('')
          : '<tr><td class="muted">No costs entered yet.</td></tr>'
      }</tbody></table>
    </section>

    <section class="ledger-block">
      <h3>💰 CapEx Depreciation Summary</h3>
      <table class="ledger-table"><tbody>${
        depSummary.length
          ? depSummary.map(d => `<tr><td colspan="2">${escapeHtml(d.term)}</td><td class="amt">${formatCurrency(d.amount)}</td></tr>`).join('')
          : '<tr><td class="muted">No costs entered yet.</td></tr>'
      }</tbody></table>
    </section>

    ${p.notes ? `<section class="ledger-block"><h3>📝 Notes</h3><p class="notes-text">${escapeHtml(p.notes)}</p></section>` : ''}

    ${images.length ? `<section class="ledger-block">
      <h3>📷 Photos</h3>
      <div class="photo-grid">${images.map(photoThumb).join('')}</div>
    </section>` : ''}
    ${!images.length && !documents.length ? `<section class="ledger-block">
      <h3>📷 Photos &amp; Files</h3>
      <p class="muted">No photos or files added yet.</p>
    </section>` : ''}

    <div class="action-row no-print">
      <button class="btn" id="btnDuplicate">${ICONS.duplicate}<span>Duplicate</span></button>
      <button class="btn" id="btnExport">${ICONS.download}<span>Export JSON</span></button>
      <button class="btn" id="btnPrint">${ICONS.print}<span>Download PDF</span></button>
      <button class="btn danger" id="btnDelete">${ICONS.trash}<span>Delete</span></button>
    </div>
  </main>
  ${documents.map(documentPageTemplate).join('')}`;
}

function documentPageTemplate(file) {
  const isPdf = (file.mimeType || '').includes('pdf');
  const body = isPdf
    ? `<embed src="${file.dataUrl}" type="application/pdf" class="doc-embed">`
    : `<div class="doc-placeholder">
         <span class="file-card-icon">${fileIcon()}</span>
         <p>This file type can't be displayed inline — use "Open" to view it, or find it in an exported JSON backup.</p>
       </div>`;
  return `
  <section class="doc-page printable">
    <div class="doc-page-header">
      <span class="file-card-icon">${fileIcon()}</span>
      <div>
        <h4>${escapeHtml(file.fileName || 'Attached file')}</h4>
        ${file.caption ? `<p class="doc-caption">${escapeHtml(file.caption)}</p>` : ''}
      </div>
      <a class="link-btn no-print" href="${file.dataUrl}" download="${attr(file.fileName || 'file')}">${ICONS.download} Open</a>
    </div>
    ${body}
  </section>`;
}

function isImageAttachment(file) {
  return file.isImage !== false && (!file.mimeType || file.mimeType.startsWith('image/'));
}

function fileIcon() {
  return '<svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/></svg>';
}

function photoThumb(photo) {
  if (isImageAttachment(photo)) {
    return `<figure class="photo-thumb"><img src="${photo.dataUrl}" data-action="zoom-photo" alt="${attr(photo.caption || 'project photo')}">${photo.caption ? `<figcaption>${escapeHtml(photo.caption)}</figcaption>` : ''}</figure>`;
  }
  return `<a class="file-card" href="${photo.dataUrl}" download="${attr(photo.fileName || 'file')}">
    <span class="file-card-icon">${fileIcon()}</span>
    <span class="file-card-name">${escapeHtml(photo.fileName || 'File')}</span>
    ${photo.caption ? `<span class="file-card-caption">${escapeHtml(photo.caption)}</span>` : ''}
  </a>`;
}

function openLightbox(src) {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.innerHTML = `<img src="${src}">`;
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

function bindViewEvents(p) {
  document.getElementById('btnBack').addEventListener('click', () => go('#/list'));
  document.getElementById('btnEdit').addEventListener('click', () => go('#/edit/' + p.id));
  document.getElementById('btnDuplicate').addEventListener('click', async () => {
    try {
      const copy = cloneProject(p);
      await DB.put(copy);
      toast('🗂️ Duplicated');
      go('#/edit/' + copy.id);
    } catch (err) { notifyStorageError(err); }
  });
  document.getElementById('btnExport').addEventListener('click', () => { exportProject(p); toast('📤 Exported'); });
  document.getElementById('btnPrint').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `${ICONS.print}<span>Generating…</span>`;
    let pdfResult = null;
    try {
      pdfResult = await exportProjectPdf(p);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('⚠️ Could not generate the PDF.\n\nTechnical detail: ' + (err && (err.name || err.message) ? `${err.name || ''} ${err.message || ''}`.trim() : String(err)));
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      return;
    }

    // Show a real tappable download link.
    // We never auto-trigger programmatic downloads — browsers lose the
    // "user gesture" context after async work, causing navigations instead
    // of file saves. A real <a> the user taps is 100% reliable everywhere.
    btn.disabled = false;
    btn.innerHTML = originalHtml;

    const overlay = document.createElement('div');
    overlay.id = 'pdfOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(14,74,42,0.82);z-index:500;display:flex;align-items:center;justify-content:center;padding:24px;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:28px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.35);">
        <div style="font-size:36px;margin-bottom:10px;">📄</div>
        <p style="margin:0 0 20px;font-weight:600;font-size:16px;color:#1a1a1a;">PDF ready!</p>
        <a href="${pdfResult.url}" download="${pdfResult.filename}"
           style="display:block;background:#f5d116;color:#0e4a2a;font-weight:700;font-size:15px;padding:14px;border-radius:8px;text-decoration:none;margin-bottom:12px;"
           onclick="setTimeout(()=>{document.getElementById('pdfOverlay')?.remove();URL.revokeObjectURL('${pdfResult.url}');},1500)">
          ⬇️ Save PDF
        </a>
        <button onclick="document.getElementById('pdfOverlay').remove();URL.revokeObjectURL('${pdfResult.url}');"
                style="background:none;border:none;color:#7a7565;font-size:13px;cursor:pointer;padding:4px;">
          Cancel
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
    // Dismiss on backdrop tap
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) { overlay.remove(); URL.revokeObjectURL(pdfResult.url); }
    });
  });
  document.getElementById('btnDelete').addEventListener('click', async () => {
    if (confirm(`Delete "${p.name}"? This can't be undone.`)) {
      try {
        await DB.delete(p.id);
        toast('🗑️ Project deleted');
        go('#/list');
      } catch (err) { notifyStorageError(err); }
    }
  });
  document.querySelectorAll('[data-action="zoom-photo"]').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src));
  });
}

// ---------------- EDIT (full form) ----------------

function editTemplate(p) {
  return `
  <header class="topbar">
    <button class="icon-btn" id="btnBack">${ICONS.back}</button>
    ${brandMark('Edit Estimate')}
    <button class="icon-btn" id="btnDone">${ICONS.check}</button>
  </header>
  <main class="edit-main">
    <section class="edit-block">
      <h3>📋 Project Info</h3>
      <label class="field"><span>Project Name</span><input type="text" id="f-name" value="${attr(p.name)}"></label>
      <div class="field-row">
        <label class="field"><span>🏪 Store</span><input type="text" id="f-store" value="${attr(p.store)}"></label>
        <label class="field"><span>Project No.</span><input type="text" id="f-projectNumber" value="${attr(p.projectNumber)}"></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Estimator</span><input type="text" id="f-estimator" value="${attr(p.estimator)}"></label>
        <label class="field"><span>Tax Rate %</span><input type="number" step="0.01" id="f-taxRate" value="${num(p.taxRate)}"></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Date</span><input type="date" id="f-date" value="${attr(p.date)}"></label>
        <label class="field"><span>Approved Date</span><input type="date" id="f-approvedDate" value="${attr(p.approvedDate)}"></label>
      </div>
      <label class="field"><span>Approved By</span><input type="text" id="f-approvedBy" value="${attr(p.approvedBy)}"></label>
      <div class="field-row">
        <label class="field"><span>Start Date</span><input type="date" id="f-startDate" value="${attr(p.startDate)}"></label>
        <label class="field"><span>End Date</span><input type="date" id="f-endDate" value="${attr(p.endDate)}"></label>
      </div>
      <label class="field"><span>Status</span>
        <select id="f-status">
          <option value="draft" ${p.status === 'draft' ? 'selected' : ''}>Draft</option>
          <option value="final" ${p.status === 'final' ? 'selected' : ''}>Final</option>
        </select>
      </label>
    </section>

    <section class="edit-block">
      <div class="block-header"><h3>🧾 Cost Categories</h3><button class="link-btn" id="btnAddCategory">${ICONS.plus} Add category</button></div>
      <div id="categoryList">${p.categories.map(categoryEditTemplate).join('')}</div>
    </section>

    <section class="edit-block">
      <div class="block-header">
        <h3>📷 Photos &amp; Files</h3>
        <div class="block-header-actions">
          <button class="link-btn" id="btnTakePhoto">${ICONS.camera} Take photo</button>
          <button class="link-btn" id="btnAddPhoto">${ICONS.upload} Add files</button>
        </div>
      </div>
      <div class="dropzone" id="photoDropzone">
        <div class="photo-grid" id="photoGrid">${p.photos.map(photoEditTemplate).join('')}</div>
        <p class="dropzone-hint">${p.photos.length ? 'Drag and drop to add more' : 'Drag and drop photos or files here, or use the buttons above'}</p>
      </div>
    </section>

    <section class="edit-block">
      <h3>📝 Notes</h3>
      <textarea id="f-notes" rows="4" placeholder="Anything else worth noting about this estimate...">${escapeHtml(p.notes)}</textarea>
    </section>
  </main>

  <footer class="sticky-summary">
    <div><span class="ss-label">Subtotal</span><span id="ss-subtotal">${formatCurrency(computeSubtotal(p))}</span></div>
    <div><span class="ss-label">Tax</span><span id="ss-tax">${formatCurrency(computeTax(p))}</span></div>
    <div class="ss-total"><span class="ss-label">Total</span><span id="ss-total">${formatCurrency(computeTotal(p))}</span></div>
  </footer>`;
}

function categoryEditTemplate(cat) {
  const subtotal = computeCategorySubtotal(cat);
  return `
  <details class="category" data-cat-id="${cat.id}">
    <summary>
      <span class="cat-code">${escapeHtml(cat.code)}</span>
      <input class="cat-title-input" data-field="title" value="${attr(cat.title)}">
      <span class="cat-subtotal" data-cat-subtotal>${formatCurrency(subtotal)}</span>
      <button class="icon-btn danger small" data-action="delete-category" title="Delete category">${ICONS.trash}</button>
    </summary>
    <div class="items">
      ${cat.items.map(it => itemEditTemplate(it, cat.id)).join('')}
      <button class="link-btn add-item-btn" data-action="add-item" data-cat-id="${cat.id}">${ICONS.plus} Add line item</button>
    </div>
  </details>`;
}

function itemEditTemplate(it, catId) {
  return `
  <div class="item-row" data-item-id="${it.id}" data-cat-id="${catId}">
    <input class="item-name" data-field="name" value="${attr(it.name)}" placeholder="Line item">
    <input class="item-vendor" data-field="vendor" value="${attr(it.vendor)}" placeholder="Vendor / Contractor">
    <div class="item-amount-row">
      <span class="dollar">$</span>
      <input class="item-amount" data-field="amount" type="number" inputmode="decimal" step="0.01" value="${it.amount ? num(it.amount) : ''}" placeholder="0.00">
      <button class="tax-toggle ${it.taxable ? 'tax-on' : ''}" data-action="toggle-tax" title="Taxable">${it.taxable ? 'TAX' : 'NT'}</button>
      <button class="icon-btn danger small" data-action="delete-item" title="Remove line">${ICONS.trash}</button>
    </div>
  </div>`;
}

function photoEditTemplate(photo) {
  const preview = isImageAttachment(photo)
    ? `<img src="${photo.dataUrl}" data-action="zoom-photo">`
    : `<a class="file-card-preview" href="${photo.dataUrl}" download="${attr(photo.fileName || 'file')}">
         <span class="file-card-icon">${fileIcon()}</span>
         <span class="file-card-name">${escapeHtml(photo.fileName || 'File')}</span>
       </a>`;
  return `
  <figure class="photo-thumb editable" data-photo-id="${photo.id}">
    ${preview}
    <input class="photo-caption" data-field="caption" placeholder="Caption (optional)" value="${attr(photo.caption)}">
    <button class="icon-btn danger small photo-delete" data-action="delete-photo" title="Remove photo">${ICONS.trash}</button>
  </figure>`;
}

function updateSummaryBar(p) {
  const sb = document.getElementById('ss-subtotal');
  const tb = document.getElementById('ss-tax');
  const ttb = document.getElementById('ss-total');
  if (sb) sb.textContent = formatCurrency(computeSubtotal(p));
  if (tb) tb.textContent = formatCurrency(computeTax(p));
  if (ttb) ttb.textContent = formatCurrency(computeTotal(p));
}

function updateCategorySubtotal(catId, p) {
  const cat = p.categories.find(c => c.id === catId);
  if (!cat) return;
  const el = document.querySelector(`[data-cat-id="${catId}"] [data-cat-subtotal]`);
  if (el) el.textContent = formatCurrency(computeCategorySubtotal(cat));
}

function rerenderEdit(p, keepOpenCatId) {
  const openIds = Array.from(document.querySelectorAll('.category[open]')).map(d => d.dataset.catId);
  if (keepOpenCatId && !openIds.includes(keepOpenCatId)) openIds.push(keepOpenCatId);
  document.getElementById('app').innerHTML = editTemplate(p);
  bindEditEvents(p);
  openIds.forEach(id => {
    const el = document.querySelector(`.category[data-cat-id="${id}"]`);
    if (el) el.setAttribute('open', '');
  });
}

function bindEditEvents(p) {
  document.getElementById('btnBack').addEventListener('click', async () => { await saveNow(p); go('#/view/' + p.id); });
  document.getElementById('btnDone').addEventListener('click', async () => { await saveNow(p); go('#/view/' + p.id); });

  function bindField(id, setter) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => { setter(el.value); scheduleSave(p); });
  }
  bindField('f-name', v => p.name = v || 'Untitled Project');
  bindField('f-store', v => p.store = v);
  bindField('f-projectNumber', v => p.projectNumber = v);
  bindField('f-estimator', v => p.estimator = v);
  bindField('f-taxRate', v => { p.taxRate = num(v); updateSummaryBar(p); });
  bindField('f-date', v => p.date = v);
  bindField('f-approvedDate', v => p.approvedDate = v);
  bindField('f-approvedBy', v => p.approvedBy = v);
  bindField('f-startDate', v => p.startDate = v);
  bindField('f-endDate', v => p.endDate = v);
  bindField('f-notes', v => p.notes = v);
  const statusEl = document.getElementById('f-status');
  if (statusEl) statusEl.addEventListener('change', e => { p.status = e.target.value; scheduleSave(p); });

  document.getElementById('btnAddCategory').addEventListener('click', () => {
    const code = (prompt('Category code (e.g. 0099):', '0099') || '0099').trim();
    const title = (prompt('Category title:', 'New Category') || 'New Category').trim();
    p.categories.push({ id: uid('cat'), code, title, depreciationTerm: 'Added Item', items: [] });
    scheduleSave(p);
    rerenderEdit(p);
  });

  document.getElementById('btnTakePhoto').addEventListener('click', () => document.getElementById('photoCameraInput').click());
  document.getElementById('btnAddPhoto').addEventListener('click', () => document.getElementById('photoInput').click());

  const dropzone = document.getElementById('photoDropzone');
  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
  });
  ['dragleave', 'dragend'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
      if (evt === 'dragleave' && dropzone.contains(e.relatedTarget)) return;
      dropzone.classList.remove('drag-over');
    });
  });
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      handleFiles(e.dataTransfer.files);
    }
  });

  const catList = document.getElementById('categoryList');

  catList.querySelectorAll('.cat-title-input, [data-action="delete-category"]').forEach(el => {
    el.addEventListener('click', e => e.stopPropagation());
  });
  catList.querySelectorAll('.cat-title-input').forEach(el => {
    el.addEventListener('input', e => {
      const catId = e.target.closest('[data-cat-id]').dataset.catId;
      const cat = p.categories.find(c => c.id === catId);
      if (cat) { cat.title = e.target.value; scheduleSave(p); }
    });
  });

  catList.addEventListener('click', e => {
    const delCatBtn = e.target.closest('[data-action="delete-category"]');
    if (delCatBtn) {
      const catId = delCatBtn.closest('[data-cat-id]').dataset.catId;
      const cat = p.categories.find(c => c.id === catId);
      if (cat && confirm(`Delete category "${cat.title}" and all its line items?`)) {
        p.categories = p.categories.filter(c => c.id !== catId);
        scheduleSave(p);
        rerenderEdit(p);
      }
      return;
    }
    const addItemBtn = e.target.closest('[data-action="add-item"]');
    if (addItemBtn) {
      const catId = addItemBtn.dataset.catId;
      const cat = p.categories.find(c => c.id === catId);
      if (cat) {
        cat.items.push({ id: uid('item'), name: '', vendor: '', amount: 0, taxable: true, division: '01' });
        scheduleSave(p);
        rerenderEdit(p, catId);
      }
      return;
    }
    const delItemBtn = e.target.closest('[data-action="delete-item"]');
    if (delItemBtn) {
      const row = delItemBtn.closest('.item-row');
      const cat = p.categories.find(c => c.id === row.dataset.catId);
      if (cat) {
        cat.items = cat.items.filter(it => it.id !== row.dataset.itemId);
        scheduleSave(p);
        rerenderEdit(p, row.dataset.catId);
      }
      return;
    }
    const taxBtn = e.target.closest('[data-action="toggle-tax"]');
    if (taxBtn) {
      const row = taxBtn.closest('.item-row');
      const cat = p.categories.find(c => c.id === row.dataset.catId);
      const item = cat && cat.items.find(it => it.id === row.dataset.itemId);
      if (item) {
        item.taxable = !item.taxable;
        taxBtn.classList.toggle('tax-on', item.taxable);
        taxBtn.textContent = item.taxable ? 'TAX' : 'NT';
        scheduleSave(p);
        updateSummaryBar(p);
        updateCategorySubtotal(row.dataset.catId, p);
      }
    }
  });

  catList.addEventListener('input', e => {
    const row = e.target.closest('.item-row');
    const field = e.target.dataset.field;
    if (!row || !field) return;
    const cat = p.categories.find(c => c.id === row.dataset.catId);
    const item = cat && cat.items.find(it => it.id === row.dataset.itemId);
    if (!item) return;
    item[field] = field === 'amount' ? num(e.target.value) : e.target.value;
    scheduleSave(p);
    if (field === 'amount') {
      updateSummaryBar(p);
      updateCategorySubtotal(row.dataset.catId, p);
    }
  });

  const photoGrid = document.getElementById('photoGrid');
  photoGrid.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-action="delete-photo"]');
    if (delBtn) {
      const photoId = delBtn.closest('[data-photo-id]').dataset.photoId;
      if (confirm('Remove this photo?')) {
        p.photos = p.photos.filter(ph => ph.id !== photoId);
        scheduleSave(p);
        rerenderEdit(p);
      }
      return;
    }
    const img = e.target.closest('[data-action="zoom-photo"]');
    if (img) openLightbox(img.src);
  });
  photoGrid.addEventListener('input', e => {
    if (e.target.dataset.field !== 'caption') return;
    const photoId = e.target.closest('[data-photo-id]').dataset.photoId;
    const photo = p.photos.find(ph => ph.id === photoId);
    if (photo) { photo.caption = e.target.value; scheduleSave(p); }
  });
}

// ---------------- Photo / file capture ----------------

const MAX_FILE_BYTES = 20 * 1024 * 1024; // soft warning threshold, not a hard block

function resizeImageFile(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function handleFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length || !state.currentProject) return;
  toast('📷 Adding ' + (files.length > 1 ? `${files.length} files` : 'file') + '…');
  let oversizeWarned = false;
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES && !oversizeWarned) {
      toast(`⚠️ Heads up — "${file.name}" is large and may be slow to load`);
      oversizeWarned = true;
    }
    const isImage = file.type.startsWith('image/');
    try {
      const dataUrl = isImage ? await resizeImageFile(file, 1600, 0.72) : await readFileAsDataURL(file);
      state.currentProject.photos.push({
        id: uid('photo'),
        dataUrl,
        mimeType: file.type || (isImage ? 'image/jpeg' : 'application/octet-stream'),
        fileName: file.name || (isImage ? 'photo.jpg' : 'file'),
        isImage,
        caption: '',
        addedAt: new Date().toISOString()
      });
    } catch (err) { console.error('File failed:', err); }
  }
  await saveNow(state.currentProject);
  renderRoute();
}

async function handlePhotoFiles(e) {
  await handleFiles(e.target.files);
  e.target.value = '';
}

async function handleImportFile(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const projects = parseImportedJSON(text);
    for (const proj of projects) await DB.put(proj);
    toast(`📥 Imported ${projects.length} project${projects.length === 1 ? '' : 's'}`);
    go('#/list');
    renderRoute();
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
}

// ---------------- Init ----------------

function init() {
  document.getElementById('importInput').addEventListener('change', handleImportFile);
  document.getElementById('photoInput').addEventListener('change', handlePhotoFiles);
  document.getElementById('photoCameraInput').addEventListener('change', handlePhotoFiles);
  window.addEventListener('hashchange', renderRoute);
  window.addEventListener('beforeunload', () => {
    if (state.currentProject) { touch(state.currentProject); DB.put(state.currentProject); }
  });
  renderRoute();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

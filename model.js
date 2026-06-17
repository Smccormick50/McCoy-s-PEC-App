// Business logic for projects: creation, calculations, import/export.
// Depends on data.js (CATEGORY_TEMPLATE, DIVISIONS, DEPRECIATION_ORDER) being loaded first.

function uid(prefix) {
  return (prefix ? prefix + '-' : '') + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function freshCategoriesFromTemplate() {
  return CATEGORY_TEMPLATE.map(cat => ({
    id: uid('cat'),
    code: cat.code,
    title: cat.title,
    depreciationTerm: cat.depreciationTerm,
    items: cat.items.map(it => ({
      id: uid('item'),
      name: it.name,
      vendor: it.vendor || '',
      amount: 0,
      taxable: it.taxable,
      division: it.division
    }))
  }));
}

function newProject(name) {
  const now = new Date().toISOString();
  const todayLocal = new Date().toISOString().slice(0, 10);
  return {
    id: uid('proj'),
    schema: 1,
    name: name && name.trim() ? name.trim() : 'Untitled Project',
    store: '',
    projectNumber: '',
    taxRate: 8.25,
    estimator: '',
    approvedBy: '',
    date: todayLocal,
    approvedDate: '',
    startDate: '',
    endDate: '',
    status: 'draft',
    notes: '',
    categories: freshCategoriesFromTemplate(),
    photos: [],
    createdAt: now,
    updatedAt: now
  };
}

function cloneProject(project, newName) {
  const copy = JSON.parse(JSON.stringify(project));
  copy.id = uid('proj');
  copy.name = newName || (project.name + ' (Copy)');
  copy.status = 'draft';
  const now = new Date().toISOString();
  copy.createdAt = now;
  copy.updatedAt = now;
  copy.categories.forEach(cat => {
    cat.id = uid('cat');
    cat.items.forEach(it => { it.id = uid('item'); });
  });
  copy.photos.forEach(p => { p.id = uid('photo'); });
  return copy;
}

function num(v) {
  const n = parseFloat(v);
  return isFinite(n) ? n : 0;
}

function allItems(project) {
  const out = [];
  project.categories.forEach(cat => cat.items.forEach(it => out.push({ item: it, category: cat })));
  return out;
}

function computeSubtotal(project) {
  return allItems(project).reduce((sum, { item }) => sum + num(item.amount), 0);
}

function computeTax(project) {
  const rate = num(project.taxRate) / 100;
  return allItems(project).reduce((sum, { item }) => sum + (item.taxable ? num(item.amount) * rate : 0), 0);
}

function computeTotal(project) {
  return computeSubtotal(project) + computeTax(project);
}

function computeCategorySubtotal(category) {
  return category.items.reduce((sum, it) => sum + num(it.amount), 0);
}

function computeDivisionSummary(project) {
  const sums = {};
  allItems(project).forEach(({ item }) => {
    const code = item.division || '01';
    sums[code] = (sums[code] || 0) + num(item.amount);
  });
  return Object.keys(sums)
    .sort()
    .map(code => ({ code, name: DIVISIONS[code] || 'Other', amount: sums[code] }));
}

function computeDepreciationSummary(project) {
  const sums = {};
  allItems(project).forEach(({ item, category }) => {
    const term = category.depreciationTerm || 'Other';
    sums[term] = (sums[term] || 0) + num(item.amount);
  });
  const ordered = DEPRECIATION_ORDER.filter(t => t in sums);
  Object.keys(sums).forEach(t => { if (!ordered.includes(t)) ordered.push(t); });
  return ordered.map(term => ({ term, amount: sums[term] }));
}

function formatCurrency(n) {
  const v = num(n);
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  return sign + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateDisplay(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y}`;
}

function touch(project) {
  project.updatedAt = new Date().toISOString();
}

// ---- Import / Export ----

function downloadJSON(filename, dataObj) {
  const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportProject(project) {
  const safeName = (project.name || 'project').replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '_');
  downloadJSON(`PCE_${safeName || 'project'}.json`, { type: 'pce-project', version: 1, project });
}

function exportAllProjects(projects) {
  downloadJSON(`PCE_all_projects_${new Date().toISOString().slice(0,10)}.json`, {
    type: 'pce-project-list', version: 1, projects
  });
}

// Accepts JSON text, returns an array of project objects (validated/normalized).
function parseImportedJSON(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('That file is not valid JSON.');
  }

  let candidates = [];
  if (Array.isArray(data)) {
    candidates = data;
  } else if (data && data.type === 'pce-project-list' && Array.isArray(data.projects)) {
    candidates = data.projects;
  } else if (data && data.type === 'pce-project' && data.project) {
    candidates = [data.project];
  } else if (data && data.categories) {
    candidates = [data];
  } else {
    throw new Error('This JSON file does not look like a PCE project export.');
  }

  return candidates.map(p => normalizeImportedProject(p));
}

function normalizeImportedProject(p) {
  const base = newProject(p.name || 'Imported Project');
  const merged = Object.assign({}, base, p);
  merged.id = uid('proj');
  if (!Array.isArray(merged.categories) || merged.categories.length === 0) {
    merged.categories = base.categories;
  } else {
    merged.categories = merged.categories.map(cat => ({
      id: uid('cat'),
      code: cat.code || '0000',
      title: cat.title || 'Untitled Category',
      depreciationTerm: cat.depreciationTerm || 'Added Item',
      items: (cat.items || []).map(it => ({
        id: uid('item'),
        name: it.name || '',
        vendor: it.vendor || '',
        amount: num(it.amount),
        taxable: !!it.taxable,
        division: it.division || '01'
      }))
    }));
  }
  merged.photos = Array.isArray(merged.photos) ? merged.photos.map(ph => ({
    id: uid('photo'),
    dataUrl: ph.dataUrl,
    mimeType: ph.mimeType || 'image/jpeg',
    fileName: ph.fileName || '',
    isImage: ph.isImage !== false,
    caption: ph.caption || '',
    addedAt: ph.addedAt || new Date().toISOString()
  })).filter(ph => !!ph.dataUrl) : [];
  merged.updatedAt = new Date().toISOString();
  return merged;
}

// pedigree.js — the reusable ancestor-tree renderer (Build Brief B2). The
// pedigree is entirely DERIVED from Dog.sire_id / Dog.dam_id (Data Model §7),
// so there's no pedigree table and no charting dependency to vendor: an ancestor
// pedigree is a fixed binary structure (each dog has exactly a sire slot and a
// dam slot), which we lay out ourselves with a classic "leaves get rows,
// parents center over their children" pass and draw with absolutely-positioned
// nodes over an SVG connector layer.
//
// Dogs with unknown parents render as a visible placeholder node (never a
// truncated branch). Clicking a node re-centers the tree on that dog via the
// caller-supplied onNavigate; a small link opens the dog's full record.
import { dogRepo } from '../data/dogRepo.js';
import { esc, fmtDate } from './ui.js';

const NODE_W = 190;
const NODE_H = 56;
const COL_GAP = 46;
const ROW_H = 74;
const SEX_BORDER = { male: '#3f78b5', female: '#8a52b5', unknown: '#9aa4b0' };

// Build the ancestor tree rooted at rootId, `generations` ancestor levels deep.
// A known dog at depth < generations always gets sire+dam children (placeholders
// when the parent is unknown/missing). Placeholders and dogs at the deepest
// level are leaves.
function buildTree(rootId, byId, generations) {
  let leafSeq = 0;
  function node(dogId, depth) {
    const dog = dogId ? byId.get(dogId) : null;
    const n = { dogId, dog, depth, placeholder: !dog };
    if (dog && depth < generations) {
      n.sire = node(dog.sire_id || null, depth + 1);
      n.dam = node(dog.dam_id || null, depth + 1);
    }
    return n;
  }
  const root = node(rootId, 0);

  // Vertical layout: each leaf claims the next row; each internal node centers
  // between its two children.
  let maxDepth = 0;
  (function assign(n) {
    maxDepth = Math.max(maxDepth, n.depth);
    if (n.sire && n.dam) {
      assign(n.sire); assign(n.dam);
      n.row = (n.sire.row + n.dam.row) / 2;
    } else {
      n.row = leafSeq++;
    }
  })(root);

  return { root, leafCount: leafSeq, maxDepth };
}

function flatten(root) {
  const out = [];
  (function walk(n) { out.push(n); if (n.sire) walk(n.sire); if (n.dam) walk(n.dam); })(root);
  return out;
}

function nodeHtml(n) {
  if (n.placeholder) {
    return `<div class="ped-node ped-unknown" style="width:${NODE_W}px;height:${NODE_H}px;">
      <span class="faint">Unknown</span>
    </div>`;
  }
  const d = n.dog;
  const dob = d.date_of_birth ? fmtDate(d.date_of_birth) : '';
  const reg = d.registered_name ? `<div class="ped-reg">${esc(d.registered_name)}</div>` : '';
  return `<div class="ped-node" style="width:${NODE_W}px;height:${NODE_H}px;border-left-color:${SEX_BORDER[d.sex] || SEX_BORDER.unknown};">
    <div class="ped-main">
      <a href="#" class="ped-name" data-nav="${esc(d.id)}" title="Re-center on this dog">${esc(d.call_name || '(unnamed)')}</a>
      ${d.is_archived ? '<span class="badge badge-gray ped-arch">arch</span>' : ''}
      <a class="ped-open" href="dog.html?id=${encodeURIComponent(d.id)}" title="Open record">↗</a>
    </div>
    ${reg}
    ${dob ? `<div class="ped-dob faint">${esc(dob)}</div>` : ''}
  </div>`;
}

// renderPedigree({ mount, rootId, generations=3, onNavigate })
//   onNavigate(dogId) — called when a node name is clicked (re-center). If
//   omitted, name clicks fall back to navigating to the pedigree page.
export async function renderPedigree({ mount, rootId, generations = 3, onNavigate }) {
  const dogs = await dogRepo.getAll({ includeArchived: true });
  const byId = new Map(dogs.map((d) => [d.id, d]));
  const rootDog = byId.get(rootId);

  if (!rootDog) {
    mount.innerHTML = `<div class="empty-state">Dog not found.</div>`;
    return;
  }

  const { root, leafCount, maxDepth } = buildTree(rootId, byId, generations);
  const nodes = flatten(root);

  const width = (maxDepth + 1) * NODE_W + maxDepth * COL_GAP;
  const height = Math.max(leafCount, 1) * ROW_H;

  const cx = (n) => n.depth * (NODE_W + COL_GAP);              // left edge
  const cyCenter = (n) => n.row * ROW_H + ROW_H / 2;           // vertical center

  // Connector paths: from a parent's right edge to each child's left edge (elbow).
  const paths = [];
  for (const n of nodes) {
    for (const child of [n.sire, n.dam]) {
      if (!child) continue;
      const x1 = cx(n) + NODE_W, y1 = cyCenter(n);
      const x2 = cx(child), y2 = cyCenter(child);
      const midX = x1 + COL_GAP / 2;
      paths.push(`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`);
    }
  }

  const nodesHtml = nodes.map((n) => {
    const top = cyCenter(n) - NODE_H / 2;
    return `<div class="ped-pos" style="left:${cx(n)}px;top:${top}px;">${nodeHtml(n)}</div>`;
  }).join('');

  mount.innerHTML = `
    <div class="ped-scroll">
      <div class="ped-canvas" style="width:${width}px;height:${height}px;">
        <svg class="ped-lines" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          ${paths.map((d) => `<path d="${d}" fill="none" stroke="var(--border-strong)" stroke-width="1.5"/>`).join('')}
        </svg>
        ${nodesHtml}
      </div>
    </div>`;

  mount.querySelectorAll('[data-nav]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.dataset.nav;
      if (onNavigate) onNavigate(id);
      else location.href = `pedigree.html?id=${encodeURIComponent(id)}`;
    });
  });
}

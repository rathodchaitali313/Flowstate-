/* ============================================================
   FLOWSTATE — App Logic & Simulation Engine
   ============================================================ */

// ── State ────────────────────────────────────────────────────
const state = {
  mode: 'splash',
  fanMode: 'entry',
  tick: 0,
  zones: {
    A: { name: 'Gate A', density: 0.42, trend: 0,  prediction: 0.50 },
    B: { name: 'Gate B', density: 0.82, trend: 1,  prediction: 0.93 },
    C: { name: 'Gate C', density: 0.28, trend: -1, prediction: 0.25 },
    D: { name: 'Gate D', density: 0.15, trend: -1, prediction: 0.12 },
    E: { name: 'Gate E', density: 0.61, trend: 1,  prediction: 0.75 },
    F: { name: 'Gate F', density: 0.55, trend: 0,  prediction: 0.60 },
  },
  alerts: [],
  predictions: [],
  fanDot: { x: 200, y: 150, tx: 200, ty: 150 },
  offerVisible: true,
};

const GATE_POSITIONS = {
  A: { x: 200, y: 19 },
  B: { x: 334, y: 51 },
  C: { x: 376, y: 150 },
  D: { x: 334, y: 249 },
  E: { x: 200, y: 281 },
  F: { x: 24,  y: 150 },
};

// ── Screen Navigation ─────────────────────────────────────────
function showView(view) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });
  if (view === 'splash') {
    document.getElementById('splash').classList.add('active');
  } else if (view === 'fan') {
    document.getElementById('fan-view').classList.add('active');
    initFanView();
  } else if (view === 'staff') {
    document.getElementById('staff-view').classList.add('active');
    initStaffView();
  }
  state.mode = view;
}

// ── Fan View ──────────────────────────────────────────────────
function initFanView() {
  renderFanGates();
  renderFanRoute();
  animateFanDot();
}

function setFanMode(mode) {
  state.fanMode = mode;
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + mode).classList.add('active');
  document.getElementById('fan-mode-label').textContent =
    mode === 'entry' ? 'Entry Mode' : mode === 'halftime' ? 'Halftime Mode' : 'Exit Mode';

  const fac = document.getElementById('fan-facilities');
  if (mode === 'halftime') {
    fac.style.display = 'block';
    renderFacilities();
  } else {
    fac.style.display = 'none';
  }
  renderFanRoute();
}

function dismissOffer() {
  const banner = document.getElementById('fan-offer-banner');
  banner.style.opacity = '0';
  banner.style.transform = 'translateY(-10px)';
  banner.style.transition = 'all 0.3s ease';
  setTimeout(() => banner.style.display = 'none', 300);
}

function getStatusColor(density) {
  if (density < 0.5) return 'green';
  if (density < 0.75) return 'amber';
  return 'red';
}

function getETA(density) {
  if (density < 0.5)  return `${Math.round(1 + density * 3)} min`;
  if (density < 0.75) return `${Math.round(6 + density * 6)} min`;
  return `${Math.round(18 + density * 10)} min`;
}

function getCrowdLabel(density) {
  if (density < 0.3)  return 'Nearly empty';
  if (density < 0.5)  return 'Light crowd';
  if (density < 0.7)  return 'Moderate crowd';
  if (density < 0.85) return 'Heavy crowd';
  return 'Overcrowded';
}

function renderFanGates() {
  const grid = document.getElementById('fan-gates-grid');
  const entries = Object.entries(state.zones);
  grid.innerHTML = entries.map(([key, z]) => {
    const color = getStatusColor(z.density);
    const pct   = Math.round(z.density * 100);
    return `
      <div class="gate-card ${color}" id="fan-gate-${key}">
        <div class="gate-name">GATE ${key}</div>
        <div class="gate-eta" style="color:var(--${color === 'green' ? 'green' : color === 'amber' ? 'amber' : 'danger'})">${getETA(z.density)}</div>
        <div class="gate-crowd">${getCrowdLabel(z.density)}</div>
        <div class="gate-bar"><div class="gate-bar-fill" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');

  // Also update SVG density overlays
  Object.entries(state.zones).forEach(([key, z]) => {
    const el = document.getElementById('density-' + key);
    if (!el) return;
    const [r, g, b] = densityColor(z.density);
    el.setAttribute('fill', `rgba(${r},${g},${b},${0.1 + z.density * 0.35})`);
    const rect = document.getElementById('gate-' + key + '-rect');
    if (rect) {
      const color = getStatusColor(z.density);
      const stroke = color === 'green' ? '#00e676' : color === 'amber' ? '#ff9f00' : '#ff3366';
      rect.setAttribute('stroke', stroke);
    }
  });
}

function densityColor(d) {
  if (d < 0.5) {
    // cyan → green
    const t = d / 0.5;
    return [Math.round(0 * (1-t) + 0 * t), Math.round(212 * (1-t) + 230 * t), Math.round(255 * (1-t) + 118 * t)];
  } else {
    // amber → red
    const t = (d - 0.5) / 0.5;
    return [Math.round(255), Math.round(159 * (1-t) + 51 * t), Math.round(0 * (1-t) + 102 * t)];
  }
}

function getBestGate() {
  const entries = Object.entries(state.zones);
  return entries.reduce((best, [k, z]) =>
    z.density < best[1].density ? [k, z] : best, entries[0]);
}
function getWorstGate() {
  const entries = Object.entries(state.zones);
  return entries.reduce((worst, [k, z]) =>
    z.density > worst[1].density ? [k, z] : worst, entries[0]);
}

function renderFanRoute() {
  const [bestKey, bestZone] = getBestGate();
  const [worstKey, worstZone] = getWorstGate();
  const pos = GATE_POSITIONS[bestKey];

  const fanDot   = state.fanDot;
  const routePath = document.getElementById('fan-route-path');
  if (routePath && pos) {
    const cx = (fanDot.x + pos.x) / 2;
    const cy = Math.min(fanDot.y, pos.y) - 30;
    routePath.setAttribute('d', `M ${fanDot.x} ${fanDot.y} Q ${cx} ${cy} ${pos.x} ${pos.y}`);
  }

  const title = document.getElementById('fan-route-title');
  const eta   = document.getElementById('fan-route-eta');
  const reason = document.getElementById('fan-route-reason');

  if (state.fanMode === 'entry') {
    if (title)  title.textContent = `Head to Gate ${bestKey}`;
    if (eta)    eta.textContent   = `ETA: ~${getETA(bestZone.density)} walk`;
    if (reason) reason.textContent = `Gate ${worstKey} is congested (${getCrowdLabel(worstZone.density)}). Gate ${bestKey} is ${Math.round((1 - bestZone.density / worstZone.density) * 100)}% less crowded right now.`;
  } else if (state.fanMode === 'halftime') {
    if (title)  title.textContent = `Restroom — Section 112`;
    if (eta)    eta.textContent   = `ETA: ~1 min walk`;
    if (reason) reason.textContent = `The nearest restroom is at 20% capacity. The one on Concourse 3 has a 15-person queue — routing you away from that.`;
  } else {
    if (title)  title.textContent = `Exit via Gate ${bestKey}`;
    if (eta)    eta.textContent   = `Least crowded exit right now`;
    if (reason) reason.textContent = `Staggered exit guidance active. Take exit ramp 3-C to reach the south transit plaza in ~4 minutes. Avoid Gate ${worstKey} — heavy outbound crush forming.`;
  }

  // Move fan dot target
  state.fanDot.tx = pos ? pos.x - 40 : 200;
  state.fanDot.ty = pos ? pos.y + 20 : 150;
}

function renderFacilities() {
  const grid = document.getElementById('fan-facilities-grid');
  const facilities = [
    { icon: '🚻', name: 'Restroom Sec. 112', wait: '~1 min' },
    { icon: '🌭', name: 'Concession 3A',     wait: '~4 min wait' },
    { icon: '🚻', name: 'Restroom Sec. 224', wait: '~8 min (busy)' },
    { icon: '🍺', name: 'Bar — Gate C Side', wait: '~2 min wait' },
  ];
  grid.innerHTML = facilities.map(f => `
    <div class="facility-card">
      <span class="fac-icon">${f.icon}</span>
      <div>
        <div class="fac-name">${f.name}</div>
        <div class="fac-wait">${f.wait}</div>
      </div>
    </div>`).join('');
}

function animateFanDot() {
  const dot   = document.getElementById('fan-dot');
  const outer = document.getElementById('fan-dot-outer');
  const pulse = document.getElementById('fan-dot-pulse');

  function step() {
    if (state.mode !== 'fan') return;
    state.fanDot.x += (state.fanDot.tx - state.fanDot.x) * 0.04;
    state.fanDot.y += (state.fanDot.ty - state.fanDot.y) * 0.04;

    // tiny organic wobble
    const wx = state.fanDot.x + Math.sin(Date.now() / 900) * 2;
    const wy = state.fanDot.y + Math.cos(Date.now() / 700) * 2;

    [dot, outer, pulse].forEach(el => {
      if (el) {
        el.setAttribute('cx', wx);
        el.setAttribute('cy', wy);
      }
    });
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Staff Dashboard ───────────────────────────────────────────
let heatmapCtx = null;

function initStaffView() {
  const canvas = document.getElementById('heatmap-canvas');
  if (canvas) heatmapCtx = canvas.getContext('2d');
  pushAlert({ level: 'red',   zone: 'Gate B',      msg: 'Gate B approaching critical capacity', sub: 'Current: 82% — Predicted: 93% in 7 min', action: 'Deploy 3 ushers to Gate B' });
  pushAlert({ level: 'amber', zone: 'Gate E',      msg: 'Gate E density rising fast',            sub: 'Current: 61% — Predicted: 75% in 11 min', action: 'Open overflow lane' });
  pushAlert({ level: 'amber', zone: 'Concourse 3', msg: 'Concourse 3 foot traffic surge detected', sub: 'Halftime exodus predicted in ~9 min', action: 'Pre-position staff at junctions' });
  renderPredictions();
  renderZones();
  renderHeatmap();
}

function pushAlert({ level, zone, msg, sub, action }) {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  state.alerts.unshift({ level, zone, msg, sub, action, time });
  if (state.alerts.length > 10) state.alerts.pop();
  renderAlerts();
}

function renderAlerts() {
  const feed = document.getElementById('alert-feed');
  if (!feed) return;
  feed.innerHTML = state.alerts.map((a, i) => `
    <div class="alert-item ${a.level}">
      <div class="alert-top">
        <span class="alert-type">${a.level.toUpperCase()}</span>
        <span style="font-size:0.75rem;font-weight:600">${a.zone}</span>
        <span class="alert-time">${a.time}</span>
      </div>
      <div class="alert-msg">${a.msg}</div>
      <div class="alert-sub">${a.sub}</div>
      ${a.action ? `<button class="alert-action" onclick="resolveAlert(${i})">⚡ ${a.action}</button>` : ''}
    </div>`).join('');

  const badge = document.getElementById('alert-count-badge');
  const count = document.getElementById('stat-alerts');
  const redAlerts = state.alerts.filter(a => a.level === 'red').length;
  if (badge) badge.textContent = state.alerts.length;
  if (count) count.textContent = state.alerts.length;
}

function resolveAlert(idx) {
  state.alerts[idx].level = 'green';
  state.alerts[idx].sub   = '✓ Resolved — Staff deployed';
  state.alerts[idx].action = null;
  renderAlerts();
  // small density reduction
  const zone = state.alerts[idx].zone.replace('Gate ', '');
  if (state.zones[zone]) {
    state.zones[zone].density = Math.max(0.1, state.zones[zone].density - 0.2);
    state.zones[zone].trend = -1;
  }
}

function renderPredictions() {
  const preds = [
    { icon: '⚠️',  text: 'Concourse 3 will exceed safe capacity',     time: 'in 9 min' },
    { icon: '📈',  text: 'Gate B congestion will spill to adjacent zones', time: 'in 12 min' },
    { icon: '🚶',  text: 'Halftime flow surge on North Concourse',     time: 'in 15 min' },
    { icon: '✅',  text: 'Gate D will become underutilized',           time: 'in 5 min' },
    { icon: '🔄',  text: 'Recommend opening auxiliary Gate G',         time: 'in 8 min' },
  ];
  const feed = document.getElementById('prediction-feed');
  if (!feed) return;
  feed.innerHTML = preds.map(p => `
    <div class="pred-item">
      <span class="pred-icon">${p.icon}</span>
      <span class="pred-text">${p.text}</span>
      <span class="pred-time">${p.time}</span>
    </div>`).join('');
}

function renderZones() {
  const grid = document.getElementById('zones-grid');
  if (!grid) return;
  grid.innerHTML = Object.entries(state.zones).map(([key, z]) => {
    const pct = Math.round(z.density * 100);
    const color = getStatusColor(z.density);
    const trendClass = z.trend > 0 ? 'trend-up' : z.trend < 0 ? 'trend-down' : 'trend-flat';
    const trendIcon  = z.trend > 0 ? '↑ Rising' : z.trend < 0 ? '↓ Falling' : '→ Stable';
    const [r, g, b] = densityColor(z.density);
    return `
      <div class="zone-card ${color}" id="zone-card-${key}">
        <div class="zone-label">Gate ${key}</div>
        <div class="zone-pct">${pct}%</div>
        <div class="zone-bar"><div class="zone-bar-fill" style="width:${pct}%; background:rgb(${r},${g},${b})"></div></div>
        <div class="zone-trend ${trendClass}">${trendIcon}</div>
      </div>`;
  }).join('');
}

function renderHeatmap() {
  const canvas = document.getElementById('heatmap-canvas');
  const svg    = document.getElementById('staff-venue-svg');
  if (!canvas || !heatmapCtx || !svg) return;

  const rect = svg.getBoundingClientRect();
  if (rect.width === 0) {
    requestAnimationFrame(renderHeatmap);
    return;
  }

  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight;
  canvas.width  = W;
  canvas.height = H;

  const scaleX = W / 400;
  const scaleY = H / 300;

  heatmapCtx.clearRect(0, 0, W, H);

  Object.entries(state.zones).forEach(([key, z]) => {
    const pos = GATE_POSITIONS[key];
    const cx  = pos.x * scaleX;
    const cy  = pos.y * scaleY;
    const rad = (60 + z.density * 60) * Math.min(scaleX, scaleY);

    const gradient = heatmapCtx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    const [r, g, b] = densityColor(z.density);
    gradient.addColorStop(0,   `rgba(${r},${g},${b},${0.7 * z.density})`);
    gradient.addColorStop(0.5, `rgba(${r},${g},${b},${0.35 * z.density})`);
    gradient.addColorStop(1,   `rgba(${r},${g},${b},0)`);

    heatmapCtx.beginPath();
    heatmapCtx.arc(cx, cy, rad, 0, Math.PI * 2);
    heatmapCtx.fillStyle = gradient;
    heatmapCtx.fill();
  });
}

// ── Simulation Engine ─────────────────────────────────────────
let simInterval = null;
let tickCounter = 0;

function startSimulation() {
  if (simInterval) clearInterval(simInterval);
  simInterval = setInterval(simulate, 2000);
}

function simulate() {
  tickCounter++;

  // Evolve densities
  Object.entries(state.zones).forEach(([key, z]) => {
    // Organic drift with momentum
    const drift = (Math.random() - 0.48) * 0.05;
    const momentum = z.trend * 0.015;
    z.density = Math.max(0.05, Math.min(0.98, z.density + drift + momentum));

    // Occasional trend reversal
    if (Math.random() < 0.08) z.trend *= -1;

    // Prediction is slightly ahead of current density
    z.prediction = Math.min(0.99, z.density + z.trend * 0.12 + (Math.random() - 0.5) * 0.03);
  });

  // Randomly inject a spike
  if (tickCounter % 8 === 0) {
    const keys = Object.keys(state.zones);
    const spike = keys[Math.floor(Math.random() * keys.length)];
    state.zones[spike].density = Math.min(0.95, state.zones[spike].density + 0.15);
    state.zones[spike].trend = 1;
  }

  // Trigger new alert when zone goes critical
  Object.entries(state.zones).forEach(([key, z]) => {
    if (z.density > 0.85 && Math.random() < 0.3) {
      const eta = Math.round(3 + Math.random() * 9);
      pushAlert({
        level: z.density > 0.9 ? 'red' : 'amber',
        zone: `Gate ${key}`,
        msg: `Gate ${key} approaching ${z.density > 0.9 ? 'critical' : 'high'} density`,
        sub: `Current: ${Math.round(z.density * 100)}% — Predicted: ${Math.round(z.prediction * 100)}% in ${eta} min`,
        action: `Redirect flow from Gate ${key}`,
      });
    }
  });

  // Update global stats
  const avgCap = Object.values(state.zones).reduce((s, z) => s + z.density, 0) / 6;
  const statCap = document.getElementById('stat-cap');
  if (statCap) statCap.textContent = Math.round(avgCap * 100) + '%';

  const bestETA = Math.round(3 + Math.random() * 10);
  const statPred = document.getElementById('stat-pred');
  if (statPred) statPred.textContent = bestETA + ' min';

  const statTotal = document.getElementById('stat-total');
  if (statTotal) {
    const fans = 10000 + Math.round(avgCap * 7000);
    statTotal.textContent = fans.toLocaleString();
  }

  // Update offer text
  const [bestKey] = getBestGate();
  const offerText = document.getElementById('fan-offer-text');
  if (offerText) offerText.textContent = `Head to Gate ${bestKey} now — $2 off your first drink!`;

  // Update fan offer banner gate
  if (state.mode === 'fan') {
    renderFanGates();
    renderFanRoute();
  }
  if (state.mode === 'staff') {
    renderZones();
    renderHeatmap();
    renderAlerts();
  }
}

// ── On Load ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  startSimulation();
});

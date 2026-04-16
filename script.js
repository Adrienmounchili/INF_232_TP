// ============================================
// AGRESTE — Script principal
// ============================================

const SUPABASE_URL = "https://grzylagpezndxpiyvmcf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyenlsYWdwZXpuZHhwaXl2bWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNzQ5NTcsImV4cCI6MjA5MTc1MDk1N30.scu7emDG2keOam8zhDeV3vcsPKG8XP3aQAjcilWlm4I";

let supabaseClient;
let allData = [];

// ---- INIT ----
document.addEventListener("DOMContentLoaded", () => {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  setupNavigation();
  navigateTo("dashboard");
});

// ---- NAVIGATION ----
function setupNavigation() {
  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.addEventListener("click", () => navigateTo(tab.dataset.section));
  });
}

function navigateTo(section) {
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelector(`[data-section="${section}"]`).classList.add("active");
  document.getElementById(section).classList.add("active");

  switch (section) {
    case "dashboard": loadDashboard(); break;
    case "collecte": setupForm(); break;
    case "analyse": loadAnalyse(); break;
    case "regression": loadRegression(); break;
    case "export": loadExport(); break;
  }
}

// ---- FETCH DATA ----
function normalizeResponseRow(row) {
  return {
    id: row.id,
    created_at: row.created_at,
    age: row.age ?? null,
    annee_etude: row.annee_etude ?? null,
    heures_code: row.heures_code ?? row.heures_code_semaine ?? null,
    langage: row.langage ?? row.langage_prefere ?? null,
    utilise_ia: typeof row.utilise_ia === "boolean"
      ? row.utilise_ia
      : typeof row.outils_ia === "boolean"
        ? row.outils_ia
        : null,
    autonomie: row.autonomie ?? row.niveau_autonomie ?? null,
    satisfaction: row.satisfaction ?? row.satisfaction_etudes ?? null,
    projets: row.projets ?? row.projets_realises ?? null
  };
}

async function fetchData() {
  const { data, error } = await supabaseClient.from("reponses").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return (data || []).map(normalizeResponseRow);
}

// ---- UTILS ----
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1));
}
function r(v) { return isNaN(v) ? "0.00" : v.toFixed(2); }

// ---- DASHBOARD ----
async function loadDashboard() {
  const el = document.getElementById("dashboard");
  el.querySelector(".dashboard-content").innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Chargement...</div>';

  allData = await fetchData();

  if (!allData.length) {
    el.querySelector(".dashboard-content").innerHTML = '<div class="empty-state"><i class="fas fa-database"></i><p>Aucune donnée collectée pour le moment.<br>Rendez-vous dans l\'onglet <strong>Collecte</strong> pour commencer.</p></div>';
    return;
  }

  const heures = allData.map(d => d.heures_code).filter(v => v != null);
  const autonomie = allData.map(d => d.autonomie).filter(v => v != null);
  const satisfaction = allData.map(d => d.satisfaction).filter(v => v != null);
  const ia = allData.filter(d => d.utilise_ia === true);
  const pctIA = (ia.length / allData.length * 100);

  const annees = {};
  allData.forEach(d => { if (d.annee_etude) annees[d.annee_etude] = (annees[d.annee_etude] || 0) + 1; });

  el.querySelector(".dashboard-content").innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label"><i class="fas fa-users"></i> Réponses totales</div><div class="kpi-value">${allData.length}</div></div>
      <div class="kpi-card"><div class="kpi-label"><i class="fas fa-clock"></i> Moy. heures/semaine</div><div class="kpi-value">${r(mean(heures))}</div></div>
      <div class="kpi-card"><div class="kpi-label"><i class="fas fa-brain"></i> Moy. autonomie</div><div class="kpi-value">${r(mean(autonomie))}/10</div></div>
      <div class="kpi-card"><div class="kpi-label"><i class="fas fa-smile"></i> Moy. satisfaction</div><div class="kpi-value">${r(mean(satisfaction))}/10</div></div>
      <div class="kpi-card"><div class="kpi-label"><i class="fas fa-robot"></i> Utilisent l'IA</div><div class="kpi-value">${r(pctIA)}%</div></div>
    </div>
    <div class="chart-container">
      <h3>Répartition par année d'étude</h3>
      <div class="chart-wrapper"><canvas id="chartAnnees"></canvas></div>
    </div>
  `;

  const labels = ["L1","L2","L3","M1","M2"];
  const values = labels.map(l => annees[l] || 0);
  new Chart(document.getElementById("chartAnnees"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Nombre", data: values, backgroundColor: "#10b981", borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: "#94a3b8" }, grid: { color: "#334155" } }, x: { ticks: { color: "#94a3b8" }, grid: { display: false } } } }
  });
}

// ---- COLLECTE ----
let formSetup = false;

function setupForm() {
  if (formSetup) return;
  formSetup = true;

  const form = document.getElementById("survey-form");
  const rangeAuto = document.getElementById("autonomie");
  const rangeSat = document.getElementById("satisfaction");
  const valAuto = document.getElementById("val-autonomie");
  const valSat = document.getElementById("val-satisfaction");
  const toggleBtns = document.querySelectorAll(".toggle-option");

  rangeAuto.addEventListener("input", () => valAuto.textContent = rangeAuto.value);
  rangeSat.addEventListener("input", () => valSat.textContent = rangeSat.value);

  toggleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      toggleBtns.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      document.getElementById("utilise_ia").value = btn.dataset.value;
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      age: parseInt(document.getElementById("age").value),
      annee_etude: document.getElementById("annee_etude").value,
      heures_code_semaine: parseFloat(document.getElementById("heures_code").value),
      langage_prefere: document.getElementById("langage").value,
      outils_ia: document.getElementById("utilise_ia").value === "true",
      niveau_autonomie: parseInt(rangeAuto.value),
      satisfaction_etudes: parseInt(rangeSat.value),
      projets_realises: parseInt(document.getElementById("projets").value)
    };

    const submitBtn = form.querySelector(".btn-primary");
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi...';

    const { error } = await supabaseClient.from("reponses").insert([payload]);

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer';

    if (error) {
      alert("Erreur : " + error.message);
    } else {
      document.getElementById("success-msg").classList.add("show");
      setTimeout(() => document.getElementById("success-msg").classList.remove("show"), 4000);
    }
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    form.reset();
    rangeAuto.value = 5; rangeSat.value = 5;
    valAuto.textContent = "5"; valSat.textContent = "5";
    toggleBtns.forEach(b => b.classList.remove("selected"));
    document.getElementById("utilise_ia").value = "";
    document.querySelectorAll(".error-msg").forEach(e => e.textContent = "");
    document.querySelectorAll(".error").forEach(e => e.classList.remove("error"));
    document.getElementById("success-msg").classList.remove("show");
  });
}

function validateForm() {
  let valid = true;
  const checks = [
    { id: "age", test: v => v >= 16 && v <= 70, msg: "Âge entre 16 et 70" },
    { id: "annee_etude", test: v => !!v, msg: "Sélectionnez une année" },
    { id: "heures_code", test: v => v >= 0 && v <= 100, msg: "Entre 0 et 100h" },
    { id: "langage", test: v => !!v, msg: "Sélectionnez un langage" },
    { id: "projets", test: v => v >= 0 && v <= 999, msg: "Nombre positif requis" },
  ];

  checks.forEach(({ id, test, msg }) => {
    const input = document.getElementById(id);
    const errEl = input.parentElement.querySelector(".error-msg");
    const val = input.value;
    if (!test(parseFloat(val) || val)) {
      input.classList.add("error");
      if (errEl) errEl.textContent = msg;
      valid = false;
    } else {
      input.classList.remove("error");
      if (errEl) errEl.textContent = "";
    }
  });

  const iaVal = document.getElementById("utilise_ia").value;
  const iaErr = document.querySelector("#ia-group .error-msg");
  if (iaVal === "") {
    if (iaErr) iaErr.textContent = "Sélectionnez une option";
    valid = false;
  } else {
    if (iaErr) iaErr.textContent = "";
  }

  return valid;
}

// ---- ANALYSE ----
let analysePage = 1;

async function loadAnalyse() {
  const el = document.getElementById("analyse");
  el.querySelector(".analyse-content").innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Chargement...</div>';

  allData = await fetchData();

  if (!allData.length) {
    el.querySelector(".analyse-content").innerHTML = '<div class="empty-state"><i class="fas fa-chart-bar"></i><p>Aucune donnée à analyser.</p></div>';
    return;
  }

  const ages = allData.map(d => d.age).filter(v => v != null);
  const heures = allData.map(d => d.heures_code).filter(v => v != null);
  const autonomie = allData.map(d => d.autonomie).filter(v => v != null);
  const satisfaction = allData.map(d => d.satisfaction).filter(v => v != null);
  const projets = allData.map(d => d.projets).filter(v => v != null);

  const langages = {};
  allData.forEach(d => { if (d.langage) langages[d.langage] = (langages[d.langage] || 0) + 1; });

  const autoByYear = {};
  allData.forEach(d => {
    if (d.annee_etude && d.autonomie != null) {
      if (!autoByYear[d.annee_etude]) autoByYear[d.annee_etude] = [];
      autoByYear[d.annee_etude].push(d.autonomie);
    }
  });

  el.querySelector(".analyse-content").innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Âge moyen</div><div class="stat-value">${r(mean(ages))}</div></div>
      <div class="stat-card"><div class="stat-label">Âge médian</div><div class="stat-value">${r(median(ages))}</div></div>
      <div class="stat-card"><div class="stat-label">Écart-type âge</div><div class="stat-value">${r(stddev(ages))}</div></div>
      <div class="stat-card"><div class="stat-label">Moy. heures/sem</div><div class="stat-value">${r(mean(heures))}</div></div>
      <div class="stat-card"><div class="stat-label">Médiane heures</div><div class="stat-value">${r(median(heures))}</div></div>
      <div class="stat-card"><div class="stat-label">Moy. projets</div><div class="stat-value">${r(mean(projets))}</div></div>
    </div>
    <div class="charts-grid">
      <div class="chart-container"><h3><i class="fas fa-chart-bar"></i> Histogramme des âges</h3><div class="chart-wrapper"><canvas id="chartAges"></canvas></div></div>
      <div class="chart-container"><h3><i class="fas fa-chart-pie"></i> Langages préférés</h3><div class="chart-wrapper"><canvas id="chartLangages"></canvas></div></div>
      <div class="chart-container"><h3><i class="fas fa-chart-bar"></i> Autonomie par année</h3><div class="chart-wrapper"><canvas id="chartAutoYear"></canvas></div></div>
      <div class="chart-container"><h3><i class="fas fa-chart-line"></i> Satisfaction vs Heures</h3><div class="chart-wrapper"><canvas id="chartSatHours"></canvas></div></div>
    </div>
    <div class="table-container">
      <h3>Dernières réponses</h3>
      <div id="analyse-table"></div>
    </div>
  `;

  // Histogramme âges
  const ageBins = {};
  ages.forEach(a => { const bin = Math.floor(a / 5) * 5; ageBins[bin] = (ageBins[bin] || 0) + 1; });
  const ageLabels = Object.keys(ageBins).sort((a, b) => a - b).map(b => `${b}-${parseInt(b)+4}`);
  const ageValues = Object.keys(ageBins).sort((a, b) => a - b).map(b => ageBins[b]);

  new Chart(document.getElementById("chartAges"), {
    type: "bar",
    data: { labels: ageLabels, datasets: [{ label: "Nombre", data: ageValues, backgroundColor: "#10b981", borderRadius: 6 }] },
    options: chartOpts()
  });

  // Langages pie
  const langLabels = Object.keys(langages);
  const langValues = Object.values(langages);
  const langColors = ["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#ec4899"];

  new Chart(document.getElementById("chartLangages"), {
    type: "doughnut",
    data: { labels: langLabels, datasets: [{ data: langValues, backgroundColor: langColors.slice(0, langLabels.length) }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: "#94a3b8" } } } }
  });

  // Autonomie par année
  const yearLabels = ["L1","L2","L3","M1","M2"];
  const yearAutoValues = yearLabels.map(y => autoByYear[y] ? mean(autoByYear[y]) : 0);

  new Chart(document.getElementById("chartAutoYear"), {
    type: "bar",
    data: { labels: yearLabels, datasets: [{ label: "Moy. Autonomie", data: yearAutoValues, backgroundColor: "#3b82f6", borderRadius: 6 }] },
    options: chartOpts()
  });

  // Satisfaction vs Heures (scatter)
  const scatterData = allData.filter(d => d.heures_code != null && d.satisfaction != null).map(d => ({ x: d.heures_code, y: d.satisfaction }));

  new Chart(document.getElementById("chartSatHours"), {
    type: "scatter",
    data: { datasets: [{ label: "Satisfaction vs Heures", data: scatterData, backgroundColor: "#f59e0b", pointRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: "Heures/semaine", color: "#94a3b8" }, ticks: { color: "#94a3b8" }, grid: { color: "#334155" } }, y: { title: { display: true, text: "Satisfaction", color: "#94a3b8" }, ticks: { color: "#94a3b8" }, grid: { color: "#334155" } } }, plugins: { legend: { display: false } } }
  });

  // Table
  analysePage = 1;
  renderTable();
}

function chartOpts() {
  return { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: "#94a3b8" }, grid: { color: "#334155" } }, x: { ticks: { color: "#94a3b8" }, grid: { display: false } } } };
}

function renderTable() {
  const perPage = 10;
  const total = allData.length;
  const pages = Math.ceil(total / perPage);
  const start = (analysePage - 1) * perPage;
  const slice = allData.slice(start, start + perPage);

  let html = `<table><thead><tr><th>Âge</th><th>Année</th><th>Heures</th><th>Langage</th><th>IA</th><th>Autonomie</th><th>Satisfaction</th><th>Projets</th></tr></thead><tbody>`;
  slice.forEach(d => {
    html += `<tr><td>${d.age}</td><td>${d.annee_etude}</td><td>${d.heures_code}</td><td>${d.langage}</td><td>${d.utilise_ia ? "Oui" : "Non"}</td><td>${d.autonomie}/10</td><td>${d.satisfaction}/10</td><td>${d.projets}</td></tr>`;
  });
  html += `</tbody></table>`;

  html += `<div class="pagination">`;
  html += `<button onclick="changePage(-1)" ${analysePage <= 1 ? "disabled" : ""}><i class="fas fa-chevron-left"></i> Préc.</button>`;
  for (let i = 1; i <= pages; i++) {
    html += `<button onclick="goToPage(${i})" class="${i === analysePage ? 'active' : ''}">${i}</button>`;
  }
  html += `<button onclick="changePage(1)" ${analysePage >= pages ? "disabled" : ""}>Suiv. <i class="fas fa-chevron-right"></i></button>`;
  html += `</div>`;

  document.getElementById("analyse-table").innerHTML = html;
}

function changePage(delta) { analysePage += delta; renderTable(); }
function goToPage(p) { analysePage = p; renderTable(); }

// ---- REGRESSION ----
async function loadRegression() {
  const el = document.getElementById("regression");
  el.querySelector(".regression-content").innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Chargement...</div>';

  allData = await fetchData();

  if (allData.length < 2) {
    el.querySelector(".regression-content").innerHTML = '<div class="empty-state"><i class="fas fa-chart-line"></i><p>Au moins 2 réponses nécessaires pour la régression.</p></div>';
    return;
  }

  const points = allData.filter(d => d.utilise_ia != null && d.autonomie != null).map(d => ({ x: d.utilise_ia ? 1 : 0, y: d.autonomie }));

  if (points.length < 2) {
    el.querySelector(".regression-content").innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Données insuffisantes.</p></div>';
    return;
  }

  const n = points.length;
  const xm = mean(points.map(p => p.x));
  const ym = mean(points.map(p => p.y));
  const ssxy = points.reduce((s, p) => s + (p.x - xm) * (p.y - ym), 0);
  const ssxx = points.reduce((s, p) => s + (p.x - xm) ** 2, 0);
  const a = ssxx !== 0 ? ssxy / ssxx : 0;
  const b = ym - a * xm;

  const ssres = points.reduce((s, p) => s + (p.y - (a * p.x + b)) ** 2, 0);
  const sstot = points.reduce((s, p) => s + (p.y - ym) ** 2, 0);
  const r2 = sstot !== 0 ? 1 - ssres / sstot : 0;

  let interpClass, interpText;
  if (r2 > 0.7) { interpClass = "strong"; interpText = "Forte corrélation — l'utilisation de l'IA est fortement liée à l'autonomie."; }
  else if (r2 > 0.3) { interpClass = "moderate"; interpText = "Corrélation modérée — une relation existe mais d'autres facteurs interviennent."; }
  else { interpClass = "weak"; interpText = "Faible corrélation — l'utilisation de l'IA n'explique pas significativement l'autonomie."; }

  el.querySelector(".regression-content").innerHTML = `
    <div class="regression-result">
      <h3><i class="fas fa-square-root-alt"></i> Résultats de la régression linéaire</h3>
      <p style="color:var(--text-secondary);margin-bottom:16px;">Variable explicative : Utilisation de l'IA (0 = Non, 1 = Oui)<br>Variable expliquée : Niveau d'autonomie (1-10)</p>
      <div class="equation">y = ${r(a)}x + ${r(b)}</div>
      <div class="r-squared">Coefficient de détermination : <strong>R² = ${r(r2)}</strong></div>
      <div class="r-squared">Pente (a) : <strong>${r(a)}</strong> | Ordonnée (b) : <strong>${r(b)}</strong></div>
      <div class="r-squared">Observations : <strong>${n}</strong></div>
      <div class="interpretation ${interpClass}"><i class="fas fa-info-circle"></i> ${interpText}</div>
    </div>
    <div class="chart-container">
      <h3>Nuage de points avec droite de régression</h3>
      <div class="chart-wrapper"><canvas id="chartRegression"></canvas></div>
    </div>
  `;

  new Chart(document.getElementById("chartRegression"), {
    type: "scatter",
    data: {
      datasets: [
        { label: "Données", data: points, backgroundColor: "#10b981", pointRadius: 8 },
        { label: "Droite y=" + r(a) + "x+" + r(b), data: [{ x: 0, y: b }, { x: 1, y: a + b }], type: "line", borderColor: "#f59e0b", borderWidth: 3, pointRadius: 0, fill: false }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: "Utilise IA (0/1)", color: "#94a3b8" }, ticks: { color: "#94a3b8", stepSize: 1 }, grid: { color: "#334155" }, min: -0.2, max: 1.2 }, y: { title: { display: true, text: "Autonomie", color: "#94a3b8" }, ticks: { color: "#94a3b8" }, grid: { color: "#334155" }, min: 0, max: 10 } }, plugins: { legend: { labels: { color: "#94a3b8" } } } }
  });
}

// ---- EXPORT ----
async function loadExport() {
  const el = document.getElementById("export");
  el.querySelector(".export-content").innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Chargement...</div>';

  allData = await fetchData();

  let previewHTML = "";
  if (allData.length) {
    const last5 = allData.slice(0, 5);
    previewHTML = `<div class="table-container" style="margin-top:24px;text-align:left;"><h3>Aperçu (5 dernières)</h3><table><thead><tr><th>Âge</th><th>Année</th><th>Heures</th><th>Langage</th><th>IA</th><th>Autonomie</th><th>Satisfaction</th><th>Projets</th></tr></thead><tbody>`;
    last5.forEach(d => {
      previewHTML += `<tr><td>${d.age}</td><td>${d.annee_etude}</td><td>${d.heures_code}</td><td>${d.langage}</td><td>${d.utilise_ia ? "Oui" : "Non"}</td><td>${d.autonomie}/10</td><td>${d.satisfaction}/10</td><td>${d.projets}</td></tr>`;
    });
    previewHTML += `</tbody></table></div>`;
  }

  el.querySelector(".export-content").innerHTML = `
    <div class="export-card">
      <div class="export-icon">📥</div>
      <h3>Exporter les données</h3>
      <p>Téléchargez toutes les réponses collectées au format CSV.</p>
      <div class="export-count">${allData.length}</div>
      <p style="color:var(--text-muted);font-size:14px;">enregistrements disponibles</p>
      <button class="btn btn-primary" onclick="exportCSV()" ${!allData.length ? 'disabled' : ''}><i class="fas fa-download"></i> Exporter en CSV</button>
    </div>
    ${previewHTML}
  `;
}

function exportCSV() {
  if (!allData.length) return;
  const headers = ["age","annee_etude","heures_code","langage","utilise_ia","autonomie","satisfaction","projets"];
  let csv = headers.join(",") + "\n";
  allData.forEach(d => {
    csv += headers.map(h => {
      let val = d[h];
      if (typeof val === "string") val = '"' + val.replace(/"/g, '""') + '"';
      return val;
    }).join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "agreste_donnees.csv";
  a.click();
  URL.revokeObjectURL(url);
}

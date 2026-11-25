/* Page-level adjustments on top of the paper chart data (figures.js), then mount. */
(function () {
  "use strict";
  const F = window.FIG_DATA;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // Main result: one short row of five panels; reference lines go in the legend.
  F.main_sim2sim.height = 215;
  F.main_sim2sim.refLegend = true;
  F.main_sim2sim.vlineLabel = "≈100 target episodes";
  F.main_sim2sim.grid = { bottom: 44 };

  // Single-panel curves sit in a two-column row, so they keep a ~1.6:1 shape.
  ["ceiling", "proposal_warmup", "ablation"].forEach((k) => {
    F[k].height = 290;
    F[k].panels[0].title = "";
  });
  F.ceiling.refLegend = true;
  F.ceiling.panels[0].refs.forEach((r) => { r.label = r.label + " (200k steps)"; });

  F.real_robot.height = 250;
  F.real_robot.refLegend = true;

  // "Attempts that did not help": four panels in one row, each with its own legend.
  const row = clone(F.failed_attempts);
  row.height = 230;
  const enc = clone(F.encoder_ibrl.panels[0]);
  enc.title = "Source-pretrained encoder for IBRL";
  const alt = clone(F.alt_adaptation.panels[0]);
  alt.title = "Alternative adaptation strategies";
  row.panels = row.panels.concat([enc, alt]);
  row.panels.forEach((p) => { p.legendInPanel = true; });
  F.failed_row = row;

  // Shorter group labels so they do not collide in a one-third-width column.
  F.oracle_dynamics.categories = ["src only", "tgt only", "src + tgt"];
  F.oracle_dynamics.height = 300;
  F.value_adapt.height = 300;

  F.shift_ladder.height = 300;
  delete F.shift_ladder.note;

  PaperCharts.mountAll();

  // Equation (falls back to the plain-text version if KaTeX did not load).
  const eq = document.getElementById("tether-eq");
  if (eq && window.katex) {
    katex.render(String.raw`\mathcal{L}(\eta)=\mathbb{E}_{(s,a)\sim\mathcal{D}_t}\big\lVert\pi_\eta(s)-a\big\rVert_2^2+\lambda\,\mathbb{E}_{s\sim\mathcal{D}_s}\big[D(\pi_\eta\,\Vert\,\pi_s)\big]`, eq, { displayMode: true, throwOnError: false });
  }

  // Real-robot videos: task switch, ours on the left, SimDist on the right.
  const tabs = document.querySelectorAll(".task-tabs button");
  const vOurs = document.getElementById("v-ours"), vBase = document.getElementById("v-base");
  function show(task) {
    tabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.task === task)));
    vOurs.poster = `assets/videos/domainadept_${task}.jpg`;
    vOurs.src = `assets/videos/domainadept_${task}.mp4`;
    vBase.poster = `assets/videos/simdist_${task}.jpg`;
    vBase.src = `assets/videos/simdist_${task}.mp4`;
    [vOurs, vBase].forEach((v) => { v.load(); v.play().catch(() => {}); });
    document.querySelectorAll("[data-score]").forEach((el) => {
      el.textContent = el.dataset[task];
    });
  }
  tabs.forEach((b) => b.addEventListener("click", () => show(b.dataset.task)));
  show("threading");

  // BibTeX copy.
  const copy = document.getElementById("copy-bib");
  if (copy) copy.addEventListener("click", () => {
    navigator.clipboard.writeText(document.getElementById("bibtex").textContent.trim()).then(() => {
      copy.textContent = "Copied";
      setTimeout(() => { copy.textContent = "Copy"; }, 1500);
    }).catch(() => {});
  });
})();

/* Website charts for the DomainADEPT paper.
 *
 * Usage on any page:
 *   <script src="vendor/echarts.min.js"></script>
 *   <script src="data/figures.js"></script>      (or fetch data/figures.json)
 *   <script src="charts.js"></script>
 *   <div class="fig" data-fig="main_sim2sim"></div>
 *   <script>PaperCharts.mountAll()</script>
 *
 * Every chart reads its numbers from figures.json (built by build_data.py from
 * the exact arrays the paper PDFs were drawn from). Colours are the paper's
 * family palette in light mode; dark mode uses hand-stepped twins (DARK below)
 * so "ours = most prominent" survives on a dark surface.
 */
(function () {
  "use strict";

  // ------------------------------------------------------------ palette
  // light (paper) -> dark twin. Deep tiers become the brightest step.
  const DARK = {
    "#1D3765": "#A6C8FF", "#487DB2": "#5B95D6", "#7698C3": "#4A7DB8", "#AABCDB": "#3D6290",
    "#86B7DB": "#4FB3C8", "#A6C7E2": "#3F93A8", "#C0D6EA": "#33707F", "#8EB6D0": "#5AA9C9",
    "#5C8FA9": "#4C8FB0",
    "#AC6E2A": "#F0A858", "#E19D49": "#B36E25", "#E7B879": "#8F5A24", "#EFC99B": "#7A4E22",
    "#F3DCC0": "#5E4128",
    "#376439": "#8FD48F", "#669877": "#5BA474", "#85B297": "#4A8C64", "#A4CBB7": "#2E7458",
    "#885D94": "#C9A0D8", "#9670A1": "#B08BC0", "#A582AE": "#9776A8", "#B39DBB": "#7E6290",
    "#C1A8C7": "#684F78",
    "#742A60": "#E58BC5", "#8D476F": "#C9709F", "#A6608D": "#AD5C87", "#C180A6": "#8F4B70",
    "#DDA1BE": "#733D5B",
    "#2a78d6": "#3987e5", "#eb6834": "#d95926",
    "#6B7280": "#8B93A3", "#6f6d68": "#9A988F", "#B9B7AF": "#5E5C57", "#C9C7BF": "#4D4C48",
    "#8E8C86": "#7C7A74", "#c0392b": "#E06A5C",
    "#D7A6A0": "#5E3A36", "#C27C74": "#7E453F", "#A9524A": "#A2534A", "#8A2F27": "#D0675B",
  };
  const UI = {
    light: { surface: "#ffffff", ink: "#0b0b0b", ink2: "#52514e", muted: "#898781",
             grid: "#e6e5df", axis: "#c3c2b7", tipBg: "#ffffff", tipBorder: "#e2e1da",
             band: 0.16, refLine: "#6B7280", red: "#c0392b" },
    dark:  { surface: "#1a1a19", ink: "#f0efec", ink2: "#c3c2b7", muted: "#8f8d86",
             grid: "#2c2c2a", axis: "#4a4945", tipBg: "#242423", tipBorder: "#3a3a38",
             band: 0.22, refLine: "#8B93A3", red: "#E06A5C" },
  };
  const FONT = 'Inter, "Helvetica Neue", system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
  const SYMBOL = { circle: "circle", rect: "rect", triangle: "triangle", diamond: "diamond",
                   pin: "path://M0,-1L0.95,-0.31L0.59,0.81L-0.59,0.81L-0.95,-0.31Z", // pentagon
                   "triangle-down": "path://M-1,-0.8L1,-0.8L0,0.9Z", none: "none" };

  function theme() {
    const t = document.documentElement.getAttribute("data-theme");
    if (t === "dark" || t === "light") return t;
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  const ui = () => UI[theme()];
  const col = (hex) => (theme() === "dark" ? (DARK[hex] || hex) : hex);
  const kfmt = (v) => (Math.abs(v) >= 1000 ? `${+(v / 1000).toFixed(1)}k` : `${v}`);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pct = (v, d = 1) => (v == null ? "–" : `${(+v).toFixed(d)}%`);

  function rgba(hex, a) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // ------------------------------------------------------------ shared pieces
  function axisCommon(u) {
    return {
      axisLine: { lineStyle: { color: u.axis } },
      axisTick: { show: false },
      axisLabel: { color: u.ink2, fontFamily: FONT, fontSize: 11 },
      splitLine: { lineStyle: { color: u.grid } },
      nameTextStyle: { color: u.ink2, fontFamily: FONT, fontSize: 11.5 },
    };
  }
  function tooltipCommon(u) {
    return {
      backgroundColor: u.tipBg, borderColor: u.tipBorder, borderWidth: 1,
      textStyle: { color: u.ink, fontFamily: FONT, fontSize: 12 },
      extraCssText: "box-shadow:0 4px 14px rgba(0,0,0,.12);border-radius:8px;padding:8px 10px;",
      confine: true,
    };
  }
  const swatchHTML = (c, marker, dash) => {
    const m = marker || "circle";
    const shape = m === "rect" ? "border-radius:1px" : m === "diamond" ? "transform:rotate(45deg) scale(.8)" :
      m === "triangle" ? "clip-path:polygon(50% 0,100% 100%,0 100%);border-radius:0" :
      m === "triangle-down" ? "clip-path:polygon(0 0,100% 0,50% 100%);border-radius:0" : "border-radius:50%";
    const line = `<span class="pc-sw-line" style="border-top:2px ${dash ? "dashed" : "solid"} ${c}"></span>`;
    const dot = m === "none" ? "" : `<span class="pc-sw-dot" style="background:${c};${shape}"></span>`;
    return `<span class="pc-sw">${line}${dot}</span>`;
  };
  const dotHTML = (c) => `<span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${c};margin-right:6px"></span>`;

  /* HTML legend that toggles series by name across a set of charts. */
  function htmlLegend(host, items, charts) {
    const box = document.createElement("div");
    box.className = "pc-legend";
    const state = {};
    items.forEach((it) => {
      if (it.inert) {
        const sp = document.createElement("span");
        sp.className = "pc-leg-item pc-note";
        sp.innerHTML = swatchHTML(it.color, it.marker, it.dash) + `<span>${esc(it.label)}</span>`;
        box.appendChild(sp);
        return;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pc-leg-item" + (it.ours ? " pc-ours" : "");
      b.innerHTML = (it.bar ? dotHTML(it.color) : swatchHTML(it.color, it.marker, it.dash)) + `<span>${esc(it.label)}</span>`;
      b.setAttribute("aria-pressed", "true");
      b.addEventListener("click", () => {
        state[it.name] = !(state[it.name] === undefined ? true : state[it.name]);
        b.classList.toggle("pc-off", !state[it.name]);
        b.setAttribute("aria-pressed", String(state[it.name]));
        const names = it.names || [it.name].concat(it.linked || []);
        charts().forEach((ch) => names.forEach((n) =>
          ch.dispatchAction({ type: state[it.name] ? "legendSelect" : "legendUnSelect", name: n })));
      });
      const hl = (type) => charts().forEach((ch) => (it.names || [it.name]).forEach((n) => ch.dispatchAction({ type, seriesName: n })));
      b.addEventListener("mouseenter", () => hl("highlight"));
      b.addEventListener("mouseleave", () => hl("downplay"));
      box.appendChild(b);
    });
    host.appendChild(box);
    return box;
  }
  const hiddenLegend = (names) => ({ show: false, data: names });

  // ------------------------------------------------------------ registry
  const live = []; // {el, build}
  function makeChart(el, height) {
    el.style.height = height + "px";
    const ch = echarts.init(el, null, { renderer: "svg" });
    return ch;
  }

  // ============================================================ LINES
  function renderLines(host, fig) {
    const u = ui();
    const grid = document.createElement("div");
    grid.className = "pc-panels pc-n" + fig.panels.length;
    host.appendChild(grid);
    const charts = [];
    const legendItems = [];
    const refItems = new Map();
    const seen = new Set();
    fig.panels.forEach((p, pi) => {
      const wrap = document.createElement("div");
      wrap.className = "pc-panel";
      if (fig.panels.length > 1 || p.title) {
        const t = document.createElement("div");
        t.className = "pc-panel-title";
        t.textContent = p.title || "";
        wrap.appendChild(t);
      }
      const el = document.createElement("div");
      wrap.appendChild(el);
      grid.appendChild(wrap);
      const series = [];
      const panelItems = [];
      const xs = p.x;
      const xcat = !!fig.xcat;
      const pt = (i, v) => (xcat ? [i, v] : [xs[i], v]);
      p.series.forEach((s) => {
        const c = col(s.color);
        const name = s.legendLink || s.label;
        if (s.lo) {
          // Band as one polygon (custom series): stacked areas misbehave on a value x-axis.
          const lo = s.lo.map((v) => Math.max(0, v)), hi = s.hi.map((v) => Math.min(p.ymax || 100, v));
          series.push({ name, type: "custom", id: s.key + "__band", z: 1, silent: true, tooltip: { show: false },
            data: [[0, 0]], emphasis: { disabled: true },
            renderItem: (params, api) => {
              const up = hi.map((v, i) => api.coord(pt(i, v))), dn = lo.map((v, i) => api.coord(pt(i, v))).reverse();
              return { type: "polygon", shape: { points: up.concat(dn) }, style: { fill: rgba(c, u.band) } };
            } });
        }
        const sym = SYMBOL[s.marker || "circle"];
        if (!s.legendLink) panelItems.push({ name, label: s.label, color: c, marker: s.marker, ours: s.ours, dash: !!s.dash });
        series.push({
          name, id: s.key, type: "line", data: s.y.map((v, i) => pt(i, v)), z: s.ours ? 5 : 3,
          lineStyle: { color: c, width: s.width || 2, type: s.dash === true ? "dashed" : (s.dash || "solid") },
          itemStyle: { color: s.dash ? c : u.surface, borderColor: c, borderWidth: s.ours ? 2.2 : 1.8 },
          symbol: sym, symbolSize: s.ours ? 10 : 8, showSymbol: sym !== "none",
          emphasis: { focus: "series", lineStyle: { width: (s.width || 2) + 1 } },
          blur: { lineStyle: { opacity: 0.15 }, itemStyle: { opacity: 0.15 } },
          _meta: s,
        });
        if (!seen.has(name) && !s.legendLink) {
          seen.add(name);
          legendItems.push({ name, label: s.label, color: c, marker: s.marker, ours: s.ours, dash: !!s.dash,
                             linked: [] });
        } else if (s.legendLink) {
          const host = legendItems.find((q) => q.name === s.legendLink);
          if (host && !legendItems.some((q) => q.name === "__po")) {
            legendItems.push({ name: "__po", label: "dashed = proposal policy alone", color: u.ink2, marker: "none", dash: true, linked: [], inert: true });
          }
        }
      });
      // references
      const ml = [];
      (p.refs || []).forEach((r) => ml.push({ yAxis: r.y, name: r.label,
        lineStyle: { color: col(r.color), type: r.dash === "dashdot" ? [6, 3, 1.5, 3] : "dashed", width: 1.4 },
        label: { show: false } }));
      (p.vlines || []).forEach((v) => ml.push({ xAxis: v.x, name: v.label,
        lineStyle: { color: u.red, type: [4, 3], width: 1.1, opacity: .75 },
        label: { show: false } }));
      // Reference lines are explained in the legend, not labelled inside the plot.
      if (fig.refLegend) {
        (p.refs || []).forEach((r) => refItems.set(r.label, { name: "__ref_" + r.label, label: r.label, color: col(r.color),
          marker: "none", dash: true, inert: true }));
        (p.vlines || []).forEach((v) => refItems.set(v.label, { name: "__v_" + v.label, label: fig.vlineLabel || v.label,
          color: u.red, marker: "none", dash: true, inert: true }));
      }
      if (ml.length) {
        series.push({ type: "line", name: "__refs", data: [], silent: false, tooltip: { show: true },
          markLine: { symbol: "none", data: ml, emphasis: { disabled: true },
                      tooltip: { formatter: (q) => `${esc(q.name)}: ${q.value != null ? (q.data.xAxis != null ? kfmt(q.value) + " steps" : pct(q.value)) : ""}` } } });
      }
      const xmax = xcat ? undefined : xs[xs.length - 1];
      const option = {
        animationDuration: 500,
        textStyle: { fontFamily: FONT },
        grid: Object.assign({ left: 46, right: 14, top: 12, bottom: 40 }, fig.grid || {}),
        legend: hiddenLegend(),
        tooltip: Object.assign(tooltipCommon(u), {
          trigger: "axis",
          axisPointer: { type: "line", lineStyle: { color: u.axis, width: 1 } },
          formatter: (items) => {
            const rows = items.filter((it) => it.seriesId && !it.seriesId.includes("__") && it.seriesName !== "__refs")
              .map((it) => {
                const s = p.series.find((q) => q.key === it.seriesId);
                const i = it.dataIndex;
                const sd = s.hi ? ` <span style="color:${u.muted}">± ${((s.hi[i] - s.lo[i]) / 2).toFixed(1)}</span>` : "";
                const cnt = s.counts ? ` <span style="color:${u.muted}">(${s.counts[i]}/${fig.trials})</span>` : "";
                return { v: s.y[i], html: `<div style="display:flex;justify-content:space-between;gap:14px">
                  <span>${swatchHTML(col(s.color), s.marker, !!s.dash)}${esc(s.label)}</span>
                  <b style="font-variant-numeric:tabular-nums">${pct(s.y[i])}${sd}${cnt}</b></div>` };
              }).sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
            if (!rows.length) return "";
            const xi = items[0].dataIndex;
            const head = xcat ? `Round ${xs[xi]}` : `${kfmt(xs[xi])} steps`;
            return `<div style="font-weight:600;margin-bottom:4px">${esc(p.title || "")} · ${head}</div>` + rows.map((r) => r.html).join("");
          },
        }),
        xAxis: Object.assign(axisCommon(u), xcat ? {
          type: "category", data: xs.map(String), boundaryGap: false,
          name: fig.xlabel, nameLocation: "middle", nameGap: 26, splitLine: { show: false },
        } : {
          type: "value", min: xs[0], max: xmax, interval: xs[1] - xs[0],
          axisLabel: Object.assign(axisCommon(u).axisLabel, { formatter: (v) => (v === 0 ? "0" : `${v / 1000}k`) }),
          name: fig.xlabel, nameLocation: "middle", nameGap: 26, splitLine: { show: false },
        }),
        yAxis: Object.assign(axisCommon(u), {
          type: "value", min: 0, max: p.ymax || 100, interval: 20,
          name: pi === 0 || (fig.panels.length > 1 && window.innerWidth < 720) ? (p.ylabel || fig.ylabel) : "",
          nameLocation: "middle", nameGap: 32,
        }),
        series,
      };
      const ch = makeChart(el, fig.height || (fig.panels.length > 2 ? 250 : 320));
      ch.setOption(option);
      charts.push(ch);
      if (p.legendInPanel) {
        htmlLegend(wrap, panelItems, () => [ch]);
        if (p.series.some((q) => q.dash === true)) {
          const n = document.createElement("div");
          n.className = "pc-note-line";
          n.textContent = "dashed = the proposal policy alone (no planning)";
          wrap.appendChild(n);
        }
      }
    });
    if (fig.legend) {
      htmlLegend(host, fig.legend.map((g) => Object.assign({ name: g.names[0] }, g, { color: col(g.color) })), () => charts);
    } else if (!fig.panels.some((p) => p.legendInPanel)) {
      htmlLegend(host, legendItems.filter((q) => !q.inert).concat(legendItems.filter((q) => q.inert), [...refItems.values()]), () => charts);
    }
    return charts;
  }

  // ============================================================ GROUPED BARS
  function renderGroupBar(host, fig) {
    const u = ui();
    const el = document.createElement("div");
    host.appendChild(el);
    const series = [];
    const n = fig.series.length;
    const CAT_GAP = n > 5 ? 0.18 : 0.28, GAP = 0.12;
    // Same layout maths as ECharts' bar layout, so overlays sit on their bar.
    const barWidth = (api) => (api.size([1, 0])[0] * (1 - CAT_GAP)) / (n + (n - 1) * GAP);
    const barOffset = (api, si) => {
      const bw = barWidth(api), total = bw * (n + (n - 1) * GAP);
      return -total / 2 + bw / 2 + si * bw * (1 + GAP);
    };
    fig.series.forEach((s, si) => {
      const c = col(s.color);
      series.push({
        name: s.label, type: "bar", data: s.values, barGap: `${GAP * 100}%`, barCategoryGap: `${CAT_GAP * 100}%`,
        itemStyle: { color: c, borderRadius: [4, 4, 0, 0] },
        emphasis: { focus: "series" }, blur: { itemStyle: { opacity: 0.25 } },
        label: { show: n <= 5 && !fig.dots, position: "top", color: u.ink2, fontFamily: FONT, fontSize: 10,
                 formatter: (q) => (q.value == null || (fig.labelMin != null && q.value < fig.labelMin) ? "" : (+q.value).toFixed(q.value >= 10 || q.value === 0 ? 0 : 1)) },
        _s: s,
      });
      if (s.err) {
        series.push({
          name: s.label, type: "custom", z: 10, silent: true, tooltip: { show: false },
          renderItem: (params, api) => {
            const i = api.value(0), v = api.value(1), e = api.value(2);
            if (e == null || isNaN(e)) return null;
            const off = barOffset(api, si);
            const top = api.coord([i, v + e]), bot = api.coord([i, Math.max(0, v - e)]);
            const x = top[0] + off;
            const st = { stroke: u.ink2, lineWidth: 1 };
            return { type: "group", children: [
              { type: "line", shape: { x1: x, y1: top[1], x2: x, y2: bot[1] }, style: st },
              { type: "line", shape: { x1: x - 3, y1: top[1], x2: x + 3, y2: top[1] }, style: st }] };
          },
          data: s.values.map((v, i) => [i, v, s.err[i]]),
        });
      }
      if (fig.dots && s.points) {
        series.push({
          name: s.label, type: "custom", z: 11, tooltip: { show: true },
          renderItem: (params, api) => {
            const i = api.value(0), v = api.value(1), j = api.value(2);
            const off = barOffset(api, si) + (j - 1.5) * barWidth(api) * 0.2;
            const p = api.coord([i, v]);
            return { type: "circle", shape: { cx: p[0] + off, cy: p[1], r: 3 },
                     style: { fill: u.surface, stroke: u.ink2, lineWidth: 1.1 } };
          },
          data: s.points.flatMap((row, i) => row.map((q, j) => ({ value: [i, q.v, j], task: q.task }))),
        });
      }
    });
    const option = {
      animationDuration: 500, textStyle: { fontFamily: FONT },
      grid: { left: 50, right: 12, top: 22, bottom: 30 },
      legend: hiddenLegend(),
      tooltip: Object.assign(tooltipCommon(u), {
        trigger: "item",
        formatter: (q) => {
          if (q.seriesType === "custom") {
            const d = q.data;
            return `${esc(q.seriesName)}<br>${esc(d.task)}: <b>${pct(d.value[1], 0)}</b>`;
          }
          const ci = q.dataIndex;
          const rows = fig.series.map((s) => `<div style="display:flex;justify-content:space-between;gap:14px;${s.label === q.seriesName ? "font-weight:700" : ""}">
            <span>${dotHTML(col(s.color))}${esc(s.label)}</span><span style="font-variant-numeric:tabular-nums">${pct(s.values[ci])}${s.err && s.err[ci] != null ? ` ± ${s.err[ci]}` : ""}</span></div>`).join("");
          return `<div style="font-weight:600;margin-bottom:4px">${esc(fig.categories[ci])}</div>${rows}`;
        },
      }),
      xAxis: Object.assign(axisCommon(u), { type: "category", data: fig.categories, splitLine: { show: false },
        axisLabel: Object.assign(axisCommon(u).axisLabel, { fontSize: 11.5, color: u.ink, interval: 0 }) }),
      yAxis: Object.assign(axisCommon(u), { type: "value", min: 0, max: fig.ymax || null, name: fig.ylabel,
        nameLocation: "middle", nameGap: 36 }),
      series,
    };
    const ch = makeChart(el, fig.height || 340);
    ch.setOption(option);
    htmlLegend(host, fig.series.map((s) => ({ name: s.label, label: s.label, color: col(s.color), bar: true,
      ours: /Ours|Dynamics only/.test(s.label) })), () => [ch]);
    return [ch];
  }

  // ============================================================ HBAR (cumulative)
  function renderHBar(host, fig) {
    const u = ui();
    const el = document.createElement("div");
    host.appendChild(el);
    const cats = fig.categories.slice().reverse();
    const vals = fig.values.slice().reverse();
    const colors = fig.colors.slice().reverse().map(col);
    const groups = fig.groups.slice().reverse();
    const ch = makeChart(el, fig.height || 36 * cats.length + 50);
    ch.setOption({
      animationDuration: 500, textStyle: { fontFamily: FONT },
      grid: { left: 8, right: 46, top: 6, bottom: 34, containLabel: true },
      tooltip: Object.assign(tooltipCommon(u), { trigger: "item",
        formatter: (q) => `<b>${esc(cats[q.dataIndex])}</b><br>${esc(groups[q.dataIndex])}<br>Σ SR₅₀ₖ = <b>${(+q.value).toFixed(2)}</b>` }),
      xAxis: Object.assign(axisCommon(u), { type: "value", max: fig.max, name: fig.xlabel, nameLocation: "middle", nameGap: 24 }),
      yAxis: Object.assign(axisCommon(u), { type: "category", data: cats, splitLine: { show: false },
        axisLabel: Object.assign(axisCommon(u).axisLabel, { color: u.ink, fontSize: 11.5 }) }),
      series: [{ type: "bar", data: vals.map((v, i) => ({ value: v, itemStyle: { color: colors[i] } })),
        barWidth: "62%", itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: "right", color: u.ink, fontFamily: FONT, fontSize: 11, fontWeight: 600,
                 formatter: (q) => (+q.value).toFixed(2) } }],
    });
    const fams = [["Model-free (IBRL)", "#376439"], ["Dyna-style (Dyna-IBRL)", "#AC6E2A"], ["Planning (SimDist)", "#487DB2"]];
    const lg = document.createElement("div");
    lg.className = "pc-legend pc-static";
    lg.innerHTML = fams.map(([l, c]) => `<span class="pc-leg-item">${dotHTML(col(c))}${l}</span>`).join("") +
      `<span class="pc-leg-item pc-note">darker = more components</span>`;
    host.appendChild(lg);
    return [ch];
  }

  // ============================================================ N50 small multiples
  function renderDotplot(host, fig) {
    const u = ui();
    const el = document.createElement("div");
    host.appendChild(el);
    const rows = fig.series.slice().reverse();
    const K = fig.categories.length;
    const W = el.clientWidth || 500, LAB = 46, GAP = 40;
    const pw = (W - LAB - 8 - GAP * K) / K;
    const grids = [], xAxes = [], yAxes = [], series = [], titles = [];
    fig.categories.forEach((task, k) => {
      const gl = LAB + k * (pw + GAP);
      grids.push({ left: gl, width: pw, top: 30, bottom: 40 });
      titles.push({ text: task, left: gl + pw / 2, top: 2, textAlign: "center",
        textStyle: { fontSize: 13, fontWeight: 600, color: u.ink, fontFamily: FONT } });
      xAxes.push(Object.assign(axisCommon(u), { gridIndex: k, type: "value", min: 0, max: fig.xmax, interval: pw < 120 ? 150 : 100,
        name: k === 1 ? "Steps to 50 % success" : "", nameLocation: "middle", nameGap: 24,
        axisLabel: Object.assign(axisCommon(u).axisLabel, { formatter: (v) => (v ? `${v}k` : "0") }) }));
      yAxes.push(Object.assign(axisCommon(u), { gridIndex: k, type: "category", data: rows.map((s) => s.key),
        splitLine: { show: false }, axisLabel: Object.assign(axisCommon(u).axisLabel, { show: k === 0, color: u.ink }) }));
      series.push({
        type: "bar", xAxisIndex: k, yAxisIndex: k, barWidth: "58%",
        data: rows.map((s) => {
          const v = s.values[k];
          const c = col(s.color);
          return v == null
            ? { value: fig.cap, never: true, itemStyle: { color: "transparent", borderColor: c, borderWidth: 1.5, borderType: "dashed", borderRadius: [0, 4, 4, 0] } }
            : { value: v, itemStyle: { color: c, borderRadius: [0, 4, 4, 0] } };
        }),
        label: { show: true, position: "right", fontFamily: FONT, fontSize: 10.5, color: u.ink2,
                 formatter: (q) => (q.data.never ? ">300k" : `${q.value}k`) },
      });
    });
    const ch = makeChart(el, 330);
    ch.setOption({
      animationDuration: 500, textStyle: { fontFamily: FONT }, title: titles, grid: grids, xAxis: xAxes, yAxis: yAxes, series,
      tooltip: Object.assign(tooltipCommon(u), { trigger: "item", formatter: (q) => {
        const s = rows[q.dataIndex];
        return `<b>${esc(s.label)}</b><br>${esc(fig.categories[q.seriesIndex])}: steps to 50 % = <b>${q.data.never ? "never (>300k)" : q.value + "k"}</b>`;
      } }),
    });
    const lg = document.createElement("div");
    lg.className = "pc-legend pc-static";
    lg.innerHTML = fig.series.map((s) => `<span class="pc-leg-item">${dotHTML(col(s.color))}<b>${esc(s.key)}</b>&nbsp;${esc(s.label.replace(s.key + " ", ""))}</span>`).join("");
    host.appendChild(lg);
    return [ch];
  }

  // ============================================================ margin channel
  function renderMarginChannel(host, fig) {
    const u = ui();
    const el = document.createElement("div");
    host.appendChild(el);
    const best = col("#AC6E2A"), mid = col("#E19D49"), weak = col("#EFC99B");
    const srCol = fig.sr.map((v) => (v > 70 ? best : v > 50 ? mid : weak));
    const narrow = el.clientWidth < 620;
    const ch = makeChart(el, narrow ? 460 : 330);
    ch.setOption({
      animationDuration: 500, textStyle: { fontFamily: FONT },
      title: [{ text: "Success at 50k", left: narrow ? 0 : "22%", top: 0, textAlign: narrow ? "left" : "center", textStyle: { fontSize: 13, color: u.ink, fontFamily: FONT } },
              { text: "Actor win rate (0–50k)", left: narrow ? 0 : "74%", top: narrow ? 220 : 0, textAlign: narrow ? "left" : "center", textStyle: { fontSize: 13, color: u.ink, fontFamily: FONT } }],
      grid: narrow ? [{ left: 118, right: 46, top: 26, height: 160 }, { left: 118, right: 20, top: 272, bottom: 26 }]
                   : [{ left: 132, width: "30%", top: 28, bottom: 30 }, { left: "56%", right: 30, top: 50, bottom: 30 }],
      legend: { data: ["Collect (rollouts)", "Backup (TD target)"], top: narrow ? 244 : 22, left: narrow ? 0 : "56%", textStyle: { color: u.ink2, fontFamily: FONT }, itemWidth: 10, itemHeight: 10,
                icon: "roundRect" },
      tooltip: Object.assign(tooltipCommon(u), { trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (items) => { const i = items[0].dataIndex; return `<b>${esc(fig.categories[i])}</b><br>SR@50k <b>${pct(fig.sr[i])}</b> · N₅₀ ${fig.n50[i]}k<br>win rate: collect ${pct(fig.collect[i])}, backup ${pct(fig.backup[i])}`; } }),
      xAxis: [Object.assign(axisCommon(u), { gridIndex: 0, type: "value", max: 100, axisLabel: Object.assign(axisCommon(u).axisLabel, { formatter: "{value}%" }) }),
              Object.assign(axisCommon(u), { gridIndex: 1, type: "value", max: 100, axisLabel: Object.assign(axisCommon(u).axisLabel, { formatter: "{value}%" }) })],
      yAxis: [0, 1].map((g) => Object.assign(axisCommon(u), { gridIndex: g, type: "category", inverse: true, data: fig.categories, splitLine: { show: false },
        axisLabel: Object.assign(axisCommon(u).axisLabel, { show: g === 0 || narrow, color: u.ink, fontSize: 11 }) })),
      series: [
        { type: "bar", xAxisIndex: 0, yAxisIndex: 0, data: fig.sr.map((v, i) => ({ value: v, itemStyle: { color: srCol[i] } })),
          barWidth: "56%", itemStyle: { borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: "right", color: u.ink, fontWeight: 600, fontFamily: FONT, formatter: (q) => `${q.value}%` } },
        { name: "Collect (rollouts)", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: fig.collect, barGap: "15%",
          itemStyle: { color: col("#487DB2"), borderRadius: [0, 4, 4, 0] } },
        { name: "Backup (TD target)", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: fig.backup,
          itemStyle: { color: col("#AABCDB"), borderRadius: [0, 4, 4, 0] } },
      ],
    });
    return [ch];
  }

  // ============================================================ tether variants
  function renderHBarErr(host, fig) {
    const u = ui();
    const el = document.createElement("div");
    host.appendChild(el);
    const rows = fig.rows.slice().reverse();
    const labels = rows.map((r) => r.label);
    const groupCol = { "(i) Formulation": "#487DB2", "(ii) State coverage": "#86B7DB", "(iii) Reference action": "#A582AE" };
    const ch = makeChart(el, fig.height || 40 * rows.length + 50);
    ch.setOption({
      animationDuration: 500, textStyle: { fontFamily: FONT },
      grid: { left: 8, right: 70, top: 8, bottom: 34, containLabel: true },
      tooltip: Object.assign(tooltipCommon(u), { trigger: "item", formatter: (q) => {
        const r = rows[q.dataIndex];
        return `<b>${esc(r.label)}</b> <span style="color:${u.muted}">${esc(r.group)}</span><br>${esc(r.coef)} · D<sub>src</sub> = ${r.dsrc}<br>SR@50k <b>${r.v}%</b> ± ${r.sd}`;
      } }),
      xAxis: Object.assign(axisCommon(u), { type: "value", min: fig.xmin, max: fig.xmax, name: fig.xlabel, nameLocation: "middle", nameGap: 24,
        axisLabel: Object.assign(axisCommon(u).axisLabel, { formatter: "{value}%" }) }),
      yAxis: Object.assign(axisCommon(u), { type: "category", data: labels, splitLine: { show: false },
        axisLabel: Object.assign(axisCommon(u).axisLabel, { color: u.ink, fontSize: 11.5,
          formatter: (v) => (rows.find((r) => r.label === v).default ? `{b|${v}}` : v), rich: { b: { fontWeight: 700, color: u.ink, fontFamily: FONT } } }) }),
      series: [
        { type: "bar", barWidth: "56%",
          data: rows.map((r) => ({ value: r.v, itemStyle: { color: r.default ? col("#1D3765") : col(groupCol[r.group]), borderRadius: [0, 4, 4, 0] } })),
          label: { show: true, position: "insideLeft", distance: 8, color: theme() === "dark" ? "#0b0b0b" : "#ffffff", fontFamily: FONT, fontSize: 11, fontWeight: 600,
                   formatter: (q) => `${q.value}%` } },
        { type: "custom", silent: true, z: 10, tooltip: { show: false },
          renderItem: (params, api) => {
            const i = api.value(0), v = api.value(1), e = api.value(2);
            const a = api.coord([v - e, i]), b = api.coord([v + e, i]);
            const st = { stroke: u.ink2, lineWidth: 1.2 };
            return { type: "group", children: [
              { type: "line", shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: st },
              { type: "line", shape: { x1: b[0], y1: b[1] - 4, x2: b[0], y2: b[1] + 4 }, style: st },
              { type: "line", shape: { x1: a[0], y1: a[1] - 4, x2: a[0], y2: a[1] + 4 }, style: st }] };
          },
          encode: { x: 1, y: 0 },
          data: rows.map((r, i) => [i, r.v, r.sd]) },
      ],
    });
    const lg = document.createElement("div");
    lg.className = "pc-legend pc-static";
    lg.innerHTML = `<span class="pc-leg-item">${dotHTML(col("#1D3765"))}Default (squared L2 / KL, λ=1)</span>` +
      Object.entries(groupCol).map(([g, c]) => `<span class="pc-leg-item">${dotHTML(col(c))}${esc(g)}</span>`).join("");
    host.appendChild(lg);
    return [ch];
  }

  // ============================================================ ranking (heads)
  function renderRanking(host, fig) {
    const u = ui();
    const el = document.createElement("div");
    host.appendChild(el);
    const c = col("#1D3765");
    const mk = (gi, data, name, better) => ({
      type: "line", xAxisIndex: gi, yAxisIndex: gi, name, data, symbol: "circle", symbolSize: 9,
      lineStyle: { color: c, width: 2.2 }, itemStyle: { color: u.surface, borderColor: c, borderWidth: 2 },
      label: { show: true, position: better === "up" ? "top" : "bottom", color: u.ink, fontFamily: FONT, fontSize: 11, fontWeight: 600, formatter: (q) => (+q.value).toFixed(3) },
    });
    const ch = makeChart(el, 270);
    ch.setOption({
      animationDuration: 500, textStyle: { fontFamily: FONT },
      title: [{ text: "Rank correlation ρ  ↑", left: "25%", textAlign: "center", textStyle: { fontSize: 13, color: u.ink, fontFamily: FONT } },
              { text: "Selection regret / σ  ↓", left: "75%", textAlign: "center", textStyle: { fontSize: 13, color: u.ink, fontFamily: FONT } }],
      grid: [{ left: 50, width: "36%", top: 40, bottom: 40 }, { left: "60%", right: 20, top: 40, bottom: 40 }],
      tooltip: Object.assign(tooltipCommon(u), { trigger: "axis" }),
      xAxis: [0, 1].map((g) => Object.assign(axisCommon(u), { gridIndex: g, type: "category", data: fig.heads.map((h) => `${h} head${h > 1 ? "s" : ""}`), splitLine: { show: false } })),
      yAxis: [Object.assign(axisCommon(u), { gridIndex: 0, type: "value", min: 0.5, max: 0.62 }),
              Object.assign(axisCommon(u), { gridIndex: 1, type: "value", min: 0.65, max: 0.85 })],
      series: [mk(0, fig.rho, "ρ", "up"), mk(1, fig.regret, "regret/σ", "down")],
    });
    return [ch];
  }

  // ============================================================ ensemble vs contact
  function renderContact(host, fig) {
    const u = ui();
    const el = document.createElement("div");
    host.appendChild(el);
    const shades = ["#1D3765", "#487DB2", "#AABCDB"];
    const ch = makeChart(el, 300);
    ch.setOption({
      animationDuration: 500, textStyle: { fontFamily: FONT },
      grid: { left: 56, right: 16, top: 20, bottom: 30 },
      legend: hiddenLegend(),
      tooltip: Object.assign(tooltipCommon(u), { trigger: "item", formatter: (q) => {
        const s = fig.seeds[q.seriesIndex], i = q.dataIndex;
        return `<b>${fig.phases[i]}</b> · seed ${s.seed}<br>disagreement u = ${s.u[i]}×10⁻³<br>5-step error: ensemble mean ${s.mean[i]}, best head ${s.best[i]} (×10⁻²)<br>best head / mean = <b>${s.ratio[i]}</b>`;
      } }),
      xAxis: Object.assign(axisCommon(u), { type: "category", data: fig.phases, splitLine: { show: false },
        axisLabel: Object.assign(axisCommon(u).axisLabel, { color: u.ink, fontSize: 11.5 }) }),
      yAxis: Object.assign(axisCommon(u), { type: "value", min: 0.9, max: 1.4, interval: 0.1, name: "Best single head error / ensemble-mean error", nameLocation: "middle", nameGap: 40 }),
      series: fig.seeds.map((s, k) => ({
        name: `Seed ${s.seed}`, type: "bar", data: s.ratio, barGap: "14%", barCategoryGap: "34%",
        itemStyle: { color: col(shades[k]), borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: "top", color: u.ink2, fontSize: 10, fontFamily: FONT, formatter: (q) => (+q.value).toFixed(2) },
        markLine: k ? undefined : { symbol: "none", silent: true, data: [{ yAxis: 1, label: { formatter: "equal error", color: u.muted, position: "insideEndTop", fontFamily: FONT, fontSize: 10.5 } }],
          lineStyle: { color: u.refLine, type: "dashed" } },
      })),
    });
    htmlLegend(host, fig.seeds.map((s, k) => ({ name: `Seed ${s.seed}`, label: `Seed ${s.seed}`, color: col(shades[k]), bar: true })), () => [ch]);
    return [ch];
  }

  // ============================================================ latency
  function renderLatency(host, fig) {
    const u = ui();
    const el = document.createElement("div");
    host.appendChild(el);
    const rows = fig.rows.slice().reverse();
    const labels = rows.map((r) => `${r.obs} · ${r.label}`);
    const ch = makeChart(el, 40 * rows.length + 60);
    ch.setOption({
      animationDuration: 500, textStyle: { fontFamily: FONT },
      grid: { left: 8, right: 30, top: 10, bottom: 34, containLabel: true },
      tooltip: Object.assign(tooltipCommon(u), { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (items) => {
        const r = rows[items[0].dataIndex];
        return `<b>${esc(r.obs)} · ${esc(r.label)}</b><br>median <b>${r.median} ms</b> · p95 ${r.p95} ms<br>${Math.round((100 * r.p95) / fig.budget)} % of the ${fig.budget} ms control step (p95)`;
      } }),
      xAxis: Object.assign(axisCommon(u), { type: "value", min: 0, max: fig.budget, name: "Single-step latency (ms) · bar = median, whisker = p95", nameLocation: "middle", nameGap: 24 }),
      yAxis: Object.assign(axisCommon(u), { type: "category", data: labels, splitLine: { show: false },
        axisLabel: Object.assign(axisCommon(u).axisLabel, { color: u.ink, fontSize: 11.5 }) }),
      series: [
        { type: "bar", barWidth: "54%", data: rows.map((r) => ({ value: r.median, itemStyle: {
            color: r.ours ? col("#1D3765") : r.label.startsWith("SimDist") ? col("#487DB2") : col("#B9B7AF"), borderRadius: [0, 4, 4, 0] } })),
          markLine: { symbol: "none", silent: true, lineStyle: { color: u.red, type: [4, 3], width: 1.2 },
            data: [{ xAxis: fig.budget, label: { formatter: "50 ms = one 20 Hz step", color: u.red, fontFamily: FONT, fontSize: 10.5, position: "insideEndTop" } }] } },
        { type: "custom", silent: true, z: 10, renderItem: (params, api) => {
            const i = api.value(0), a = api.coord([api.value(1), i]), b = api.coord([api.value(2), i]);
            const st = { stroke: u.ink2, lineWidth: 1.2 };
            return { type: "group", children: [
              { type: "line", shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: st },
              { type: "line", shape: { x1: b[0], y1: b[1] - 5, x2: b[0], y2: b[1] + 5 }, style: st },
              { type: "text", style: { x: b[0] + 5, y: b[1], text: `${api.value(2)}`, fill: u.muted, fontSize: 10, verticalAlign: "middle", fontFamily: FONT } }] };
          }, data: rows.map((r, i) => [i, r.median, r.p95]) },
      ],
    });
    return [ch];
  }

  // ============================================================ MPPI breakdown
  function renderBreakdown(host, fig) {
    const u = ui();
    const grid = document.createElement("div");
    grid.className = "pc-panels pc-n4";
    host.appendChild(grid);
    return fig.panels.map((p) => {
      const wrap = document.createElement("div");
      wrap.className = "pc-panel";
      wrap.innerHTML = `<div class="pc-panel-title">${esc(p.title)}</div>`;
      const el = document.createElement("div");
      wrap.appendChild(el);
      grid.appendChild(wrap);
      const c = col("#487DB2");
      const ch = makeChart(el, 220);
      ch.setOption({
        animationDuration: 500, textStyle: { fontFamily: FONT },
        grid: { left: 40, right: 12, top: 14, bottom: 28 },
        tooltip: Object.assign(tooltipCommon(u), { trigger: "axis", formatter: (it) => `${esc(p.title)} = <b>${p.x[it[0].dataIndex]}</b><br>median ${it[0].value[1]} ms` }),
        xAxis: Object.assign(axisCommon(u), p.log ? { type: "log", logBase: 10, min: 100, max: 10000, splitLine: { show: false },
          name: p.unit || "", axisLabel: Object.assign(axisCommon(u).axisLabel, { formatter: (v) => kfmt(v) }) }
          : { type: "value", min: 0, max: p.xmax, interval: p.xstep, splitLine: { show: false } }),
        yAxis: Object.assign(axisCommon(u), { type: "value", min: 0, name: "ms", nameLocation: "end", nameGap: 6, splitNumber: 4 }),
        series: [{ type: "line", data: p.x.map((x, i) => [x, p.y[i]]), lineStyle: { color: c, width: 2 },
          symbol: "circle", symbolSize: 8, showSymbol: true,
          itemStyle: { color: u.surface, borderColor: c, borderWidth: 2 },
          markPoint: { symbol: "circle", symbolSize: 11, itemStyle: { color: col("#1D3765") },
            data: [{ coord: [p.default, p.y[p.x.indexOf(p.default)]], value: "default" }],
            label: { show: true, position: p.default === Math.max(...p.x) ? "left" : "top", formatter: "default", color: u.ink2, fontSize: 10, fontFamily: FONT } } }],
      });
      return ch;
    });
  }

  const RENDER = { lines: renderLines, groupbar: renderGroupBar, hbar: renderHBar, dotplot: renderDotplot,
                   margin_channel: renderMarginChannel, hbar_err: renderHBarErr, ranking: renderRanking,
                   contact: renderContact, latency: renderLatency, breakdown: renderBreakdown };

  function mount(el, id, data) {
    const fig = (data || window.FIG_DATA)[id];
    if (!fig) { el.textContent = `missing figure "${id}"`; return; }
    const draw = () => {
      (el._pcCharts || []).forEach((c) => c.dispose());
      el.innerHTML = "";
      el.classList.add("pc-root");
      el._pcCharts = RENDER[fig.type](el, fig);
      if (fig.note) {
        const n = document.createElement("div");
        n.className = "pc-note-line";
        n.textContent = fig.note;
        el.appendChild(n);
      }
    };
    draw();
    live.push({ el, draw });
  }

  function mountAll(root, data) {
    (root || document).querySelectorAll("[data-fig]").forEach((el) => mount(el, el.dataset.fig, data));
  }

  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => live.forEach((l) => (l.el._pcCharts || []).forEach((c) => c.resize())), 120);
  });
  function redrawAll() { live.forEach((l) => l.draw()); }
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redrawAll);
  new MutationObserver(redrawAll).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  window.PaperCharts = { mount, mountAll, redrawAll, DARK };
})();

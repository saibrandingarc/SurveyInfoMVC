/* ACA Economic Impact Survey dashboard.
   Reads one file, responses.json. All charts are computed from it, so a live
   export can replace the sample without code changes. */
(function () {
  "use strict";

  var CONFIG = {
    dataUrl: window.DASHBOARD_DATA_URL || "./responses.json",
    target: 100,
    startDate: "2026-10-30",
    smallGroupMin: 5,
    markers: [
      { type: "line", date: "2026-11-02", label: "ACA member email" },
      { type: "band", from: "2026-11-04", to: "2026-11-06", label: "Fall Forum" },
      { type: "line", date: "2026-11-09", label: "Receivables Info email" }
    ]
  };

  var Q = {
    q1: ["$0 to $1 million", "$1 million to $2 million", "$2 million to $3 million", "$3 million to $4 million",
      "$4 million to $5 million", "$5 million to $15 million", "$15 million to $25 million",
      "$25 million to $35 million", "More than $35 million"],
    q2: ["5%-7%", "7%-9%", "9%-11%", "11%-13%", "13%-15%", "15%-17%", "17%-19%", "19%-21%", "21%-35%", "More than 35%"],
    q3: ["$0 to $1 million", "$1 million to $10 million", "$10 million to $20 million", "$20 million to $30 million",
      "$30 million to $40 million", "$40 million to $50 million", "$50 million to $150 million",
      "$150 million to $250 million", "$250 million to $350 million", "$350 million to $450 million",
      "More than $450 million"],
    q4: ["Credit / retail card", "Unsecured consumer installment loans", "Buy now pay later (BNPL)", "Fintech",
      "Automotive", "Mortgage / HELOC", "Student loans (federal)", "Student loans (private)",
      "Tenant / landlord or rental", "Utility / telecom", "Healthcare (institutional care)",
      "Healthcare (other medical care)", "Government / taxes (for example, federal, state, municipal)",
      "Commercial", "Legal fees / court judgments", "Other"]
  };
  var SOURCES = ["ACA member email", "Fall Forum QR code", "Receivables Info email", "Direct outreach", "LinkedIn"];
  var STATE_NAMES = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
    DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
    IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
    MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
    NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
    NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
    RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
    VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming"
  };
  var SMALL_MSG = "Not enough responses to display. Select additional states to see results.";

  var all = [];
  var completedTotal = 0;
  var selected = new Set();
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pct(c, n) { return n ? Math.round((100 * c) / n) : 0; }
  function fmt(n) { return n.toLocaleString("en-US"); }
  function stateName(code) { return STATE_NAMES[code] || code; }
  function plural(n, one, many) { return n === 1 ? one : many; }
  function dayMs(iso) { var p = iso.split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function isoFromMs(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function shortDate(iso) {
    return new Date(dayMs(iso)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  function longDate(iso) {
    return new Date(dayMs(iso)).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", timeZone: "UTC" });
  }
  function countBy(records, key) {
    var m = new Map();
    records.forEach(function (r) { m.set(r[key], (m.get(r[key]) || 0) + 1); });
    return m;
  }
  function niceMax(maxPct) {
    var step = maxPct <= 20 ? 5 : 10;
    var m = Math.ceil(maxPct / step) * step;
    if (m <= maxPct) m += step;
    m = Math.min(100, Math.max(step, m));
    return { max: m, step: m / step > 6 ? step * 2 : step };
  }

  /* ---------- load ---------- */
  fetch(CONFIG.dataUrl, { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(init)
    .catch(function (e) { console.error(e); $("load-error").hidden = false; });

  function init(data) {
    all = (Array.isArray(data.responses) ? data.responses : []).filter(function (r) {
      return r && typeof r.submitted_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.submitted_date) && r.state;
    });
    completedTotal = data.completed_total;
    $("last-refreshed").textContent = formatRefreshed(data.last_refreshed);

    renderProgress();
    renderTimeline();
    renderStateTable();
    renderSources();
    buildFilter();
    renderFiltered();
    document.body.classList.add("loaded");

    var w = window.innerWidth, t;
    window.addEventListener("resize", function () {
      if (window.innerWidth === w) return;
      w = window.innerWidth; clearTimeout(t); t = setTimeout(renderTimeline, 120);
    });
  }

  function formatRefreshed(v) {
    if (!v) return "Not available";
    var d = new Date(v);
    if (isNaN(d)) return String(v);
    var date = d.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" });
    var time = d.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
    return date + ", " + time + " ET";
  }

  /* ---------- Panel 1 ---------- */
  function renderProgress() {
    var total = all.length;
    var last = all.reduce(function (m, r) { return r.submitted_date > m ? r.submitted_date : m; }, "");
    $("kpi-total").textContent = fmt(total);
    $("kpi-new").textContent = fmt(all.filter(function (r) { return r.submitted_date === last; }).length);
    $("kpi-states").textContent = fmt(new Set(all.map(function (r) { return r.state; })).size);
    $("kpi-tu").textContent = fmt(Number(completedTotal) || 0);
    var fill = Math.min(100, (100 * total) / CONFIG.target);
    var bar = $("kpi-bar");
    bar.setAttribute("aria-valuenow", String(Math.min(total, CONFIG.target)));
    requestAnimationFrame(function () { bar.firstElementChild.style.width = fill + "%"; });
  }

  /* ---------- Panel 2 ---------- */
  function renderTimeline() {
    var el = $("timeline");
    var byDay = countBy(all, "submitted_date");
    var lastIso = all.reduce(function (m, r) { return r.submitted_date > m ? r.submitted_date : m; }, CONFIG.startDate);
    var firstIso = all.reduce(function (m, r) { return r.submitted_date < m ? r.submitted_date : m; }, CONFIG.startDate);
    var days = [], cum = 0;
    for (var ms = dayMs(firstIso); ms <= dayMs(lastIso); ms += 86400000) {
      var iso = isoFromMs(ms), n = byDay.get(iso) || 0;
      cum += n; days.push({ iso: iso, n: n, cum: cum });
    }
    var W = Math.max(300, el.clientWidth), narrow = W < 560;
    var H = narrow ? 240 : 290;
    var m = { t: 58, r: narrow ? 12 : 20, b: 28, l: 36 };
    var pw = W - m.l - m.r, ph = H - m.t - m.b;
    var top = Math.max(CONFIG.target, cum);
    var yStep = top <= 150 ? 25 : top <= 300 ? 50 : 100;
    var yMax = Math.ceil((top * 1.06) / yStep) * yStep;
    var nD = days.length;
    var x = function (i) { return m.l + (nD === 1 ? pw / 2 : (i * pw) / (nD - 1)); };
    var y = function (v) { return m.t + ph - (v / yMax) * ph; };
    var idx = function (iso) { return Math.round((dayMs(iso) - dayMs(firstIso)) / 86400000); };
    var s = [];
    s.push('<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Cumulative responses by day">');

    // markers
    CONFIG.markers.forEach(function (mk, k) {
      var ly = 14 + k * 15;
      if (mk.type === "band") {
        var a = idx(mk.from), b = idx(mk.to);
        if (b < 0 || a > nD - 1) return;
        a = Math.max(0, a); b = Math.min(nD - 1, b);
        var x1 = x(a) - (nD > 1 ? pw / (nD - 1) / 2 : 0), x2 = x(b) + (nD > 1 ? pw / (nD - 1) / 2 : 0);
        x1 = Math.max(m.l, x1); x2 = Math.min(m.l + pw, x2);
        s.push('<rect x="' + x1 + '" y="' + m.t + '" width="' + Math.max(1, x2 - x1) + '" height="' + ph + '" fill="var(--band)"/>');
        s.push(markLabel(x1, ly, mk.label, W, m) + '<line x1="' + x1 + '" x2="' + x1 + '" y1="' + (ly + 4) + '" y2="' + m.t + '" stroke="#c4cad0" stroke-width="1"/>');
      } else {
        var i = idx(mk.date);
        if (i < 0 || i > nD - 1) return;
        var xx = x(i);
        s.push('<line x1="' + xx + '" x2="' + xx + '" y1="' + (ly + 4) + '" y2="' + (m.t + ph) + '" stroke="#9aa3ac" stroke-width="1"/>');
        s.push(markLabel(xx, ly, mk.label, W, m));
      }
    });

    // y grid
    for (var v = 0; v <= yMax; v += yStep) {
      s.push('<line x1="' + m.l + '" x2="' + (m.l + pw) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="' + (v === 0 ? "#b9c0c7" : "#f0f2f4") + '"/>');
      s.push('<text class="ax" x="' + (m.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + "</text>");
    }
    // target
    s.push('<line x1="' + m.l + '" x2="' + (m.l + pw) + '" y1="' + y(CONFIG.target) + '" y2="' + y(CONFIG.target) + '" stroke="#16202b" stroke-width="1" stroke-dasharray="5 4"/>');
    s.push('<text class="ax" x="' + (m.l + 4) + '" y="' + (y(CONFIG.target) - 5) + '" style="fill:#16202b">Target</text>');
    // x labels
    var every = Math.max(1, Math.ceil(nD / (narrow ? 5 : 10)));
    days.forEach(function (d, i) {
      if (i % every !== 0 && i !== nD - 1) return;
      if (i === nD - 1 && i % every !== 0 && (i % every) < every * 0.6) return;
      s.push('<text class="ax" x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + shortDate(d.iso) + "</text>");
    });
    // line
    var path = days.map(function (d, i) { return (i ? "L" : "M") + x(i).toFixed(1) + "," + y(d.cum).toFixed(1); }).join("");
    s.push('<path d="' + path + '" fill="none" stroke="var(--accent)" stroke-width="2.25" stroke-linejoin="round"/>');
    var li = nD - 1;
    s.push('<circle cx="' + x(li) + '" cy="' + y(days[li].cum) + '" r="3.5" fill="var(--accent)"/>');
    // hover
    s.push('<line id="tl-guide" x1="0" x2="0" y1="' + m.t + '" y2="' + (m.t + ph) + '" stroke="#16202b" stroke-opacity=".25" visibility="hidden"/>');
    s.push('<circle id="tl-dot" r="4.5" fill="#fff" stroke="var(--accent)" stroke-width="2" visibility="hidden"/>');
    s.push('<rect id="tl-hit" x="' + m.l + '" y="' + m.t + '" width="' + pw + '" height="' + ph + '" fill="transparent"/>');
    s.push("</svg>");
    el.innerHTML = s.join("");

    var hit = $("tl-hit"), guide = $("tl-guide"), dot = $("tl-dot"), tip = $("tip");
    function show(evt) {
      var r = hit.getBoundingClientRect();
      var rel = (evt.clientX - r.left) / r.width;
      var i = Math.max(0, Math.min(nD - 1, Math.round(rel * (nD - 1))));
      var d = days[i], cx = x(i), cy = y(d.cum);
      guide.setAttribute("x1", cx); guide.setAttribute("x2", cx); guide.setAttribute("visibility", "visible");
      dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("visibility", "visible");
      tip.innerHTML = "<b>" + esc(longDate(d.iso)) + "</b><br>Cumulative: " + fmt(d.cum) + "<br>New that day: " + fmt(d.n);
      tip.hidden = false;
      var svgR = el.firstElementChild.getBoundingClientRect(), scale = svgR.width / W;
      var px = svgR.left + cx * scale, py = svgR.top + cy * scale;
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var left = px + 12 + tw > window.innerWidth - 8 ? px - tw - 12 : px + 12;
      tip.style.left = Math.max(8, left) + "px";
      tip.style.top = Math.max(8, py - th - 10) + "px";
    }
    function hide() { tip.hidden = true; guide.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); }
    hit.addEventListener("pointermove", show);
    hit.addEventListener("pointerdown", show);
    hit.addEventListener("pointerleave", hide);
    window.addEventListener("scroll", hide, { passive: true });
  }
  function markLabel(xx, ly, label, W, m) {
    var approx = label.length * 6.1;
    var anchor = xx + 4 + approx > W - m.r ? "end" : "start";
    var tx = anchor === "start" ? xx + 4 : xx - 4;
    return '<text class="mk" x="' + tx + '" y="' + ly + '" text-anchor="' + anchor + '">' + esc(label) + "</text>";
  }

  /* ---------- Panel 7 ---------- */
  function renderStateTable() {
    var total = all.length;
    var rows = Array.from(countBy(all, "state").entries()).sort(function (a, b) {
      return b[1] - a[1] || stateName(a[0]).localeCompare(stateName(b[0]));
    });
    $("state-rows").innerHTML = rows.map(function (r) {
      var few = r[1] < CONFIG.smallGroupMin ? '<span class="few">Too few to show alone</span>' : "";
      return '<tr><th scope="row">' + esc(stateName(r[0])) + few + '</th><td class="num">' + fmt(r[1]) +
        '</td><td class="num">' + pct(r[1], total) + "%</td></tr>";
    }).join("");
    $("state-total").textContent = fmt(total);
  }

  /* ---------- Panel 8 ---------- */
  function renderSources() {
    var c = countBy(all, "source"), n = all.length;
    var items = SOURCES.map(function (s) { var k = c.get(s) || 0; return { label: s, count: k, pct: pct(k, n), text: fmt(k) + " (" + pct(k, n) + "%)" }; });
    $("chart-source").innerHTML = hbars(items, Math.max.apply(null, items.map(function (i) { return i.count; })) || 1, "count");
  }

  /* ---------- Filtered panels 3 to 6 ---------- */
  function filtered() {
    if (!selected.size) return all;
    return all.filter(function (r) { return selected.has(r.state); });
  }
  function renderFiltered() {
    var recs = filtered(), n = recs.length, small = n < 1;
    ["q1", "q2", "q3"].forEach(function (q) {
      $("chart-" + q).innerHTML = small ? smallMsg() : columns(q, recs);
    });
    $("chart-q4").innerHTML = small ? smallMsg() : debtTypes(recs);
    document.querySelectorAll("[data-base]").forEach(function (p) {
      p.textContent = small ? "" : "Based on " + fmt(n) + " " + plural(n, "agency", "agencies");
      p.hidden = small;
    });
    var status = "";
    if (selected.size) status = "Showing " + selected.size + " " + plural(selected.size, "state", "states") + ", " + fmt(n) + " " + plural(n, "agency", "agencies");
    $("filter-status").textContent = status;
    $("ms-clear").hidden = !selected.size;
    var bt = "All states";
    if (selected.size === 1) bt = stateName(Array.from(selected)[0]);
    else if (selected.size > 1) bt = selected.size + " states selected";
    $("ms-btn-text").textContent = bt;
    renderResponseList(recs);
  }
  function renderResponseList(recs) {
    $("response-scope").textContent = selected.size ? $("ms-btn-text").textContent : "All states";
    $("response-rows").innerHTML = recs.map(function (r) {
      var debts = Array.isArray(r.q4) && r.q4.length ? r.q4.join(", ") : "—";
      return "<tr><td>" + esc(shortDate(r.submitted_date)) + "</td><td>" + esc(stateName(r.state)) +
        "</td><td>" + esc(r.q1 || "—") + "</td><td>" + esc(r.q2 || "—") + "</td><td>" + esc(r.q3 || "—") +
        "</td><td>" + esc(debts) + "</td></tr>";
    }).join("") || '<tr><td colspan="6">No responses</td></tr>';
  }
  function smallMsg() { return '<div class="small-msg">' + SMALL_MSG + "</div>"; }

  function columns(q, recs) {
    var n = recs.length, c = countBy(recs, q);
    var items = Q[q].map(function (label) { var k = c.get(label) || 0; return { label: label, count: k, pct: pct(k, n), exact: n ? (100 * k) / n : 0 }; });
    var nm = niceMax(Math.max.apply(null, items.map(function (i) { return i.exact; })));
    var grid = "";
    for (var v = 0; v <= nm.max; v += nm.step) {
      grid += '<div style="bottom:' + (100 * v) / nm.max + '%"><span>' + v + "%</span></div>";
    }
    var bars = items.map(function (i) {
      return '<div class="col" role="listitem" aria-label="' + esc(i.label) + ": " + i.pct + "%, " + i.count + ' agencies">' +
        '<span class="val" style="bottom:calc(' + (100 * i.exact) / nm.max + '% + 3px)"><span class="vp">' + i.pct + '%</span> <span class="vc">(' + fmt(i.count) + ")</span></span>" +
        '<span class="bar" style="height:' + (100 * i.exact) / nm.max + '%"></span></div>';
    }).join("");
    var xs = items.map(function (i) { return "<span>" + esc(i.label) + "</span>"; }).join("");
    return '<div class="cols"><div class="cols-plot"><div class="cols-grid" aria-hidden="true">' + grid +
      '</div><div class="cols-bars" role="list">' + bars + '</div></div><div class="cols-x" aria-hidden="true">' + xs + "</div></div>";
  }

  function debtTypes(recs) {
    var n = recs.length, c = new Map();
    recs.forEach(function (r) {
      var picks = Array.isArray(r.q4) ? r.q4 : [];
      new Set(picks).forEach(function (t) { c.set(t, (c.get(t) || 0) + 1); });
    });
    var items = Q.q4.map(function (label, order) { var k = c.get(label) || 0; return { label: label, count: k, order: order, pct: pct(k, n), exact: n ? (100 * k) / n : 0 }; });
    var other = items.pop();
    items.sort(function (a, b) { return b.count - a.count || a.order - b.order; });
    items.push(other);
    items.forEach(function (i) { i.text = i.pct + "% (" + fmt(i.count) + ")"; });
    var max = Math.max.apply(null, items.map(function (i) { return i.exact; })) || 1;
    return hbars(items, max, "exact");
  }

  function hbars(items, max, key) {
    return '<div class="hbars" role="list">' + items.map(function (i) {
      var f = (i[key] || 0) / max;
      return '<div class="hb-label" role="listitem">' + esc(i.label) + "</div>" +
        '<div class="hb-track" aria-label="' + esc(i.text) + '"><span class="hb-bar" style="width:calc((100% - 78px) * ' + f.toFixed(4) + ')"></span>' +
        '<span class="hb-val">' + esc(i.text) + "</span></div>";
    }).join("") + "</div>";
  }

  /* ---------- State filter ---------- */
  function buildFilter() {
    var counts = countBy(all, "state");
    var states = Array.from(counts.keys()).sort(function (a, b) { return stateName(a).localeCompare(stateName(b)); });
    var list = $("ms-list"), btn = $("ms-btn"), pop = $("ms-pop"), search = $("ms-search");
    list.innerHTML = states.map(function (s) {
      return '<li role="option" tabindex="0" aria-selected="false" data-state="' + esc(s) + '" data-name="' + esc(stateName(s).toLowerCase() + " " + s.toLowerCase()) + '">' +
        '<span class="box" aria-hidden="true"></span><span class="nm">' + esc(stateName(s)) + '</span><span class="ct">' + counts.get(s) + "</span></li>";
    }).join("") + '<li class="empty" hidden>No matching states</li>';

    function open(v) {
      pop.hidden = !v; btn.setAttribute("aria-expanded", String(v));
      if (v) { search.value = ""; applySearch(); search.focus(); }
    }
    function applySearch() {
      var q = search.value.trim().toLowerCase(), shown = 0;
      list.querySelectorAll("li[data-state]").forEach(function (li) {
        var hit = !q || li.dataset.name.indexOf(q) !== -1;
        li.hidden = !hit; if (hit) shown++;
      });
      list.querySelector(".empty").hidden = shown > 0;
    }
    function toggle(li) {
      var s = li.dataset.state;
      if (selected.has(s)) selected.delete(s); else selected.add(s);
      li.setAttribute("aria-selected", String(selected.has(s)));
      renderFiltered();
    }
    btn.addEventListener("click", function () { open(pop.hidden); });
    search.addEventListener("input", applySearch);
    list.addEventListener("click", function (e) { var li = e.target.closest("li[data-state]"); if (li) toggle(li); });
    list.addEventListener("keydown", function (e) {
      var li = e.target.closest("li[data-state]"); if (!li) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(li); }
    });
    document.addEventListener("click", function (e) { if (!pop.hidden && !$("ms").contains(e.target)) open(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pop.hidden) { open(false); btn.focus(); } });
    $("ms-clear").addEventListener("click", function () {
      selected.clear();
      list.querySelectorAll("li[data-state]").forEach(function (li) { li.setAttribute("aria-selected", "false"); });
      renderFiltered();
    });
  }
})();

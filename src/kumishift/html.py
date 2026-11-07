"""シフト表を1ファイルの HTML（画面イメージ）に書き出す。

- 月間: スタッフ × 日付の一覧表
- 日別: 1日の時間帯をバーで表示（ガントチャート）＋ 時間ごとの人数/必要人数
ブラウザで開くだけで見られ、そのまま印刷もできます。
"""

from __future__ import annotations

import json
from pathlib import Path

from . import __version__
from .model import WEEKDAY_LABELS, Problem
from .solver import Result


def to_view_data(p: Problem, r: Result) -> dict:
    days = []
    for d in p.dates:
        if p.hourly:
            bh = p.business_hours.get(d)
            open_, close = (bh if bh else (None, None))
            slots = [
                {"t": t, "need": p.slot_demand.get((d, t), 0)} for t in p.slots_of(d)
            ]
        else:
            open_ = close = None
            slots = []
        days.append(
            {
                "date": d.isoformat(),
                "label": f"{d.month}/{d.day}",
                "wd": "祝" if d in p.holidays else WEEKDAY_LABELS[d.weekday()],
                "weekend": p.is_weekend(d),
                "closed": p.hourly and not p.business_hours.get(d),
                "open": open_,
                "close": close,
                "slots": slots,
                "need": {s.code: p.demand.get((d, s.code), 0) for s in p.shifts}
                if not p.hourly
                else {},
            }
        )
    shifts = {
        s.code: {"name": s.name, "start": s.start_min, "end": s.end_min} for s in p.shifts
    }
    summary = {s.name: s for s in r.summaries}
    staff = [
        {
            "name": s.name,
            "days": summary[s.name].days if s.name in summary else 0,
            "hours": summary[s.name].minutes / 60 if s.name in summary else 0,
            "weekend": summary[s.name].weekend_days if s.name in summary else 0,
        }
        for s in p.staff
    ]
    return {
        "version": __version__,
        "status": r.status,
        "hourly": p.hourly,
        "step": p.slot_minutes,
        "period": [p.dates[0].isoformat(), p.dates[-1].isoformat()],
        "days": days,
        "shifts": shifts,
        "shiftOrder": [s.code for s in p.shifts],
        "staff": staff,
        "assign": {f"{n}|{d.isoformat()}": c for (n, d), c in r.assignments.items()},
        "shortages": [
            {"date": s.date.isoformat(), "shift": s.shift, "need": s.need, "assigned": s.assigned}
            for s in r.shortages
        ],
        "warnings": r.unmet_requests,
    }


def write_html(p: Problem, r: Result, path: str | Path, title: str = "シフト表") -> None:
    data = json.dumps(to_view_data(p, r), ensure_ascii=False).replace("</", "<\\/")
    html = TEMPLATE.replace("__TITLE__", _esc(title)).replace("__DATA__", data)
    Path(path).write_text(html, encoding="utf-8")


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


TEMPLATE = r"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__</title>
<style>
  :root{
    --bg:#f6f7f9; --card:#fff; --ink:#1c2230; --sub:#667085; --line:#e4e7ec;
    --accent:#2f6fed; --warn:#d92d20; --warn-bg:#fef3f2; --ok:#079455; --ok-bg:#ecfdf3;
    --am:#3b82f6; --mid:#10b981; --pm:#f59e0b; --night:#7c3aed;
    --weekend:#f9fafb;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font-family:"Hiragino Sans","Noto Sans JP","Yu Gothic UI",system-ui,sans-serif;font-size:14px}
  header{background:var(--card);border-bottom:1px solid var(--line);padding:16px 24px;
    display:flex;align-items:center;gap:16px;flex-wrap:wrap}
  h1{font-size:18px;margin:0}
  .period{color:var(--sub)}
  .badge{padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600}
  .badge.ok{background:var(--ok-bg);color:var(--ok)} .badge.ng{background:var(--warn-bg);color:var(--warn)}
  .tabs{margin-left:auto;display:flex;background:var(--bg);border-radius:8px;padding:3px}
  .tabs button{border:0;background:none;padding:7px 14px;border-radius:6px;font:inherit;cursor:pointer;color:var(--sub)}
  .tabs button.on{background:var(--card);color:var(--ink);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}
  main{padding:20px 24px;max-width:1400px;margin:0 auto}
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:16px}
  .card h2{font-size:15px;margin:0 0 12px}
  .alerts li{color:var(--warn)} .alerts{margin:0;padding-left:20px}
  .legend{display:flex;gap:14px;flex-wrap:wrap;color:var(--sub);font-size:12px;margin-bottom:10px}
  .legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}

  /* 月間 */
  .scroll{overflow-x:auto}
  table.month{border-collapse:separate;border-spacing:0;font-size:12px;min-width:100%}
  .month th,.month td{border-bottom:1px solid var(--line);padding:6px 4px;text-align:center;white-space:nowrap}
  .month thead th{position:sticky;top:0;background:var(--card);font-weight:600;cursor:pointer}
  .month thead th:hover{color:var(--accent)}
  .month th.name,.month td.name{position:sticky;left:0;background:var(--card);text-align:left;
    padding-left:8px;padding-right:12px;font-weight:600;z-index:1}
  .month .we{background:var(--weekend)} .month .sat{color:#2563eb} .month .sun{color:#dc2626}
  .month .closed{background:repeating-linear-gradient(45deg,#f2f4f7,#f2f4f7 4px,#fff 4px,#fff 8px);color:var(--sub)}
  .chip{display:inline-block;min-width:38px;padding:3px 5px;border-radius:5px;color:#fff;font-weight:600;font-size:11px}
  .month td.num{color:var(--sub);font-variant-numeric:tabular-nums}
  .month tr.covrow td{font-size:11px;color:var(--sub)} .month tr.covrow td.short{color:var(--warn);font-weight:700;background:var(--warn-bg)}

  /* 日別 */
  .daynav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
  .daynav button{border:1px solid var(--line);background:var(--card);border-radius:8px;padding:6px 8px;
    font:inherit;font-size:12px;cursor:pointer;min-width:58px}
  .daynav button.on{border-color:var(--accent);color:var(--accent);font-weight:700}
  .daynav button.has-short{border-color:var(--warn)}
  .daynav button.closed{color:#98a2b3}
  .gantt{position:relative}
  .g-row{display:grid;grid-template-columns:90px 1fr 70px;align-items:center;min-height:36px;border-bottom:1px solid var(--line)}
  .g-name{font-weight:600}
  .g-track{position:relative;height:36px}
  .g-bar{position:absolute;top:7px;height:22px;border-radius:6px;color:#fff;font-size:11px;font-weight:600;
    display:flex;align-items:center;padding:0 8px;white-space:nowrap;overflow:hidden}
  .g-hours{text-align:right;color:var(--sub);font-size:12px}
  .g-axis{display:grid;grid-template-columns:90px 1fr 70px;color:var(--sub);font-size:11px}
  .g-axis .ticks{position:relative;height:20px}
  .g-axis .ticks span{position:absolute;transform:translateX(-50%);white-space:nowrap}
  .g-axis .ticks span:last-child{transform:translateX(-100%)}
  .g-grid{position:absolute;top:0;bottom:0;width:1px;background:var(--line)}
  .g-cov .g-track{display:flex;height:40px;gap:2px;padding:4px 0}
  .cov{flex:1;border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-size:11px;background:var(--ok-bg);color:var(--ok);font-weight:600}
  .cov.short{background:var(--warn-bg);color:var(--warn)} .cov.over{background:#eff4ff;color:var(--accent)}
  .empty{color:var(--sub);padding:30px;text-align:center}

  .stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
  .stat{border:1px solid var(--line);border-radius:10px;padding:10px 12px}
  .stat b{display:block;font-size:14px;margin-bottom:4px}
  .stat span{color:var(--sub);font-size:12px}
  footer{color:var(--sub);font-size:11px;text-align:center;padding:10px 0 24px}

  @media print{
    body{background:#fff} header .tabs{display:none} .card{border:0;padding:0}
    .view{display:block!important} .daynav{display:none} .chip,.g-bar,.cov{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style>
</head>
<body>
<header>
  <h1>__TITLE__</h1>
  <span class="period" id="period"></span>
  <span class="badge" id="status"></span>
  <div class="tabs">
    <button data-tab="month" class="on">月間</button>
    <button data-tab="day">日別</button>
    <button data-tab="staff">スタッフ</button>
  </div>
</header>
<main>
  <div class="card" id="alerts" hidden><h2>確認が必要なこと</h2><ul class="alerts"></ul></div>

  <section class="view" id="v-month">
    <div class="card">
      <div class="legend" id="legend"></div>
      <div class="scroll"><table class="month" id="month"></table></div>
    </div>
  </section>

  <section class="view" id="v-day" hidden>
    <div class="card">
      <div class="daynav" id="daynav"></div>
      <h2 id="dayTitle"></h2>
      <div class="gantt" id="gantt"></div>
    </div>
  </section>

  <section class="view" id="v-staff" hidden>
    <div class="card"><h2>スタッフごとの集計</h2><div class="stats" id="stats"></div></div>
  </section>
</main>
<footer>kumishift <span id="ver"></span> で作成</footer>

<script>
const D = __DATA__;
const $ = s => document.querySelector(s);
const hm = m => `${String(Math.floor(m/60)%24).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

// 色: 時間帯モードは開始時刻、固定勤務モードは勤務ごと
const PALETTE = ["#3b82f6","#10b981","#f59e0b","#7c3aed","#ec4899","#0ea5e9","#84cc16","#ef4444"];
function colorOf(code){
  const s = D.shifts[code]; if(!s) return "#98a2b3";
  if(!D.hourly) return PALETTE[D.shiftOrder.indexOf(code) % PALETTE.length];
  if(s.start >= 22*60 || s.start < 5*60) return "var(--night)";
  if(s.start < 11*60) return "var(--am)";
  if(s.start < 15*60) return "var(--mid)";
  return "var(--pm)";
}
const get = (name, date) => D.assign[`${name}|${date}`];

// ---- ヘッダー
$("#period").textContent = `${D.period[0]} 〜 ${D.period[1]}`;
const short = D.shortages.length;
$("#status").textContent = short ? `人数不足 ${short} 件` : (D.warnings.length ? "希望の未反映あり" : "すべて充足");
$("#status").className = "badge " + (short || D.warnings.length ? "ng" : "ok");
$("#ver").textContent = D.version;
if(short || D.warnings.length){
  const ul = $("#alerts ul");
  D.shortages.forEach(s => {
    const day = D.days.find(d => d.date === s.date);
    ul.insertAdjacentHTML("beforeend", `<li>${day.label}(${day.wd}) ${esc(s.shift)}: ${s.assigned}/${s.need}人</li>`);
  });
  D.warnings.forEach(w => ul.insertAdjacentHTML("beforeend", `<li>${esc(w)}</li>`));
  $("#alerts").hidden = false;
}

// ---- 凡例
$("#legend").innerHTML = D.hourly
  ? [["var(--am)","朝（〜11時開始）"],["var(--mid)","昼（11〜15時開始）"],["var(--pm)","夕方・夜（15時〜開始）"]]
      .map(([c,t]) => `<span><i style="background:${c}"></i>${t}</span>`).join("")
  : D.shiftOrder.map(c => `<span><i style="background:${colorOf(c)}"></i>${esc(D.shifts[c].name)} ${hm(D.shifts[c].start)}〜${hm(D.shifts[c].end)}</span>`).join("");

// ---- 月間
function countAt(date, t){
  return D.staff.filter(st => { const c = get(st.name, date); if(!c) return false;
    const s = D.shifts[c]; return s.start <= t && t < s.end; }).length;
}
function renderMonth(){
  const wdClass = d => d.wd === "土" ? "sat" : (d.wd === "日" || d.wd === "祝") ? "sun" : "";
  let h = `<thead><tr><th class="name">名前</th>`;
  D.days.forEach((d,i) => h += `<th class="${d.weekend?"we":""} ${d.closed?"closed":""}" data-day="${i}" title="日別で見る">
    ${d.label}<br><span class="${wdClass(d)}">${d.wd}</span></th>`);
  h += `<th>日数</th><th>時間</th></tr></thead><tbody>`;
  D.staff.forEach(st => {
    h += `<tr><td class="name">${esc(st.name)}</td>`;
    D.days.forEach(d => {
      const c = get(st.name, d.date);
      const cls = d.closed ? "closed" : (d.weekend ? "we" : "");
      h += `<td class="${cls}">${c ? `<span class="chip" style="background:${colorOf(c)}">${esc(c)}</span>` : (d.closed ? "休" : "")}</td>`;
    });
    h += `<td class="num">${st.days}</td><td class="num">${+st.hours.toFixed(1)}</td></tr>`;
  });
  // 充足状況
  h += `<tr class="covrow"><td class="name">充足</td>`;
  D.days.forEach(d => {
    const s = D.shortages.filter(x => x.date === d.date).length;
    h += `<td class="${s ? "short" : ""} ${d.closed ? "closed" : ""}">${d.closed ? "" : (s ? `不足${s}` : "✓")}</td>`;
  });
  h += `<td></td><td></td></tr></tbody>`;
  $("#month").innerHTML = h;
  document.querySelectorAll("#month th[data-day]").forEach(th =>
    th.onclick = () => { showTab("day"); renderDay(+th.dataset.day); });
}

// ---- 日別（ガントチャート）
let current = D.days.findIndex(d => !d.closed); if(current < 0) current = 0;
function renderDayNav(){
  $("#daynav").innerHTML = D.days.map((d,i) => {
    const s = D.shortages.some(x => x.date === d.date);
    return `<button data-i="${i}" class="${i===current?"on":""} ${s?"has-short":""} ${d.closed?"closed":""}">
      ${d.label}(${d.wd})${d.closed?" 休":""}</button>`;
  }).join("");
  document.querySelectorAll("#daynav button").forEach(b => b.onclick = () => renderDay(+b.dataset.i));
}
function renderDay(i){
  current = i; renderDayNav();
  const d = D.days[i];
  $("#dayTitle").textContent = `${d.label}(${d.wd})` + (d.closed ? " 定休日" : (d.open!=null ? `　営業 ${hm(d.open)}〜${hm(d.close)}` : ""));
  if(d.closed){ $("#gantt").innerHTML = `<div class="empty">定休日です</div>`; return; }

  // 表示範囲: 営業時間（なければその日の勤務の最小〜最大）
  const used = D.staff.map(st => get(st.name, d.date)).filter(Boolean).map(c => D.shifts[c]);
  let lo = d.open ?? Math.min(...used.map(s => s.start), ...Object.values(D.shifts).map(s=>s.start));
  let hi = d.close ?? Math.max(...used.map(s => s.end), ...Object.values(D.shifts).map(s=>s.end));
  lo = Math.floor(lo/60)*60; hi = Math.ceil(hi/60)*60;
  const pct = m => ((m - lo) / (hi - lo) * 100) + "%";
  const grid = () => { let g=""; for(let t=lo; t<=hi; t+=60) g += `<div class="g-grid" style="left:${pct(t)}"></div>`; return g; };

  let h = `<div class="g-axis"><div></div><div class="ticks">`;
  for(let t=lo; t<=hi; t+=60) h += `<span style="left:${pct(t)}">${Math.floor(t/60)%24}時</span>`;
  h += `</div><div></div></div>`;

  D.staff.forEach(st => {
    const c = get(st.name, d.date);
    h += `<div class="g-row"><div class="g-name">${esc(st.name)}</div><div class="g-track">${grid()}`;
    if(c){
      const s = D.shifts[c];
      h += `<div class="g-bar" style="left:${pct(s.start)};width:calc(${pct(s.end)} - ${pct(s.start)});background:${colorOf(c)}">
        ${hm(s.start)}〜${hm(s.end)}</div>`;
    }
    h += `</div><div class="g-hours">${c ? ((D.shifts[c].end - D.shifts[c].start)/60) + "時間" : "休み"}</div></div>`;
  });

  // 人数 / 必要人数
  if(D.hourly){
    h += `<div class="g-row g-cov"><div class="g-name">人数/必要</div><div class="g-track">`;
    d.slots.forEach(sl => {
      const n = countAt(d.date, sl.t);
      const cls = n < sl.need ? "short" : (n > sl.need ? "over" : "");
      h += `<div class="cov ${cls}" title="${hm(sl.t)}〜${hm(sl.t + D.step)}">${n}/${sl.need}</div>`;
    });
    h += `</div><div class="g-hours"></div></div>`;
  } else {
    D.shiftOrder.forEach(code => {
      const n = D.staff.filter(st => get(st.name, d.date) === code).length, need = d.need[code] || 0;
      const s = D.shifts[code];
      h += `<div class="g-row g-cov"><div class="g-name">${esc(s.name)}</div><div class="g-track">
        <div style="margin-left:${pct(s.start)};width:calc(${pct(s.end)} - ${pct(s.start)})" class="cov ${n<need?"short":""}">${n}/${need}人</div>
      </div><div class="g-hours"></div></div>`;
    });
  }
  $("#gantt").innerHTML = h;
}

// ---- スタッフ
function renderStats(){
  $("#stats").innerHTML = D.staff.map(st => `<div class="stat"><b>${esc(st.name)}</b>
    <span>${st.days}日 ・ ${+st.hours.toFixed(1)}時間 ・ 土日祝 ${st.weekend}日</span></div>`).join("");
}

function showTab(t){
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
  document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== "v-" + t);
}
document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => showTab(b.dataset.tab));

if(D.status !== "最適" && D.status !== "実行可能"){
  document.querySelector("main").innerHTML = `<div class="card empty">シフトを作れませんでした（${esc(D.status)}）</div>`;
} else {
  renderMonth(); renderDay(current); renderStats();
}
</script>
</body>
</html>
"""

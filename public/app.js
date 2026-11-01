const $ = selector => document.querySelector(selector);
const form = $("#quiz-form");
const status = $("#form-status");
const analyzeButton = $("#analyze-btn");
const demoButton = $("#demo-btn");
const pages = $("#report-pages");
const config = window.ARZ_CONFIG || {};
let turnstileId = null;
let latestReport = null;

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const txt = (v, max = 500) => escapeHtml(String(v ?? "").slice(0, max));
const selected = name => form.querySelector('input[name="' + name + '"]:checked')?.value || "";
function setStatus(message, kind = "") { status.textContent = message; status.className = "status " + kind; }
function showOtherFields() {
  $("#industry-other-wrap").hidden = selected("industry") !== "其他";
  $("#pain-other-wrap").hidden = selected("pain") !== "其他";
}
form.addEventListener("change", showOtherFields);

function readAnswers() {
  let industry = selected("industry");
  let pain = selected("pain");
  if (!industry || !pain) throw new Error("請回答第 1、2 題：行業與最花時間的工作。");
  if (industry === "其他") industry = $("#industry-other").value.trim();
  if (pain === "其他") pain = $("#pain-other").value.trim();
  if (industry.length < 2 || industry.length > 60) throw new Error("請補充行業名稱（2～60 字）。");
  if (pain.length < 2 || pain.length > 80) throw new Error("請補充最花時間的工作（2～80 字）。");
  const tools = [...form.querySelectorAll('input[name="tools"]:checked')].map(el => el.value);
  if (!tools.length) throw new Error("請選擇目前使用的工具。");
  const frequency = Number($("#frequency").value);
  const minutes = Number($("#minutes").value);
  if (!Number.isInteger(frequency) || frequency < 1 || frequency > 200) throw new Error("一週處理次數請填 1～200。");
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) throw new Error("每次處理時間請填 1～240 分鐘。");
  const goal = selected("goal");
  if (!goal) throw new Error("請選擇最希望改善的目標。");
  return { industry, pain, tools, frequency, minutes, goal, notes: $("#notes").value.trim().slice(0, 300) };
}

function metricsFrom(answers) {
  const round = n => Math.round(n * 10) / 10;
  return { weeklyHours: round(answers.frequency * answers.minutes / 60), monthlyHours: round(answers.frequency * answers.minutes * 52 / 12 / 60), assumption: "每週次數 × 每次分鐘數；月工時以 52 週 ÷ 12 個月估算。這是現況處理量，並非可全部節省的時間。" };
}

function localDemo(answers) {
  return {
    title: answers.industry + "・工作流程健檢",
    summary: "目前使用 LINE 與人工紀錄確認預約，重複溝通容易占用營業時間。建議先整理營業時段、改期與例外處理規則，再從最常見的預約情境開始測試。",
    risks: ["顧客在不同訊息串提出預約，時段可能重複確認。", "沒有一致的取消與改期規則，容易造成人工交接遺漏。"],
    opportunities: [
      { title: "整理預約與異動規則", why: "讓每位同仁依照同一套條件確認時段。", how: "列出營業時間、預約緩衝、取消期限與特殊情況。", effort: "低" },
      { title: "建立 LINE 預約資料入口", why: "先一次收齊日期、服務和聯絡資訊，減少反覆確認。", how: "用預約表單小規模測試，必要時再加入時段庫存。", effort: "中" },
      { title: "設定確認與提醒流程", why: "減少逐一回覆、提醒與遺漏。", how: "測試預約確認、改期通知，以及人工處理衝突時段。", effort: "中" }
    ],
    nextSteps: ["整理現行預約過程中的 5 個步驟及例外規則。", "選一種最常見的預約類型，先用表單測試一週。", "比較導入前後的耗時與錯誤次數，再決定是否擴充。"],
    flow: ["顧客從 LINE 進入預約", "填寫服務與希望時段", "系統按規則檢查與通知", "管理員確認例外並回覆"],
    isDemo: true
  };
}

function dateLabel(iso) {
  try { return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)); }
  catch { return "近期"; }
}
function sheetHead(no) { return '<header class="sheet-top"><span>ARZ / WORKFLOW LAB</span><span>' + no + ' / 03</span></header>'; }
function sheetFooter(date) { return '<footer class="sheet-footer"><span>本報告僅供初步規劃參考 · ' + txt(date) + '</span><strong>ARZ · 讓流程變得清楚</strong></footer>'; }

function showReport(data) {
  const { report, answers, metrics } = data;
  latestReport = data;
  const date = dateLabel(data.generatedAt);
  const ribbon = report.isDemo ? '<div class="demo-ribbon">示範報告｜非 AI 分析結果</div>' : '<div class="demo-ribbon" style="background:#edf5eb;color:#346247;border-color:#cfdfcc">AI 個人化初步建議</div>';
  const risks = (report.risks || []).slice(0, 2).map((r, i) => '<div class="risk-item"><b>0' + (i + 1) + '</b><span>' + txt(r) + '</span></div>').join("");
  const cards = (report.opportunities || []).slice(0, 3).map((o, i) =>
    '<article class="op-card"><div class="op-card-top"><span class="op-number">0' + (i + 1) + '</span><span class="op-title">' + txt(o.title) + '</span><span class="effort">導入難度 ' + txt(o.effort, 6) + '</span></div><p><strong>為什麼：</strong>' + txt(o.why) + '</p><p><strong>先怎麼做：</strong>' + txt(o.how) + '</p></article>'
  ).join("");
  const flow = (report.flow || []).slice(0, 4).map((s, i) => (i ? '<div class="flow-arrow">↓</div>' : '') + '<div class="flow-step">' + txt(s) + '</div>').join("");
  const steps = (report.nextSteps || []).slice(0, 3).map((s, i) => '<div class="action-item"><strong>0' + (i + 1) + '</strong><span>' + txt(s) + '</span></div>').join("");
  pages.innerHTML = `
    <article class="report-sheet" aria-label="報告第一頁">
      ${sheetHead("01")}
      <div class="sheet-kicker">01 — Current workflow</div>
      ${ribbon}
      <h3 class="sheet-title">${txt(report.title, 100)}</h3>
      <p class="sheet-subtitle">根據填答資料整理目前的工作流程，先看清楚時間花在哪裡，再決定適合的改善方向。</p>
      <div class="sheet-summary">${txt(report.summary)}</div>
      <div class="sheet-section-title">現況處理時間估算</div>
      <div class="metric-panel"><div class="metric-card"><div class="metric-label">每週處理量</div><div class="metric-number">${txt(metrics.weeklyHours)}<small>小時／週</small></div></div>
      <div class="metric-card"><div class="metric-label">每月平均處理量</div><div class="metric-number">${txt(metrics.monthlyHours)}<small>小時／月</small></div></div></div>
      <p class="metric-note">${txt(metrics.assumption)}</p>
      <div class="sheet-section-title">值得注意的兩個風險</div><div class="risk-list">${risks}</div>
      ${sheetFooter(date)}
    </article>
    <article class="report-sheet" aria-label="報告第二頁">
      ${sheetHead("02")}
      <div class="sheet-kicker">02 — Improvement priorities</div>
      <h3 class="sheet-title">從這三件事開始，<br>最容易看見改變。</h3>
      <p class="sheet-subtitle">建議依序評估：先釐清規則，再簡化資料入口，最後才增加自動化。導入難度是初步判斷，仍需確認現場條件。</p>
      ${cards}
      <div class="sheet-summary"><strong>你最想改善的方向：</strong> ${txt(answers.goal)}<br><strong>目前主要使用：</strong> ${txt((answers.tools || []).join("、"))}</div>
      ${sheetFooter(date)}
    </article>
    <article class="report-sheet" aria-label="報告第三頁">
      ${sheetHead("03")}
      <div class="sheet-kicker">03 — Your next move</div>
      <h3 class="sheet-title">把改善想法，<br>變成真正能做的下一步。</h3>
      <div class="sheet-section-title">建議流程示意</div><div class="flow-grid">${flow}</div>
      <div class="sheet-section-title">現在就能開始的 3 件事</div><div>${steps}</div>
      <div class="sheet-callout"><strong>先驗證，再投入。</strong><p>可以先用低成本工具做小規模測試，確認規則、資料權限與人工例外，再評估是否需要客製化系統。</p></div>
      ${sheetFooter(date)}
    </article>`;
  $("#report-section").hidden = false;
  $("#report-desc").textContent = report.isDemo ? "目前顯示的是固定示範案例，並非針對你填答內容的 AI 分析。完成設定後可取得個人化報告。" : "已依照你的填答整理出三頁個人化診斷。可下載 PDF，方便與團隊討論下一步。";
  $("#report-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

function turnstileToken() {
  return turnstileId !== null && window.turnstile ? window.turnstile.getResponse(turnstileId) : "";
}
function initTurnstile(attempt = 0) {
  if (!config.turnstileSiteKey) return;
  $("#turnstile-box").hidden = false;
  if (window.turnstile?.render) {
    turnstileId = window.turnstile.render("#turnstile-widget", { sitekey: config.turnstileSiteKey, theme: "light" });
  } else if (attempt < 25) window.setTimeout(() => initTurnstile(attempt + 1), 300);
}
initTurnstile();

form.addEventListener("submit", async event => {
  event.preventDefault();
  let answers;
  try { answers = readAnswers(); }
  catch (error) { setStatus(error.message, "error"); return; }
  analyzeButton.disabled = true;
  setStatus("正在分析工作流程，通常需要幾秒鐘……");
  try {
    const response = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers, turnstileToken: turnstileToken() }), signal: AbortSignal.timeout(35000), cache: "no-store" });
    let result;
    try { result = await response.json(); } catch { throw new Error("伺服器未回傳有效資料，請稍後再試。"); }
    if (!response.ok) throw new Error(result.error || "分析未完成，請稍後再試。");
    if (!result.report || !result.metrics) throw new Error("報告資料不完整。");
    showReport(result);
    setStatus("分析完成！下方可以查看並下載 PDF。", "success");
  } catch (error) {
    setStatus(error.name === "TimeoutError" ? "分析逾時，請稍後再試；也可以先看示範報告。" : (error.message || "暫時無法分析，請稍後再試。"), "error");
  } finally {
    analyzeButton.disabled = false;
    if (turnstileId !== null && window.turnstile) window.turnstile.reset(turnstileId);
  }
});

demoButton.addEventListener("click", () => {
  const answers = { industry: "美容／美體", pain: "預約排程", tools: ["LINE", "紙本／手寫"], frequency: 35, minutes: 10, goal: "節省時間", notes: "" };
  showReport({ answers, report: localDemo(answers), metrics: metricsFrom(answers), generatedAt: new Date().toISOString() });
  setStatus("已開啟固定示範案例，未使用 AI、未上傳資料。", "success");
});

$("#print-btn").addEventListener("click", () => { if (latestReport) window.print(); });
$("#download-btn").addEventListener("click", async () => {
  if (!latestReport) return;
  const btn = $("#download-btn");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "PDF 製作中……";
  try {
    if (!window.html2canvas || !window.jspdf?.jsPDF) throw new Error("PDF 工具尚未載入。");
    await document.fonts.ready;
    const pdf = new window.jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const sheets = [...pages.querySelectorAll(".report-sheet")];
    for (let i = 0; i < sheets.length; i++) {
      // Render a fixed A4-size copy, regardless of the visitor's mobile viewport width.
      const holder = document.createElement("div");
      holder.style.cssText = "position:absolute;left:-12000px;top:0;width:794px;z-index:-1;pointer-events:none;";
      const clone = sheets[i].cloneNode(true);
      clone.style.cssText = "width:794px;min-width:794px;height:1123px;min-height:1123px;max-height:1123px;padding:54px 58px 42px;box-shadow:none;";
      holder.appendChild(clone);
      document.body.appendChild(holder);
      let canvas;
      try {
        if (clone.scrollHeight > 1128) throw new Error("報告內容太長，請改用列印／另存 PDF。");
        canvas = await window.html2canvas(clone, { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true });
      } finally { holder.remove(); }
      if (i) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.89), "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }
    const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    pdf.save("ARZ_工作流程健檢_" + day + ".pdf");
  } catch (error) {
    alert("PDF 直接下載失敗：" + error.message + "\n可使用「列印／另存 PDF」功能。");
  } finally { btn.disabled = false; btn.textContent = original; }
});

if (config.portfolioUrl) $("#portfolio-link").href = config.portfolioUrl;
if (config.consultationUrl && /^https:\/\//.test(config.consultationUrl)) {
  const link = $("#consult-link");
  link.href = config.consultationUrl;
  link.hidden = false;
}

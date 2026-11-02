// Pure functions shared by the Cloudflare API and Node tests. No personal data is persisted.
// Strip angle brackets and control characters, then cut by code point so emoji are never split in half.
const clean = (value, max = 160) => Array.from(String(value ?? "").replace(/[<>\u0000-\u001f\u007f\u2028\u2029]/g, "").trim()).slice(0, max).join("");
// Accept real numbers or numeric strings only (rejects true, [5], "" and similar coercion tricks).
const toInt = value => (typeof value === "number" || (typeof value === "string" && /^\s*\d+\s*$/.test(value))) ? Number(value) : NaN;
const INDUSTRIES = ["美容／美體", "課程／教育", "診所／健康服務", "零售／電商", "餐飲", "場館／活動", "顧問／接案", "其他"];
const PAINS = ["回覆客戶訊息", "預約排程", "接單與訂單追蹤", "資料整理與報表", "報名與行政審核", "內部交接與派工", "其他"];
const GOALS = ["節省時間", "減少遺漏與錯誤", "提升顧客體驗", "增加接單能力"];
const TOOLS = ["LINE", "Excel", "Google 表單", "紙本／手寫", "現有系統", "其他"];

export function validateAnswers(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("請填寫完整問卷。");
  const industry = clean(raw.industry, 60);
  const pain = clean(raw.pain, 80);
  const goal = clean(raw.goal, 60);
  const notes = clean(raw.notes, 300);
  const tools = Array.isArray(raw.tools) ? [...new Set(raw.tools.slice(0, 12).map(v => clean(v, 40)))].slice(0, 6) : [];
  const frequency = toInt(raw.frequency);
  const minutes = toInt(raw.minutes);
  if (!industry || !(INDUSTRIES.includes(industry) || industry.length >= 2)) throw new Error("請選擇行業。");
  if (!pain || pain.length < 2) throw new Error("請填寫最花時間的工作。");
  if (!GOALS.includes(goal)) throw new Error("請選擇改善目標。");
  if (!tools.length || tools.some(t => !TOOLS.includes(t))) throw new Error("請選擇目前使用的工具。");
  if (!Number.isInteger(frequency) || frequency < 1 || frequency > 200) throw new Error("每週次數請填 1～200。");
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) throw new Error("每次時間請填 1～240 分鐘。");
  return { industry, pain, goal, tools, frequency, minutes, notes };
}

export function calculateMetrics(answers) {
  const weeklyMinutes = answers.frequency * answers.minutes;
  const round = v => Math.round(v * 10) / 10;
  return {
    weeklyMinutes,
    weeklyHours: round(weeklyMinutes / 60),
    monthlyHours: round(weeklyMinutes * 52 / 12 / 60),
    assumption: "每週次數 × 每次分鐘數；月工時以 52 週 ÷ 12 個月估算。這是現況處理量，並非可全部節省的時間。"
  };
}

function pickOpportunities(pain) {
  if (pain.includes("預約")) return [
    { title: "整理可預約規則", why: "先確認營業時間、緩衝與異動規則，避免系統排錯。", how: "把可約時段、取消條件及例外整理成一頁規則表。", effort: "低" },
    { title: "串接預約表單與通知", why: "讓客人自行填寫，減少來回確認。", how: "先以 LINE 入口＋預約表單測試，再評估時段庫存管理。", effort: "中" },
    { title: "預約前提醒", why: "減少逐一提醒與遺漏。", how: "測試確認成功、改期及提醒通知流程。", effort: "中" }
  ];
  if (pain.includes("訊息")) return [
    { title: "整理常見問題", why: "把重複回覆變成一致的標準答案。", how: "整理前 15 個真實問句與正確回覆。", effort: "低" },
    { title: "加入自動回覆與真人轉接", why: "讓簡單問題即時處理，複雜問題留給人。", how: "使用 LINE OA FAQ 並設定無法回答時通知管理員。", effort: "中" },
    { title: "追蹤常見問題趨勢", why: "從常見提問找出網站與服務說明的缺口。", how: "匿名記錄問題分類並每週檢視。", effort: "中" }
  ];
  return [
    { title: "先畫出現在的流程", why: "找出最常重複、最容易漏掉的步驟。", how: "記錄觸發條件、負責人、資料欄位和完成標準。", effort: "低" },
    { title: "建立統一資料入口", why: "減少資料在訊息、表單與試算表之間反覆搬運。", how: "先統一一張表單或登記表，驗證欄位與狀態。", effort: "中" },
    { title: "將例行通知自動化", why: "讓團隊依照同一套規則處理後續工作。", how: "定義觸發事件、通知對象與失敗補救方式。", effort: "中" }
  ];
}

export function buildDemoReport(answers) {
  const opportunities = pickOpportunities(answers.pain);
  return {
    title: `${answers.industry}・工作流程健檢`,
    summary: `目前最耗時的工作是「${answers.pain}」，主要使用 ${answers.tools.join("、")} 處理。建議先把規則與資料入口整理清楚，再小範圍測試自動化。`,
    risks: ["多種工具與人工作業並存時，容易重複輸入或遺漏交接。", "在規則尚未確認前直接導入 AI，可能產生錯誤判斷，仍須設置人工確認。"],
    opportunities,
    nextSteps: ["列出目前實際處理的 5 個步驟與判斷規則。", "選一個高頻、低風險的步驟做最小規模測試。", "記錄測試前後耗時與錯誤率，再決定是否擴充。"],
    flow: ["顧客／同仁提出需求", "統一入口收集資料", "依明確規則判斷與通知", "人工確認例外情況"],
    isDemo: true
  };
}

// Only plain strings are accepted from the model; objects/numbers would otherwise render as "[object Object]".
const bounded = (v, max = 160) => typeof v === "string" ? clean(v, max) : "";
export function normalizeAiReport(value, answers) {
  const fallback = buildDemoReport(answers);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI 報告格式不正確。");
  // Keep the first n items when the model returns extra ones; fall back per item only when an entry is missing/invalid.
  const list = (items, n, fallbackItems, max = 150) => Array.from({ length: n }, (_, i) =>
    (Array.isArray(items) ? bounded(items[i], max) : "") || fallbackItems[i]);
  const ops = Array.isArray(value.opportunities) ? value.opportunities : [];
  const opportunities = fallback.opportunities.map((fb, i) => {
    const item = ops[i] && typeof ops[i] === "object" ? ops[i] : {};
    return {
      title: bounded(item.title, 34) || fb.title,
      why: bounded(item.why, 130) || fb.why,
      how: bounded(item.how, 150) || fb.how,
      effort: ["低", "中", "高"].includes(item.effort) ? item.effort : (ops[i] ? "中" : fb.effort)
    };
  });
  return {
    title: bounded(value.title, 65) || fallback.title,
    summary: bounded(value.summary, 340) || fallback.summary,
    risks: list(value.risks, 2, fallback.risks),
    opportunities,
    nextSteps: list(value.nextSteps, 3, fallback.nextSteps),
    flow: list(value.flow, 4, fallback.flow, 54),
    isDemo: false
  };
}

const strings = n => ({ type: "ARRAY", items: { type: "STRING" }, minItems: n, maxItems: n });
export const reportSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    summary: { type: "STRING" },
    risks: strings(2),
    opportunities: { type: "ARRAY", minItems: 3, maxItems: 3, items: { type: "OBJECT", properties: {
      title: { type: "STRING" }, why: { type: "STRING" }, how: { type: "STRING" },
      effort: { type: "STRING", format: "enum", enum: ["低", "中", "高"] }
    }, required: ["title", "why", "how", "effort"] } },
    nextSteps: strings(3),
    flow: strings(4)
  },
  required: ["title", "summary", "risks", "opportunities", "nextSteps", "flow"],
  propertyOrdering: ["title", "summary", "risks", "opportunities", "nextSteps", "flow"]
};

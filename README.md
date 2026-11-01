# ARZ｜AI 工作流程健檢（MVP）

讓小型商家、工作室與服務業回答 **6 個問題**，經由 **Gemini AI** 產生具體的工作流程改善建議，並下載 **3 頁繁體中文 PDF**。主要流程：問卷 → 資料驗證 → Gemini 結構化分析 → 報告預覽 → 下載 PDF → 瀏覽阿茲作品／進一步諮詢。

> 開發狀態：**可供測試的 MVP 原始碼**，已提供不需 API Key 的「固定示範報告」。尚未在這個 Repository 內設定 Cloudflare Pages 部署，也尚未填入 Gemini API Key、Turnstile 金鑰與正式 LINE 聯絡網址。請勿將尚未部署誤認為已上線。

## 已完成

- 手機／電腦皆可使用的 6 題繁體中文問卷（行業、痛點、工具、頻率、分鐘數、改善目標，另有選填補充欄位）。
- 後端驗證欄位與字數、計算每週／每月處理工時，明確說明 **處理工時不等於節省工時**。
- Cloudflare Pages Functions：`POST /api/analyze` → Gemini JSON 結構化建議（2 項風險、3 項改善方向、4 步驟流程、3 項下一步）。
- 無 API Key 時可點「先看示範報告」，使用瀏覽器內的固定美容工作室情境；報告標示 **示範，非 AI 結果**。
- 三頁 A4 版型、前端產出 PDF（html2canvas + jsPDF CDN），另提供瀏覽器「列印／另存 PDF」備援。
- 表單不用留下姓名、信箱或電話；不建立資料庫、不在伺服器儲存問卷資料。
- 可選擇啟用 Cloudflare Turnstile 驗證（上線前應啟用）、AI 模型可透過環境變數調整。

## 專案結構

```text
public/
  index.html        # 問卷 + 三頁報告預覽
  styles.css        # 視覺與 A4 列印樣式
  app.js            # 前端互動／AI API 呼叫／PDF 下載
  config.js         # 公開設定：作品集、LINE URL、Turnstile Site Key（不可放 API 金鑰）
  _headers          # 靜態資源安全標頭
functions/api/
  analyze.js        # 後端 Gemini API 與 Turnstile 驗證
  health.js         # GET /api/health：設定狀態（不回傳金鑰）
src/diagnosis.js    # 純函式：資料驗證、工時計算、示範產生、AI 回應正規化
tests/              # Node.js 測試
```

## Cloudflare Pages 部署（GitHub 連接）

1. Cloudflare Dashboard → Workers & Pages → Create → **Pages → Connect to Git**，選 `tmparz/analy_classes`。
2. Build configuration：**Framework preset = None**、**Build command = `exit 0`**、**Build output directory = `public`**、Root directory 不變。注意 `functions/` 必須保留在**專案根目錄**，不是 `public/functions/`。
3. 在 Settings → Variables and Secrets 設定 Production 與 Preview（若要在 Preview 也測試 AI）：
   - `GEMINI_API_KEY`：**Secret**；從 Google AI Studio 取得，不可寫進前端程式。
   - `GEMINI_MODEL`：可選，預設 `gemini-2.5-flash-lite`。
   - `TURNSTILE_SECRET_KEY`：上線前建議設定，**Secret**。
   - `REQUIRE_TURNSTILE=true`：上線前建議設定，缺少 Turnstile Secret 時 API 會拒絕操作。
4. 在 `public/config.js` 設定 **Turnstile Site Key**（公開金鑰），須與上述 Secret 同屬同一個 Turnstile Widget；正式諮詢網址確定後設定 `consultationUrl`（例如正確的 LINE OA 加好友連結）。作品集網址預設 `https://arz-ai-showcase.pages.dev/`。
5. 重新部署，檢查 `GET /api/health`，完成一筆完整的 AI 問卷、報告、PDF 下載測試。再用手機測試中文文字、截圖與 PDF 是否完整。

**公開推廣前必做：** 正式 Turnstile、Cloudflare WAF／速率限制、AI 額度與預算警示、Google API Key 使用限制、隱私說明與真實諮詢連結。免費工具不可不設配額就公開放量。

**特別注意：** Cloudflare Pages 若採 Dashboard 的靜態檔案「拖拉上傳」，不會自動建置這個 `functions/` 路由；請使用 **Git 整合**或 Wrangler 部署。

## 在本機測試

前提：Node.js 20+。

```bash
npm test
cp .dev.vars.example .dev.vars
# 在 .dev.vars 中填入私密 GEMINI_API_KEY（勿加入版本控制）
npx wrangler pages dev public
```

開啟 Wrangler 顯示的本機網址。若沒有 Gemini Key，依然能使用「先看示範報告」驗證報告與 PDF。正式 AI 分析功能沒有金鑰時會明確提示尚未設定。

## API 契約

`POST /api/analyze`，Content-Type: `application/json`：

```json
{
  "answers": {
    "industry": "美容／美體",
    "pain": "預約排程",
    "tools": ["LINE", "紙本／手寫"],
    "frequency": 35,
    "minutes": 10,
    "goal": "節省時間",
    "notes": "目前兩人輪流確認預約"
  },
  "turnstileToken": "如已啟用 Turnstile，填入驗證 token"
}
```

成功回傳 `{ report, metrics, answers, generatedAt }`。前端只使用純文字資料渲染（輸出經 HTML escaping）。HTTP 錯誤回傳 `{ error }`，不會把無 API 回應偽裝成 AI 產出。

## 資料與風險

- 正式 AI 分析透過伺服器以 HTTPS 把本次填答傳至 Google Gemini API；現階段不落地 D1、R2 或其他永久資料庫。第三方處理資料仍受其政策與帳戶設定影響。
- 使用者不應輸入姓名、聯絡電話、病歷、身分證字號等敏感資料；題目僅需營運流程概述。
- 防止使用者輸入 prompt injection：後端明確將答案視為未信任資料、使用受約束 JSON 輸出並做回傳內容裁切；這不是完整安全防護，仍應以 Turnstile + WAF 防濫用。
- 工時估算只代表**填答者自述的處理量**，不是財務成效或 ROI 保證。
- V1 PDF 使用圖片式排版以支援中文，便於視覺分享，但 PDF 內文不保證可選取與搜尋；之後可替換成伺服器字型嵌入式 PDF。
- 客戶留資與訂閱尚未實作；之後加入時要個別取得同意，不可預設同意行銷電子報。

## 下一階段

- 實際測試 10 位不同產業的填答者，確認建議與情境符合度。
- 將正式 LINE 聯絡網址、作品集案例與服務方案加入報告轉換區。
- 增加成效回饋（不留資版本）、降低 PDF 圖像檔案大小、測試更多瀏覽器。
- 需要留資時再加 D1 與同意管理；不應一開始就收集不必要的資訊。

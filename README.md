# 📚 每日一本好書：互動式閱讀 PWA（V8）

本專案是供高中學生使用的「100 天，每天一本書」閱讀推廣網站，使用 **GitHub Pages + Google Apps Script Web API + Google 試算表 + Gemini 圖卡**，不用另建資料庫。

## 🌈 功能

- RWD：手機、平板與電腦瀏覽；首頁今日好書、完整導讀與圖卡、歷史書單
- 搜尋／分類／排序／收藏（收藏記錄只儲存在學生自己的瀏覽器）
- 點擊 AI 資訊圖卡放大、瀏覽器語音朗讀（依裝置可用性而定）
- 七項顯示設定：全螢幕、音效、裝置模擬、直橫版面、繁中／英文介面、三種字級、系統／亮色／暗色
- PWA：主畫面安裝、網站檔案離線快取；離線時顯示最近一次取得的公開書單（非即時）
- 介面支援鍵盤、語意標籤、減少動態效果設定；音效預設關閉

## 📁 GitHub 儲存庫架構

```text
library-daily-books/
├── index.html                # 首頁
├── manifest.webmanifest      # PWA 安裝設定
├── sw.js                     # Service Worker 快取
├── README.md                 # 本說明文件
├── css/
│   └── styles.css            # RWD 與亮暗色、裝置／版面設定
├── js/
│   └── app.js                # API 資料、七項設定與互動
└── assets/
    ├── icon-192.png          # PWA 圖示
    └── icon-512.png
```

## 🚀 部署步驟

1. 在已成功運作的 Apps Script `WebApi.gs` 中，確認 `/exec?callback=receiveDailyBooks` 可正常傳回 JSONP。建議保留目前正常執行的 Web API，不需修改 Gemini 或試算表。
2. 打開 `js/app.js`，將 `PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE` 換成你自己的完整 Apps Script `/exec` 網址（不可填 `/dev`）。
3. 在 GitHub 新增公開儲存庫，例如 `library-daily-books`，把整個專案**所有檔案連同資料夾結構**上傳至儲存庫根目錄。
4. GitHub → **Settings → Pages → Build and deployment**，選擇 **Deploy from a branch**，Branch 設 `main`，Folder 設 `/ (root)`，儲存。
5. 網站預計位於 `https://<GitHub帳號>.github.io/library-daily-books/`。首次部署可能需要稍候生效。
6. 用手機 Chrome／Safari 開啟網站，依瀏覽器選單選擇「安裝 App」或「加入主畫面」。PWA 安裝支援因系統與瀏覽器而不同。

## 🔄 每天自動更新

Apps Script 的 V7 自動備書程序負責生成文字、圖卡並將圖片設為可公開；網站**不直接呼叫 Gemini API**。網站每次開啟或按「更新資料」時，只讀取 Web API 已公開的書籍（由原 API 檢查推薦日期與狀態）。

> 提醒：如果你使用 V7 的「必須有圖卡才發布」條件，未準備好圖卡的書籍不會出現在首頁；不會因此把未準備好的新書提前曝光。

## 🔐 安全與注意事項

- **絕對不要**將 Gemini API Key、Google Books API Key 或試算表可編輯權限放在 GitHub。
- 本網站使用既有 Apps Script JSONP 唯讀公開端點，僅適合非敏感的公開書目；不要在 API 裡傳個資。
- `js/app.js` 內的 `API_URL` 是公開的 Web App 位址，不是 API 金鑰。
- 書目若由 AI 自動推薦且沒有外部驗證，可能出現錯誤；圖卡的繁中文字也可能失準。網站已放置說明，仍建議定期抽查。
- 語音朗讀是使用瀏覽器 Web Speech API，並非 Gemini 配音；不同瀏覽器可能缺少繁中語音。
- 圖卡使用公開的 Drive 圖片網址。若學校 Workspace 不允許連結分享，圖片可能無法讀取。
- PWA 不會離線呼叫 Google Apps Script，離線僅顯示最後成功載入的公開資料。
- 裝置及直橫切換是**網站版面預覽**，不會強行改變手機螢幕旋轉方向。
- 英文只翻譯 UI；由試算表提供的書籍內容仍保持繁體中文。

## 🧪 上線檢核

- [ ] `js/app.js` 內已設定 `/exec` API 網址
- [ ] 首頁讀到書籍清單與今日推薦
- [ ] 放大資訊圖卡並能關閉
- [ ] 搜尋、分類、排序、收藏正常
- [ ] 設定面板七項切換正常
- [ ] Chrome／Safari 使用 HTTPS 開啟並測試 PWA
- [ ] 無網路時可看到上次載入的內容與離線提示

## 🛠️ 更新網站

更新檔案推送至 GitHub 的 `main` 分支即可；若 PWA 曾安裝，重新開啟並重新載入後會取得新版資源。若需強制清除舊資源快取，可提高 `sw.js` 的 `VERSION` 字串。


## V8.2 設定面板修正
- 改善設定面板開啟與關閉。
- 防止 localStorage 被停用時設定初始化中斷。
- 強化字體與顯示模式的切換。
- 升級 Service Worker 快取版本，CSS/JS 加上版本參數。
- **重要：** 上傳前請在 `js/app.js` 設定自己的 Apps Script `/exec` 網址。
- GitHub Pages 更新後請使用 Ctrl+Shift+R 強制重新載入；PWA 若仍顯示舊版，可移除舊 App 再從瀏覽器安裝。


## V8.3 設定按鈕修正

修正首頁背景裝飾圖層可能擋住設定按鈕的問題，提升導覽列點擊層級。保留原本 7 大設定和書籍 API。

部署：將完整檔案覆蓋 GitHub 原專案後，確認 GitHub Pages 已完成部署。以網址後附 `?v=83` 測試最新首頁，例如 `https://帳號.github.io/專案/?v=83`。若 PWA 仍讀取舊檔，可在瀏覽器網站資料中清除該網站的快取及 Service Worker 後重新開啟。

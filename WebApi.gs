/**
 * 每日一本好書 V3：公開唯讀 API
 * 放入「原本綁定試算表」的 Apps Script 專案，另建 WebApi.gs。
 * 依賴 DailyBooks.gs 的 DAILY 與 bookSpreadsheet_()。
 * 僅提供狀態「已審核」、推薦日期 <= 台灣今天的資料。
 * 不對外曝露 Google 試算表、Gemini 金鑰或未審核內容。
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  const callback = String(params.callback || '');
  // JSONP 僅接受固定回呼名稱，避免注入任意 JS。
  if (callback && callback !== 'receiveDailyBooks') {
    return ContentService.createTextOutput('/* invalid callback */')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  let payload;
  try {
    payload = publicBooksPayload_();
  } catch (error) {
    console.error('Public API error: ' + error.message);
    payload = { ok: false, error: '目前暫時無法讀取書籍資料，請稍後再試。', books: [] };
  }
  const json = JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  if (callback) {
    return ContentService.createTextOutput('receiveDailyBooks(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function publicBooksPayload_() {
  const ss = bookSpreadsheet_();
  const sheet = ss.getSheetByName(DAILY.SHEET);
  if (!sheet) throw new Error('正式推薦工作表不存在');
  const today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  const count = Math.max(0, sheet.getLastRow() - 1);
  const values = count ? sheet.getRange(2, 1, count, 12).getDisplayValues() : [];
  const artIndex = publicInfographicIndex_();
  const books = values.filter(row => {
    const status = row[10].trim();
    const date = row[11].trim();
    return status === '已審核' && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today;
  }).map(row => ({
    day: Number(row[0]),
    title: row[1],
    author: row[2],
    publisher: row[3],
    published: row[4],
    category: row[5],
    summary: row[6],
    reason: row[7],
    question: row[8],
    source: /^https:\/\//i.test(row[9].trim()) ? row[9].trim() : '',
    date: row[11],
    infographic: artIndex[String(row[0]).trim() + '|' + row[11].trim() + '|' + row[1].trim()] || null
  })).filter(book => Number.isInteger(book.day) && book.title && book.author)
     .sort((a,b) => a.day - b.day);
  return { ok: true, today: today, count: books.length, books: books };
}

/** 編輯器中先執行以確認內容；只有審核通過且日期已到者會顯示。 */
function previewPublicBooks() {
  Logger.log(JSON.stringify(publicBooksPayload_(), null, 2));
}

/**
 * 診斷每筆資料為何無法公開；只能在 Apps Script 編輯器執行。
 * 不會修改任何資料，也不會透過 doGet 對學生公開。
 */
function diagnoseDailyBooksPublication() {
  const ss = bookSpreadsheet_();
  const sheet = ss.getSheetByName(DAILY.SHEET);
  if (!sheet) throw new Error('找不到工作表：' + DAILY.SHEET);
  const today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  const count = Math.max(0, sheet.getLastRow() - 1);
  const rows = count ? sheet.getRange(2, 1, count, 12).getDisplayValues() : [];
  Logger.log('今日：' + today + '；總資料筆數：' + rows.length);
  rows.slice(0, 120).forEach((r, i) => {
    const state = String(r[10]).trim();
    const date = String(r[11]).trim();
    const issues = [];
    if (state !== '已審核') issues.push('K欄不等於「已審核」');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) issues.push('L欄不是 YYYY-MM-DD 格式');
    else if (date > today) issues.push('L欄日期尚未到');
    if (!Number.isInteger(Number(r[0])) || !r[1] || !r[2]) issues.push('Day/書名/作者資料不完整');
    Logger.log('試算表第 ' + (i + 2) + ' 列：' + (r[1] || '(無書名)') +
      '；狀態=' + state + '；日期=' + date + '；' + (issues.join('、') || '符合公開條件'));
  });
}

/**
 * 只讀取圖卡管理表中標示「已公開」的圖卡。
 * H 欄：圖片公開狀態；I 欄：公開圖片 URL。
 * 其餘 Drive 管理用途連結及檔案 ID 絕不傳給網站。
 */
function publicInfographicIndex_() {
  const sh = bookSpreadsheet_().getSheetByName('圖卡管理');
  const result = Object.create(null);
  if (!sh || sh.getLastRow() < 2) return result;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 9).getDisplayValues();
  rows.forEach(r => {
    const [day, date, title, , , , generationState, state, url] = r;
    if (generationState !== '成功' || state !== '已公開') return;
    if (!/^https:\/\/drive\.google\.com\/thumbnail\?id=[A-Za-z0-9_-]+&sz=w\d+$/.test(url)) return;
    result[day.trim() + '|' + date.trim() + '|' + title.trim()] = url;
  });
  return result;
}

/** V6 圖卡發布管理：保留 V5 圖卡管理 A:G 欄，新增 H:I 欄。 */
function setupInfographicPublishing() {
  const ss = bookSpreadsheet_();
  let sh = ss.getSheetByName('圖卡管理');
  if (!sh) sh = ss.insertSheet('圖卡管理');
  const headers = ['Day','推薦日期','書名','Google Drive 檔案 ID','圖片連結（管理用途）','產生時間','狀態','圖片公開狀態','公開圖片 URL'];
  sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  sh.getRange('H:I').setNumberFormat('@');
  Logger.log('圖卡管理發布欄位已建立；原圖卡紀錄保留。');
}

/**
 * 一次發布一張圖卡：在「圖卡管理」選取該列任一儲存格執行。
 * 僅當對應的正式推薦書籍 K 欄「已審核」才允許。
 * 注意：Drive「知道連結的任何人」可存取圖片，不要用於私人/敏感素材。
 */
function publishSelectedInfographic() {
  setupInfographicPublishing();
  const ss = bookSpreadsheet_();
  const art = ss.getSheetByName('圖卡管理');
  const active = ss.getActiveSheet();
  if (active.getSheetId() !== art.getSheetId()) throw new Error('請切換至「圖卡管理」，選取欲公開的圖卡列。');
  const rowNumber = active.getActiveCell().getRow();
  if (rowNumber < 2) throw new Error('請選取資料列，不是標題列。');
  const r = art.getRange(rowNumber,1,1,9).getDisplayValues()[0];
  const [day,date,title,fileId,,,state,publicState] = r;
  if (!fileId || state !== '成功') throw new Error('圖卡尚未成功產生或缺少檔案 ID。');
  const books = ss.getSheetByName('正式推薦100天');
  if (!books) throw new Error('找不到正式推薦100天工作表。');
  const rows = books.getLastRow() < 2 ? [] : books.getRange(2,1,books.getLastRow()-1,12).getDisplayValues();
  const match = rows.find(b => b[0].trim() === day.trim() && b[1].trim() === title.trim() && b[11].trim() === date.trim() && b[10].trim() === '已審核');
  if (!match) throw new Error('沒有對應且已審核的正式推薦書目；請先核對書名、Day、日期與審核狀態。');
  if (publicState === '已公開') { Logger.log('此圖卡已發布。'); return; }
  const file = DriveApp.getFileById(fileId);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w1600';
  art.getRange(rowNumber,8,1,2).setValues([['已公開',url]]);
  Logger.log('圖片已公開：'+url);
}

/** 撤回圖卡公開：取消共用，並清除公開狀態與 URL。 */
function unpublishSelectedInfographic() {
  setupInfographicPublishing();
  const ss = bookSpreadsheet_(), sh = ss.getSheetByName('圖卡管理');
  if (ss.getActiveSheet().getSheetId() !== sh.getSheetId()) throw new Error('請在「圖卡管理」工作表選取資料列。');
  const row = sh.getActiveCell().getRow();
  if (row < 2) throw new Error('請選取圖卡資料列。');
  const id = sh.getRange(row,4).getDisplayValue().trim();
  if (!id) throw new Error('找不到圖片檔案 ID。');
  DriveApp.getFileById(id).setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  sh.getRange(row,8,1,2).setValues([['未公開','']]);
  Logger.log('圖片公開權限已撤回。');
}

/** 批次檢查：只列出已公開圖卡，不會改變權限。 */
function previewInfographicPublishing() {
  const sh = bookSpreadsheet_().getSheetByName('圖卡管理');
  if (!sh || sh.getLastRow() < 2) { Logger.log('尚未產生圖卡。'); return; }
  sh.getRange(2,1,sh.getLastRow()-1,9).getDisplayValues().forEach(r => {
    Logger.log(r[2]+'｜'+r[1]+'｜'+r[7]+'｜'+r[8]);
  });
}

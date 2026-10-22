/**
 * 每日一本好書 V7.1：無 Google Books 依賴；按日期備書、生成圖卡、自動發布與失敗紀錄。
 * 保留 V5/V6 既有檔案，並依賴：
 *   bookSpreadsheet_(), callGemini_(prompt,true), bv5GenerateForRow_(row),
 *   bv5DateText_(), setupInfographicPublishing()
 * 不使用 Google Books API；不使用舊 runDailyBook 或舊圖卡排程。
 */
const AUTO7 = Object.freeze({
  BOOKS:'正式推薦100天', ARTS:'圖卡管理', LOG:'V7執行紀錄',
  START:'2026-10-13', DAYS:100, AHEAD:7,
  HANDLER:'auto7Run', MAX_TEXT_ATTEMPTS:3, TZ:'Asia/Taipei'
});
function auto7Date_(value){
  if (value instanceof Date && !isNaN(value)) return Utilities.formatDate(value,AUTO7.TZ,'yyyy-MM-dd');
  const s=String(value==null?'':value).trim().replace(/\//g,'-');
  const m=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if(!m)return '';
  const iso=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
  const dt=new Date(iso+'T00:00:00Z');
  return !isNaN(dt)&&dt.toISOString().slice(0,10)===iso?iso:'';
}
function auto7Ord_(iso){return Math.floor(Date.parse(iso+'T00:00:00Z')/86400000);}
function auto7FromOrd_(n){return new Date(n*86400000).toISOString().slice(0,10);}
function auto7Today_(){return Utilities.formatDate(new Date(),AUTO7.TZ,'yyyy-MM-dd');}
function auto7Days_(){
  const start=auto7Ord_(AUTO7.START), today=auto7Ord_(auto7Today_());
  const first=Math.max(start,today), last=Math.min(start+AUTO7.DAYS-1,today+AUTO7.AHEAD);
  const arr=[];for(let n=first;n<=last;n++)arr.push({date:auto7FromOrd_(n),day:n-start+1});
  return arr;
}
function auto7Log_(stage,day,date,result,detail){
  const ss=bookSpreadsheet_();let sh=ss.getSheetByName(AUTO7.LOG);
  if(!sh){sh=ss.insertSheet(AUTO7.LOG);sh.appendRow(['時間','階段','Day','推薦日期','結果','說明']);sh.setFrozenRows(1);}
  sh.appendRow([Utilities.formatDate(new Date(),AUTO7.TZ,'yyyy-MM-dd HH:mm:ss'),stage,day,date,result,String(detail||'').slice(0,2500)]);
}
function auto7Rows_(){
  const sh=bookSpreadsheet_().getSheetByName(AUTO7.BOOKS);
  if(!sh)throw new Error('找不到 '+AUTO7.BOOKS);
  return {sh, rows:sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,12).getValues():[]};
}
function auto7ArtRows_(){
  const sh=bookSpreadsheet_().getSheetByName(AUTO7.ARTS);
  return {sh, rows:sh&&sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,9).getValues():[]};
}
function auto7FindBook_(date){
  const a=auto7Rows_();const m=[];
  a.rows.forEach((r,i)=>{if(auto7Date_(r[11])===date)m.push({row:i+2,data:r});});
  if(m.length>1)throw new Error('推薦日期 '+date+' 有重複書籍 '+m.length+' 筆，請先處理');
  return m[0]||null;
}
function auto7TitleKey_(x){return String(x||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');}
function auto7ExistingTitles_(){
  const ss=bookSpreadsheet_();const names=['每日好書推薦',AUTO7.BOOKS,'自動生成測試'];
  const out=new Set();names.forEach(name=>{const sh=ss.getSheetByName(name);if(!sh||sh.getLastRow()<2)return;
    sh.getRange(2,2,sh.getLastRow()-1,1).getValues().forEach(r=>{const s=auto7TitleKey_(r[0]);if(s)out.add(s);});
  });return out;
}
/**
 * 不呼叫外部書目 API。僅做格式與內容基本檢查。
 * 這不是事實查核，可能仍有錯誤、虛構或書籍版本不符。
 */
function auto7ValidateGenerated_(b, excluded){
  if(!b || typeof b!=='object' || Array.isArray(b)) throw new Error('Gemini JSON 必須是單一本書物件');
  for(const field of ['title','author','category','summary','reason','question']){
    if(typeof b[field]!=='string' || !b[field].trim()) throw new Error('缺少必要欄位 '+field);
  }
  if(auto7TitleKey_(b.title).length<2) throw new Error('書名過短');
  if(excluded.has(auto7TitleKey_(b.title))) throw new Error('圖書重複：'+b.title);
  if(b.summary.trim().length<45 || b.reason.trim().length<30) throw new Error('簡介或推薦理由過短');
  for(const field of ['title','author','publisher','publishDate','category','summary','reason','question']){
    if(String(b[field]||'').length>4000) throw new Error('欄位過長：'+field);
  }
  return b;
}
function auto7CreateBook_(day,date){
  const {sh}=auto7Rows_();const excluded=auto7ExistingTitles_();
  for(let k=1;k<=AUTO7.MAX_TEXT_ATTEMPTS;k++){
    const prompt=`你是台灣高中圖書館閱讀推薦館員。為日期 ${date} 的 Day ${day} 推薦一本真實存在且有繁體中文版、適合高中生閱讀的圖書，避開以下書名：${JSON.stringify([...excluded])}。\n只能輸出 JSON 物件，欄位必須是 title,author,publisher,publishDate,category,summary,reason,question。\n簡介約150至220字，推薦理由約100至150字，開放式思考題一題。優先使用廣為人知且真實出版的書籍；書名作者正確、避免暴力露骨內容、不捏造情節或引文、不要爆雷。publisher 與 publishDate 不確定時填待查證。使用繁體中文。`;
    try{
      const b=callGemini_(prompt,true);
      auto7ValidateGenerated_(b,excluded);
      const rows=auto7Rows_().rows;
      const usedDay=new Set(rows.map(r=>Number(r[0])).filter(Number.isInteger));
      if(usedDay.has(day))throw new Error('Day '+day+' 已被其他推薦日期使用，暫停以免改動既有資料');
      if(auto7FindBook_(date))return;
      // K 欄沿用網站識別值「已審核」；實際意義為 AI 自動核准，並未人工或外部查證。
      sh.appendRow([day,auto7Safe_(b.title),auto7Safe_(b.author),auto7Safe_(b.publisher||'待查證'),
        auto7Safe_(b.publishDate||'待查證'),auto7Safe_(b.category),auto7Safe_(b.summary),auto7Safe_(b.reason),
        auto7Safe_(b.question),'AI 推薦（未經外部書目查核）','已審核',date]);
      auto7Log_('生成書籍',day,date,'成功','《'+b.title+'》；AI 自動核准，未外部查證');
      return;
    }catch(e){auto7Log_('生成書籍',day,date,'失敗','第'+k+'次：'+e.message);if(k===AUTO7.MAX_TEXT_ATTEMPTS)throw e;}
  }
}
function auto7Safe_(x){const s=String(x==null?'':x).trim();return /^[=+\-@\t\r]/.test(s)?"'"+s:s;}
function auto7Art_(book){
  const {rows}=auto7ArtRows_();const d=book.data,date=auto7Date_(d[11]), title=String(d[1]).trim(), day=Number(d[0]);
  const hits=[];rows.forEach((r,i)=>{if(Number(r[0])===day&&auto7Date_(r[1])===date&&String(r[2]).trim()===title&&String(r[6]).trim()==='成功'&&String(r[3]).trim())hits.push({row:i+2,data:r});});
  return hits.find(x=>String(x.data[7]).trim()==='已公開')||hits[0]||null;
}
function auto7Publish_(book,art){
  const d=book.data,r=art.data;
  if(String(d[10]).trim()!=='已審核')throw new Error('非已審核書籍');
  const id=String(r[3]).trim();if(!id)throw new Error('缺少圖片檔案 ID');
  if(String(r[7]).trim()==='已公開'&&/^https:\/\//.test(String(r[8])))return;
  DriveApp.getFileById(id).setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
  const url='https://drive.google.com/thumbnail?id='+encodeURIComponent(id)+'&sz=w1600';
  auto7ArtRows_().sh.getRange(art.row,8,1,2).setValues([['已公開',url]]);
  auto7Log_('公開圖卡',Number(d[0]),auto7Date_(d[11]),'成功',id);
}
/** 一次最多處理 1 個尚未完成的耗時工作，避免 6 分鐘執行上限。 */
function auto7Run(){
  // 使用使用者鎖，避免與 V5 繪圖函式使用的 script lock 互相卡住。
  const lock=LockService.getUserLock();if(!lock.tryLock(2000))return;
  try{
    setupInfographicPublishing();
    const dates=auto7Days_();
    for(const item of dates){
      try{
        let book=auto7FindBook_(item.date);
        if(!book){auto7CreateBook_(item.day,item.date);return;}
        const d=book.data;
        if(Number(d[0])!==item.day)throw new Error('Day 與日期不吻合，請修正既有資料');
        if(String(d[10]).trim()!=='已審核')throw new Error('審核狀態非已審核');
        const art=auto7Art_(book);
        if(!art){
          bv5GenerateForRow_(book.row);
          auto7Log_('生成圖卡',item.day,item.date,'成功','請由下次執行公開圖片');
          return;
        }
        if(String(art.data[7]).trim()!=='已公開'||!String(art.data[8]).trim()){
          auto7Publish_(book,art);return;
        }
      }catch(e){
        auto7Log_('當日處理',item.day,item.date,'失敗',e.stack||e.message);
        Logger.log('Day '+item.day+'：'+e.message+'；繼續巡檢其他日期');
      }
    }
    auto7Log_('檢查',0,auto7Today_(),'完成','未來 7 天已巡檢；失敗日保留供下次重試');
  }catch(e){auto7Log_('主流程',0,auto7Today_(),'失敗',e.stack||e.message);Logger.log(e.stack||e.message);
  }finally{lock.releaseLock();}
}
/** 先執行：只檢查進度，不呼叫 Gemini。 */
function auto7Preview(){
  for(const item of auto7Days_()){
    try{const b=auto7FindBook_(item.date);const a=b?auto7Art_(b):null;
      Logger.log(item.date+' Day '+item.day+'｜'+(!b?'缺書':!a?'缺圖':String(a.data[7]).trim()==='已公開'?'已公開':'待公開'));
    }catch(e){Logger.log(item.date+'：'+e.message);}
  }
}
/** 啟動前請備份試算表；改為每小時巡檢一次，初期可盡快補齊未來七天。 */
function auto7Install(){
  const old=['runDailyBook','generateTodayBookInfographic','auto7Run'];
  ScriptApp.getProjectTriggers().filter(t=>old.includes(t.getHandlerFunction())).forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger(AUTO7.HANDLER).timeBased().everyHours(1).create();
  auto7Log_('設定',0,auto7Today_(),'成功','已安裝每小時巡檢，並移除舊文字／圖卡排程');
}
function auto7Stop(){ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===AUTO7.HANDLER).forEach(t=>ScriptApp.deleteTrigger(t));}

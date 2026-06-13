// ==================== 管理面板 HTML 模板 ====================

function fmtUTC(iso) {
  if (!iso) return "-";
  var d = new Date(iso);
  var pad = function(n) { return n < 10 ? "0" + n : "" + n; };
  return pad(d.getUTCMonth() + 1) + "/" + pad(d.getUTCDate()) + " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + " UTC";
}

var DTL = '<div id="dv" class="ov" onclick="if(event.target===this)closeDetail()"><div class="md" id="detailMd" onclick="event.stopPropagation()">'
  + '<div id="detailContent"></div>'
  + '<div style="margin-top:var(--ss)"><div class="lb">降价阈值 (USD)</div><input class="in" id="dtThreshold" type="number" step="0.01" value="6" style="height:40px;font-size:14px"></div>'
  + '<div style="margin-top:var(--ss)"><div class="lb">地区</div><input class="in" id="dtCountry" value="us" style="height:40px;font-size:14px"></div>'
  + '<div style="margin-top:var(--ss)"><div class="lb">备注</div><input class="in" id="dtNote" placeholder="可写备注信息" style="height:40px;font-size:14px"></div>'
  + '<div style="margin-top:var(--ss)"><label class="tg"><input type="checkbox" class="tgi" id="dtMonitorMode"><span class="tk"></span> 价格变动时通知</label></div>'
  + '<button class="bp" onclick="addFromDetail()" id="detailAddBtn" style="margin-top:var(--sm);height:40px;font-size:14px">添加监控</button>'
  + '</div></div>';

var EDT = '<div id="ov" class="ov" onclick="if(event.target===this)closeEdit()"><div class="md" onclick="event.stopPropagation()"><h2>编辑应用</h2><div style="display:grid;gap:var(--ss)"><div><div class="lb">显示名称</div><input class="in" id="eName"></div><div><div class="lb">备注</div><input class="in" id="eNote" placeholder="可写备注信息"></div><div><div class="lb">降价阈值 (USD)</div><input class="in" id="eThreshold" type="number" step="0.01"></div><div><div class="lb">地区</div><input class="in" id="eCountry"></div><div><label class="tg"><input type="checkbox" class="tgi" id="eMonitorMode"><span class="tk"></span> 价格变动时通知</label></div></div><button class="bp" onclick="saveEdit()" style="margin-top:var(--sm)">保存</button></div></div>';

var SCRIPT = [
  'var tt=document.getElementById("tt"),ttm,edId=null,detailData=null;',
  'function show(m){tt.textContent=m;tt.classList.add("s");clearTimeout(ttm);ttm=setTimeout(function(){tt.classList.remove("s")},2500)}',
  'async function api(p,o){var r=await fetch(p,Object.assign({},o,{headers:{"Content-Type":"application/json"}})),d=await r.json();if(!r.ok){show(d.error||"请求失败");throw new Error(d.error)}return d}',
  'function addApp(e){e.preventDefault();var f=new FormData(e.target);api("/api/apps",{method:"POST",body:JSON.stringify({app_id:f.get("app_id"),name:f.get("name")||"",threshold:parseFloat(f.get("threshold")),country:f.get("country"),note:f.get("note")||"",monitor_mode:f.get("monitor_mode")?"change":"threshold"})}).then(function(){show("已添加");setTimeout(function(){location.reload()},800)})}',
  'function removeApp(id){if(!confirm("确认删除？"))return;api("/api/apps",{method:"DELETE",body:JSON.stringify({app_id:id})}).then(function(){show("已删除");setTimeout(function(){location.reload()},800)})}',
  'function editApp(id,n,c,t,nt,mm){edId=id;document.getElementById("eName").value=n;document.getElementById("eThreshold").value=t;document.getElementById("eCountry").value=c;document.getElementById("eNote").value=nt||"";document.getElementById("eMonitorMode").checked=!!mm;document.getElementById("ov").classList.add("s")}',
  'function closeEdit(){edId=null;document.getElementById("ov").classList.remove("s")}',
  'function saveEdit(){if(!edId)return;var n=document.getElementById("eName").value.trim(),t=parseFloat(document.getElementById("eThreshold").value),c=document.getElementById("eCountry").value.trim(),nt=document.getElementById("eNote").value.trim(),mm=document.getElementById("eMonitorMode").checked;if(!n){show("名称不能为空");return}if(isNaN(t)||t<=0){show("无效阈值");return}var b={app_id:edId,name:n,threshold:t,country:c,note:nt,monitor_mode:mm?"change":"threshold"};api("/api/apps",{method:"PATCH",body:JSON.stringify(b)}).then(function(){show("已更新");closeEdit();setTimeout(function(){location.reload()},800)})}',
  'function checkAll(){show("正在检查...");api("/api/check").then(function(){show("检查完成");setTimeout(function(){location.reload()},1500)})}',
  'async function doSearch(){var q=document.getElementById("searchTerm").value.trim();if(!q){show("请输入关键词");return}var el=document.getElementById("searchResults");el.textContent="搜索中...";try{var d=await api("/api/search?term="+encodeURIComponent(q));if(!d.results||d.results.length===0){el.innerHTML="<div style=\'text-align:center;padding:20px;color:var(--m)\'>未找到结果</div>";return}var h="";for(var i=0;i<d.results.length;i++){var r=d.results[i];h+="<div class=\'sri\' onclick=\'showDetail(\\""+escJs(r.appId)+"\\",\\""+escJs(r.title)+"\\",\\""+escJs(r.icon||"")+"\\",\\""+escJs(r.priceText||(r.free?"免费":""))+"\\",\\""+escJs(r.developer||"")+"\\",\\""+escJs(r.scoreText||"")+"\\")\'>";if(r.icon){h+="<img src=\'"+r.icon+"\' alt=\'\' onerror=\'this.style.display=\\"none\\"\'>"}h+="<div class=\'srd\'><div class=\'srn\'>"+r.title+"</div><div class=\'sra\'>"+r.appId+" - "+r.developer+"</div></div><div class=\'srp\'>"+(r.priceText||(r.free?"免费":""))+"</div></div>"}el.innerHTML="<div class=\'sr\'>"+h+"</div>"}catch(e){el.innerHTML="<div style=\'text-align:center;padding:20px;color:var(--m)\'>搜索失败</div>"}}',
  'function escJs(s){if(!s)return "";return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\'/g,"\\\'").replace(/"/g,"&quot;")}',
  'function showDetail(id,title,icon,price,dev,score){detailData={id:id,title:title};var h="";h+="<div style=\'display:flex;align-items:center;gap:var(--sm);margin-bottom:var(--ss)\'>";if(icon){h+="<img src=\'"+icon+"\' alt=\'\' style=\'width:44px;height:44px;border-radius:10px;flex-shrink:0\' onerror=\'this.style.display=\\"none\\"\'>"}h+="<div><div style=\'font-size:17px;font-weight:700\'>"+title+"</div><div style=\'font-size:11px;color:var(--m);margin-top:1px\'>"+id+"</div></div></div>";h+="<div class=\'g\' style=\'margin-bottom:0\'>";h+="<div class=\'gi\' style=\'padding:10px\'><div class=\'gl\'>评分</div><div class=\'v\'><span class=\'mat\' style=\'font-size:14px;color:#fbbc04;vertical-align:middle\'>star</span> "+(score||"-")+"</div></div>";h+="<div class=\'gi\' style=\'padding:10px\'><div class=\'gl\'>价格</div><div class=\'v\'>"+(price||"-")+"</div></div>";h+="</div>";if(dev){h+="<div class=\'gi\' style=\'padding:10px;margin-top:var(--ss)\'><div class=\'gl\'>开发者</div><div class=\'v\'>"+dev+"</div></div>"}document.getElementById("detailContent").innerHTML=h;document.getElementById("dv").classList.add("s")}',
  'function closeDetail(){detailData=null;document.getElementById("dv").classList.remove("s")}',
  'function addFromDetail(){if(!detailData)return;var btn=document.getElementById("detailAddBtn");var t=parseFloat(document.getElementById("dtThreshold").value);var c=document.getElementById("dtCountry").value.trim();var nt=document.getElementById("dtNote").value.trim();var mm=document.getElementById("dtMonitorMode").checked;if(isNaN(t)||t<=0){show("无效阈值");return}btn.disabled=true;btn.textContent="添加中...";api("/api/apps",{method:"POST",body:JSON.stringify({app_id:detailData.id,name:detailData.title,threshold:t,country:c||"us",note:nt||"",monitor_mode:mm?"change":"threshold"})}).then(function(){show("已添加");closeDetail();setTimeout(function(){location.reload()},800)}).catch(function(){btn.disabled=false;btn.textContent="添加监控"})}',
].join("");

function renderHtml(apps, history, hasSc3, hasProxy) {
  try {
    var cards = "";
    for (var i = 0; i < apps.length; i++) {
      var a = apps[i], st = a.status || {};
      var p = st.last_checked_price, ps = p !== undefined ? "$" + p : "-";
      var ts = fmtUTC(st.last_checked_at), ns = fmtUTC(st.last_notified_at);
      var cm = a.monitor_mode === "change";
      var lo = !cm && p !== undefined && p > 0 && p < a.threshold;
      var icon = st.icon || "", score = st.scoreText || "", ratings = st.ratings || "", note = a.note || "", dev = st.developer || "";
      var rn = parseInt(ratings, 10), rd = !isNaN(rn) && rn >= 1000 ? (rn / 1000).toFixed(1).replace(/\.0$/, "") + "k" : ratings;
      var head = '<div class="ach">';
      if (icon) { head += '<img src="' + esc(icon) + '" alt="" class="aci-icon" onerror="this.style.display=\'none\'">'; }
      head += '<div class="acn"><div class="act">' + esc(a.name) + '</div>';
      if (dev) { head += '<div class="aci">' + esc(dev) + '</div>'; }
      head += '<div class="aci" style="font-size:10px">' + esc(a.id) + '</div></div><span class="' + (cm ? "bg tc" : (lo ? "bg" : "bg gy")) + '">' + (cm ? "变动" : (lo ? "低于阈值" : "正常")) + '</span></div>';
      var sv = (score ? '<span class="mat" style="font-size:14px;color:#fbbc04;vertical-align:middle">star</span> ' + esc(score) + ' ' : "") + (rd ? '<span style="color:var(--m)">|</span> <span class="mat" style="font-size:14px;color:var(--m);vertical-align:middle">bookmark_border</span> ' + esc(rd) : "");
      var extra;
      if (note) {
        extra = '<div class="gi"><div class="gl">评分 / 心愿单</div><div class="v">' + sv + '</div></div><div class="gi"><div class="gl">备注</div><div class="v" style="font-size:12px;color:#856404">' + esc(note) + '</div></div>';
      } else {
        extra = '<div class="gi" style="grid-column:1/3"><div class="gl">评分 / 心愿单</div><div class="v">' + sv + '</div></div>';
      }
      cards += '<div class="ac">' + head + '<div class="acb"><div class="g"><div class="gi"><div class="gl">当前价格</div><div class="v' + (lo ? " gr" : "") + '">' + ps + '</div></div><div class="gi"><div class="gl">' + (cm ? "监控" : "阈值") + '</div><div class="v">' + (cm ? "变动" : "$" + a.threshold) + '</div></div>' + extra + '<div class="gi"><div class="gl">检查</div><div class="v">' + ts + '</div></div><div class="gi"><div class="gl">通知</div><div class="v">' + ns + '</div></div></div><div class="ar"><button class="bs" onclick="editApp(' + "'" + esc(a.id) + "','" + esc(a.name) + "','" + esc(a.country || "us") + "'," + a.threshold + ",'" + esc(note) + "'," + (cm ? "true" : "false") + ')"><span class="mat">edit</span></button><button class="bs br" onclick="removeApp(' + "'" + esc(a.id) + "'" + ')"><span class="mat">delete</span></button></div></div></div>';
    }
    var hr = "";
    for (var j = 0; j < history.length; j++) {
      var hh = history[j];
      hr += '<div class="hr"><span class="ht">' + fmtUTC(hh.time) + '</span><span class="hn">' + esc(hh.name) + '</span><span class="hp">$' + hh.price + '</span><span class="bg hb' + (hh.notified ? "" : " gy") + '">' + (hh.notified ? "已通知" : "跳过") + '</span></div>';
    }
    var noApps = apps.length === 0 ? '<div class="cd" style="text-align:center;padding:32px;color:var(--m);font-weight:500;font-size:14px">暂无监控应用</div>' : cards;
    var warn = !hasSc3 ? '<div class="w"><span class="mat" style="font-size:16px">warning</span> 未配置通知</div>' : "";
    var searchBox = hasProxy ? '<div class="cd" id="searchSection"><div class="sh"><span class="st"><span class="mat" style="font-size:16px;vertical-align:middle;margin-right:3px">monitoring</span>监控价格</span></div><div style="display:flex;gap:var(--ss);margin-top:var(--ss)"><input class="in" id="searchTerm" placeholder="输入关键词搜索 Google Play..." style="flex:1" onkeydown="if(event.key===\'Enter\'){event.preventDefault();doSearch()}"><button class="bp" onclick="doSearch()" style="width:56px;flex-shrink:0;padding:0"><span class="mat">search</span></button></div><div id="searchResults"></div></div>' : "";
    var addForm = '<div class="cd"><div class="sc-h"><span class="mat">add_box</span><h2>添加应用</h2></div>';
    addForm += '<form id="af" onsubmit="addApp(event)"><div style="display:grid;gap:var(--ss)">';
    addForm += '<div><div class="lb">Google Play ID</div><input class="in" name="app_id" placeholder="com.flyersoft.moonreaderp" required></div>';
    addForm += '<div><div class="lb">显示名称 <span style="color:var(--m);font-weight:400">（可选）</span></div><input class="in" name="name" placeholder="留空自动获取"></div>';
    addForm += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--ss)"><div><div class="lb">降价阈值 (USD)</div><input class="in" name="threshold" type="number" step="0.01" value="6" required></div><div><div class="lb">地区</div><input class="in" name="country" value="us"></div></div></div>';
    addForm += '<div><div class="lb">备注</div><input class="in" name="note" placeholder="可写备注信息"></div>';
    addForm += '<div style="margin-top:4px"><label class="tg"><input type="checkbox" class="tgi" name="monitor_mode"><span class="tk"></span> 价格变动时通知</label></div>';
    addForm += '<button type="submit" class="bp" style="margin-top:var(--sm)"><span class="mat" style="font-size:20px">add</span>添加监控</button></form></div>';
    var out = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><title>Price Monitor</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet"><link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet"><style>';
    out += ':root{--p:#9fe870;--op:#0e0f0c;--pa:#cdffad;--pp:#e2f6d5;--k:#0e0f0c;--b:#454745;--m:#868685;--c:#fff;--s:#e8ebe6;--pos:#2ead4b;--neg:#d03238;--rx:24px;--rm:12px;--rp:9999px;--ss:8px;--sm:12px;--sl:16px;--sxl:24px;--f:Inter,sans-serif}@media(prefers-color-scheme:dark){:root{--p:#9fe870;--op:#e8e6e3;--pa:#2a5a2a;--pp:#1a3a1a;--k:#e8e6e3;--b:#a0a0a0;--m:#6b6b6b;--c:#1c1c1e;--s:#2c2c2e;--pos:#4ade80;--neg:#f87171}}';
    out += '*{margin:0;padding:0;box-sizing:border-box}body{font-family:var(--f);font-size:16px;color:var(--k);background:var(--s);display:flex;justify-content:center;padding:var(--sl);min-height:100dvh}.wr{width:100%;max-width:480px;display:flex;flex-direction:column;gap:var(--sm);margin-top:var(--ss);padding-bottom:40px}';
    out += '.st{display:inline-flex;align-items:center;padding:5px 16px 5px 12px;border-radius:var(--rp);background:var(--p);color:var(--op);font-size:14px;font-weight:700;height:30px}.st .mat{font-size:16px}';
    out += '.rn{display:inline-flex;align-items:center;justify-content:center;height:34px;padding:6px 18px;border-radius:14px;font-family:var(--f);font-size:13px;font-weight:600;cursor:pointer;border:none;gap:4px;background:var(--s);color:var(--k)}.rn:hover{background:var(--pp);color:#163300}.rn .mat{font-size:16px}';
    out += '.sc-h{display:flex;align-items:center;gap:var(--ss);margin-bottom:var(--ss)}.sc-h .mat{font-size:22px;color:var(--p)}.sc-h h2{font-size:18px;font-weight:700;letter-spacing:-.02em}.ac{background:var(--c);border-radius:var(--rx);box-shadow:0 4px 24px rgba(14,15,12,.06);overflow:hidden}.ach{display:flex;align-items:center;gap:var(--sm);padding:var(--sl) var(--sl) var(--ss)}.aci-icon{width:36px;height:36px;border-radius:8px;flex-shrink:0}.acn{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}.act{font-size:17px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.aci{font-size:11px;color:var(--m);font-weight:500;word-break:break-all}.acb{padding:0 var(--sl) var(--sl)}';
    out += '.bg{display:inline-flex;align-items:center;padding:4px 12px;border-radius:var(--rp);font-size:11px;font-weight:700;white-space:nowrap;background:var(--pp);color:#163300}.bg.gy{background:var(--s);color:var(--b)}.bg.tc{background:#dbeafe;color:#1e40af}.g{display:grid;grid-template-columns:1fr 1fr;gap:var(--ss);margin-bottom:var(--sm)}.gi{background:var(--s);border-radius:var(--rm);padding:14px}.gl{font-size:9px;font-weight:700;text-transform:uppercase;color:var(--m);margin-bottom:2px;letter-spacing:.03em}.v{font-size:14px;font-weight:600;word-break:break-all;font-variant-numeric:tabular-nums;color:var(--k)}.v.gr{color:var(--pos)}.ar{display:flex;gap:var(--ss)}';
    out += '.bs{display:inline-flex;align-items:center;justify-content:center;height:38px;width:38px;border-radius:var(--rp);font-family:var(--f);cursor:pointer;border:none;background:var(--s);color:var(--k)}.bs:hover{background:var(--pp);color:#163300}.bs .mat{font-size:18px}.bs.br .mat{color:var(--neg)}.bp{display:inline-flex;align-items:center;justify-content:center;height:46px;border-radius:var(--rp);font-family:var(--f);font-size:16px;font-weight:600;cursor:pointer;border:none;gap:6px;background:var(--p);color:var(--op);width:100%}.bp:hover{background:var(--pa)}.bp:disabled{opacity:0.5;cursor:default}';
    out += '.in{width:100%;height:50px;background:var(--c);border:2px solid var(--k);border-radius:var(--rm);padding:0 var(--sl);font-family:var(--f);font-size:16px;color:var(--k);outline:none}.in:focus{border-color:var(--p);box-shadow:0 0 0 3px rgba(159,232,112,.2)}.lb{font-size:10px;font-weight:700;text-transform:uppercase;color:var(--b);margin-bottom:6px;letter-spacing:.03em}.cd{background:var(--c);border-radius:var(--rx);box-shadow:0 4px 24px rgba(14,15,12,.06);padding:var(--sl)}.sh{display:flex;align-items:center;justify-content:space-between}';
    out += '.tg{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;cursor:pointer;color:var(--k)}.tg .tgi{display:none}.tg .tk{width:36px;height:20px;background:var(--s);border-radius:10px;position:relative;transition:background .2s;flex-shrink:0}.tg .tk::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;background:var(--m);border-radius:50%;transition:all .2s}.tg .tgi:checked+.tk{background:var(--p)}.tg .tgi:checked+.tk::after{background:var(--k);left:18px}';
    out += '.hr{display:flex;align-items:center;gap:var(--ss);padding:10px 0;border-bottom:1px solid var(--s);font-size:13px}.hr:last-child{border-bottom:none}.ht{color:var(--m);font-weight:500;white-space:nowrap;min-width:52px;font-variant-numeric:tabular-nums}.hn{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hp{font-weight:700;font-variant-numeric:tabular-nums}.hb{padding:2px 10px;font-size:10px}';
    out += '.w{background:#fff3cd;color:#856404;border-radius:var(--rm);padding:var(--sm) var(--sl);font-size:13px;font-weight:500;display:flex;align-items:center;gap:6px}.tt{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--k);color:var(--p);padding:8px 18px;border-radius:var(--rp);font-size:13px;z-index:10000;opacity:0;transition:opacity .2s;pointer-events:none;font-weight:500}.tt.s{opacity:1}.ft{text-align:center;padding:20px 0;font-size:12px;color:var(--m);font-weight:500}';
    out += '.mat{font-family:Material Symbols Rounded;font-weight:400;font-style:normal;font-size:18px;display:inline-block;line-height:1;letter-spacing:normal;text-transform:none;white-space:nowrap;word-wrap:normal}';
    out += '.ov{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.35);z-index:9999;display:none;align-items:center;justify-content:center;padding:var(--sl)}.ov.s{display:flex}.md{background:var(--c);border-radius:var(--rx);width:100%;max-width:400px;padding:var(--sxl);box-shadow:0 8px 40px rgba(14,15,12,.12)}.md h2{font-size:20px;font-weight:900;letter-spacing:-.03em;margin-bottom:var(--sm)}';
    out += '.sr{margin-top:var(--sm);display:flex;flex-direction:column;gap:var(--ss)}.sri{display:flex;align-items:center;gap:var(--sm);background:var(--s);border-radius:var(--rm);padding:var(--sm);cursor:pointer;transition:background .15s}.sri:hover{background:var(--pp)}.sri img{width:40px;height:40px;border-radius:8px;flex-shrink:0}.sri .srd{flex:1;min-width:0}.sri .srd .srn{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sri .srd .sra{font-size:11px;color:var(--m);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sri .srp{font-size:13px;font-weight:600;color:var(--pos);white-space:nowrap}';
    out += '</style></head><body><div class="wr">';
    out += warn + searchBox;
    out += '<div class="sh" style="margin-bottom:var(--ss)"><button class="rn" onclick="checkAll()"><span class="mat">refresh</span> 刷新</button></div>';
    out += noApps + addForm;
    out += '<div class="cd"><div class="sh" style="margin-bottom:var(--ss)"><span class="st"><span class="mat" style="font-size:16px;vertical-align:middle;margin-right:3px">history</span>通知记录</span></div>' + (history.length ? '<div>' + hr + '</div>' : '<div style="text-align:center;padding:20px;color:var(--m);font-weight:500;font-size:14px">暂无记录</div>') + '</div>';
    out += '<div class="ft">Cloudflare Workers - Wise Design</div></div>';
    out += DTL + EDT;
    out += '<div id="tt" class="tt"></div><script>' + SCRIPT + '</script></body></html>';
    return out;
  } catch (e2) {
    return "RENDER ERR: " + e2.message;
  }
}

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

const DEFAULT_COUNTRY = "us";
const DEFAULT_LANG = "en";
const DEFAULT_THRESHOLD = 6;
const DEFAULT_CURRENCY = "USD";
const SCRAPER_API_DEFAULT = "https://play-scraper-api.vercel.app/api/price";
const HISTORY_MAX = 50;

export default {
  async scheduled(event, env, ctx) { await monitorAndNotify(env); },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/api/apps") return handleAppsApi(request, env);
    if (path === "/check" || path === "/api/check") { const res = await monitorAndNotify(env); return jsonResponse(res); }
    if (path === "/api/history") return handleHistory(env);
    if (path === "/api/status") return handleStatus(env);
    if (path === "/api/search") return handleSearch(request, env);
    return jsonResponse({ error: "Not found" }, 404);
    try {
      return await handleDashboard(env);
    } catch (e) {
      return new Response("ERR: " + e.message + "\n" + e.stack, { status: 500, headers: { "Content-Type": "text/plain;charset=utf-8" } });
    }
  },
};

async function handleAppsApi(request, env) {
  if (request.method === "GET") {
    const apps = await getApps(env);
    const result = [];
    for (const app of apps) {
      const st = await env.KV.get("status:" + app.id, "json") || {};
      result.push({ ...app, status: st });
    }
    return jsonResponse(result);
  }
  if (request.method === "POST") {
    const body = await request.json();
    if (!body.app_id) return jsonResponse({ error: "app_id required" }, 400);
    let name = body.name || "";
    const country = body.country || DEFAULT_COUNTRY;
    const lang = body.lang || DEFAULT_LANG;
    const apps = await getApps(env);
    if (apps.find(a => a.id === body.app_id)) return jsonResponse({ error: "App already exists" }, 409);
    let info = null;
    try { info = await fetchAppInfo(env, body.app_id, country, lang); } catch (e) {}
    if (!name && info && info.title) name = info.title;
    if (!name) name = body.app_id;
    const appConfig = { id: body.app_id, name, threshold: body.threshold ?? DEFAULT_THRESHOLD, country, lang, currency: DEFAULT_CURRENCY, created_at: new Date().toISOString(), monitor_mode: body.monitor_mode || "threshold" };
    apps.push(appConfig);
    await env.KV.put("config:apps", JSON.stringify(apps));
    if (info) {
      const st = await env.KV.get("status:" + body.app_id, "json") || {};
      st.last_checked_price = info.price; st.last_checked_at = new Date().toISOString();
      st.icon = info.icon; st.score = info.score; st.scoreText = info.scoreText; st.ratings = info.ratings; st.developer = info.developer;
      await env.KV.put("status:" + body.app_id, JSON.stringify(st));
    }
    return jsonResponse({ ok: true, name });
  }
  if (request.method === "DELETE") {
    const body = await request.json();
    if (!body.app_id) return jsonResponse({ error: "app_id required" }, 400);
    let apps = await getApps(env);
    apps = apps.filter(a => a.id !== body.app_id);
    await env.KV.put("config:apps", JSON.stringify(apps));
    await env.KV.delete("status:" + body.app_id);
    return jsonResponse({ ok: true });
  }
  if (request.method === "PATCH") {
    const body = await request.json();
    if (!body.app_id) return jsonResponse({ error: "app_id required" }, 400);
    let apps = await getApps(env);
    const idx = apps.findIndex(a => a.id === body.app_id);
    if (idx === -1) return jsonResponse({ error: "App not found" }, 404);
    for (const key in body) { if (key !== "app_id") apps[idx][key] = body[key]; }
    await env.KV.put("config:apps", JSON.stringify(apps));
    return jsonResponse({ ok: true });
  }
  return jsonResponse({ error: "Method not allowed" }, 405);
}

async function handleHistory(env) { return jsonResponse(await env.KV.get("history", "json") || []); }

async function handleStatus(env) {
  const apps = await getApps(env);
  const result = [];
  for (const app of apps) {
    const st = await env.KV.get("status:" + app.id, "json") || {};
    result.push({ ...app, status: st });
  }
  return jsonResponse(result);
}

async function handleSearch(request, env) {
  const term = new URL(request.url).searchParams.get("term");
  if (!term) return jsonResponse({ error: "term required" }, 400);
  const proxy = env.SCRAPER_PROXY;
  if (!proxy) return jsonResponse({ error: "SCRAPER_PROXY not configured" }, 400);
  try {
    const resp = await fetch(proxy + "?method=search&term=" + encodeURIComponent(term) + "&num=10", { headers: { Accept: "application/json" } });
    const data = await resp.json();
    if (!data.ok) return jsonResponse({ error: data.error || "search failed" }, 500);
    return jsonResponse({ ok: true, results: data.data });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

async function fetchAppInfo(env, appId, country, lang) {
  const proxy = env.SCRAPER_PROXY;
  if (proxy) {
    try {
      const resp = await fetch(proxy + "?method=app&appId=" + appId + "&country=" + country + "&lang=" + lang);
      const data = await resp.json();
      if (data.ok && data.data) {
        return {
          price: data.data.price, currency: data.data.currency || "USD",
          icon: data.data.icon, title: data.data.title,
          score: data.data.score, scoreText: data.data.scoreText,
          ratings: data.data.ratings, developer: data.data.developer,
        };
      }
    } catch (e) {}
  }
  const fallbackResp = await fetch((env.SCRAPER_API || SCRAPER_API_DEFAULT) + "?id=" + appId + "&country=" + country + "&lang=" + lang);
  if (fallbackResp.ok) { const data = await fallbackResp.json(); return { price: data.price, currency: data.currency || "USD" }; }
  return null;
}

async function monitorAndNotify(env) {
  const SCRAPER_API = env.SCRAPER_API || SCRAPER_API_DEFAULT;
  const SC3_UID = env.SC3_UID;
  const SC3_SENDKEY = env.SC3_SENDKEY;
  const PROXY = env.SCRAPER_PROXY;
  if (!SC3_UID || !SC3_SENDKEY) return { ok: false, error: "Missing SC3_UID or SC3_SENDKEY" };
  const apps = await getApps(env);
  if (!apps.length) return { ok: true, message: "No apps configured" };
  const results = [];
  for (const app of apps) {
    try { results.push(await checkApp(app, SCRAPER_API, PROXY, SC3_UID, SC3_SENDKEY, env)); }
    catch (e) { results.push({ app_id: app.id, name: app.name, ok: false, error: e.message }); }
  }
  return { ok: true, results };
}

async function checkApp(app, scraperApi, proxy, sc3Uid, sc3Sendkey, env) {
  const { id, name, country, lang, threshold, monitor_mode } = app;
  let price, cur = "USD", icon, score, scoreText, ratings, developer;
  if (proxy) {
    try {
      const resp = await fetch(proxy + "?method=app&appId=" + id + "&country=" + country + "&lang=" + lang);
      const data = await resp.json();
      if (data.ok && data.data) {
        price = data.data.price; cur = data.data.currency || "USD";
        icon = data.data.icon; score = data.data.score; scoreText = data.data.scoreText;
        ratings = data.data.ratings; developer = data.data.developer;
      }
    } catch (e) {}
  }
  if (price === undefined) {
    const priceInfo = await fetchPrice(scraperApi, id, country, lang);
    if (!priceInfo || !priceInfo.ok) return { app_id: id, name, ok: false, error: "fetch_price_failed" };
    price = priceInfo.price; cur = priceInfo.currency || "USD";
  }
  const statusKey = "status:" + id;
  const status = await env.KV.get(statusKey, "json") || {};
  status.last_checked_price = price; status.last_checked_at = new Date().toISOString();
  status.icon = icon || status.icon; status.score = score || status.score;
  status.scoreText = scoreText || status.scoreText; status.ratings = ratings || status.ratings;
  status.developer = developer || status.developer;
  let notified = false, reason = null;
  if (monitor_mode === "change") {
    const lastCheck = status.last_checked_price;
    if (lastCheck !== undefined && lastCheck !== null && lastCheck !== price) {
      notified = true; reason = "price_changed";
    }
  } else {
    const below = price > 0 && price < threshold && cur === "USD";
    if (below) {
      const last = status.last_notified_price;
      if (last === undefined || last === null) { notified = true; reason = "first_drop"; }
      else if (price < last) { notified = true; reason = "price_dropped"; }
      else if (price === last) { notified = false; reason = "price_unchanged"; }
      else { notified = false; reason = "price_rose"; }
    }
  }
  if (notified) {
    const title = monitor_mode === "change" ? (name + " 价格变动") : (name + " 降价啦！");
    const desp = "**" + price + " " + cur + "**" + (monitor_mode === "change" ? "（上次: $" + status.last_checked_price + "）" : "，已低于阈值 " + threshold + " " + cur) + "\n\n应用ID：`" + id + "`\n时间：" + new Date().toISOString() + "\n\n[打开 Google Play](https://play.google.com/store/apps/details?id=" + id + "&hl=" + lang + "&gl=" + country + ")";
    const nr = await sendSc3(sc3Uid, sc3Sendkey, title, desp);
    status.last_notified_price = price; status.last_notified_at = new Date().toISOString();
    await appendHistory(env, { app_id: id, name: name, price: price, threshold: threshold, time: new Date().toISOString(), notified: true });
    await env.KV.put(statusKey, JSON.stringify(status));
    return { app_id: id, name, ok: true, price, currency: cur, threshold, notified: true, reason, icon, score, scoreText, ratings, developer, sc3: nr };
  }
  await env.KV.put(statusKey, JSON.stringify(status));
  return { app_id: id, name, ok: true, price, currency: cur, threshold, notified: false, reason, icon, score, scoreText, ratings, developer };
}

async function fetchPrice(api, appId, country, lang) {
  const resp = await fetch(api + "?id=" + appId + "&country=" + country + "&lang=" + lang, { headers: { Accept: "application/json" } });
  if (!resp.ok) throw new Error("Vercel " + resp.status);
  return await resp.json();
}

async function sendSc3(uid, key, title, desp) {
  const resp = await fetch("https://" + uid + ".push.ft07.com/send/" + key + ".send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, desp }) });
  return { status: resp.status, body: await resp.text() };
}

async function getApps(env) { return await env.KV.get("config:apps", "json") || []; }

async function appendHistory(env, entry) {
  let h = await env.KV.get("history", "json") || [];
  h.unshift(entry);
  if (h.length > HISTORY_MAX) h = h.slice(0, HISTORY_MAX);
  await env.KV.put("history", JSON.stringify(h));
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
}

async function handleDashboard(env) {
  var apps = await getApps(env);
  var list = [];
  for (var k = 0; k < apps.length; k++) {
    var app = apps[k];
    var st = await env.KV.get("status:" + app.id, "json") || {};
    list.push({ id: app.id, name: app.name, threshold: app.threshold, country: app.country, note: app.note, monitor_mode: app.monitor_mode, status: st });
  }
  var history = await env.KV.get("history", "json") || [];
  return new Response(renderHtml(list, history, !!(env.SC3_UID && env.SC3_SENDKEY), !!(env.SCRAPER_PROXY)), { headers: { "Content-Type": "text/html;charset=utf-8" } });
}

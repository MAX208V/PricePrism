// Wise 管理面板 HTML 模板

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
  + '<button class="bp" onclick="addFromDetail()" id="detailAddBtn" style="margin-top:var(--sm);height:40px;font-size:14px">添加监控</button>'
  + '</div></div>';

var EDT = '<div id="ov" class="ov"><div class="md"><h2>编辑应用</h2><div style="display:grid;gap:var(--ss)"><div><div class="lb">显示名称</div><input class="in" id="eName"></div><div><div class="lb">备注</div><input class="in" id="eNote" placeholder="可写备注信息"></div><div><div class="lb">降价阈值 (USD)</div><input class="in" id="eThreshold" type="number" step="0.01"></div><div><div class="lb">地区</div><input class="in" id="eCountry"></div></div><div class="rw" style="margin-top:var(--sm)"><button class="bs" onclick="closeEdit()" style="flex:1;width:auto;padding:0 var(--sxl)">取消</button><button class="bp" onclick="saveEdit()" style="flex:1">保存</button></div></div></div>';

var SCRIPT = [
  'var tt=document.getElementById("tt"),ttm,edId=null,detailData=null;',
  'function show(m){tt.textContent=m;tt.classList.add("s");clearTimeout(ttm);ttm=setTimeout(function(){tt.classList.remove("s")},2500)}',
  'async function api(p,o){var r=await fetch(p,Object.assign({},o,{headers:{"Content-Type":"application/json"}})),d=await r.json();if(!r.ok){show(d.error||"请求失败");throw new Error(d.error)}return d}',
  'function addApp(e){e.preventDefault();var f=new FormData(e.target);api("/api/apps",{method:"POST",body:JSON.stringify({app_id:f.get("app_id"),name:f.get("name")||"",threshold:parseFloat(f.get("threshold")),country:f.get("country")})}).then(function(){show("已添加");setTimeout(function(){location.reload()},800)})}',
  'function removeApp(id){if(!confirm("确认删除？"))return;api("/api/apps",{method:"DELETE",body:JSON.stringify({app_id:id})}).then(function(){show("已删除");setTimeout(function(){location.reload()},800)})}',
  'function editApp(id,n,c,t,nt){edId=id;document.getElementById("eName").value=n;document.getElementById("eThreshold").value=t;document.getElementById("eCountry").value=c;document.getElementById("eNote").value=nt||"";document.getElementById("ov").classList.add("s")}',
  'function closeEdit(){edId=null;document.getElementById("ov").classList.remove("s")}',
  'function saveEdit(){if(!edId)return;var n=document.getElementById("eName").value.trim(),t=parseFloat(document.getElementById("eThreshold").value),c=document.getElementById("eCountry").value.trim(),nt=document.getElementById("eNote").value.trim();if(!n){show("名称不能为空");return}if(isNaN(t)||t<=0){show("无效阈值");return}var b={app_id:edId,name:n,threshold:t,country:c};if(nt){b.note=nt}api("/api/apps",{method:"PATCH",body:JSON.stringify(b)}).then(function(){show("已更新");closeEdit();setTimeout(function(){location.reload()},800)})}',
  'function checkAll(){show("正在检查...");api("/api/check").then(function(){show("检查完成");setTimeout(function(){location.reload()},1500)})}',
  'async function doSearch(){var q=document.getElementById("searchTerm").value.trim();if(!q){show("请输入关键词");return}var el=document.getElementById("searchResults");el.textContent="搜索中...";try{var d=await api("/api/search?term="+encodeURIComponent(q));if(!d.results||d.results.length===0){el.innerHTML="<div style=\'text-align:center;padding:20px;color:var(--m)\'>未找到结果</div>";return}var h="";for(var i=0;i<d.results.length;i++){var r=d.results[i];h+="<div class=\'sri\' onclick=\'showDetail(\\""+r.appId+"\\",\\""+escJs(r.title)+"\\",\\""+escJs(r.icon||"")+"\\",\\""+escJs(getPriceDisplay(r))+"\\",\\""+escJs(r.developer||"")+"\\",\\""+escJs(r.scoreText||"")+"\\")\'>";if(r.icon){h+="<img src=\'"+r.icon+"\' alt=\'\' onerror=\'this.style.display=\\"none\\"\'>"}h+="<div class=\'srd\'><div class=\'srn\'>"+r.title+"</div><div class=\'sra\'>"+r.appId+" - "+r.developer+"</div></div><div class=\'srp\'>"+getPriceDisplay(r)+"</div></div>"}el.innerHTML="<div class=\'sr\'>"+h+"</div>"}catch(e){el.innerHTML="<div style=\\'text-align:center;padding:20px;color:var(--m)\\'>搜索失败</div>"}}',
  'function escJs(s){if(!s)return "";return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\\\\\\\\\\\\'/g,"\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\'\").replace(/"/g,"&quot;")}',
  'function getPriceDisplay(appData){if(!appData)return"N/A";if(appData.free===true||appData.price===0){if(appData.containsAds&&appData.containsAds===true)return"免费(含广告)";if(appData.inAppPurchases&&appData.inAppPurchases===true)return"免费+内购";if(appData.offersIAP&&appData.offersIAP===true)return"免费+内购";return"免费"}if(appData.priceText&&appData.priceText!=="0"&&appData.priceText!=="0.00")return appData.priceText;if(appData.formattedPrice)return appData.formattedPrice;if(appData.priceCurrency)return appData.priceCurrency;if(appData.price_amount_micros&&appData.price_amount_micros>0){var dollars=appData.price_amount_micros/1000000;return"$"+dollars.toFixed(2)}if(appData.price!==undefined&&appData.price!==null&&appData.price!==0){if(typeof appData.price==="number")return"$"+appData.price.toFixed(2);if(/^(\\\\d+(\\\\.\\\\d+)?)$/.test(String(appData.price)))return"$"+parseFloat(appData.price).toFixed(2);return"$"+String(appData.price)}return"价格未知"}',
  'function showDetail(id,title,icon,price,dev,score){detailData={id:id,title:title};var h="";h+="<div style=\'display:flex;align-items:center;gap:var(--sm);margin-bottom:var(--ss)\'>";if(icon){h+="<img src=\'"+icon+"\' alt=\'\' style=\'width:44px;height:44px;border-radius:10px;flex-shrink:0\' onerror=\'this.style.display=\\"none\\"\'>"}h+="<div><div style=\'font-size:17px;font-weight:700\'>"+title+"</div><div style=\'font-size:11px;color:var(--m);margin-top:1px\'>"+id+"</div></div></div>";h+="<div class=\'g\' style=\'margin-bottom:0\'>";h+="<div class=\'gi\' style=\'padding:10px\'><div class=\'gl\'>评分</div><div class=\'v\'><span class=\'star\'>★</span> "+(score||"-")+"</div></div>";h+="<div class=\'gi\' style=\'padding:10px\'><div class=\'gl\'>价格</div><div class=\'v\'>"+(price||"-")+"</div></div>";h+="</div>";if(dev){h+="<div class=\'gi\' style=\'padding:10px;margin-top:var(--ss)\'><div class=\'gl\'>开发者</div><div class=\'v\'>"+dev+"</div></div>"}document.getElementById("detailContent").innerHTML=h;document.getElementById("dv").classList.add("s")}',
  'function closeDetail(){detailData=null;document.getElementById("dv").classList.remove("s")}',
  'function addFromDetail(){if(!detailData)return;var btn=document.getElementById("detailAddBtn");var t=parseFloat(document.getElementById("dtThreshold").value);var c=document.getElementById("dtCountry").value.trim();if(isNaN(t)||t<=0){show("无效阈值");return}btn.disabled=true;btn.textContent="添加中...";api("/api/apps",{method:"POST",body:JSON.stringify({app_id:detailData.id,name:detailData.title,threshold:t,country:c||"us"})}).then(function(){show("已添加");closeDetail();setTimeout(function(){location.reload()},800)}).catch(function(){btn.disabled=false;btn.textContent="添加监控"})}',
].join("");

export function renderHtml(apps, history, hasSc3, hasProxy) {
  var cards = "";
  for (var i = 0; i < apps.length; i++) {
    var a = apps[i], st = a.status || {};
    var p = st.last_checked_price, ps = p !== undefined ? "$" + p : "-";
    var ts = fmtUTC(st.last_checked_at), ns = fmtUTC(st.last_notified_at);
    var lo = p !== undefined && p > 0 && p < a.threshold;
    var icon = st.icon || "", score = st.scoreText || "", ratings = st.ratings || "", note = a.note || "", dev = st.developer || "";

    var head = '<div class="ach">';
    if (icon) { head += '<img src="' + esc(icon) + '" alt="" class="aci-icon" onerror="this.style.display=\'none\'">'; }
    head += '<div class="acn"><div class="act">' + esc(a.name) + '</div>';
    if (note) { head += '<div class="acnote">' + esc(note) + '</div>'; }
    head += '<div class="aci">';
    if (dev) { head += esc(dev) + ' · '; }
    head += esc(a.id) + '</div></div><span class="' + (lo ? "bg" : "bg gy") + '">' + (lo ? "低于阈值" : "正常") + '</span></div>';

    var extra = '<div class="gi" style="grid-column:1/3"><div class="gl">评分 / 心愿单</div><div class="v">' + (score ? '<span class="star">★</span> ' + esc(score) + ' ' : "") + (ratings ? '<span style="color:var(--m)">|</span> ' + esc(ratings) : "") + '</div></div>';

    cards += '<div class="ac">' + head + '<div class="acb"><div class="g"><div class="gi"><div class="gl">当前价格</div><div class="v' + (lo ? " gr" : "") + '">' + ps + '</div></div><div class="gi"><div class="gl">阈值</div><div class="v">$' + a.threshold + '</div></div>' + extra + '<div class="gi"><div class="gl">检查</div><div class="v">' + ts + '</div></div><div class="gi"><div class="gl">通知</div><div class="v">' + ns + '</div></div></div><div class="ar"><button class="bs" onclick="editApp(' + "'" + esc(a.id) + "','" + esc(a.name) + "','" + esc(a.country || "us") + "'," + a.threshold + ",'" + esc(note) + "'" + ')"><span class="mat">edit</span></button><button class="bs br" onclick="removeApp(' + "'" + esc(a.id) + "'" + ')"><span class="mat">delete</span></button></div></div></div>';
  }

  var hr = "";
  for (var j = 0; j < history.length; j++) {
    var hh = history[j];
    hr += '<div class="hr"><span class="ht">' + fmtUTC(hh.time) + '</span><span class="hn">' + esc(hh.name) + '</span><span class="hp">$' + hh.price + '</span><span class="bg hb' + (hh.notified ? "" : " gy") + '">' + (hh.notified ? "已通知" : "跳过") + '</span></div>';
  }

  var noApps = apps.length === 0 ? '<div class="cd" style="text-align:center;padding:32px;color:var(--m);font-weight:500;font-size:14px">暂无监控应用</div>' : cards;
  var warn = !hasSc3 ? '<div class="w"><span class="mat" style="font-size:16px">warning</span> 未配置通知</div>' : "";
  var searchBox = hasProxy ? '<div class="cd" id="searchSection"><h2 style="font-size:18px;font-weight:700;letter-spacing:-.02em;margin-bottom:var(--ss)">搜索应用</h2><div style="display:flex;gap:var(--ss)"><input class="in" id="searchTerm" placeholder="输入关键词搜索 Google Play..." style="flex:1" onkeydown="if(event.key===\'Enter\'){event.preventDefault();doSearch()}"><button class="bp" onclick="doSearch()" style="width:56px;flex-shrink:0;padding:0;border-radius:14px"><span class="mat">search</span></button></div><div id="searchResults"></div></div>' : "";

  var addForm = '<div class="cd"><div class="sc-h"><span class="mat">add_box</span><h2>添加应用</h2></div>';
  addForm += '<form id="af" onsubmit="addApp(event)"><div style="display:grid;gap:var(--ss)">';
  addForm += '<div><div class="lb">Google Play ID</div><input class="in" name="app_id" placeholder="com.flyersoft.moonreaderp" required></div>';
  addForm += '<div><div class="lb">显示名称 <span style="color:var(--m);font-weight:400">（可选）</span></div><input class="in" name="name" placeholder="留空自动获取"></div>';
  addForm += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--ss)"><div><div class="lb">降价阈值 (USD)</div><input class="in" name="threshold" type="number" step="0.01" value="6" required></div><div><div class="lb">地区</div><input class="in" name="country" value="us"></div></div></div>';
  addForm += '<button type="submit" class="bp" style="margin-top:var(--sm)"><span class="mat" style="font-size:20px">add</span>添加监控</button></form></div>';

  var out = '<!DOCTYPE html><html lang="zh-CN"><head>';
  out += '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no>';
  out += '<title>Price Monitor</title>';
  out += '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">';
  out += '<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet">';
  out += '<style>';
  out += ':root{--p:#9fe870;--op:#0e0f0c;--pa:#cdffad;--pp:#e2f6d5;--k:#0e0f0c;--b:#454745;--m:#868685;--c:#fff;--s:#e8ebe6;--pos:#2ead4b;--neg:#d03238;--rx:24px;--rm:12px;--rp:9999px;--ss:8px;--sm:12px;--sl:16px;--f:Inter,sans-serif}';
  out += '*{margin:0;padding:0;box-sizing:border-box}';
  out += 'body{font-family:var(--f);font-size:16px;color:var(--k);background:var(--s);display:flex;justify-content:center;padding:var(--sl);min-height:100dvh}';
  out += '.wr{width:100%;max-width:480px;display:flex;flex-direction:column;gap:var(--sm);margin-top:var(--ss);padding-bottom:40px}';
  out += '.brd{display:flex;align-items:center;gap:var(--sm);margin-bottom:4px}.brd-i{width:36px;height:36px;background:var(--p);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--op);flex-shrink:0}.brd-i .mat{font-size:20px}';
  out += 'h1{font-size:28px;font-weight:900;letter-spacing:-.03em;line-height:1.1}.sb{font-size:13px;color:var(--m);margin-top:2px;font-weight:500}';
  out += '.sc-h{display:flex;align-items:center;gap:var(--ss);margin-bottom:var(--ss)}.sc-h .mat{font-size:22px;color:var(--p)}.sc-h h2{font-size:18px;font-weight:700;letter-spacing:-.02em}';
  out += '.ac{background:var(--c);border-radius:var(--rx);box-shadow:0 4px 24px rgba(14,15,12,.06);overflow:hidden}';
  out += '.ach{display:flex;align-items:center;gap:var(--sm);padding:var(--sl) var(--sl) var(--ss)}.aci-icon{width:36px;height:36px;border-radius:8px;flex-shrink:0}';
  out += '.acn{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}.act{font-size:17px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';
  out += '.acnote{font-size:11px;color:#856404;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';
  out += '.aci{font-size:11px;color:var(--m);font-weight:500;word-break:break-all}.acb{padding:0 var(--sl) var(--sl)}';
  out += '.bg{display:inline-flex;align-items:center;padding:4px 12px;border-radius:var(--rp);font-size:11px;font-weight:700;white-space:nowrap;background:var(--pp);color:#163300}.bg.gy{background:var(--s);color:var(--b)}';
  out += '.g{display:grid;grid-template-columns:1fr 1fr;gap:var(--ss);margin-bottom:var(--sm)}.gi{background:var(--s);border-radius:var(--rm);padding:14px}';
  out += '.gl{font-size:9px;font-weight:700;text-transform:uppercase;color:var(--m);margin-bottom:2px;letter-spacing:.03em}.v{font-size:14px;font-weight:600;word-break:break-all;font-variant-numeric:tabular-nums;color:var(--k)}.v.gr{color:var(--pos)}.star{color:#fbbc04}';
  out += '.ar{display:flex;gap:var(--ss)}.bs{display:inline-flex;align-items:center;justify-content:center;height:38px;width:38px;border-radius:var(--rp);font-family:var(--f);cursor:pointer;border:none;background:var(--s);color:var(--k)}.bs:hover{background:var(--pp);color:#163300}.bs .mat{font-size:18px}.bs.br .mat{color:var(--neg)}';
  out += '.bp{display:inline-flex;align-items:center;justify-content:center;height:46px;border-radius:var(--rp);font-family:var(--f);font-size:16px;font-weight:600;cursor:pointer;border:none;gap:6px;background:var(--p);color:var(--op);width:100%}.bp:hover{background:var(--pa)}.bp:disabled{opacity:0.5;cursor:default}';
  out += '.in{width:100%;height:50px;background:var(--c);border:2px solid var(--k);border-radius:var(--rm);padding:0 var(--sl);font-family:var(--f);font-size:16px;color:var(--k);outline:none}.in:focus{border-color:var(--p);box-shadow:0 0 0 3px rgba(159,232,112,.2)}';
  out += '.lb{font-size:10px;font-weight:700;text-transform:uppercase;color:var(--b);margin-bottom:6px;letter-spacing:.03em}';
  out += '.cd{background:var(--c);border-radius:var(--rx);box-shadow:0 4px 24px rgba(14,15,12,.06);padding:var(--sl)}.sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--ss)}.sh h2{font-size:18px;font-weight:700;letter-spacing:-.02em}';
  out += '.hr{display:flex;align-items:center;gap:var(--ss);padding:10px 0;border-bottom:1px solid var(--s);font-size:13px}.hr:last-child{border-bottom:none}.ht{color:var(--m);font-weight:500;white-space:nowrap;min-width:52px;font-variant-numeric:tabular-nums}.hn{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hp{font-weight:700;font-variant-numeric:tabular-nums}.hb{padding:2px 10px;font-size:10px}';
  out += '.w{background:#fff3cd;color:#856404;border-radius:var(--rm);padding:var(--sm) var(--sl);font-size:13px;font-weight:500;display:flex;align-items:center;gap:6px}';
  out += '.tt{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--k);color:var(--p);padding:8px 18px;border-radius:var(--rp);font-size:13px;z-index:10000;opacity:0;transition:opacity .2s;pointer-events:none;font-weight:500}.tt.s{opacity:1}';
  out += '.ft{text-align:center;padding:20px 0;font-size:12px;color:var(--m);font-weight:500}';
  out += '.sh .bs{display:inline-flex;align-items:center;justify-content:center;height:34px;padding:6px var(--sl);border-radius:var(--rp);font-family:var(--f);font-size:12px;font-weight:600;cursor:pointer;border:none;gap:4px;background:var(--s);color:var(--k)}.sh .bs:hover{background:var(--pp);color:#163300}.sh .bs .mat{font-size:14px}';
  out += '.mat{font-family:Material Symbols Rounded;font-weight:400;font-style:normal;font-size:18px;display:inline-block;line-height:1;letter-spacing:normal;text-transform:none;white-space:nowrap;word-wrap:normal}',
  out += '.ov{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.35);z-index:9999;display:none;align-items:center;justify-content:center;padding:var(--sl)}.ov.s{display:flex}',
  out += '.md{background:var(--c);border-radius:var(--rx);width:100%;max-width:400px;padding:var(--sxl);box-shadow:0 8px 40px rgba(14,15,12,.12)}.md h2{font-size:20px;font-weight:900;letter-spacing:-.03em;margin-bottom:var(--sm)}',
  out += '.sr{margin-top:var(--sm);display:flex;flex-direction:column;gap:var(--ss)}',
  out += '.sri{display:flex;align-items:center;gap:var(--sm);background:var(--s);border-radius:var(--rm);padding:var(--sm);cursor:pointer;transition:background .15s}.sri:hover{background:var(--pp)}.sri img{width:40px;height:40px;border-radius:8px;flex-shrink:0}.sri .srd{flex:1;min-width:0}.sri .srd .srn{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sri .srd .sra{font-size:11px;color:var(--m);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sri .srp{font-size:13px;font-weight:600;color:var(--pos);white-space:nowrap}',
  out += '</style></head><body><div class="wr">',
  out += '<div class="brd"><div class="brd-i"><span class="mat">monitoring</span></div><div><h1>Price Monitor</h1><div class="sb">极简 · 智能 · 省心</div></div></div>';
  out += warn + searchBox;
  out += '<div class="sh"><h2>监控应用</h2><button class="bs" onclick="checkAll()"><span class="mat">refresh</span></button></div>';
  out += noApps + addForm;
  out += '<div class="cd"><div class="sh"><h2>通知记录</h2></div>' + (history.length ? '<div>' + hr + '</div>' : '<div style="text-align:center;padding:20px;color:var(--m);font-weight:500;font-size:14px">暂无记录</div>') + '</div>';
  out += '<div class="ft">Cloudflare Workers · Wise Design</div></div>';
  out += DTL + EDT;
  out += '<div id="tt" class="tt"></div>';
  out += '<script>' + SCRIPT + '</script></body></html>';
  return out;
}

export function esc(s) {
  if (!s) return "";
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
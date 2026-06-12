  h += '<div class="cd"><div class="sh"><h2>通知记录</h2></div>';
  if (history.length) {
    h += '<div>' + hr + '</div>';
  } else {
    h += '<div style="text-align:center;padding:20px;color:var(--m);font-weight:500;font-size:14px">暂无记录</div>';
  }
  h += '</div>';
  h += '<div class="ft">Cloudflare Workers \u00b7 Wise Design</div></div>';
  h += DTL + EDT;
  h += '<div id="tt" class="tt"></div>';
  h += '<script>' + SCRIPT + '</script></body></html>';
  return h;
}

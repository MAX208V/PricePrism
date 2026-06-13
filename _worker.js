      var sv = (score ? '<span class="mat" style="font-size:14px;color:#fbbc04;vertical-align:middle">star</span> ' + esc(score) + ' ' : "") + (ratings ? '<span style="color:var(--m)">|</span> <span class="mat" style="font-size:14px;color:var(--m);vertical-align:middle">bookmark_border</span> ' + esc(ratings) : "");
      var extra;
      if (note) {
        extra = '<div class="gi"><div class="gl">评分 / 心愿单</div><div class="v">' + sv + '</div></div><div class="gi"><div class="gl">备注</div><div class="v" style="font-size:12px;color:#856404">' + esc(note) + '</div></div>';
      } else {
        extra = '<div class="gi" style="grid-column:1/3"><div class="gl">评分 / 心愿单</div><div class="v">' + sv + '</div></div>';
      }

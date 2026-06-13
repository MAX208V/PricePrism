      var icon = st.icon || "", score = st.scoreText || "", ratings = st.ratings || "", note = a.note || "", dev = st.developer || "";
      var rn = parseInt(ratings, 10), ratingsDisp = !isNaN(rn) && rn >= 1000 ? (rn / 1000).toFixed(1).replace(/\.0$/, "") + "k" : ratings;

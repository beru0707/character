window.SheetParser = (function () {
  var tmp = document.createElement('canvas');
  var tctx = tmp.getContext('2d', { willReadFrequently: true });

  function cellOf(s, i) {
    var cw = s.img.naturalWidth / s.cols, ch = s.img.naturalHeight / s.rows;
    return { sx: (i % s.cols) * cw, sy: Math.floor(i / s.cols) * ch, cw: cw, ch: ch };
  }

  function emptyCell(s, i) {
    var c = cellOf(s, i); tmp.width = 40; tmp.height = 40; tctx.clearRect(0, 0, 40, 40);
    tctx.drawImage(s.img, c.sx, c.sy, c.cw, c.ch, 0, 0, 40, 40);
    var d = tctx.getImageData(0, 0, 40, 40).data;
    for (var j = 3; j < d.length; j += 4) if (d[j] > 8) return false;
    return true;
  }

  function count(s) {
    if (!s || !s.img) return 0;
    var key = s.cols + 'x' + s.rows;
    if (s.frames > 0) return Math.min(s.frames, s.cols * s.rows);
    if (s._ck !== key) {
      var n = s.cols * s.rows;
      try { while (n > 1 && emptyCell(s, n - 1)) n--; } catch (e) { }
      s._ck = key; s._n = n;
    }
    return s._n;
  }

  function bbox(s) {
    var key = s.cols + 'x' + s.rows; if (s._bk === key) return s._bb;
    var c = cellOf(s, 0), k = Math.min(1, 256 / Math.max(c.cw, c.ch)), w = Math.max(1, Math.round(c.cw * k)), h = Math.max(1, Math.round(c.ch * k));
    tmp.width = w; tmp.height = h; tctx.clearRect(0, 0, w, h); tctx.drawImage(s.img, c.sx, c.sy, c.cw, c.ch, 0, 0, w, h);
    var d = tctx.getImageData(0, 0, w, h).data, x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    s._bk = key; s._bb = x1 < 0 ? null : { x0: x0 / w, x1: (x1 + 1) / w, y0: y0 / h, y1: (y1 + 1) / h };
    return s._bb;
  }

  // Vùng nhìn thấy theo TỪNG khung rồi lấy trung vị (chính xác hơn bbox của riêng khung 1):
  // cx = tâm ngang, y1 = chân (trung vị), y1max = chân thấp nhất, h = chiều cao. Tất cả tính theo tỉ lệ khung 0..1.
  function bboxMedian(s) {
    var key = s.cols + 'x' + s.rows + ':' + count(s); if (s._mk === key) return s._mb;
    var c = cellOf(s, 0), k = Math.min(1, 256 / Math.max(c.cw, c.ch)), w = Math.max(1, Math.round(c.cw * k)), h = Math.max(1, Math.round(c.ch * k));
    var n = count(s), cxs = [], y1s = [], hs = [];
    tmp.width = w; tmp.height = h;
    for (var i = 0; i < n; i++) {
      var cc = cellOf(s, i); tctx.clearRect(0, 0, w, h); tctx.drawImage(s.img, cc.sx, cc.sy, cc.cw, cc.ch, 0, 0, w, h);
      var d = tctx.getImageData(0, 0, w, h).data, x0 = w, x1 = -1, y0 = h, y1 = -1;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) continue;
      cxs.push((x0 + x1 + 1) / 2 / w); y1s.push((y1 + 1) / h); hs.push((y1 - y0 + 1) / h);
    }
    function med(a) { a = a.slice().sort(function (p, q) { return p - q; }); return a.length ? a[Math.floor(a.length / 2)] : 0; }
    s._mk = key;
    s._mb = cxs.length ? { cx: med(cxs), y1: med(y1s), y1max: Math.max.apply(null, y1s), h: med(hs) } : null;
    return s._mb;
  }

  return {
    bboxMedian: bboxMedian,
    cellOf: cellOf,
    count: count,
    bbox: bbox
  };
})();
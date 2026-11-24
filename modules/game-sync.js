/* ------------------------------------------------------------------
   ĐỒNG BỘ VỚI GAME – đọc / ghi thẳng thư mục game (File System Access API: Chrome, Edge)
   Mở thư mục game  : nạp ảnh Character/<PET>/... + cấu hình js/config/pets.data.js của mọi pet
                      (pet có trong Character/ mà chưa có cấu hình sẽ được tự căn theo Đi bộ)
   Lưu vào game     : ghi lại js/config/pets.data.js (chỉ cập nhật các pet đang mở, pet khác giữ nguyên)
   Lưu ý            : đừng đổi tên pet trong ô "Tên pet hiện tại" khi dùng đồng bộ (tên = thư mục trong Character/).
------------------------------------------------------------------- */
window.GameSync = (function () {
  var $ = function (id) { return document.getElementById(id); };
  var DATA_PATH = 'js/config/pets.data.js';
  var HEADER = [
    "// DỮ LIỆU THÚ – file này do công cụ căn (repo 'character') đọc và GHI TRỰC TIẾP (nút \"Mở thư mục game\" / \"Lưu vào game\"); cũng sửa tay được.",
    "// Phải là JSON hợp lệ sau 'const PET_DATA =' (khoá có dấu nháy kép, không có chú thích, không dấu phẩy thừa). Giải thích các trường: xem js/config/pets.js."
  ];
  var root = null, data = null;
  var SYNC_STATES = ['walk', 'idle', 'attack', 'run', 'jumpup', 'jumpfall', 'jumpthrow', 'hurt', 'dizzy', 'dead'];

  function r3(v) { return Math.round(v * 1000) / 1000; }
  function status(msg) { if ($('gsStatus')) $('gsStatus').textContent = msg; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function dirAt(dir, parts) { var h = dir; for (var i = 0; i < parts.length; i++) h = await h.getDirectoryHandle(parts[i]); return h; }
  async function fileAt(dir, path) {
    var p = path.split('/'), d = await dirAt(dir, p.slice(0, -1));
    return (await d.getFileHandle(p[p.length - 1])).getFile();
  }
  // duyệt đệ quy: trả về [{ path: 'CHICKEN/03-Walk/03-Walk.png', handle }]
  async function walk(dir, prefix, out) {
    for await (var entry of dir.values()) {
      if (entry.kind === 'directory') await walk(entry, prefix + entry.name + '/', out);
      else out.push({ path: prefix + entry.name, handle: entry });
    }
    return out;
  }

  function parseData(text) {
    var m = /^const\s+PET_DATA\s*=\s*/m.exec(text);   // ^ + m: bỏ qua dòng chú thích có nhắc tới 'const PET_DATA ='
    if (!m) throw new Error('Không tìm thấy "const PET_DATA =" trong ' + DATA_PATH);
    return JSON.parse(text.slice(m.index + m[0].length).replace(/;\s*$/, ''));
  }

  // Mỗi trạng thái 1 dòng cho dễ đọc / dễ so sánh git
  function serialize(d) {
    var L = HEADER.slice(); L.push('const PET_DATA = {', '  "defs": [');
    d.defs.forEach(function (x, i) { L.push('    ' + JSON.stringify(x) + (i < d.defs.length - 1 ? ',' : '')); });
    L.push('  ],', '  "anim": {');
    var names = Object.keys(d.anim);
    names.forEach(function (n, i) {
      L.push('    ' + JSON.stringify(n) + ': { "extra": {');
      var ex = d.anim[n].extra, ks = Object.keys(ex);
      ks.forEach(function (k, j) { L.push('      ' + JSON.stringify(k) + ': ' + JSON.stringify(ex[k]) + (j < ks.length - 1 ? ',' : '')); });
      L.push('    } }' + (i < names.length - 1 ? ',' : ''));
    });
    L.push('  }', '};');
    return L.join('\n') + '\n';
  }

  function ensurePet(dir) {
    if (!AppState.pets[dir]) {
      AppState.pets[dir] = AppState.createPetData(dir); AppState.petOrder.push(dir);
    }
    AppState.pets[dir]._dir = dir;
    return AppState.pets[dir];
  }

  function applyDef(def, anim) {
    var pd = AppState.pets[def.dir]; if (!pd) return;
    pd.petScale = def.scale; pd.walk.dx = def.ox; pd.walk.dy = def.oy;
    AppState.STATES_DEF.forEach(function (d) {
      var a = anim && anim[d.k]; if (!a) return;
      var s = pd[d.k];
      s.cols = a.cols; s.rows = a.rows; s.frames = a.frames || 0;
      s.scale = d.k === 'walk' ? 1 : (a.scale || 1);
      s.fps = a.fps || AppState.DEF_FPS[d.k] || 12;
      s.stride = a.stride || 1; s.speed = a.speed || 1;
      s.dx = (a.dx || 0) + def.ox; s.dy = (a.dy || 0) + def.oy;   // trong game dx/dy là tương đối so với Đi bộ
      s._ck = s._bk = s._mk = null;
    });
  }

  // ------- MỞ -------
  async function openHandle(handle) {
    root = handle; status('Đang đọc ' + DATA_PATH + ' …');
    data = parseData(await (await fileAt(root, DATA_PATH)).text());
    AppState.petOrder.length = 0; Object.keys(AppState.pets).forEach(function (k) { delete AppState.pets[k]; }); AppState.activePet = null;

    // 1) pet đã có cấu hình: nạp đúng file mà cấu hình trỏ tới
    var known = {};
    for (var i = 0; i < data.defs.length; i++) {
      var def = data.defs[i], anim = (data.anim[def.name] || {}).extra || {}; known[def.dir] = true;
      ensurePet(def.dir);
      for (var k in anim) {
        var st = AppState.pets[def.dir][k]; if (!st) continue;
        try {
          var file = await fileAt(root, anim[k].src);
          file._rel = anim[k].src.replace(/^Character\/[^/]+\//, '');
          FileHandler.loadFile(file, def.dir, k);
        } catch (e) { console.warn('Không đọc được', anim[k].src, e); }
      }
    }
    // 2) pet mới (có trong Character/ nhưng chưa có cấu hình): nạp theo tên file rồi tự căn
    var fresh = [];
    try {
      var cdir = await dirAt(root, ['Character']), items = await walk(cdir, '', []), files = [];
      var petsNew = {};
      for (var j = 0; j < items.length; j++) {
        var top = items[j].path.split('/')[0];
        if (known[top] || !/\.(png|webp|jpe?g)$/i.test(items[j].path)) continue;
        var f = await items[j].handle.getFile();
        Object.defineProperty(f, 'webkitRelativePath', { value: 'Character/' + items[j].path });
        files.push(f); petsNew[top] = true;
      }
      fresh = Object.keys(petsNew);
      if (files.length) FileHandler.processFileList(files, function () { });
    } catch (e) { console.warn('Không quét được Character/', e); }

    for (var w = 0; w < 400 && FileHandler.pending > 0; w++) await sleep(50);   // chờ ảnh nạp xong (tối đa 20s)
    data.defs.forEach(function (def) { applyDef(def, (data.anim[def.name] || {}).extra); });
    fresh.forEach(function (p) { if (AppState.pets[p]) { AppState.pets[p]._dir = p; UIController.alignPet(p); AppState.pets[p]._new = true; } });

    AppState.activePet = AppState.petOrder[0] || null;
    UIController.buildUI(); UIController.refresh();
    $('gsSave').disabled = false;
    status('Đã mở game: ' + data.defs.length + ' pet có cấu hình' + (fresh.length ? ' + ' + fresh.length + ' pet mới tự căn (' + fresh.join(', ') + ')' : '') + '. Chỉnh xong bấm "Lưu vào game" (Ctrl+S).');
  }

  // ------- LƯU -------
  function buildData() {
    var out = JSON.parse(JSON.stringify(data));
    AppState.petOrder.forEach(function (key) {
      var pd = AppState.pets[key]; if (!pd || !pd.walk.img) return;
      var dir = pd._dir || key, w = pd.walk, def = out.defs.filter(function (d) { return d.dir === dir; })[0];
      if (!def) {   // pet mới: ước lượng các số phụ từ ảnh Đi bộ
        var c = SheetParser.cellOf(w, 0), ratio = c.cw / c.ch, bb = SheetParser.bboxMedian(w), vis = bb ? bb.h : 0.75;
        def = { name: dir.charAt(0) + dir.slice(1).toLowerCase(), dir: dir, scale: 1, ox: 0, oy: 0, vis: r3(vis),
          barDY: Math.round((vis * 100 * pd.petScale + 3) * 10) / 10, sw: Math.round(200 * ratio), sh: 200, spriteLeft: true };
        out.defs.push(def);
      }
      def.scale = r3(pd.petScale); def.ox = r3(w.dx); def.oy = r3(w.dy);
      var prev = (out.anim[def.name] || {}).extra || {}, ex = {};
      SYNC_STATES.forEach(function (k) {
        var s = pd[k]; if (!s || !(s.img || s.name)) return;
        var o = { src: 'Character/' + dir + '/' + (s.rel || s.name), cols: s.cols, rows: s.rows, max: (prev[k] && prev[k].max) || 176 };
        if (s.frames > 0) o.frames = s.frames;
        if (k === 'idle' || k === 'attack' || (k !== 'walk' && s.fps !== AppState.DEF_FPS[k])) o.fps = s.fps;   // idle/attack luôn ghi fps (mặc định của game khác công cụ)
        if (k === 'walk') { if (s.stride !== 1) o.stride = r3(s.stride); if (s.speed !== 1) o.speed = r3(s.speed); }
        else {
          if (r3(s.scale) !== 1) o.scale = r3(s.scale);
          var dx = r3(s.dx - w.dx), dy = r3(s.dy - w.dy); if (dx !== 0) o.dx = dx; if (dy !== 0) o.dy = dy;
        }
        ex[k] = o;
      });
      out.anim[def.name] = { extra: ex };
    });
    return out;
  }

  async function save() {
    if (!root) return;
    try {
      var out = buildData(), h = await dirAt(root, ['js', 'config']), fh = await h.getFileHandle('pets.data.js', { create: true });
      var wr = await fh.createWritable(); await wr.write(serialize(out)); await wr.close();
      data = out;
      status('Đã lưu ' + DATA_PATH + ' lúc ' + new Date().toLocaleTimeString() + ' — tải lại game (F5) để thấy.');
    } catch (e) { status('Lưu thất bại: ' + e.message); }
  }

  async function open() {
    try { await openHandle(await window.showDirectoryPicker({ mode: 'readwrite' })); }
    catch (e) { if (e.name !== 'AbortError') { status('Không mở được: ' + e.message); console.error(e); } }
  }

  // ------- GẮN NÚT -------
  if (!window.showDirectoryPicker) {
    $('gsOpen').disabled = true;
    status('Trình duyệt này không hỗ trợ ghi thẳng vào thư mục (cần Chrome / Edge). Vẫn dùng được "Sao chép" như cũ.');
  }
  $('gsOpen').onclick = open;
  $('gsSave').onclick = save;
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && root) { e.preventDefault(); save(); }
  });

  return { openHandle: openHandle, buildData: buildData, serialize: serialize, save: save };
})();

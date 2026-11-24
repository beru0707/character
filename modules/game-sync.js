/* ------------------------------------------------------------------
   ĐỒNG BỘ VỚI GAME – đọc / ghi thẳng thư mục game (File System Access API: Chrome, Edge)
   Mở thư mục game  : nạp ảnh Character/<PET>/... + cấu hình js/config/pets.data.js của mọi pet,
                      và Enemy/<QUÁI>/... + js/config/enemies.data.js của mọi quái
                      (pet có trong Character/ mà chưa có cấu hình sẽ được tự căn theo Đi bộ)
   Lưu vào game     : ghi lại pets.data.js và enemies.data.js (chỉ cập nhật các mục đang mở; chỉ số chiến đấu của quái như hp, dmg, range... giữ nguyên)
   Lưu ý            : đừng đổi tên pet trong ô "Tên pet hiện tại" khi dùng đồng bộ (tên = thư mục trong Character/).
------------------------------------------------------------------- */
window.GameSync = (function () {
  var $ = function (id) { return document.getElementById(id); };
  // Hai loại dữ liệu cùng cách làm: thư mục ảnh + file JSON. animKey: khoá trong "anim" của 1 mục.
  var KINDS = [
    { id: 'pet', folder: 'Character', file: 'js/config/pets.data.js', varName: 'PET_DATA', label: 'pet', animKey: function (d) { return d.name; },
      header: ["// DỮ LIỆU THÚ – file này do công cụ căn (repo 'character') đọc và GHI TRỰC TIẾP (nút \"Mở thư mục game\" / \"Lưu vào game\"); cũng sửa tay được.",
               "// Phải là JSON hợp lệ sau 'const PET_DATA =' (khoá có dấu nháy kép, không có chú thích, không dấu phẩy thừa). Giải thích các trường: xem js/config/pets.js."],
      newDef: function (dir, ratio, vis, scale) { return { name: cap(dir), dir: dir, scale: 1, ox: 0, oy: 0, vis: r3(vis),
        barDY: Math.round((vis * 100 * scale + 3) * 10) / 10, sw: Math.round(200 * ratio), sh: 200, spriteLeft: true }; } },
    { id: 'enemy', folder: 'Enemy', file: 'js/config/enemies.data.js', varName: 'ENEMY_DATA', label: 'quái', animKey: function (d) { return d.key; },
      header: ["// DỮ LIỆU QUÁI – file này do công cụ căn (repo 'character') đọc và GHI TRỰC TIẾP (nút \"Mở thư mục game\" / \"Lưu vào game\"); cũng sửa tay được.",
               "// Phải là JSON hợp lệ sau 'const ENEMY_DATA =' (khoá có dấu nháy kép, không chú thích, không dấu phẩy thừa). Giải thích các trường: xem js/config/battle.js."],
      newDef: function (dir, ratio, vis, scale) { return { key: dir.toLowerCase(), name: cap(dir), dir: dir, scale: 1, ox: 0, oy: 0, sw: Math.round(500 * ratio), sh: 500, spriteLeft: true,
        hp: 60, dmg: 8, speed: 45, bar: Math.round(vis * 100 * scale + 3), range: 100, cd: 1.5 }; } }
  ];
  var root = null, datas = {};   // datas[kind.id] = { defs, anim }
  // Các trạng thái được đồng bộ; khoá do công cụ quản lý (các khoá khác của 1 trạng thái, vd. hitAt, được giữ nguyên khi lưu)
  var SYNC_STATES = ['walk', 'idle', 'attack', 'run', 'jumpup', 'jumpfall', 'jumpthrow', 'hurt', 'dizzy', 'dead', 'dead2', 'stone'];
  var MANAGED = ['src', 'cols', 'rows', 'max', 'frames', 'fps', 'stride', 'speed', 'scale', 'dx', 'dy'];
  function cap(s) { return s.charAt(0) + s.slice(1).toLowerCase(); }

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

  function parseData(text, kind) {
    var m = new RegExp('^const\\s+' + kind.varName + '\\s*=\\s*', 'm').exec(text);   // ^ + m: bỏ qua dòng chú thích có nhắc tới 'const ... ='
    if (!m) throw new Error('Không tìm thấy "const ' + kind.varName + ' =" trong ' + kind.file);
    return JSON.parse(text.slice(m.index + m[0].length).replace(/;\s*$/, ''));
  }

  // Mỗi trạng thái 1 dòng cho dễ đọc / dễ so sánh git
  function serialize(d, kind) {
    var L = kind.header.slice(); L.push('const ' + kind.varName + ' = {', '  "defs": [');
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

  function ensurePet(dir, kind) {
    if (!AppState.pets[dir]) { AppState.pets[dir] = AppState.createPetData(dir); AppState.petOrder.push(dir); }
    AppState.pets[dir]._dir = dir; AppState.pets[dir]._kind = kind.id;
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
  async function loadKind(kind) {
    var dt = parseData(await (await fileAt(root, kind.file)).text(), kind); datas[kind.id] = dt;
    var known = {};
    for (var i = 0; i < dt.defs.length; i++) {
      var def = dt.defs[i], anim = (dt.anim[kind.animKey(def)] || {}).extra || {}; known[def.dir] = true;
      ensurePet(def.dir, kind);
      for (var k in anim) {
        if (!AppState.pets[def.dir][k]) continue;
        try {
          var file = await fileAt(root, anim[k].src);
          file._rel = anim[k].src.replace(new RegExp('^' + kind.folder + '/[^/]+/'), '');
          FileHandler.loadFile(file, def.dir, k);
        } catch (e) { console.warn('Không đọc được', anim[k].src, e); }
      }
    }
    // mục mới (có thư mục trong Character/ hoặc Enemy/ mà chưa có cấu hình): nạp theo tên file rồi tự căn
    var fresh = [];
    try {
      var cdir = await dirAt(root, [kind.folder]), items = await walk(cdir, '', []), files = [], seen = {};
      for (var j = 0; j < items.length; j++) {
        var top = items[j].path.split('/')[0];
        if (known[top] || !/\.(png|webp|jpe?g)$/i.test(items[j].path)) continue;
        var fl = await items[j].handle.getFile();
        Object.defineProperty(fl, 'webkitRelativePath', { value: kind.folder + '/' + items[j].path });
        files.push(fl); seen[top] = true;
      }
      fresh = Object.keys(seen);
      if (files.length) FileHandler.processFileList(files, function () { });
    } catch (e) { console.warn('Không quét được ' + kind.folder + '/', e); }
    return { kind: kind, fresh: fresh };
  }

  async function openHandle(handle) {
    root = handle; status('Đang đọc cấu hình …');
    AppState.petOrder.length = 0; Object.keys(AppState.pets).forEach(function (k) { delete AppState.pets[k]; }); AppState.activePet = null;
    var loaded = [];
    for (var i = 0; i < KINDS.length; i++) loaded.push(await loadKind(KINDS[i]));
    for (var w = 0; w < 400 && FileHandler.pending > 0; w++) await sleep(50);   // chờ ảnh nạp xong (tối đa 20s)
    var msg = [];
    loaded.forEach(function (L) {
      var dt = datas[L.kind.id];
      dt.defs.forEach(function (def) { applyDef(def, (dt.anim[L.kind.animKey(def)] || {}).extra); });
      L.fresh.forEach(function (p) { if (AppState.pets[p]) { AppState.pets[p]._dir = p; AppState.pets[p]._kind = L.kind.id; UIController.alignPet(p); } });
      msg.push(dt.defs.length + ' ' + L.kind.label + (L.fresh.length ? ' + ' + L.fresh.length + ' mới tự căn (' + L.fresh.join(', ') + ')' : ''));
    });
    AppState.activePet = AppState.petOrder[0] || null;
    UIController.buildUI(); UIController.refresh();
    $('gsSave').disabled = false;
    status('Đã mở game: ' + msg.join(' · ') + '. Chỉnh xong bấm "Lưu vào game" (Ctrl+S).');
  }

  // ------- LƯU -------
  function buildData(kind) {
    var out = JSON.parse(JSON.stringify(datas[kind.id]));
    AppState.petOrder.forEach(function (key) {
      var pd = AppState.pets[key]; if (!pd || pd._kind !== kind.id || !pd.walk.img) return;
      var dir = pd._dir || key, w = pd.walk, def = out.defs.filter(function (d) { return d.dir === dir; })[0];
      if (!def) {   // mục mới: ước lượng các số phụ từ ảnh Đi bộ (chỉ số chiến đấu của quái đặt mặc định, hãy chỉnh lại trong enemies.data.js)
        var c = SheetParser.cellOf(w, 0), bb = SheetParser.bboxMedian(w);
        def = kind.newDef(dir, c.cw / c.ch, bb ? bb.h : 0.75, pd.petScale); out.defs.push(def);
      }
      def.scale = r3(pd.petScale); def.ox = r3(w.dx); def.oy = r3(w.dy);
      var prev = (out.anim[kind.animKey(def)] || {}).extra || {}, ex = {};
      SYNC_STATES.forEach(function (k) {
        var s = pd[k]; if (!s || !(s.img || s.name)) return;
        var p0 = prev[k] || {}, o = { src: kind.folder + '/' + dir + '/' + (s.rel || s.name), cols: s.cols, rows: s.rows, max: p0.max || 176 };
        if (s.frames > 0) o.frames = s.frames;
        if (k !== 'stone' && (k === 'idle' || k === 'attack' || p0.fps !== undefined || (k !== 'walk' && s.fps !== AppState.DEF_FPS[k]))) o.fps = s.fps;   // idle/attack luôn ghi fps (mặc định của game khác công cụ)
        if (k === 'walk') { if (s.stride !== 1) o.stride = r3(s.stride); if (s.speed !== 1) o.speed = r3(s.speed); }
        else if (k !== 'stone') {
          if (r3(s.scale) !== 1) o.scale = r3(s.scale);
          var dx = r3(s.dx - w.dx), dy = r3(s.dy - w.dy); if (dx !== 0) o.dx = dx; if (dy !== 0) o.dy = dy;
        }
        for (var q in p0) if (MANAGED.indexOf(q) < 0) o[q] = p0[q];   // giữ khoá riêng của game (vd. hitAt)
        ex[k] = o;
      });
      out.anim[kind.animKey(def)] = { extra: ex };
    });
    return out;
  }

  async function save() {
    if (!root) return;
    try {
      var h = await dirAt(root, ['js', 'config']), names = [];
      for (var i = 0; i < KINDS.length; i++) {
        var kind = KINDS[i], out = buildData(kind), fh = await h.getFileHandle(kind.file.split('/').pop(), { create: true });
        var wr = await fh.createWritable(); await wr.write(serialize(out, kind)); await wr.close();
        datas[kind.id] = out; names.push(kind.file.split('/').pop());
      }
      status('Đã lưu ' + names.join(' + ') + ' lúc ' + new Date().toLocaleTimeString() + ' — tải lại game (F5) để thấy.');
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

  return { openHandle: openHandle, buildData: buildData, serialize: serialize, save: save, KINDS: KINDS };
})();

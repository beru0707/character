window.UIController = (function () {
  var $ = function (id) { return document.getElementById(id); };

  function r3(v) { return Math.round(v * 1000) / 1000; }
  function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : d; }

  /* ---------- PARSE DÁN CẤU HÌNH ---------- */
  function parseAndApplyConfig(text) {
    if (!text || !text.trim()) return;

    // Tự động tìm tên Pet từ cấu hình dán vào (ví dụ: 'Slime': { ... })
    var petMatch = text.match(/['"]?([a-zA-Z0-9_\-]+)['"]?\s*:\s*\{/);
    var targetPet = AppState.activePet || 'Pet_1';

    if (petMatch && petMatch[1] && !['walkSheet', 'idleSheet', 'sleepSheet', 'attackSheet', 'skill1Sheet', 'extra'].includes(petMatch[1])) {
      targetPet = petMatch[1];
    }

    // Nếu nhân vật chưa có trong danh sách thì khởi tạo mới
    if (!AppState.pets[targetPet]) {
      AppState.pets[targetPet] = AppState.createPetData(targetPet);
      AppState.petOrder.push(targetPet);
    }

    // Chuyển sang nhân vật vừa dán
    AppState.activePet = targetPet;
    if ($('petName')) $('petName').value = targetPet;

    var parsedAny = false, pd = AppState.pets[targetPet];

    // Dòng "// PET_DEF  scale: 1.055, ox: 0.115, oy: 0.112" (do nút Sao chép xuất ra): ox/oy chính là dx/dy của Đi bộ
    var pdLine = text.match(/\/\/\s*PET_DEF[^\n]*/);
    if (pdLine) {
      var sc0 = pdLine[0].match(/scale\s*:\s*([\d.]+)/), ox0 = pdLine[0].match(/\box\s*:\s*(-?[\d.]+)/), oy0 = pdLine[0].match(/\boy\s*:\s*(-?[\d.]+)/);
      if (sc0) pd.petScale = parseFloat(sc0[1]);
      pd.walk.dx = ox0 ? parseFloat(ox0[1]) : 0;
      pd.walk.dy = oy0 ? parseFloat(oy0[1]) : 0;
    }

    // Duyệt đọc từng khối trạng thái (walk/idle/attack... và các mục trong extra:{...})
    AppState.STATES_DEF.forEach(function (d) {
      var s = pd[d.k];
      var regex = new RegExp('\\b' + d.cfg + '\\s*:\\s*\\{([^}]+)\\}', 'm');
      var match = text.match(regex);
      if (!(match && match[1])) return;
      var body = match[1];
      parsedAny = true;

      var srcM = body.match(/src\s*:\s*['"]([^'"]+)['"]/);
      if (srcM) { var parts = srcM[1].split('/'); s.name = parts[parts.length - 1]; s.rel = /^Character\//i.test(srcM[1]) ? parts.slice(2).join('/') : ''; }
      function pick(re, def, fn) { var m = body.match(re); return m ? fn(m[1]) : def; }
      s.cols = pick(/cols\s*:\s*(\d+)/, d.cols, parseInt);
      s.rows = pick(/rows\s*:\s*(\d+)/, d.rows, parseInt);
      s.frames = pick(/frames\s*:\s*(\d+)/, 0, parseInt);
      s.scale = pick(/scale\s*:\s*([\d.]+)/, 1, parseFloat);
      s.fps = pick(/fps\s*:\s*([\d.]+)/, AppState.DEF_FPS[d.k] || 12, parseFloat);
      // dx/dy trong cấu hình game là TƯƠNG ĐỐI so với Đi bộ -> cộng lại thành tuyệt đối để vẽ trên sân khấu
      var wdx = d.k === 'walk' ? 0 : pd.walk.dx, wdy = d.k === 'walk' ? 0 : pd.walk.dy;
      s.dx = pick(/\bdx\s*:\s*(-?[\d.]+)/, 0, parseFloat) + wdx;
      s.dy = pick(/\bdy\s*:\s*(-?[\d.]+)/, 0, parseFloat) + wdy;
      s.stride = pick(/stride\s*:\s*([\d.]+)/, 1, parseFloat);
      s.speed = pick(/speed\s*:\s*([\d.]+)/, 1, parseFloat);
      s.ballX = pick(/ballX\s*:\s*(\d+)/, 40, parseInt);
      s.ballY = pick(/ballY\s*:\s*(\d+)/, 45, parseInt);
      s._ck = s._bk = s._mk = null;
    });

    if (parsedAny) {
      buildUI();
      refresh();
      $('hint').textContent = 'Đã cập nhật cấu hình cho "' + targetPet + '" thành công!';
    } else {
      alert('Không tìm thấy cấu hình hợp lệ. Dạng chuẩn:\nwalkSheet: { ... }, idleSheet: { ... }');
    }
  }

  /* ---------- XÂY DỰNG GIAO DIỆN ---------- */
  function buildUI() {
    // 1. Render danh sách các Pet
    var pSel = $('petSelector'); pSel.innerHTML = '';
    $('petCountTag').textContent = AppState.petOrder.length + ' pet';

    AppState.petOrder.forEach(function (pName, idx) {
      var item = document.createElement('div');
      item.className = 'pet-item ' + (pName === AppState.activePet ? 'active' : '');

      // Nút dịch trái
      var moveLeftBtn = document.createElement('button');
      moveLeftBtn.className = 'pet-item-btn'; moveLeftBtn.textContent = '◄';
      moveLeftBtn.onclick = function (e) {
        e.stopPropagation();
        if (idx > 0) {
          var temp = AppState.petOrder[idx];
          AppState.petOrder[idx] = AppState.petOrder[idx - 1];
          AppState.petOrder[idx - 1] = temp;
          buildUI(); refresh();
        }
      };

      // Tên nhân vật
      var nameBtn = document.createElement('button');
      nameBtn.className = 'pet-item-name'; nameBtn.textContent = pName;
      nameBtn.onclick = function () {
        AppState.activePet = pName;
        if ($('petName')) $('petName').value = AppState.activePet;
        buildUI(); refresh();
      };

      // Nút dịch phải
      var moveRightBtn = document.createElement('button');
      moveRightBtn.className = 'pet-item-btn'; moveRightBtn.textContent = '►';
      moveRightBtn.onclick = function (e) {
        e.stopPropagation();
        if (idx < AppState.petOrder.length - 1) {
          var temp = AppState.petOrder[idx];
          AppState.petOrder[idx] = AppState.petOrder[idx + 1];
          AppState.petOrder[idx + 1] = temp;
          buildUI(); refresh();
        }
      };

      // Nút xóa nhân vật
      var delBtn = document.createElement('button');
      delBtn.className = 'pet-item-btn del'; delBtn.textContent = '✕';
      delBtn.onclick = function (e) {
        e.stopPropagation();
        delete AppState.pets[pName];
        AppState.petOrder.splice(idx, 1);
        if (AppState.activePet === pName) {
          AppState.activePet = AppState.petOrder.length > 0 ? AppState.petOrder[0] : null;
        }
        buildUI(); refresh();
      };

      item.appendChild(moveLeftBtn);
      item.appendChild(nameBtn);
      item.appendChild(moveRightBtn);
      item.appendChild(delBtn);
      pSel.appendChild(item);
    });

    if (AppState.activePet && $('petName') && document.activeElement !== $('petName')) {
      $('petName').value = AppState.activePet;
    }

    var activePetData = AppState.getActivePetS();

    // 2. Cập nhật giá trị ô petScale riêng cho nhân vật đang chọn
    if (activePetData && $('petScale') && document.activeElement !== $('petScale')) {
      $('petScale').value = activePetData.petScale || 1;
    }

    // 3. Render Tabs Trạng Thái
    var tabs = $('tabs'); tabs.innerHTML = '';
    AppState.STATES_DEF.forEach(function (d) {
      var b = document.createElement('button');
      b.className = d.k === AppState.curState ? 'on' : ''; b.type = 'button';
      var hasImg = activePetData && activePetData[d.k] && activePetData[d.k].img;
      b.innerHTML = '<span class="dot ' + (hasImg ? 'ok' : '') + '"></span>' + d.label;
      b.onclick = function () {
        AppState.curState = d.k; AppState.pickMode = false; AppState.manualFrame = null; AppState.t0 = performance.now();
        buildUI(); refresh();
      };
      tabs.appendChild(b);
    });

    // 4. Ghost Selector
    var gs = $('ghostSrc'), prev = gs.value; gs.innerHTML = '';
    AppState.STATES_DEF.forEach(function (d) {
      if (activePetData && activePetData[d.k] && activePetData[d.k].img && d.k !== AppState.curState) {
        var o = document.createElement('option'); o.value = d.k; o.textContent = d.label; gs.appendChild(o);
      }
    });
    if (prev && Array.prototype.some.call(gs.options, function (o) { return o.value === prev; })) gs.value = prev;

    // 5. Render Bảng Thông Số
    var f = $('fields'); f.innerHTML = '';
    if (activePetData) {
      var s = activePetData[AppState.curState];
      function add(id, label, val, step, key, min) {
        var l = document.createElement('label');
        l.innerHTML = label + '<input type="number" id="f_' + id + '" step="' + step + '"' + (min !== undefined ? ' min="' + min + '"' : '') + '>';
        f.appendChild(l); var inp = l.querySelector('input'); inp.value = val;
        inp.oninput = function () { s[key] = num(inp.value, 0); if (key === 'cols' || key === 'rows') s._ck = s._bk = s._mk = null; refresh(); };
      }

      add('cols', 'cols', s.cols, 1, 'cols', 1); add('rows', 'rows', s.rows, 1, 'rows', 1);
      add('frames', 'frames (0 = tự đếm)', s.frames, 1, 'frames', 0);
      add('scale', 'scale', r3(s.scale), 0.01, 'scale', 0.05);
      add('fps', 'fps', s.fps, 0.5, 'fps', 1);

      if (AppState.curState === 'walk') {
        add('stride', 'stride', s.stride, 0.05, 'stride', 0.1);
        add('speed', 'speed', s.speed, 0.05, 'speed', 0.1);
      }
      if (s.move) {
        add('dx', 'dx', r3(s.dx), 0.005, 'dx');
        add('dy', 'dy', r3(s.dy), 0.005, 'dy');
      }
      if (AppState.curState === 'skill1') {
        add('bx', 'ballX (px)', r3(s.ballX), 1, 'ballX');
        add('by', 'ballY (px)', r3(s.ballY), 1, 'ballY');
      }

      $('suggest').hidden = $('reset').hidden = !s.move;
      $('pickBall').hidden = AppState.curState !== 'skill1';
      $('drop').childNodes[0].textContent = s.img ? 'Đang chỉnh ' + AppState.activePet + ' (' + s.name + ') — thả thêm folder/file khác hoặc ' : 'Thả file hoặc nhiều folder vào đây / ';
    } else {
      $('drop').childNodes[0].textContent = 'Thả file hoặc nhiều folder vào đây / ';
    }

    $('pickBall').classList.toggle('on', AppState.pickMode);
    Renderer.cv.classList.toggle('pick', AppState.pickMode);
  }

  function syncInputs() {
    var activePetData = AppState.getActivePetS();
    if (!activePetData) return;
    var s = activePetData[AppState.curState];
    ['dx', 'dy'].forEach(function (k) { var e = $('f_' + k); if (e && document.activeElement !== e) e.value = r3(s[k]); });
    var bx = $('f_bx'), by = $('f_by');
    if (bx && document.activeElement !== bx) bx.value = r3(s.ballX);
    if (by && document.activeElement !== by) by.value = r3(s.ballY);
  }

  // Chuyển cấu hình của 1 pet thành đoạn mã dán thẳng vào game (js/config/pets.js).
  // Trong game: ox/oy (PET_DEF) = dx/dy của Đi bộ, còn dx/dy các trạng thái khác là TƯƠNG ĐỐI so với Đi bộ.
  function petText(pName, label) {
    var pData = AppState.pets[pName]; if (!pData) return '';
    var dir = 'Character/' + (label || pName).toUpperCase(), top = [], extra = [], w = pData.walk;
    AppState.STATES_DEF.forEach(function (d) {
      var s = pData[d.k]; if (!s.img && !s.name) return;
      var nm = s.rel || s.name || (d.k + '.png'), ind = d.extra ? '      ' : '    ', parts = ["src: '" + dir + "/" + nm + "'"];
      if (s.cols !== d.cols || s.rows !== d.rows) parts.push('cols: ' + s.cols, 'rows: ' + s.rows);
      if (s.frames > 0) parts.push('frames: ' + s.frames);
      if (r3(s.scale) !== 1) parts.push('scale: ' + r3(s.scale));
      if (d.k !== 'sleep' && d.k !== 'walk' && s.fps !== AppState.DEF_FPS[d.k]) parts.push('fps: ' + s.fps);
      if (d.k === 'walk') { if (s.stride !== 1) parts.push('stride: ' + r3(s.stride)); if (s.speed !== 1) parts.push('speed: ' + r3(s.speed)); }
      else if (d.move) {
        var rx = r3(s.dx - w.dx), ry = r3(s.dy - w.dy);
        if (rx !== 0) parts.push('dx: ' + rx); if (ry !== 0) parts.push('dy: ' + ry);
      }
      if (d.k === 'skill1') parts.push('ballX: ' + Math.round(s.ballX), 'ballY: ' + Math.round(s.ballY));
      if (d.extra) extra.push(ind + d.cfg + ': { ' + parts.join(', ') + ' },');
      else top.push(ind + d.cfg + ': {\n' + ind + '  ' + parts.join(',\n' + ind + '  ') + '\n' + ind + '},');
    });
    if (!top.length && !extra.length) return '';
    var head = '// PET_DEF  scale: ' + r3(pData.petScale) + ', ox: ' + r3(w.dx) + ', oy: ' + r3(w.dy) + '\n';
    return head + "  '" + pName + "': {\n" + top.join('\n') + (extra.length ? '\n    extra: {\n' + extra.join('\n') + '\n    },' : '') + "\n  },";
  }

  function output() {
    if (!AppState.activePet || !AppState.pets[AppState.activePet]) {
      $('out').value = 'Chưa có nhân vật nào.';
      return;
    }
    var pet = $('petName').value.trim() || AppState.activePet;
    $('out').value = petText(AppState.activePet, pet) || 'Nạp ít nhất một sheet để xem cấu hình.';
  }

  /* ---------- TỰ CĂN THEO ĐI BỘ ---------- */
  // Cùng công thức của nút "Gợi ý theo ghost" nhưng dùng vùng nhìn thấy TRUNG VỊ của mọi khung, lấy Đi bộ làm mốc:
  //  - Đi bộ: tâm thân về giữa, chân chạm đường chân (dx/dy của Đi bộ = ox/oy trong game)
  //  - Idle / Tấn công / Chạy: thêm scale cho cao thấy được bằng Đi bộ (giới hạn 0.92–1.08)
  //  - Nhóm nhảy: chỉ căn ngang (ảnh đã có độ cao của cú nhảy); các trạng thái còn lại: căn cả chân
  function alignPet(pName) {
    var pd = AppState.pets[pName]; if (!pd || !pd.walk.img) return false;
    var wb = SheetParser.bboxMedian(pd.walk); if (!wb) return false;
    var c = SheetParser.cellOf(pd.walk, 0), ratio = c.cw / c.ch;
    pd.walk.dx = ratio * (0.5 - wb.cx); pd.walk.dy = 1 - wb.y1;
    AppState.STATES_DEF.forEach(function (d) {
      var s = pd[d.k]; if (d.k === 'walk' || !s.img || !s.move) return;
      var b = SheetParser.bboxMedian(s); if (!b) return;
      s.scale = (d.k === 'idle' || d.k === 'attack' || d.k === 'run') ? Math.min(1.08, Math.max(0.92, wb.h / b.h)) : 1;
      s.dx = ratio * (0.5 - b.cx);
      s.dy = d.k.indexOf('jump') === 0 ? pd.walk.dy : 1 - b.y1;
    });
    return true;
  }

  function refresh() { syncInputs(); output(); }

  /* ---------- TƯƠNG TÁC CON TRỎ & PAN CANVAS ---------- */
  var isPanning = false, panStart = { x: 0, y: 0 }, drag = null;
  function mpos(e) { var r = Renderer.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * Renderer.cv.width / r.width, y: (e.clientY - r.top) * Renderer.cv.height / r.height }; }

  Renderer.cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  Renderer.cv.addEventListener('pointerdown', function (e) {
    Renderer.cv.focus();
    var p = mpos(e);

    // Chuột phải (button = 2) HOẶC giữ Shift + Chuột trái: Di chuyển camera (Pan)
    if (e.button === 2 || e.shiftKey) {
      isPanning = true;
      panStart = { x: e.clientX - AppState.cameraOffset.x, y: e.clientY - AppState.cameraOffset.y };
      Renderer.cv.classList.add('panning');
      Renderer.cv.setPointerCapture(e.pointerId);
      return;
    }

    // Chuột trái (button = 0): Kéo chỉnh dx/dy
    if (e.button === 0) {
      var activePetData = AppState.getActivePetS();
      if (!activePetData) return;
      var s = activePetData[AppState.curState], Z = num($('zoom').value, 1.5), mirror = $('mirror').checked;

      if (AppState.pickMode && AppState.curState === 'skill1') {
        var gx = Renderer.getPetPosX(AppState.activePet);
        s.ballX = Math.max(0, (mirror ? gx - p.x : p.x - gx) / Z);
        s.ballY = (Renderer.getGY() - p.y) / Z;
        refresh(); return;
      }

      if (!s.img || !s.move) return;
      drag = { x: p.x, y: p.y };
      Renderer.cv.setPointerCapture(e.pointerId);
    }
  });

  Renderer.cv.addEventListener('pointermove', function (e) {
    if (isPanning) {
      AppState.cameraOffset.x = e.clientX - panStart.x;
      AppState.cameraOffset.y = e.clientY - panStart.y;
      return;
    }

    if (drag) {
      var activePetData = AppState.getActivePetS();
      if (!activePetData) return;
      var s = activePetData[AppState.curState], p = mpos(e), Z = num($('zoom').value, 1.5), mirror = $('mirror').checked, g = Renderer.geom(s, AppState.activePet);
      s.dx += (mirror ? -1 : 1) * (p.x - drag.x) / (Z * g.dh);
      s.dy += (p.y - drag.y) / (Z * g.dh);
      drag = { x: p.x, y: p.y };
      refresh();
    }
  });

  function endPointer() {
    if (isPanning) { isPanning = false; Renderer.cv.classList.remove('panning'); }
    drag = null;
  }

  Renderer.cv.addEventListener('pointerup', endPointer);
  Renderer.cv.addEventListener('pointercancel', endPointer);

  $('resetViewBtn').onclick = function () { AppState.cameraOffset = { x: 0, y: 0 }; };

  // Sự kiện Nút bấm
  $('suggest').onclick = function () {
    var activePetData = AppState.getActivePetS();
    if (!activePetData) return;
    var s = activePetData[AppState.curState], gk = $('ghostSrc').value, gs = activePetData[gk];
    if (!s.img || !gs || !gs.img || gk === AppState.curState) { $('hint').textContent = 'Cần nạp ảnh cho trạng thái này và ghost.'; return; }
    var b = SheetParser.bbox(s), gb = SheetParser.bbox(gs); if (!b || !gb) return;
    var g = Renderer.geom(s, AppState.activePet), gg = Renderer.geom(gs, AppState.activePet);
    var feetG = gg.offT + gb.y1 * gg.dh, cxG = gg.offL + (gb.x0 + gb.x1) / 2 * gg.dw;
    s.dy = 1 - b.y1 + feetG / g.dh;
    s.dx = (cxG - (-g.dw / 2 + (b.x0 + b.x1) / 2 * g.dw)) / g.dh;
    refresh(); $('hint').textContent = 'Đã căn chân và tâm theo ghost.';
  };

  $('alignAll').onclick = function () {
    var ok = alignPet(AppState.activePet);
    refresh(); buildUI(); $('hint').textContent = ok ? 'Đã căn mọi trạng thái của "' + AppState.activePet + '" theo Đi bộ.' : 'Cần nạp sheet Đi bộ trước.';
  };
  $('alignEvery').onclick = function () {
    var n = 0; AppState.petOrder.forEach(function (p) { if (alignPet(p)) n++; });
    refresh(); buildUI(); $('hint').textContent = 'Đã căn ' + n + '/' + AppState.petOrder.length + ' pet theo Đi bộ.';
  };
  $('copyAll').onclick = function () {
    var t = AppState.petOrder.map(function (p) { return petText(p); }).filter(Boolean).join('\n'), b = $('copyAll');
    function ok() { b.textContent = 'Đã chép ' + AppState.petOrder.length + ' pet'; setTimeout(function () { b.textContent = 'Sao chép TẤT CẢ pet'; }, 1600); }
    function fb() { var old = $('out').value; $('out').value = t; $('out').select(); try { document.execCommand('copy'); ok(); } catch (e) { } }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, fb); else fb();
  };

  $('reset').onclick = function () {
    var activePetData = AppState.getActivePetS();
    if (activePetData && activePetData[AppState.curState]) {
      activePetData[AppState.curState].dx = activePetData[AppState.curState].dy = 0; refresh();
    }
  };

  $('pickBall').onclick = function () { AppState.pickMode = !AppState.pickMode; buildUI(); };
  $('playBtn').onclick = function () {
    AppState.playing = !AppState.playing;
    var activePetData = AppState.getActivePetS();
    if (activePetData && activePetData[AppState.curState]) {
      AppState.manualFrame = AppState.playing ? null : Math.floor((performance.now() - AppState.t0) / 1000 * activePetData[AppState.curState].fps) % Math.max(1, SheetParser.count(activePetData[AppState.curState]));
    }
    AppState.t0 = AppState.playing ? performance.now() : AppState.t0;
    $('playBtn').textContent = AppState.playing ? 'Tạm dừng' : 'Phát';
  };
  $('frameSl').oninput = function () { AppState.playing = false; $('playBtn').textContent = 'Phát'; AppState.manualFrame = +$('frameSl').value; };

  $('pasteConfig').onclick = function () {
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(function (text) {
        if (text && text.trim()) {
          $('out').value = text;
          parseAndApplyConfig(text);
        }
      }).catch(function () {
        parseAndApplyConfig($('out').value);
      });
    } else {
      parseAndApplyConfig($('out').value);
    }
  };

  $('out').addEventListener('change', function () { parseAndApplyConfig($('out').value); });

  $('copy').onclick = function () {
    var t = $('out').value, b = $('copy');
    function ok() { b.textContent = 'Đã chép'; setTimeout(function () { b.textContent = 'Sao chép'; }, 1400); }
    function fb() { $('out').select(); try { document.execCommand('copy'); ok(); } catch (e) { } }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, fb); else fb();
  };

  $('petName').addEventListener('input', function () {
    var newName = $('petName').value.trim();
    if (newName && AppState.activePet && newName !== AppState.activePet) {
      AppState.pets[newName] = AppState.pets[AppState.activePet];
      delete AppState.pets[AppState.activePet];
      var idx = AppState.petOrder.indexOf(AppState.activePet);
      if (idx !== -1) AppState.petOrder[idx] = newName;
      AppState.activePet = newName;
      buildUI(); refresh();
    }
  });

  $('petScale').addEventListener('input', function () {
    var activePetData = AppState.getActivePetS();
    if (activePetData) {
      activePetData.petScale = num($('petScale').value, 1);
      refresh();
    }
  });

  ['zoom', 'mirror', 'ghostOn', 'ghostSrc', 'onion'].forEach(function (id) { $(id).addEventListener('input', refresh); });

  // Tải file & folder
  $('file').onchange = function (e) {
    if (e.target.files && e.target.files.length > 0) {
      FileHandler.processFileList(e.target.files, function () { buildUI(); refresh(); });
      e.target.value = '';
    }
  };

  $('btnSelectFolder').onclick = function (e) { e.stopPropagation(); $('folderInput').click(); };
  $('folderInput').onchange = function (e) {
    if (e.target.files && e.target.files.length > 0) {
      FileHandler.processFileList(e.target.files, function () { buildUI(); refresh(); });
      e.target.value = '';
    }
  };

  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });

  drop.addEventListener('drop', function (e) {
    e.preventDefault(); drop.classList.remove('over');
    var items = e.dataTransfer.items;
    if (items && items.length > 0) {
      var filesToProcess = [];
      var pendingReads = 0;
      for (var i = 0; i < items.length; i++) {
        var entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
        if (entry) {
          pendingReads++;
          FileHandler.traverseFileTree(entry, '', function (file) {
            filesToProcess.push(file);
          }, function () {
            pendingReads--;
            if (pendingReads === 0) FileHandler.processFileList(filesToProcess, function () { buildUI(); refresh(); });
          });
        }
      }
      if (pendingReads === 0 && e.dataTransfer.files.length > 0) {
        FileHandler.processFileList(e.dataTransfer.files, function () { buildUI(); refresh(); });
      }
    }
  });

  // Khởi chạy UI ban đầu
  buildUI();
  refresh();
  Renderer.startLoop();

  return { buildUI: buildUI, refresh: refresh, alignPet: alignPet, petText: petText };
})();
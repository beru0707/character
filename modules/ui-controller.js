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

    if (petMatch && petMatch[1] && !['walkSheet', 'idleSheet', 'sleepSheet', 'attackSheet', 'skill1Sheet'].includes(petMatch[1])) {
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

    var cfgMap = {
      walkSheet: 'walk',
      idleSheet: 'idle',
      sleepSheet: 'sleep',
      attackSheet: 'attack',
      skill1Sheet: 'skill1'
    };

    var parsedAny = false;

    // Duyệt đọc từng khối trạng thái
    for (var cfgKey in cfgMap) {
      var stateKey = cfgMap[cfgKey];
      var s = AppState.pets[targetPet][stateKey];

      var regex = new RegExp(cfgKey + '\\s*:\\s*\\{([^}]+)\\}', 'm');
      var match = text.match(regex);

      if (match && match[1]) {
        var body = match[1];
        parsedAny = true;

        var srcM = body.match(/src\s*:\s*['"]([^'"]+)['"]/);
        if (srcM) {
          var parts = srcM[1].split('/');
          s.name = parts[parts.length - 1];
        }

        var colsM = body.match(/cols\s*:\s*(\d+)/);
        s.cols = colsM ? parseInt(colsM[1]) : 6;

        var rowsM = body.match(/rows\s*:\s*(\d+)/);
        s.rows = rowsM ? parseInt(rowsM[1]) : 6;

        var framesM = body.match(/frames\s*:\s*(\d+)/);
        s.frames = framesM ? parseInt(framesM[1]) : 0;

        var scaleM = body.match(/scale\s*:\s*([\d\.]+)/);
        s.scale = scaleM ? parseFloat(scaleM[1]) : 1;

        var fpsM = body.match(/fps\s*:\s*([\d\.]+)/);
        s.fps = fpsM ? parseFloat(fpsM[1]) : (AppState.DEF_FPS[stateKey] || 12);

        var dxM = body.match(/dx\s*:\s*([-\d\.]+)/);
        s.dx = dxM ? parseFloat(dxM[1]) : 0;

        var dyM = body.match(/dy\s*:\s*([-\d\.]+)/);
        s.dy = dyM ? parseFloat(dyM[1]) : 0;

        var strideM = body.match(/stride\s*:\s*([\d\.]+)/);
        s.stride = strideM ? parseFloat(strideM[1]) : 1;

        var speedM = body.match(/speed\s*:\s*([\d\.]+)/);
        s.speed = speedM ? parseFloat(speedM[1]) : 1;

        var ballXM = body.match(/ballX\s*:\s*(\d+)/);
        s.ballX = ballXM ? parseInt(ballXM[1]) : 40;

        var ballYM = body.match(/ballY\s*:\s*(\d+)/);
        s.ballY = ballYM ? parseInt(ballYM[1]) : 45;

        s._ck = s._bk = null;
      }
    }

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
        inp.oninput = function () { s[key] = num(inp.value, 0); if (key === 'cols' || key === 'rows') s._ck = s._bk = null; refresh(); };
      }

      add('cols', 'cols', s.cols, 1, 'cols', 1); add('rows', 'rows', s.rows, 1, 'rows', 1);
      add('frames', 'frames (0 = tự đếm)', s.frames, 1, 'frames', 0);
      add('scale', 'scale', s.scale, 0.01, 'scale', 0.05);
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

  function output() {
    if (!AppState.activePet || !AppState.pets[AppState.activePet]) {
      $('out').value = 'Chưa có nhân vật nào.';
      return;
    }
    var pet = $('petName').value.trim() || AppState.activePet, dir = 'assets/' + pet.toLowerCase(), lines = [];
    var pData = AppState.pets[AppState.activePet];

    AppState.STATES_DEF.forEach(function (d) {
      var s = pData[d.k]; if (!s.img && !s.name) return;
      var nm = s.name || (d.k + '.webp'), parts = ["src: '" + dir + "/" + nm + "'"];
      if (s.cols !== 6 || s.rows !== 6) parts.push('cols: ' + s.cols, 'rows: ' + s.rows);
      if (s.frames > 0) parts.push('frames: ' + s.frames);
      parts.push('scale: ' + r3(s.scale));
      if (d.k !== 'sleep' && d.k !== 'walk' && s.fps !== AppState.DEF_FPS[d.k]) parts.push('fps: ' + s.fps);
      if (d.k === 'walk') { if (s.stride !== 1) parts.push('stride: ' + r3(s.stride)); if (s.speed !== 1) parts.push('speed: ' + r3(s.speed)); }
      if (d.move) { if (r3(s.dx) !== 0) parts.push('dx: ' + r3(s.dx)); if (r3(s.dy) !== 0) parts.push('dy: ' + r3(s.dy)); }
      if (d.k === 'skill1') parts.push('ballX: ' + Math.round(s.ballX), 'ballY: ' + Math.round(s.ballY));
      lines.push('    ' + d.cfg + ': {\n      ' + parts.join(',\n      ') + '\n    },');
    });

    $('out').value = lines.length ? "  '" + pet + "': {\n" + lines.join('\n') + "\n  }," : 'Nạp ít nhất một sheet để xem cấu hình.';
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

  return { buildUI: buildUI, refresh: refresh };
})();
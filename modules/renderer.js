window.Renderer = (function () {
  var cv = document.getElementById('cv');
  var ctx = cv.getContext('2d');

  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : d; }

  function getGY() {
    return cv.height - 80 + AppState.cameraOffset.y;
  }

  // Sửa hàm geom để nhận thêm petName hoặc tự tra cứu petScale riêng của nhân vật đó
  function geom(s, petName) {
    var pData = AppState.pets[petName || AppState.activePet];
    var petScale = (pData && pData.petScale !== undefined) ? pData.petScale : 1;
    
    var dh = 100 * petScale * s.scale;
    if (!s.img) return { dh: dh, dw: dh, offL: 0, offT: -dh };
    var c = SheetParser.cellOf(s, 0), dw = dh * c.cw / c.ch;
    var dx = s.move ? s.dx : 0, dy = s.move ? s.dy : 0;
    return { dh: dh, dw: dw, offL: -dw / 2 + dx * dh, offT: -dh + dy * dh };
  }

  function drawFrameAt(s, fi, alpha, Z, mirror, tint, gx, gy, petName) {
    var c = SheetParser.cellOf(s, fi), g = geom(s, petName), dh = g.dh * Z, dw = g.dw * Z, oL = g.offL * Z, oT = g.offT * Z;
    ctx.save(); ctx.globalAlpha = alpha;
    if (tint) ctx.filter = 'hue-rotate(160deg) saturate(1.6)';
    if (mirror) {
      ctx.translate(gx - oL, gy + oT);
      ctx.scale(-1, 1);
      ctx.drawImage(s.img, c.sx, c.sy, c.cw, c.ch, 0, 0, dw, dh);
    } else {
      ctx.drawImage(s.img, c.sx, c.sy, c.cw, c.ch, gx + oL, gy + oT, dw, dh);
    }
    ctx.restore();
  }

  function frameOf(s, now) {
    var n = SheetParser.count(s); if (!n) return 0;
    if (AppState.manualFrame !== null) return Math.min(AppState.manualFrame, n - 1);
    return Math.floor((now - AppState.t0) / 1000 * s.fps) % n;
  }

  function getPetPosX(pName) {
    var idx = AppState.petOrder.indexOf(pName);
    if (idx === -1) idx = 0;
    var total = Math.max(1, AppState.petOrder.length);
    var spacing = Math.max(140, cv.width / (total + 1));
    return spacing * (idx + 1) + AppState.cameraOffset.x;
  }

  function render(now) {
    var Z = num(document.getElementById('zoom').value, 1.5);
    var mirror = document.getElementById('mirror').checked;
    var GY = getGY();

    ctx.clearRect(0, 0, cv.width, cv.height);

    ctx.strokeStyle = css('--stage-grid'); ctx.lineWidth = 1; ctx.beginPath();
    var gridX = (AppState.cameraOffset.x) % (40 * Z);
    var gridY = (AppState.cameraOffset.y + GY) % (40 * Z);
    for (var x = gridX; x < cv.width; x += 40 * Z) { ctx.moveTo(x, 0); ctx.lineTo(x, cv.height); }
    for (var y = gridY; y < cv.height; y += 40 * Z) { ctx.moveTo(0, y); ctx.lineTo(cv.width, y); }
    ctx.stroke();

    var activePetData = AppState.getActivePetS();

    // Ghost
    var gk = document.getElementById('ghostSrc').value;
    if (document.getElementById('ghostOn').checked && activePetData && activePetData[gk] && activePetData[gk].img && gk !== AppState.curState) {
      var activeGX = getPetPosX(AppState.activePet);
      drawFrameAt(activePetData[gk], 0, 0.45, Z, mirror, true, activeGX, GY, AppState.activePet);
    }

    if (AppState.petOrder.length === 0) {
      ctx.fillStyle = css('--muted'); ctx.font = '14px system-ui,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Thả tập tin/thư mục nhân vật vào đây để bắt đầu', cv.width / 2, cv.height / 2);
    }

    // Render từng pet với scale riêng
    AppState.petOrder.forEach(function (pName) {
      var pData = AppState.pets[pName];
      var s = pData[AppState.curState];
      var gx = getPetPosX(pName);

      if (s && s.img) {
        var n = SheetParser.count(s), fi = frameOf(s, now);

        if (pName === AppState.activePet && document.getElementById('onion').checked) {
          for (var i = 0; i < n; i++) drawFrameAt(s, i, 0.18, Z, mirror, false, gx, GY, pName);
        }

        var alpha = (pName === AppState.activePet) ? 1.0 : 0.55;
        drawFrameAt(s, fi, alpha, Z, mirror, false, gx, GY, pName);

        ctx.fillStyle = (pName === AppState.activePet) ? css('--accent') : css('--muted');
        ctx.font = 'bold 12px ui-monospace,monospace'; ctx.textAlign = 'center';
        ctx.fillText(pName + (pName === AppState.activePet ? ' ★' : ''), gx, GY + 25);
      } else {
        ctx.fillStyle = css('--muted'); ctx.font = '12px system-ui,sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('[' + pName + ': Thiếu sheet]', gx, GY - 40);
      }
    });

    if (activePetData && activePetData[AppState.curState] && activePetData[AppState.curState].img) {
      var activeS = activePetData[AppState.curState];
      var totalF = SheetParser.count(activeS), curF = frameOf(activeS, now);
      document.getElementById('frameSl').max = Math.max(0, totalF - 1);
      document.getElementById('frameSl').value = curF;
      document.getElementById('frameLbl').textContent = (curF + 1) + '/' + totalF;
    }

    ctx.lineWidth = 1.5; ctx.strokeStyle = css('--accent');
    ctx.beginPath(); ctx.moveTo(0, GY + 0.5); ctx.lineTo(cv.width, GY + 0.5); ctx.stroke();

    if (AppState.activePet) {
      var activeGX = getPetPosX(AppState.activePet);
      ctx.setLineDash([6, 5]); ctx.beginPath();
      ctx.moveTo(activeGX + 0.5, 0); ctx.lineTo(activeGX + 0.5, cv.height); ctx.stroke();
      ctx.setLineDash([]);

      if (AppState.curState === 'skill1' && activePetData && activePetData.skill1) {
        var bx = activeGX + (mirror ? -1 : 1) * activePetData.skill1.ballX * Z, by = GY - activePetData.skill1.ballY * Z;
        ctx.strokeStyle = css('--accent'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 9, 0, 7);
        ctx.moveTo(bx - 14, by); ctx.lineTo(bx + 14, by); ctx.moveTo(bx, by - 14); ctx.lineTo(bx, by + 14); ctx.stroke();
      }
    }
  }

  function loop(now) { render(now); requestAnimationFrame(loop); }

  return {
    cv: cv,
    geom: geom,
    getGY: getGY,
    getPetPosX: getPetPosX,
    startLoop: function () { requestAnimationFrame(loop); }
  };
})();
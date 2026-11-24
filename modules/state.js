window.AppState = (function () {
  // Các trạng thái khớp với game: walk / idle / attack nằm ở walkSheet / idleSheet / attackSheet, các trạng thái còn lại (extra:true) nằm trong extra:{...}.
  // cols x rows mặc định theo sheet của bộ ảnh Character/ trong game.
  var STATES_DEF = [
    { k: 'walk', label: 'Đi bộ', cfg: 'walkSheet', cols: 4, rows: 3, fps: 12, scale: 1, move: true },
    { k: 'idle', label: 'Đứng yên', cfg: 'idleSheet', cols: 4, rows: 3, fps: 10, scale: 1, move: true },
    { k: 'attack', label: 'Tấn công', cfg: 'attackSheet', cols: 4, rows: 2, fps: 12.5, scale: 1, move: true },
    { k: 'run', label: 'Chạy', cfg: 'run', extra: true, cols: 5, rows: 2, fps: 14, scale: 1, move: true },
    { k: 'jumpup', label: 'Nhảy lên', cfg: 'jumpup', extra: true, cols: 5, rows: 1, fps: 12, scale: 1, move: true },
    { k: 'jumpfall', label: 'Nhảy xuống', cfg: 'jumpfall', extra: true, cols: 5, rows: 1, fps: 12, scale: 1, move: true },
    { k: 'jumpthrow', label: 'Nhảy + đánh', cfg: 'jumpthrow', extra: true, cols: 4, rows: 2, fps: 12, scale: 1, move: true },
    { k: 'hurt', label: 'Bị đánh', cfg: 'hurt', extra: true, cols: 3, rows: 2, fps: 12, scale: 1, move: true },
    { k: 'dizzy', label: 'Choáng', cfg: 'dizzy', extra: true, cols: 5, rows: 2, fps: 12, scale: 1, move: true },
    { k: 'dead', label: 'Chết', cfg: 'dead', extra: true, cols: 5, rows: 2, fps: 12, scale: 1, move: true },
    { k: 'dead2', label: 'Chết 2 (quái)', cfg: 'dead2', extra: true, cols: 5, rows: 2, fps: 12, scale: 1, move: true },
    { k: 'stone', label: 'Đạn (quái)', cfg: 'stone', extra: true, cols: 1, rows: 1, fps: 6, scale: 1, move: false },
    { k: 'sleep', label: 'Ngủ', cfg: 'sleepSheet', cols: 1, rows: 1, fps: 6, scale: 1, move: true },
    { k: 'skill1', label: 'Skill 1', cfg: 'skill1Sheet', cols: 4, rows: 4, fps: 12.5, scale: 1, move: true }
  ];

  var DEF_FPS = { idle: 10, attack: 12.5, skill1: 12.5, run: 14, jumpup: 12, jumpfall: 12, jumpthrow: 12, hurt: 12, dizzy: 12, dead: 12, dead2: 12, stone: 6 };

  var pets = {};
  var petOrder = [];
  var activePet = null;

  var curState = 'walk';
  var playing = true;
  var pickMode = false;
  var manualFrame = null;
  var t0 = performance.now();

  var cameraOffset = { x: 0, y: 0 };

  function createPetData(name) {
    var S = {
      petScale: 1 // Scale tổng thể ban đầu chỉnh riêng cho từng pet
    };
    STATES_DEF.forEach(function (d) {
      S[d.k] = Object.assign({ img: null, name: '', frames: 0, dx: 0, dy: 0, ballX: 40, ballY: 45, stride: 1, speed: 1 }, d);
    });
    return S;
  }

  function getActivePetS() {
    if (!activePet || !pets[activePet]) return null;
    return pets[activePet];
  }

  return {
    STATES_DEF: STATES_DEF,
    DEF_FPS: DEF_FPS,
    pets: pets,
    petOrder: petOrder,
    get activePet() { return activePet; },
    set activePet(v) { activePet = v; },
    get curState() { return curState; },
    set curState(v) { curState = v; },
    get playing() { return playing; },
    set playing(v) { playing = v; },
    get pickMode() { return pickMode; },
    set pickMode(v) { pickMode = v; },
    get manualFrame() { return manualFrame; },
    set manualFrame(v) { manualFrame = v; },
    get t0() { return t0; },
    set t0(v) { t0 = v; },
    cameraOffset: cameraOffset,
    createPetData: createPetData,
    getActivePetS: getActivePetS
  };
})();
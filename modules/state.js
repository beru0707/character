window.AppState = (function () {
  var STATES_DEF = [
    { k: 'walk', label: 'Đi bộ', cfg: 'walkSheet', cols: 6, rows: 6, fps: 12, scale: 1, move: true },
    { k: 'idle', label: 'Đứng yên', cfg: 'idleSheet', cols: 6, rows: 6, fps: 12, scale: 1, move: true },
    { k: 'sleep', label: 'Ngủ', cfg: 'sleepSheet', cols: 1, rows: 1, fps: 6, scale: 1, move: true },
    { k: 'attack', label: 'Tấn công', cfg: 'attackSheet', cols: 4, rows: 4, fps: 12.5, scale: 1, move: true },
    { k: 'skill1', label: 'Skill 1', cfg: 'skill1Sheet', cols: 4, rows: 4, fps: 12.5, scale: 1, move: true }
  ];

  var DEF_FPS = { idle: 12, attack: 12.5, skill1: 12.5 };

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
window.FileHandler = (function () {
  // Thứ tự QUAN TRỌNG: từ khoá cụ thể (jump_throw, dizzy...) phải đứng trước từ khoá chung (attack, hurt...)
  var STATE_KEYWORDS = [
    ['jumpthrow', ['jump_throw', 'jumpthrow', 'jump-throw']],
    ['jumpup', ['jump_up', 'jumpup', 'jump-up']],
    ['jumpfall', ['jump_fall', 'jumpfall', 'jump-fall']],
    ['dizzy', ['dizzy', 'hurt_dizzy', 'choang']],
    ['hurt', ['hurt', 'bi_danh']],
    ['dead', ['dead', 'death', 'die', 'chet']],
    ['run', ['run', 'chay']],
    ['walk', ['walk', 'move', 'di_bo', 'dibo']],
    ['idle', ['idle', 'blink', 'stand', 'dung_yen', 'dungyen']],
    ['sleep', ['sleep', 'ngu']],
    ['attack', ['attack', 'atk', 'throw', 'tan_cong', 'tancong']],
    ['skill1', ['skill1', 'skill', 'sk1', 'magic', 'chieu']]
  ];

  function detectStateFromFilename(filename) {
    var name = filename.toLowerCase();
    for (var j = 0; j < STATE_KEYWORDS.length; j++) {
      var keywords = STATE_KEYWORDS[j][1];
      for (var i = 0; i < keywords.length; i++) {
        if (name.includes(keywords[i])) return STATE_KEYWORDS[j][0];
      }
    }
    return null;
  }

  var pending = 0;   // số ảnh đang nạp (GameSync chờ về 0)

  function loadFileToPetState(file, petName, targetStateKey, onLoaded) {
    if (!file) return;
    if (!AppState.pets[petName]) {
      AppState.pets[petName] = AppState.createPetData(petName);
      AppState.petOrder.push(petName);
    }
    if (!AppState.activePet) AppState.activePet = petName;

    var s = AppState.pets[petName][targetStateKey || AppState.curState];
    // Có cả 01-Idle.png và 02-Idle_Blink.png: ưu tiên bản chớp mắt (game dùng bản đó)
    var img = new Image(); pending++;
    img.onerror = function () { pending--; };
    img.onload = function () {
      pending--;
      if (targetStateKey === 'idle' && s.name && /blink/i.test(s.name) && !/blink/i.test(file.name)) return;   // đã có bản chớp mắt: giữ lại
      s.img = img;
      s.name = file.name;
      s.rel = file._rel || '';
      s._ck = s._bk = s._mk = null;
      if (onLoaded) onLoaded();
    };
    img.src = URL.createObjectURL(file);
  }

  function processFileList(files, onComplete) {
    var fileArr = Array.from(files);
    var loadedAny = false;

    fileArr.forEach(function (file) {
      if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif)$/i.test(file.name)) return;

      if (/_\d{2,}\.(png|jpe?g|webp|gif)$/i.test(file.name)) return;   // bỏ khung đơn lẻ (FA_X_Dead_000.png), chỉ nhận sprite sheet
      var petName = AppState.activePet || 'Pet_1';
      if (file.webkitRelativePath) {
        var parts = file.webkitRelativePath.split('/');
        if (parts.length > 1 && parts[0].trim() !== '') {
          // Bỏ các thư mục trạng thái ở cuối (03-Walk, 01-Idle...) -> tên pet là thư mục chứa chúng (Character/CHICKEN/03-Walk/x.png -> CHICKEN)
          var dirs = parts.slice(0, -1);
          while (dirs.length > 1 && /^\d+[-_]/.test(dirs[dirs.length - 1])) dirs.pop();
          petName = dirs[dirs.length - 1];
          file._rel = parts.slice(dirs.length).join('/');   // đường dẫn con trong thư mục pet, vd. 03-Walk/03-Walk.png
        }
      }

      var stateKey = detectStateFromFilename(file.name) || AppState.curState;
      loadFileToPetState(file, petName, stateKey, onComplete);
      loadedAny = true;
    });

    if (loadedAny && !AppState.activePet && AppState.petOrder.length > 0) {
      AppState.activePet = AppState.petOrder[0];
    }
  }

  function traverseFileTree(item, path, onFile, onComplete) {
    path = path || "";
    if (item.isFile) {
      item.file(function (file) {
        try { Object.defineProperty(file, 'webkitRelativePath', { value: path + file.name }); } catch (e) { }
        onFile(file);
        onComplete();
      }, onComplete);
    } else if (item.isDirectory) {
      var dirReader = item.createReader();
      dirReader.readEntries(function (entries) {
        if (entries.length === 0) onComplete();
        else {
          var count = entries.length;
          for (var i = 0; i < entries.length; i++) {
            traverseFileTree(entries[i], path + item.name + "/", onFile, function () {
              count--; if (count === 0) onComplete();
            });
          }
        }
      }, onComplete);
    } else onComplete();
  }

  return {
    get pending() { return pending; },
    loadFile: loadFileToPetState,
    processFileList: processFileList,
    traverseFileTree: traverseFileTree
  };
})();
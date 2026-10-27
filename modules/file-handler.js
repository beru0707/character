window.FileHandler = (function () {
  var STATE_KEYWORDS = {
    walk: ['walk', 'move', 'run', 'di_bo', 'dibo'],
    idle: ['idle', 'stand', 'dung_yen', 'dungyen'],
    sleep: ['sleep', 'ngu'],
    attack: ['attack', 'atk', 'hit', 'tan_cong', 'tancong'],
    skill1: ['skill1', 'skill', 'sk1', 'magic', 'chieu']
  };

  function detectStateFromFilename(filename) {
    var name = filename.toLowerCase();
    for (var key in STATE_KEYWORDS) {
      var keywords = STATE_KEYWORDS[key];
      for (var i = 0; i < keywords.length; i++) {
        if (name.includes(keywords[i])) return key;
      }
    }
    return null;
  }

  function loadFileToPetState(file, petName, targetStateKey, onLoaded) {
    if (!file) return;
    if (!AppState.pets[petName]) {
      AppState.pets[petName] = AppState.createPetData(petName);
      AppState.petOrder.push(petName);
    }
    if (!AppState.activePet) AppState.activePet = petName;

    var s = AppState.pets[petName][targetStateKey || AppState.curState];
    var img = new Image();
    img.onload = function () {
      s.img = img;
      s.name = file.name;
      s._ck = s._bk = null;
      if (onLoaded) onLoaded();
    };
    img.src = URL.createObjectURL(file);
  }

  function processFileList(files, onComplete) {
    var fileArr = Array.from(files);
    var loadedAny = false;

    fileArr.forEach(function (file) {
      if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif)$/i.test(file.name)) return;

      var petName = AppState.activePet || 'Pet_1';
      if (file.webkitRelativePath) {
        var parts = file.webkitRelativePath.split('/');
        if (parts.length > 1 && parts[0].trim() !== '') {
          petName = parts[parts.length - 2] || parts[0];
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
        file.webkitRelativePath = path + file.name;
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
    processFileList: processFileList,
    traverseFileTree: traverseFileTree
  };
})();
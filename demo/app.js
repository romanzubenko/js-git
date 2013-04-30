getFs();
function log(err) {
  if (err) throw err;
  console.log.apply(console, Array.prototype.slice.call(arguments, 1));
}

function getFs() {

  // These functions make using async function in the repl easier.  If no
  // callback is specefied, they log the result to the console.
  function formatError(fileError) {
    switch (fileError.code) {
      case window.FileError.QUOTA_EXCEEDED_ERR: return 'QUOTA_EXCEEDED_ERR';
      case window.FileError.NOT_FOUND_ERR: return 'NOT_FOUND_ERR';
      case window.FileError.SECURITY_ERR: return 'SECURITY_ERR';
      case window.FileError.INVALID_MODIFICATION_ERR: return 'INVALID_MODIFICATION_ERR';
      case window.FileError.INVALID_STATE_ERR: return 'INVALID_STATE_ERR';
      default: return 'Unknown Error';
    }
  }
  function check(path, callback) {
    return function (err) {
      if (err && err instanceof window.FileError) {
        err.path = path;
        err.message = formatError(err) + " at '" + path + "'";
        console.error(err.message);
        callback(err);
      }
      else {
        callback.apply(this, arguments);
      }
    };
  }
  function rr2(fn) {
    return function (arg1, arg2, callback) {
      return fn(arg1, arg2, check(arg1, callback || log));
    };
  }
  function rr1(fn) {
    return function (arg, callback) {
      return fn(arg, check(arg, callback || log));
    };
  }

  function wrapFileSystem(fileSystem) {
    var cwd = fileSystem.root;
    var fs = {
      readfile: rr1(readfile),
      writefile: rr2(writefile),
      rmfile: rr1(rmfile),
      readdir: rr1(readdir),
      mkdir: rr1(mkdir),
      rmdir: rr1(rmdir),
      copy: rr2(copy),
      move: rr2(move),
      chdir: rr1(chdir),
      cwd: function () { return cwd.fullPath; }
    };

    function readfile(path, callback) {
      cwd.getFile(path, {}, function (fileEntry) {
        fileEntry.file(function (file) {
          var reader = new FileReader();
          reader.onloadend = function () {
            callback(null, this.result);
          };
          reader.readAsText(file);
        }, callback);
      }, callback);
    }

    function writefile(path, contents, callback) {
      cwd.getFile(path, {create: true}, function (fileEntry) {
        fileEntry.createWriter(function (fileWriter) {
          fileWriter.onwriteend = function () {
            callback();
          };
          fileWriter.onerror = callback;
          fileWriter.write(new Blob([contents], {type: 'text/plain'}));
        }, callback);
      }, callback);
    }
    function rmfile(path, callback) {
      cwd.getFile(path, {}, function (fileEntry) {
        fileEntry.remove(function () {
          callback();
        }, callback);
      }, callback);
    }
    function readdir(path, callback) {
      cwd.getDirectory(path, {}, function (dirEntry) {
        var dirReader = dirEntry.createReader();
        var entries = [];
        readEntries();
        function readEntries() {
          dirReader.readEntries(function (results) {
            if (!results.length) {
              callback(null, entries);
            }
            else {
              entries = entries.concat(Array.prototype.slice.call(results).map(function (entry) {
                return entry.name + (entry.isDirectory ? "/" : "");
              }));
              readEntries();
            }
          }, callback);
        }
      }, callback);
    }
    function mkdir(path, callback) {
      cwd.getDirectory(path, {create: true}, function () {
        callback();
      }, callback);
    }
    function rmdir(path, callback) {
      cwd.getDirectory(path, {}, function (dirEntry) {
        dirEntry.removeRecursively(function () {
          callback();
        }, callback);
      }, callback);
    }
    function copy(src, dest, callback) {
      // TODO: make sure works for cases where dest includes and excludes file name.
      cwd.getFile(src, {}, function(fileEntry) {
        cwd.getDirectory(dest, {}, function(dirEntry) {
          fileEntry.copyTo(dirEntry, function () {
            callback();
          }, callback);
        }, callback);
      }, callback);
    }
    function move(src, dest, callback) {
      // TODO: handle more cases like file renames and moving/renaming directories
      cwd.getFile(src, {}, function(fileEntry) {
        cwd.getDirectory(dest, {}, function(dirEntry) {
          fileEntry.moveTo(dirEntry, function () {
            callback();
          }, callback);
        }, callback);
      }, callback);
    }
    function chdir(path, callback) {
      cwd.getDirectory(path, {}, function (dirEntry) {
        cwd = dirEntry;
        if (fs.onchdir) {
          fs.onchdir(cwd.fullPath);
        }
        callback();
      }, callback);
    }

    return fs;
  }

  // Note: The file system has been prefixed as of Google Chrome 12:
  window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
  window.requestFileSystem(window.PERSISTENT, null, function (fileSystem) {
    window.fs = wrapFileSystem(fileSystem);
    getDb();
  }, function (fileError) {
    throw new Error("Problem getting fs: " + formatError(fileError));
  });
}

function getDb() {
  function get(key, callback) {
    window.fs.readfile("/.gitdb/" + key, callback || log);
  }
  function set(key, value, callback) {
    window.fs.writefile("/.gitdb/" + key, value, callback || log);
  }
  window.fs.mkdir("/.gitdb", function (err) {
    if (err) throw err;
    window.db = {
      get: get,
      set: set
    };
    getGit();
  });
}

function getGit() {
  window.git = {};
  start();
}

function start() {
  console.log("Welcome to the js-git demo.\n" +
              "There are some global objects you can use to manupulate the sandbox.\n" +
              "They are `fs`, `git`, and `db`.\n" +
              "Use autocomplete to explore their capabilities");
}






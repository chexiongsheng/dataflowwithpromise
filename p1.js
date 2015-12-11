var Promise = require('promise');
var fs = require('fs');
var util = require('util');

//fs.open('p1.js', 'r', function(err, fd){
//    if (err) {
//        printError(err);
//    } else {
//        fs.fstat(fd, function(err, infos){
//            if(err) {
//                printError(err);
//            } else {
//            console.log('p1.js size:', infos.size);
//            }
//        });
//    }
//});

var promisify = function(fn, receiver) {
  return function() {
      var slice   = Array.prototype.slice,
          args    = slice.call(arguments, 0, fn.length - 1);

      return new Promise(function(resolve, reject) {
          args.push(function() {
              var results = slice.call(arguments),
              error   = results.shift();

              if (error) reject(error);
              else resolve.apply(null, results);
          });

          fn.apply(receiver, args);
      });
    };
};

Promise.prototype.map = function(fn) {
    var self = this;
    return new Promise(function(resolve, reject) {
        self.then(function(results){
            var maped = [];
            for(var i = 0; i < results.length; ++i) maped.push(fn(results[i]));
            Promise.all(maped).then(function(res){
                resolve(res);
            }, reject);
        }, reject);
    });
};

Promise.prototype.reduce = function() {
    var self = this;
    var args = Array.prototype.slice.call(arguments);
    return new Promise(function(resolve, reject) {
        self.then(function(results){
            resolve(results.reduce.apply(results, args));
        }, reject);
    });
}

Promise.prototype.filter = function(cond) { // cond :: a -> (bool | promise bool)
    var self = this;
    return new Promise(function(resolve, reject) {
        self.then(function(results) {
            self.map(cond).then(function(flags){
                resolve(results.filter(function(_, idx) {
                    return flags[idx];
                }));
            }, reject);
        }, reject);
    });
};

Promise.prototype.zip = function(other, ldefault, rdefault) {
    var self = this;
    return new Promise(function(resolve, reject) {
        Promise.all([self, other]).then(function(results) {
            if (!Array.isArray(results[1])) {
                rdefault = other;
                ldefault = null;
                results[1] = [];
            }
            var len = ((typeof ldefault != 'undefined' && typeof rdefault != 'undefined')? Math.max : Math.min)(results[0].length, results[1].length);
            var result = [];
            for(var i = 0; i < len; ++i) {
                result.push([((i < results[0].length) ? results[0][i] : ldefault), ((i < results[1].length) ? results[1][i] : rdefault)]);
            }
            resolve(result);
        }, reject);
    });
};

var applyfunc = function(func) {
    return function(arr) {
        return func.apply(null, arr);
    };
};

var trace = function(func, funcName) {
    funcName = funcName || func.displayName
    return function() {
        console.log(funcName, 'called, arguments=', arguments)
        return func.apply(this, Array.prototype.slice.call(arguments))
    }
}

var readdir = promisify(fs.readdir);
var fstat = promisify(fs.fstat);
var open = promisify(fs.open);
var read = promisify(fs.read);
//var readdir = trace(promisify(fs.readdir), 'fs.readdir');
//var fstat = trace(promisify(fs.fstat), 'fs.fstat');
//var open = trace(promisify(fs.open), 'fs.open');
//var read = trace(promisify(fs.read), 'fs.read');

var printError = function(err) {
    console.log('error:' + err);
};

console.log('------------------------begin basic----------------------------')
open('p1.js', 'r').then(fstat).done(function(infos){
    console.log('p1.js size:', infos.size)
}, printError);

open('not_existed_file_name', 'r').then(fstat).then(function(infos){
    console.log('size:', infos.size)
}, printError);
console.log('-------------------------end basic-----------------------------')


open = applyfunc(open);

//Promise.resolve(['p1.js', 'r']).then(open).then(fstat).done(function(infos){
//    console.log('p1.js size:', infos.size)
//}, printError);


console.log('------------------------begin stream split----------------------------')
var isDirectory = function(a) { return a.isDirectory();}
var isFile = function(a) { return a.isFile();}
var fileSizeSum = function(sum, finfo) {return sum + finfo.size}

var finfos = readdir('.').zip('r').map(open).map(fstat);

finfos.filter(isDirectory).done(function(infos){
    console.log('dirs count:', infos.length)
}, printError);

finfos.filter(isFile).reduce(fileSizeSum, 0).done(function(allsize) {
    console.log('total size:', allsize)
}, printError);
console.log('-------------------------end stream split-----------------------------')


console.log('------------------------begin timing independent----------------------------')
var isFile = function(a) {
    return a[0].isFile();
};
var maxFileSize = function(previous, current) {
    return (previous[0].size > current[0].size) ? previous : current;
};
var fileToString = function(info) {
    var buf = new Buffer(info[0].size);
    return new Promise(function(resolve, reject) {
        fs.read(info[1], buf, 0, info[0].size, 0, function(err, bread, buff){
            if (err) reject(err);
            else resolve(buff.toString());
        });
    });
};

var fds = readdir('.').zip('r').map(open);
var finfos = fds.map(fstat);
finfos.zip(fds).filter(isFile).reduce(maxFileSize).then(fileToString).done(function(context) {
    console.log('100 bytes of max file:', context.substring(0, 100));
}, printError);
console.log('-------------------------end timing independent-----------------------------')





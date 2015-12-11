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

var map = function(fn) {
    return function(results) {
        return new Promise(function(resolve, reject) {
            var maped = [];
            for(var i = 0; i < results.length; ++i) maped.push(fn(results[i]));
            Promise.all(maped).then(function(res){
                resolve(res);
            }, reject);
        });
    }
};

var reduce = function() {
    var args = Array.prototype.slice.call(arguments);
    return function(results){
        return new Promise(function(resolve, reject) {
            resolve(Array.prototype.reduce.apply(results, args));
        });
    }
}

var filter = function(cond) { // cond :: a -> (bool | promise bool)
    return function(results) {
        return new Promise(function(resolve, reject) {
            map(cond)(results).then(function(flags){
                resolve(results.filter(function(_, idx) {
                    return flags[idx];
                }));
            }, reject);
        });
    }
};

var zip = function(other, ldefault, rdefault) {
    return function(lresults) {
        return new Promise(function(resolve, reject) {
            Promise.resolve(other).then(function(rresults) {
                if (!Array.isArray(rresults)) {
                    rdefault = other;
                    ldefault = null;
                    rresults = [];
                }
                var len = ((typeof ldefault != 'undefined' && typeof rdefault != 'undefined')? Math.max : Math.min)(lresults.length, rresults.length);
                var result = [];
                for(var i = 0; i < len; ++i) {
                    result.push([((i < lresults.length) ? lresults[i] : ldefault), ((i < rresults.length) ? rresults[i] : rdefault)]);
                }
                resolve(result);
            }, reject);
        });
    }
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

var finfos = readdir('.').then(zip('r')).then(map(open)).then(map(fstat));

finfos.then(filter(isDirectory)).done(function(infos){
    console.log('dirs count:', infos.length)
}, printError);

finfos.then(filter(isFile)).then(reduce(fileSizeSum, 0)).done(function(allsize) {
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

var fds = readdir('.').then(zip('r')).then(map(open));
var finfos = fds.then(map(fstat));
finfos.then(zip(fds)).then(filter(isFile)).then(reduce(maxFileSize)).then(fileToString).done(function(context) {
    console.log('100 bytes of max file:', context.substring(0, 100));
}, printError);
console.log('-------------------------end timing independent-----------------------------')





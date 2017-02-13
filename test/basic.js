var assert = require('assert');
var path = require('path');
var fs = require('fs');
var child = require('child_process');
var Promise = require('es6-promise-polyfill').Promise;
var cmd = 'node';

function run() {
    var args = [path.join(__dirname, '../bin/csso')].concat(Array.prototype.slice.call(arguments));
    var proc = child.spawn(cmd, args, { stdio: 'pipe' });
    var resolve;
    var wrapper = new Promise(function(_resolve) {
        resolve = _resolve;
    });

    wrapper.input = function(data) {
        proc.stdin.write(data);
        proc.stdin.end();
        return wrapper;
    };

    wrapper.output = function(test) {
        proc.stdout.once('data', function(data) {
            switch (typeof test) {
                case 'function':
                    test(String(data));
                    break;

                case 'string':
                    assert.equal(String(data), test);
                    break;

                default:
                    assert.equal(data, test);
            }
        });
        return wrapper;
    };

    proc.once('exit', function() {
        resolve();
    });

    return wrapper;
}

it('should output version', function() {
    return run('-v').output(
        require('csso/package.json').version + '\n'
    );
});

it('should read content from stdin if no file specified', function() {
    return run()
        .input(fs.readFileSync(__dirname + '/fixture/1.css', 'utf-8'))
        .output(fs.readFileSync(__dirname + '/fixture/1.min.css', 'utf-8') + '\n');
});

it('should read from file', function() {
    return run(__dirname + '/fixture/1.css')
        .output(fs.readFileSync(__dirname + '/fixture/1.min.css', 'utf-8') + '\n');
});

var assert = require('assert');
var path = require('path');
var fs = require('fs');
var child = require('child_process');
var Promise = require('es6-promise-polyfill').Promise;
var cmd = 'node';

function run() {
    var args = [path.join(__dirname, '../bin/csso')].concat(Array.prototype.slice.call(arguments));
    var proc = child.spawn(cmd, args, { stdio: 'pipe' });
    var error = '';
    var wrapper = new Promise(function(resolve, reject) {
        proc.once('exit', function(code) {
            code ? reject(new Error(error)) : resolve();
        });
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

    proc.stderr.once('data', function(data) {
        error += data;
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
        .output(fs.readFileSync(__dirname + '/fixture/1.min.css', 'utf-8'));
});

it('should read from file', function() {
    return run(__dirname + '/fixture/1.css')
        .output(fs.readFileSync(__dirname + '/fixture/1.min.css', 'utf-8'));
});

it('should use relative paths in source map', function() {
    return run(__dirname + '/fixture/1.css', '--source-map', 'inline')
        .output(function(res) {
            var expected = fs.readFileSync(__dirname + '/fixture/1.min.css.map', 'utf-8');
            var actual = new Buffer(String(res).match(/data:application\/json;base64,(.+)/)[1], 'base64').toString('utf-8') + '\n';

            assert.equal(actual, expected);
        });
});

it('should disable structure optimisations with --no-restructure option', function() {
    return run(__dirname + '/fixture/1.css', '--no-restructure')
        .output(fs.readFileSync(__dirname + '/fixture/1-no-restructure.min.css', 'utf-8'));
});

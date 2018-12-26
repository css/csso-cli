var assert = require('assert');
var path = require('path');
var fs = require('fs');
var child = require('child_process');
var Promise = require('es6-promise-polyfill').Promise;
var cmd = 'node';

function fixturePath(filepath) {
    return path.join(__dirname, 'fixture', filepath);
}

function fixtureContent(filepath) {
    return fs.readFileSync(fixturePath(filepath), 'utf-8').trim();
}

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

    wrapper.output = function(expected) {
        proc.stdout.once('data', function(data) {
            data = String(data).trim();
            switch (typeof expected) {
                case 'function':
                    expected(data);
                    break;

                default:
                    assert.equal(data, expected);
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
        require('csso/package.json').version
    );
});

it('should read content from stdin if no file specified', function() {
    return run()
        .input(fixtureContent('1.css'))
        .output(fixtureContent('1.min.css'));
});

it('should read from file', function() {
    return run(fixturePath('1.css'))
        .output(fixtureContent('1.min.css'));
});

it('--source-map inline', function() {
    return run(fixturePath('1.css'), '--source-map', 'inline')
        .output(function(res) {
            var expected = fixtureContent('1.min.css.map');
            var actual = new Buffer(String(res).match(/data:application\/json;base64,(.+)/)[1], 'base64').toString('utf-8');

            assert.equal(actual, expected);
        });
});

it('--source-map file', function() {
    return run(
            fixturePath('1.css'),
            '--source-map', 'file',
            '--output', fixturePath('write-hack/1-source-map-file.min.css')
        ).then(() => {
            assert.equal(
                fixtureContent('write-hack/1-source-map-file.min.css'),
                fixtureContent('1-source-map-file.min.css')
            );
            assert.equal(
                fixtureContent('write-hack/1-source-map-file.min.css.map'),
                fixtureContent('1-source-map-file.min.css.map')
            );
        });
});

it('--source-map <filepath>', function() {
    return run(
            fixturePath('1.css'),
            '--source-map', fixturePath('write-hack/1-source-map-file.min.css.map')
        ).output((res) => {
            assert.equal(
                res,
                fixtureContent('1-source-map-filepath.min.css')
            );
            assert.equal(
                fixtureContent('write-hack/1-source-map-file.min.css.map'),
                fixtureContent('1-source-map-file.min.css.map')
            );
        });
});

it('should disable structure optimisations with --no-restructure option', function() {
    return run(fixturePath('1.css'), '--no-restructure')
        .output(fixtureContent('1-no-restructure.min.css'));
});

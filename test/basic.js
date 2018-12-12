/* eslint-env mocha */

const assert = require('assert');
const child = require('child_process');
const fs = require('fs');
const path = require('path');

function fixturePath(filepath) {
    return path.join(__dirname, 'fixture', filepath);
}

function fixtureContent(filepath) {
    return fs.readFileSync(fixturePath(filepath), 'utf-8').trim();
}

function run(...args) {
    const proc = child.spawn('node', [
        path.join(__dirname, '../bin/csso'),
        ...args
    ], { stdio: 'pipe' });
    let error = '';
    const wrapper = new Promise((resolve, reject) => {
        proc.once('exit', code => {
            if (code) {
                reject(new Error(error));
            } else {
                resolve();
            }
        });
    });

    wrapper.input = data => {
        proc.stdin.write(data);
        proc.stdin.end();
        return wrapper;
    };

    wrapper.output = expected => {
        const buffer = [];

        proc.stdout
            .on('data', chunk => {
                buffer.push(chunk);
            })
            .on('end', () => {
                const data = buffer.join('').trim();

                switch (typeof expected) {
                    case 'function':
                        expected(data);
                        break;

                    default:
                        assert.strictEqual(data, expected);
                }
            });
        return wrapper;
    };

    proc.stderr.once('data', data => {
        error += data;
    });

    return wrapper;
}

it('should output version', () => {
    return run('-v')
        .output(require('csso/package.json').version);
});

it('should read content from stdin if no file specified', () => {
    return run()
        .input(fixtureContent('1.css'))
        .output(fixtureContent('1.min.css'));
});

it('should read from file', () => {
    return run(fixturePath('1.css'))
        .output(fixtureContent('1.min.css'));
});

it('--source-map inline', () => {
    return run(fixturePath('1.css'), '--source-map', 'inline')
        .output(res => {
            const expected = fixtureContent('1.min.css.map');
            const actual = Buffer.from(String(res).match(/data:application\/json;base64,(.+)/)[1], 'base64').toString('utf-8');

            assert.strictEqual(actual, expected);
        });
});

it('--source-map file', () => {
    return run(
        fixturePath('1.css'),
        '--source-map', 'file',
        '--output', fixturePath('write-hack/1-source-map-file.min.css')
    ).then(() => {
        assert.strictEqual(
            fixtureContent('write-hack/1-source-map-file.min.css'),
            fixtureContent('1-source-map-file.min.css')
        );
        assert.strictEqual(
            fixtureContent('write-hack/1-source-map-file.min.css.map'),
            fixtureContent('1-source-map-file.min.css.map')
        );
    });
});

it('--source-map <filepath>', () => {
    return run(
        fixturePath('1.css'),
        '--source-map', fixturePath('write-hack/1-source-map-file.min.css.map')
    ).output(res => {
        assert.strictEqual(
            res,
            fixtureContent('1-source-map-filepath.min.css')
        );
        assert.strictEqual(
            fixtureContent('write-hack/1-source-map-file.min.css.map'),
            fixtureContent('1-source-map-file.min.css.map')
        );
    });
});

it('should fetch a source map from a comment in source file', () => {
    return run(
        fixturePath('bootstrap-grid-source-map-filepath.css'),
        '--source-map', fixturePath('write-hack/bootstrap-grid-source-map-filepath.min.css.map')
    ).output(res => {
        assert.strictEqual(
            res,
            fixtureContent('bootstrap-grid-source-map-filepath.min.css')
        );
        assert.strictEqual(
            fixtureContent('write-hack/bootstrap-grid-source-map-filepath.min.css.map'),
            fixtureContent('bootstrap-grid-source-map-filepath.min.css.map')
        );
    });
});

it('should fetch a source map from a file with .map extension', () => {
    return run(
        fixturePath('bootstrap-grid.css'),
        '--source-map', fixturePath('write-hack/bootstrap-grid.min.css.map')
    ).output(res => {
        assert.strictEqual(
            res,
            fixtureContent('bootstrap-grid.min.css')
        );
        assert.strictEqual(
            fixtureContent('write-hack/bootstrap-grid.min.css.map'),
            fixtureContent('bootstrap-grid.min.css.map')
        );
    });
});

it('should disable structure optimisations with --no-restructure option', () => {
    return run(fixturePath('1.css'), '--no-restructure')
        .output(fixtureContent('1-no-restructure.min.css'));
});

it('should use usage data', () => {
    return run(fixturePath('usage.css'), '--usage', fixturePath('usage.css.json'))
        .output(fixtureContent('usage.min.css'));
});

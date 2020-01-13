const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

function fixturePath(filepath) {
    return path.join(__dirname, 'fixture', filepath);
}

function fixtureContent(filepath) {
    return fs.readFileSync(fixturePath(filepath), 'utf-8').trim();
}

function run(...cliArgs) {
    let stderr = '';
    let stdout = '';
    const args = [path.join(__dirname, '../bin/csso'), ...cliArgs];
    const child = spawn('node', args, { stdio: 'pipe' });
    const wrapper = new Promise(function(resolve, reject) {
        child.once('exit', () =>
            stderr ? reject(new Error(stderr)) : resolve(stdout)
        );
    });

    child.stderr.on('data', chunk => stderr += chunk);
    child.stdout.on('data', chunk => stdout += chunk);

    wrapper.input = function(data) {
        child.stdin.write(data);
        child.stdin.end();
        return wrapper;
    };

    wrapper.output = expected => wrapper.then(actual => {
        if (typeof expected === 'function') {
            expected(actual.trim());
        } else if (typeof expected === 'string') {
            assert.equal(actual.trim(), expected);
        } else {
            assert.deepStrictEqual(JSON.parse(actual), expected);
        }
    });

    return wrapper;
}

it('should output version', () =>
    run('-v')
        .output(require('csso/package.json').version)
);

it('should read content from stdin if no file specified', () =>
    run()
        .input(fixtureContent('1.css'))
        .output(fixtureContent('1.min.css'))
);

it('should read from file', () =>
    run(fixturePath('1.css'))
        .output(fixtureContent('1.min.css'))
);

it('--source-map inline', () =>
    run(fixturePath('1.css'), '--source-map', 'inline')
        .output(stdout => {
            const expected = fixtureContent('1.min.css.map');
            const actual = Buffer.from(String(stdout).match(/data:application\/json;base64,(.+)/)[1], 'base64').toString('utf-8');

            assert.equal(actual, expected);
        })
);

it('--source-map file', () =>
    run(
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
    })
);

it('--source-map <filepath>', () =>
    run(
        fixturePath('1.css'),
        '--source-map', fixturePath('write-hack/1-source-map-file.min.css.map')
    ).output(actual => {
        assert.equal(
            actual,
            fixtureContent('1-source-map-filepath.min.css')
        );
        assert.equal(
            fixtureContent('write-hack/1-source-map-file.min.css.map'),
            fixtureContent('1-source-map-file.min.css.map')
        );
    })
);

it('should fetch a source map from a comment in source file', () =>
    run(
        fixturePath('bootstrap-grid-source-map-filepath.css'),
        '--source-map', fixturePath('write-hack/bootstrap-grid-source-map-filepath.min.css.map')
    ).output(actual => {
        assert.equal(
            actual,
            fixtureContent('bootstrap-grid-source-map-filepath.min.css')
        );
        assert.equal(
            fixtureContent('write-hack/bootstrap-grid-source-map-filepath.min.css.map'),
            fixtureContent('bootstrap-grid-source-map-filepath.min.css.map')
        );
    })
);

it('should fetch a source map from a file with .map extension', () =>
    run(
        fixturePath('bootstrap-grid.css'),
        '--source-map', fixturePath('write-hack/bootstrap-grid.min.css.map')
    ).output(actual => {
        assert.equal(
            actual,
            fixtureContent('bootstrap-grid.min.css')
        );
        assert.equal(
            fixtureContent('write-hack/bootstrap-grid.min.css.map'),
            fixtureContent('bootstrap-grid.min.css.map')
        );
    })
);

it('should disable structure optimisations with --no-restructure option', () =>
    run(fixturePath('1.css'), '--no-restructure')
        .output(fixtureContent('1-no-restructure.min.css'))
);

it('should use usage data', () =>
    run(fixturePath('usage.css'), '--usage', fixturePath('usage.css.json'))
        .output(fixtureContent('usage.min.css'))
);

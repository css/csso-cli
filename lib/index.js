const fs = require('fs');
const path = require('path');
const cli = require('clap');
const csso = require('csso');
const SourceMapConsumer = require('source-map-js').SourceMapConsumer;

function unixPathname(pathname) {
    return pathname.replace(/\\/g, '/');
}

function readFromStream(stream, minify) {
    const buffer = [];

    stream
        .setEncoding('utf8')
        .on('data', (chunk) => buffer.push(chunk))
        .on('end', () => minify(buffer.join('')));
}

function showStat(filename, source, result, inputMap, map, time, mem) {
    function fmt(size) {
        return String(size).split('').reverse().reduce((size, digit, idx) => {
            if (idx && idx % 3 === 0) {
                size = ' ' + size;
            }

            return digit + size;
        }, '');
    }

    map = map || 0;
    result -= map;

    console.error('Source:    ', filename === '<stdin>' ? filename : path.relative(process.cwd(), filename));
    if (inputMap) {
        console.error('Map source:', inputMap);
    }
    console.error('Original:  ', fmt(source), 'bytes');
    console.error('Compressed:', fmt(result), 'bytes', '(' + (100 * result / source).toFixed(2) + '%)');
    console.error('Saving:    ', fmt(source - result), 'bytes', '(' + (100 * (source - result) / source).toFixed(2) + '%)');
    if (map) {
        console.error('Source map:', fmt(map), 'bytes', '(' + (100 * map / (result + map)).toFixed(2) + '% of total)');
        console.error('Total:     ', fmt(map + result), 'bytes');
    }
    console.error('Time:      ', time, 'ms');
    console.error('Memory:    ', (mem / (1024 * 1024)).toFixed(3), 'MB');
}

function debugLevel(level) {
    // level is undefined when no param -> 1
    return isNaN(level) ? 1 : Math.max(Number(level), 0);
}

function resolveSourceMap(source, inputMap, outputMap, inputFile, outputFile) {
    let inputMapContent = null;
    let inputMapFile = null;
    let outputMapFile = null;

    switch (outputMap) {
        case 'none':
            // don't generate source map
            outputMap = false;
            inputMap = 'none';
            break;

        case 'inline':
            // nothing to do
            break;

        case 'file':
            if (!outputFile) {
                console.error('Output filename should be specified when `--source-map file` is used');
                process.exit(2);
            }

            outputMapFile = outputFile + '.map';
            break;

        default:
            // process filename
            if (outputMap) {
                // check path is reachable
                if (!fs.existsSync(path.dirname(outputMap))) {
                    console.error('Directory for map file should exists:', path.dirname(path.resolve(outputMap)));
                    process.exit(2);
                }

                // resolve to absolute path
                outputMapFile = path.resolve(process.cwd(), outputMap);
            }
    }

    switch (inputMap) {
        case 'none':
            // nothing to do
            break;

        case 'auto':
            if (outputMap) {
                // try fetch source map from source
                let inputMapComment = source.match(/\/\*# sourceMappingURL=(\S+)\s*\*\/\s*$/);

                if (inputFile === '<stdin>') {
                    inputFile = false;
                }

                if (inputMapComment) {
                    // if comment found – value is filename or base64-encoded source map
                    inputMapComment = inputMapComment[1];

                    if (inputMapComment.substr(0, 5) === 'data:') {
                        // decode source map content from comment
                        inputMapContent = Buffer.from(inputMapComment.substr(inputMapComment.indexOf('base64,') + 7), 'base64').toString();
                    } else {
                        // value is filename – resolve it as absolute path
                        if (inputFile) {
                            inputMapFile = path.resolve(path.dirname(inputFile), inputMapComment);
                        }
                    }
                } else {
                    // comment doesn't found - look up file with `.map` extension nearby input file
                    if (inputFile && fs.existsSync(inputFile + '.map')) {
                        inputMapFile = inputFile + '.map';
                    }
                }

            }
            break;

        default:
            if (inputMap) {
                inputMapFile = inputMap;
            }
    }

    // source map placed in external file
    if (inputMapFile) {
        inputMapContent = fs.readFileSync(inputMapFile, 'utf8');
    }

    return {
        input: inputMapContent,
        inputFile: inputMapFile || (inputMapContent ? '<inline>' : false),
        output: outputMap,
        outputFile: outputMapFile
    };
}

function processCommentsOption(value) {
    switch (value) {
        case 'exclamation':
        case 'first-exclamation':
        case 'none':
            return value;
    }

    console.error('Wrong value for `comments` option: %s', value);
    process.exit(2);
}

function processOptions(options, args) {
    let inputFile = options.input || args[0];
    let outputFile = options.output;
    const usageFile = options.usage;
    let usageData = false;
    const sourceMap = options.sourceMap;
    const inputSourceMap = options.inputSourceMap;
    const declarationList = options.declarationList;
    const restructure = Boolean(options.restructure);
    const forceMediaMerge = Boolean(options.forceMediaMerge);
    const comments = processCommentsOption(options.comments);
    const debug = options.debug;
    const statistics = options.stat;
    const watch = options.watch;

    if (process.stdin.isTTY && !inputFile && !outputFile) {
        return null;
    }

    if (!inputFile) {
        inputFile = '<stdin>';
    } else {
        inputFile = path.resolve(process.cwd(), inputFile);
    }

    if (outputFile) {
        outputFile = path.resolve(process.cwd(), outputFile);
    }

    if (usageFile) {
        if (!fs.existsSync(usageFile)) {
            console.error('Usage data file doesn\'t found (%s)', usageFile);
            process.exit(2);
        }

        usageData = fs.readFileSync(usageFile, 'utf-8');

        try {
            usageData = JSON.parse(usageData);
        } catch (e) {
            console.error('Usage data parse error (%s)', usageFile);
            process.exit(2);
        }
    }

    return {
        inputFile,
        outputFile,
        usageData,
        sourceMap,
        inputSourceMap,
        declarationList,
        restructure,
        forceMediaMerge,
        comments,
        statistics,
        debug,
        watch
    };
}

function minifyStream(options) {
    const inputStream = options.inputFile !== '<stdin>'
        ? fs.createReadStream(options.inputFile)
        : process.stdin;

    readFromStream(inputStream, (source) => {
        const startTime = Date.now();
        const mem = process.memoryUsage().heapUsed;
        const relInputFilename = path.relative(process.cwd(), options.inputFile);
        const sourceMap = resolveSourceMap(
            source,
            options.inputSourceMap,
            options.sourceMap,
            options.inputFile,
            options.outputFile
        );
        let sourceMapAnnotation = '';
        let result;

        // main action
        const minifyFunc = options.declarationList ? csso.minifyBlock : csso.minify;
        result = minifyFunc(source, {
            filename: unixPathname(relInputFilename),
            sourceMap: Boolean(sourceMap.output),
            usage: options.usageData,
            restructure: options.restructure,
            forceMediaMerge: options.forceMediaMerge,
            comments: options.comments,
            debug: options.debug
        });

        // for backward capability minify returns a string
        if (typeof result === 'string') {
            result = {
                css: result,
                map: null
            };
        }

        if (sourceMap.output && result.map) {
            // apply input map
            if (sourceMap.input) {
                result.map.applySourceMap(
                    new SourceMapConsumer(sourceMap.input),
                    unixPathname(relInputFilename)
                );
            }

            // add source map to result
            if (sourceMap.outputFile) {
                // write source map to file
                fs.writeFileSync(sourceMap.outputFile, result.map.toString(), 'utf-8');
                sourceMapAnnotation = '\n' +
                    '/*# sourceMappingURL=' +
                    unixPathname(path.relative(options.outputFile ? path.dirname(options.outputFile) : process.cwd(), sourceMap.outputFile)) +
                    ' */';
            } else {
                // inline source map
                sourceMapAnnotation = '\n' +
                    '/*# sourceMappingURL=data:application/json;base64,' +
                    Buffer.from(result.map.toString()).toString('base64') +
                    ' */';
            }

            result.css += sourceMapAnnotation;
        }

        // output result
        if (options.outputFile) {
            fs.writeFileSync(options.outputFile, result.css, 'utf-8');
        } else {
            console.log(result.css);
        }

        // output statistics
        if (options.statistics) {
            showStat(
                relInputFilename,
                source.length,
                result.css.length,
                sourceMap.inputFile,
                sourceMapAnnotation.length,
                Date.now() - startTime,
                process.memoryUsage().heapUsed - mem
            );
        }
    });
}

const command = cli.command('csso [input]')
    .version(require('csso/package.json').version)
    .option('-i, --input <filename>', 'Input file')
    .option('-o, --output <filename>', 'Output file (result outputs to stdout if not set)')
    .option('-s, --source-map <destination>', 'Generate source map: none (default), inline, file or <filename>', 'none')
    .option('-u, --usage <filename>', 'Usage data file')
    .option('--input-source-map <source>', 'Input source map: none, auto (default) or <filename>', 'auto')
    .option('-d, --declaration-list', 'Treat input as a declaration list')
    .option('--no-restructure', 'Disable structural optimisations')
    .option('--force-media-merge', 'Enable unsafe merge of @media rules')
    .option('--comments <value>', 'Comments to keep: exclamation (default), first-exclamation or none', 'exclamation')
    .option('--stat', 'Output statistics in stderr')
    .option('--debug [level]', 'Output intermediate state of CSS during a compression', debugLevel, 0)
    .option('--watch', 'Watch source file for changes')
    .action(({ options, args }) => {
        options = processOptions(options, args);

        if (options === null) {
            this.outputHelp();
            return;
        }

        minifyStream(options);

        // enable watch mode only when input is a file
        if (options.watch && options.inputFile !== '<stdin>') {
            // NOTE: require chokidar here to keep down start up time when --watch doesn't use
            // (yep, chokidar adds a penalty ~0.2-0.3s on its init)
            require('chokidar')
                .watch(options.inputFile)
                .on('change', () => minifyStream(options));
        }
    });

module.exports = {
    run: (...args) =>command.run(...args),
    isCliError: (err) => err instanceof cli.Error
};

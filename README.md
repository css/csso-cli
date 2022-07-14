[![NPM version](https://img.shields.io/npm/v/csso-cli.svg)](https://www.npmjs.com/package/csso-cli)
[![Build Status](https://travis-ci.org/css/csso-cli.svg?branch=master)](https://travis-ci.org/css/csso-cli)
[![Twitter](https://img.shields.io/badge/Twitter-@cssoptimizer-blue.svg)](https://twitter.com/cssoptimizer)

Command line interface for [CSSO](https://github.com/css/csso).

<!-- MarkdownTOC -->

- [Install](#install)
- [Usage](#usage)
  - [Source maps](#source-maps)
  - [Usage data](#usage-data)
  - [Debugging](#debugging)
- [Related projects](#related-projects)
- [License](#license)

<!-- /MarkdownTOC -->

## Install

```
npm install -g csso-cli
```

## Usage

```
Usage:

    csso [input] [options]

Options:

        --comments <value>             Comments to keep: exclamation (default), first-exclamation or none
        --debug [level]                Output intermediate state of CSS during a compression
    -d, --declaration-list             Treat input as a declaration list
        --force-media-merge            Enable unsafe merge of @media rules
    -h, --help                         Output usage information
    -i, --input <filename>             Input file
        --input-source-map <source>    Input source map: none, auto (default) or <filename>
    -o, --output <filename>            Output file (result outputs to stdout if not set)
        --no-restructure               Disable structural optimisations
    -s, --source-map <destination>     Generate source map: none (default), inline, file or <filename>
        --stat                         Output statistics in stderr
    -u, --usage <filename>             Usage data file
    -v, --version                      Output version
        --watch                        Watch source file for changes
```

Some examples:

```
> csso in.css
...output result in stdout...

> csso in.css --output out.css

> echo '.test { color: #ff0000; }' | csso
.test{color:red}

> cat source1.css source2.css | csso | gzip -9 -c > production.css.gz
```

### Source maps

Source map doesn't generate by default. To generate map use `--source-map` CLI option, that can be:

- `none` (default) – don't generate source map
- `inline` – add source map into result CSS (via `/*# sourceMappingURL=application/json;base64,... */`)
- `file` – write source map into file with same name as output file, but with `.map` extension (in this case `--output` option is required)
- any other values treat as filename for generated source map

Examples:

```
> csso my.css --source-map inline
> csso my.css --output my.min.css --source-map file
> csso my.css --output my.min.css --source-map maps/my.min.map
```

Use `--input-source-map` option to specify input source map if needed. Possible values for option:

- `auto` (default) - attempt to fetch input source map by follow steps:
  - try to fetch inline map from input
  - try to fetch source map filename from input and read its content
  - (when `--input` is specified) check file with same name as input file but with `.map` extension exists and read its content
- `none` - don't use input source map; actually it's using to disable `auto`-fetching
- any other values treat as filename for input source map

Generally you shouldn't care about the input source map since defaults behaviour (`auto`) covers most use cases.

> NOTE: Input source map is using only if output source map is generating.

### Usage data

`CSSO` can use data about how `CSS` is using for better compression. File with this data (`JSON` format) can be set using `--usage` option. Read more about [Usage data](https://github.com/css/csso#usage-data) in [CSSO](https://github.com/css/csso) repository.

### Debugging

All debug information outputs to `stderr`.

To get brief info about compression use `--stat` option.

```
> echo '.test { color: #ff0000 }' | csso --stat >/dev/null
Source:     <stdin>
Original:   25 bytes
Compressed: 16 bytes (64.00%)
Saving:     9 bytes (36.00%)
Time:       7 ms
Memory:     0.204 MB
```

To get details about compression steps use `--debug` option.

```
> echo '.test { color: green; color: #ff0000 } .foo { color: red }' | csso --debug
## parsing done in 4 ms

Compress block #1
[0.000s] init
[0.001s] clean
[0.003s] replace
[0.001s] prepare
[0.001s] mergeAtrule
[0.000s] initialMergeRuleset
[0.000s] disjoinRuleset
[0.000s] restructShorthand
[0.001s] restructBlock
[0.000s] mergeRuleset
[0.000s] restructRuleset
## compress done in 9 ms

## generate done in 0 ms

.foo,.test{color:red}
```

More details are providing when `--debug` option has a number greater than `1`:

```
> echo '.test { color: green; color: #ff0000 } .foo { color: red }' | csso --debug 2
## parsing done in 4 ms

Compress block #1
[0.001s] init
  .test{color:green;color:#ff0000}.foo{color:red}

[0.001s] clean
  .test{color:green;color:#ff0000}.foo{color:red}

[0.004s] replace
  .test{color:green;color:red}.foo{color:red}

...

[0.000s] mergeRuleset
  .foo,.test{color:red}

[0.000s] restructRuleset
  .foo,.test{color:red}

## compress done in 12 ms

## generate done in 0 ms

.foo,.test{color:red}
```

Using `--debug` option adds stack trace to CSS parse error output. That can help to find out problem in parser.

```
> echo '.a { color }' | csso --debug

Parse error <stdin>: Colon is expected
    1 |.a { color }
------------------^
    2 |

/usr/local/lib/node_modules/csso/lib/cli.js:243
                throw e;
                ^

Error: Colon is expected
    at parseError (/usr/local/lib/node_modules/csso/lib/parser/index.js:54:17)
    at eat (/usr/local/lib/node_modules/csso/lib/parser/index.js:88:5)
    at getDeclaration (/usr/local/lib/node_modules/csso/lib/parser/index.js:394:5)
    at getBlock (/usr/local/lib/node_modules/csso/lib/parser/index.js:380:27)
    ...
```

## Related projects

- [CSSO](https://github.com/css/csso) – CSS minifier itself
- Gulp: [gulp-csso](https://github.com/ben-eb/gulp-csso)
- Grunt: [grunt-csso](https://github.com/t32k/grunt-csso)
- Broccoli: [broccoli-csso](https://github.com/sindresorhus/broccoli-csso)
- PostCSS: [postcss-csso](https://github.com/lahmatiy/postcss-csso)
- Webpack: [csso-loader](https://github.com/sandark7/csso-loader)

## License

MIT

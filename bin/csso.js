#!/usr/bin/env node

const cli = require('..');

try {
    cli.run();
} catch (error) {
    // output user frendly message if cli error
    if (cli.isCliError(error)) {
        console.error(error.message || error);
        process.exit(2);
    }

    // otherwise re-throw exception
    throw error;
}
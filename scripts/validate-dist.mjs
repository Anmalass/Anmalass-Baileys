import {
    existsSync,
    readdirSync
} from 'node:fs';

import {
    join,
    resolve
} from 'node:path';

import {
    spawnSync
} from 'node:child_process';

import {
    pathToFileURL
} from 'node:url';

const required = [
    'lib/index.js',
    'lib/index.d.ts',
    'WAProto/index.js',
    'WAProto/index.d.ts',
    'engine-requirements.js'
];

for (const file of required) {
    if (!existsSync(file)) {
        console.error(
            'MISSING:',
            file
        );

        process.exit(10);
    }
}

const files = [];

const walk = dir => {
    for (
        const entry
        of readdirSync(
            dir,
            {
                withFileTypes: true
            }
        )
    ) {
        const target =
            join(
                dir,
                entry.name
            );

        if (entry.isDirectory()) {
            walk(target);
            continue;
        }

        if (
            entry.isFile() &&
            target.endsWith('.js')
        ) {
            files.push(target);
        }
    }
};

walk('lib');
walk('WAProto');

for (const file of files) {
    const result =
        spawnSync(
            process.execPath,
            [
                '--check',
                file
            ],
            {
                stdio: 'inherit'
            }
        );

    if (
        result.status !== 0
    ) {
        console.error(
            'SYNTAX FAILED:',
            file
        );

        process.exit(
            result.status ?? 20
        );
    }
}

const pkg =
    await import(
        pathToFileURL(
            resolve(
                'lib/index.js'
            )
        ).href
    );

const publicChecks = {
    default:
        typeof pkg.default ===
            'function',

    makeWASocket:
        typeof pkg.makeWASocket ===
            'function',

    createVenexvoraSDK:
        typeof pkg.createVenexvoraSDK ===
            'function',

    createVenexvoraFlow:
        typeof pkg.createVenexvoraFlow ===
            'function',

    createVenexvoraHealthMonitor:
        typeof pkg.createVenexvoraHealthMonitor ===
            'function'
};

const failed =
    Object.entries(
        publicChecks
    ).filter(
        ([, value]) =>
            value !== true
    );

if (failed.length) {
    console.error(
        'PUBLIC API FAILED:',
        failed
    );

    process.exit(30);
}

console.log(
    `DIST VALIDATION PASS (${files.length} JS files)`
);

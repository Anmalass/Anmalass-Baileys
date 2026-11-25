import {
    access,
    readdir,
    readFile,
    stat
} from 'fs/promises';
import { join } from 'path';
import { BufferJSON } from '../Utils/generics.js';

const canAccess = async (path) => {
    try {
        await access(path);
        return true;
    }
    catch {
        return false;
    }
};

const readJsonSafe = async (path) => {
    try {
        const raw = await readFile(
            path,
            'utf8'
        );

        const parsed = JSON.parse(
            raw,
            BufferJSON.reviver
        );

        return {
            ok: true,
            data: parsed,
            error: null
        };
    }
    catch (error) {
        return {
            ok: false,
            data: null,
            error
        };
    }
};

const classifyStatus = ({
    credsReadable,
    backupReadable,
    tempFiles,
    registered,
    hasCreds
}) => {
    if (!hasCreds) {
        return 'NEW';
    }

    if (
        !credsReadable &&
        backupReadable
    ) {
        return 'RECOVERABLE';
    }

    if (
        !credsReadable &&
        !backupReadable
    ) {
        return 'CORRUPT';
    }

    if (tempFiles > 0) {
        return 'DEGRADED';
    }

    if (!registered) {
        return 'UNREGISTERED';
    }

    return 'HEALTHY';
};

const countSessionFiles = async (
    folder
) => {
    const entries =
        await readdir(
            folder,
            {
                withFileTypes: true
            }
        );

    let jsonFiles = 0;
    let keyFiles = 0;
    let tempFiles = 0;
    let backupFiles = 0;

    for (const entry of entries) {
        if (!entry.isFile()) {
            continue;
        }

        const name = entry.name;

        if (
            name.endsWith('.json')
        ) {
            jsonFiles += 1;

            if (
                name !== 'creds.json'
            ) {
                keyFiles += 1;
            }
        }

        if (
            name.includes('.tmp-')
        ) {
            tempFiles += 1;
        }

        if (
            name.endsWith('.bak')
        ) {
            backupFiles += 1;
        }
    }

    return {
        jsonFiles,
        keyFiles,
        tempFiles,
        backupFiles
    };
};

export const inspectVenexvoraAuthSession =
    async (targetPath) => {

        const path =
            String(targetPath ?? '');

        if (!path) {
            throw new TypeError(
                'Session path is required'
            );
        }

        const info =
            await stat(path)
                .catch(() => null);

        /*
         * =====================================================
         * PATH BELUM ADA
         * =====================================================
         */

        if (!info) {
            return {
                ok: true,
                status: 'NEW',
                type: 'unknown',
                pathExists: false,

                registered: false,

                hasCreds: false,
                hasBackup: false,

                credsReadable: false,
                backupReadable: false,

                jsonFiles: 0,
                keyFiles: 0,
                backupFiles: 0,
                tempFiles: 0
            };
        }

        /*
         * =====================================================
         * MULTI FILE SESSION
         * =====================================================
         */

        if (info.isDirectory()) {
            const credsPath =
                join(
                    path,
                    'creds.json'
                );

            const backupPath =
                `${credsPath}.bak`;

            const hasCreds =
                await canAccess(
                    credsPath
                );

            const hasBackup =
                await canAccess(
                    backupPath
                );

            const credsResult =
                hasCreds
                    ? await readJsonSafe(
                          credsPath
                      )
                    : {
                          ok: false,
                          data: null,
                          error: null
                      };

            const backupResult =
                hasBackup
                    ? await readJsonSafe(
                          backupPath
                      )
                    : {
                          ok: false,
                          data: null,
                          error: null
                      };

            const files =
                await countSessionFiles(
                    path
                );

            const registered =
                Boolean(
                    credsResult
                        .data
                        ?.registered ??
                    backupResult
                        .data
                        ?.registered
                );

            const status =
                classifyStatus({
                    credsReadable:
                        credsResult.ok,
                    backupReadable:
                        backupResult.ok,
                    tempFiles:
                        files.tempFiles,
                    registered,
                    hasCreds
                });

            return {
                ok:
                    status !==
                    'CORRUPT',

                status,

                type:
                    'multi-file',

                pathExists: true,

                registered,

                hasCreds,
                hasBackup,

                credsReadable:
                    credsResult.ok,

                backupReadable:
                    backupResult.ok,

                jsonFiles:
                    files.jsonFiles,

                keyFiles:
                    files.keyFiles,

                backupFiles:
                    files.backupFiles,

                tempFiles:
                    files.tempFiles
            };
        }

        /*
         * =====================================================
         * SINGLE FILE SESSION
         * =====================================================
         */

        if (info.isFile()) {
            const backupPath =
                `${path}.bak`;

            const hasBackup =
                await canAccess(
                    backupPath
                );

            const authResult =
                await readJsonSafe(
                    path
                );

            const backupResult =
                hasBackup
                    ? await readJsonSafe(
                          backupPath
                      )
                    : {
                          ok: false,
                          data: null,
                          error: null
                      };

            const registered =
                Boolean(
                    authResult
                        .data
                        ?.creds
                        ?.registered ??
                    backupResult
                        .data
                        ?.creds
                        ?.registered
                );

            const status =
                classifyStatus({
                    credsReadable:
                        authResult.ok,
                    backupReadable:
                        backupResult.ok,
                    tempFiles: 0,
                    registered,
                    hasCreds: true
                });

            return {
                ok:
                    status !==
                    'CORRUPT',

                status,

                type:
                    'single-file',

                pathExists: true,

                registered,

                hasCreds: true,
                hasBackup,

                credsReadable:
                    authResult.ok,

                backupReadable:
                    backupResult.ok,

                jsonFiles: 1,

                keyFiles:
                    authResult
                        .data
                        ?.keys
                        ? Object
                              .values(
                                  authResult
                                      .data
                                      .keys
                              )
                              .reduce(
                                  (
                                      total,
                                      group
                                  ) =>
                                      total +
                                      Object.keys(
                                          group ??
                                              {}
                                      ).length,
                                  0
                              )
                        : 0,

                backupFiles:
                    hasBackup
                        ? 1
                        : 0,

                tempFiles: 0
            };
        }

        return {
            ok: false,
            status:
                'UNSUPPORTED',
            type:
                'unknown',
            pathExists: true,

            registered: false,

            hasCreds: false,
            hasBackup: false,

            credsReadable: false,
            backupReadable: false,

            jsonFiles: 0,
            keyFiles: 0,
            backupFiles: 0,
            tempFiles: 0
        };
    };

import { Mutex } from 'async-mutex';
import {
    mkdir,
    readFile,
    rename,
    stat,
    unlink,
    writeFile
} from 'fs/promises';
import { dirname } from 'path';
import { proto } from '../../WAProto/index.js';
import { initAuthCreds } from './auth-utils.js';
import { BufferJSON } from './generics.js';

const fileLock = new Mutex();

const serializeAuthData = (data) => {
    const serialized =
        JSON.stringify(
            data,
            BufferJSON.replacer,
            2
        );

    JSON.parse(
        serialized,
        BufferJSON.reviver
    );

    return serialized;
};

const parseAuthData = (raw) =>
    JSON.parse(
        raw,
        BufferJSON.reviver
    );

/**
 * VENEXVORA Fork SINGLE FILE AUTH STATE
 *
 * Proteksi:
 * - global single-file mutex
 * - atomic temporary write
 * - validation before replace
 * - known-good backup
 * - automatic recovery
 * - no silent reset on corrupt auth
 */
export const useSingleFileAuthState =
    async (filePath) => {

        const resolvedPath =
            String(filePath);

        const folder =
            dirname(resolvedPath);

        const backupPath =
            `${resolvedPath}.bak`;

        const ensureFolder =
            async () => {

                const folderInfo =
                    await stat(folder)
                        .catch(() => null);

                if (folderInfo) {
                    if (!folderInfo.isDirectory()) {
                        throw new Error(
                            `Path ${folder} is not a directory`
                        );
                    }

                    return;
                }

                await mkdir(
                    folder,
                    {
                        recursive: true
                    }
                );
            };

        const readFullData =
            async () => {

                await ensureFolder();

                return fileLock.runExclusive(
                    async () => {

                        try {
                            const raw =
                                await readFile(
                                    resolvedPath,
                                    'utf-8'
                                );

                            return parseAuthData(raw);
                        }
                        catch (error) {

                            /*
                             * First run:
                             * belum ada auth file.
                             */
                            if (
                                error?.code === 'ENOENT'
                            ) {
                                return {
                                    creds:
                                        initAuthCreds(),
                                    keys: {}
                                };
                            }

                            /*
                             * Current file rusak.
                             * Coba known-good backup.
                             */
                            try {
                                const backupRaw =
                                    await readFile(
                                        backupPath,
                                        'utf-8'
                                    );

                                return parseAuthData(
                                    backupRaw
                                );
                            }
                            catch {
                                const authError =
                                    new Error(
                                        `VENEXVORA_AUTH_CORRUPT: single auth file "${resolvedPath}" is unreadable and no valid backup is available`
                                    );

                                authError.code =
                                    'VENEXVORA_AUTH_CORRUPT';

                                authError.cause =
                                    error;

                                throw authError;
                            }
                        }
                    }
                );
            };

        const writeFullData =
            async (data) => {

                await ensureFolder();

                return fileLock.runExclusive(
                    async () => {

                        const serialized =
                            serializeAuthData(
                                data
                            );

                        const suffix =
                            `${process.pid}-${Date.now()}-${Math.random()
                                .toString(16)
                                .slice(2)}`;

                        const tempPath =
                            `${resolvedPath}.tmp-${suffix}`;

                        const backupTemp =
                            `${backupPath}.tmp-${suffix}`;

                        try {

                            /*
                             * Backup hanya dibuat dari
                             * current file yang valid.
                             */
                            try {
                                const currentRaw =
                                    await readFile(
                                        resolvedPath,
                                        'utf-8'
                                    );

                                parseAuthData(
                                    currentRaw
                                );

                                await writeFile(
                                    backupTemp,
                                    currentRaw,
                                    {
                                        encoding:
                                            'utf-8',
                                        mode: 0o600
                                    }
                                );

                                await rename(
                                    backupTemp,
                                    backupPath
                                );
                            }
                            catch {
                                // first write / corrupt current:
                                // pertahankan backup lama.
                            }

                            /*
                             * Atomic temp write.
                             */
                            await writeFile(
                                tempPath,
                                serialized,
                                {
                                    encoding:
                                        'utf-8',
                                    mode: 0o600
                                }
                            );

                            /*
                             * Verify file yang benar-benar
                             * telah ditulis.
                             */
                            const verifyRaw =
                                await readFile(
                                    tempPath,
                                    'utf-8'
                                );

                            parseAuthData(
                                verifyRaw
                            );

                            await rename(
                                tempPath,
                                resolvedPath
                            );
                        }
                        finally {
                            await unlink(
                                tempPath
                            ).catch(() => {});

                            await unlink(
                                backupTemp
                            ).catch(() => {});
                        }
                    }
                );
            };

        const fullData =
            await readFullData();

        /*
         * Pastikan struktur lama tetap kompatibel.
         */
        fullData.creds ||=
            initAuthCreds();

        fullData.keys ||=
            {};

        return {
            state: {
                creds:
                    fullData.creds,

                keys: {
                    get: async (
                        type,
                        ids
                    ) => {

                        const result = {};

                        for (
                            const id of ids
                        ) {
                            let value =
                                fullData
                                    .keys?.[
                                        type
                                    ]?.[
                                        id
                                    ];

                            if (
                                type ===
                                    'app-state-sync-key' &&
                                value
                            ) {
                                value =
                                    proto.Message
                                        .AppStateSyncKeyData
                                        .fromObject(
                                            value
                                        );
                            }

                            result[id] =
                                value;
                        }

                        return result;
                    },

                    set: async (
                        data
                    ) => {

                        for (
                            const category in
                            data
                        ) {
                            if (
                                !fullData
                                    .keys[
                                    category
                                ]
                            ) {
                                fullData.keys[
                                    category
                                ] = {};
                            }

                            for (
                                const id in
                                data[
                                    category
                                ]
                            ) {
                                const value =
                                    data[
                                        category
                                    ][id];

                                if (value) {
                                    fullData
                                        .keys[
                                        category
                                    ][id] =
                                        value;
                                }
                                else {
                                    delete fullData
                                        .keys[
                                        category
                                    ][id];
                                }
                            }
                        }

                        await writeFullData(
                            fullData
                        );
                    }
                }
            },

            saveCreds: async () => {
                await writeFullData(
                    fullData
                );
            }
        };
    };

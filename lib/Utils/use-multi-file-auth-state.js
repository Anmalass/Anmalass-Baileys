import { Mutex } from 'async-mutex';
import {
    mkdir,
    readFile,
    rename,
    stat,
    unlink,
    writeFile
} from 'fs/promises';
import { join } from 'path';
import { proto } from '../../WAProto/index.js';
import { initAuthCreds } from './auth-utils.js';
import { BufferJSON } from './generics.js';

/**
 * VENEXVORA Fork MULTI FILE AUTH STATE
 *
 * Proteksi:
 * - per-file mutex
 * - atomic temp write
 * - JSON validation before replace
 * - creds.json known-good backup
 * - recovery from creds.json.bak
 * - no silent credential reset on corruption
 */

const fileLocks = new Map();

const getFileLock = (path) => {
    let mutex = fileLocks.get(path);

    if (!mutex) {
        mutex = new Mutex();
        fileLocks.set(path, mutex);
    }

    return mutex;
};

const fixFileName = (file) =>
    file?.replace(/\//g, '__')?.replace(/:/g, '-');

const serializeAuthData = (data) => {
    const serialized =
        JSON.stringify(data, BufferJSON.replacer);

    // Jangan menulis hasil serialize yang ternyata tidak valid.
    JSON.parse(serialized, BufferJSON.reviver);

    return serialized;
};

const parseAuthData = (raw) =>
    JSON.parse(raw, BufferJSON.reviver);

/**
 * stores the full authentication state in a single folder.
 *
 * Venexvora edition adds atomic session protection for bot/Jadibot usage.
 */
export const useMultiFileAuthState = async (folder) => {

    const folderInfo =
        await stat(folder).catch(() => undefined);

    if (folderInfo) {
        if (!folderInfo.isDirectory()) {
            throw new Error(
                `found something that is not a directory at ${folder}, either delete it or specify a different location`
            );
        }
    }
    else {
        await mkdir(folder, {
            recursive: true
        });
    }

    const writeData = async (data, file) => {
        const safeFile = fixFileName(file);
        const filePath = join(folder, safeFile);
        const mutex = getFileLock(filePath);

        return mutex.runExclusive(async () => {
            const serialized =
                serializeAuthData(data);

            const uniqueSuffix =
                `${process.pid}-${Date.now()}-${Math.random()
                    .toString(16)
                    .slice(2)}`;

            const tempPath =
                `${filePath}.tmp-${uniqueSuffix}`;

            const isCreds =
                safeFile === 'creds.json';

            const backupPath =
                `${filePath}.bak`;

            const backupTempPath =
                `${backupPath}.tmp-${uniqueSuffix}`;

            try {
                /*
                 * Untuk creds.json kita simpan current valid state
                 * sebagai known-good backup sebelum replace.
                 */
                if (isCreds) {
                    try {
                        const currentRaw =
                            await readFile(
                                filePath,
                                'utf-8'
                            );

                        // Backup hanya dibuat dari current file
                        // yang benar-benar valid.
                        parseAuthData(currentRaw);

                        await writeFile(
                            backupTempPath,
                            currentRaw,
                            {
                                encoding: 'utf-8',
                                mode: 0o600
                            }
                        );

                        await rename(
                            backupTempPath,
                            backupPath
                        );
                    }
                    catch {
                        // First write atau current file tidak valid:
                        // jangan menimpa backup known-good yang ada.
                    }
                }

                /*
                 * Tulis ke temporary file terlebih dahulu.
                 */
                await writeFile(
                    tempPath,
                    serialized,
                    {
                        encoding: 'utf-8',
                        mode: 0o600
                    }
                );

                /*
                 * Integrity validation dari file yang benar-benar
                 * telah ditulis ke filesystem.
                 */
                const verifyRaw =
                    await readFile(
                        tempPath,
                        'utf-8'
                    );

                parseAuthData(verifyRaw);

                /*
                 * Atomic replace di filesystem yang sama.
                 */
                await rename(
                    tempPath,
                    filePath
                );
            }
            finally {
                /*
                 * Bersihkan temporary files bila operasi gagal.
                 */
                await unlink(tempPath)
                    .catch(() => {});

                await unlink(backupTempPath)
                    .catch(() => {});
            }
        });
    };

    const readData = async (file) => {
        const safeFile = fixFileName(file);
        const filePath = join(folder, safeFile);
        const mutex = getFileLock(filePath);

        return mutex.runExclusive(async () => {
            try {
                const raw =
                    await readFile(
                        filePath,
                        {
                            encoding: 'utf-8'
                        }
                    );

                return parseAuthData(raw);
            }
            catch (error) {

                /*
                 * creds.json adalah root identity session.
                 *
                 * Jika rusak, jangan langsung initAuthCreds()
                 * karena itu dapat membuat session lama terlihat
                 * seperti session baru.
                 */
                if (safeFile === 'creds.json') {
                    const backupPath =
                        `${filePath}.bak`;

                    try {
                        const backupRaw =
                            await readFile(
                                backupPath,
                                {
                                    encoding: 'utf-8'
                                }
                            );

                        const recovered =
                            parseAuthData(backupRaw);

                        /*
                         * Kembalikan backup known-good.
                         * saveCreds berikutnya akan menghasilkan
                         * current creds.json yang valid lagi.
                         */
                        return recovered;
                    }
                    catch {
                        /*
                         * Folder/session baru memang normal tidak
                         * memiliki creds.json.
                         */
                        if (
                            error?.code === 'ENOENT'
                        ) {
                            return null;
                        }

                        const sessionError =
                            new Error(
                                `VENEXVORA_AUTH_CORRUPT: credentials at "${folder}" are unreadable and no valid backup is available`
                            );

                        sessionError.code =
                            'VENEXVORA_AUTH_CORRUPT';

                        sessionError.cause =
                            error;

                        throw sessionError;
                    }
                }

                /*
                 * Signal key individual boleh dianggap tidak ada.
                 * Protocol dapat meminta/membangun key terkait lagi.
                 */
                return null;
            }
        });
    };

    const removeData = async (file) => {
        const safeFile = fixFileName(file);
        const filePath = join(folder, safeFile);
        const mutex = getFileLock(filePath);

        return mutex.runExclusive(async () => {
            await unlink(filePath)
                .catch(() => {});
        });
    };

    const existingCreds =
        await readData('creds.json');

    const creds =
        existingCreds || initAuthCreds();

    return {
        state: {
            creds,

            keys: {
                get: async (type, ids) => {
                    const data = {};

                    await Promise.all(
                        ids.map(async (id) => {
                            let value =
                                await readData(
                                    `${type}-${id}.json`
                                );

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

                            data[id] =
                                value;
                        })
                    );

                    return data;
                },

                set: async (data) => {
                    const tasks = [];

                    for (
                        const category in data
                    ) {
                        for (
                            const id in
                            data[category]
                        ) {
                            const value =
                                data[category][id];

                            const file =
                                `${category}-${id}.json`;

                            tasks.push(
                                value
                                    ? writeData(
                                          value,
                                          file
                                      )
                                    : removeData(
                                          file
                                      )
                            );
                        }
                    }

                    await Promise.all(tasks);
                }
            }
        },

        saveCreds: async () => {
            return writeData(
                creds,
                'creds.json'
            );
        }
    };
};

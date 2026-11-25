import {
    mkdir,
    open,
    readFile,
    rm,
    stat,
    writeFile
} from 'fs/promises';

import {
    dirname,
    join
} from 'path';

import {
    randomUUID
} from 'crypto';

const DEFAULT_LOCK_NAME =
    '.venexvora-session.lock';

const DEFAULT_STALE_MS =
    2 * 60 * 1000;

const sleep =
    (ms) =>
        new Promise(
            resolve =>
                setTimeout(resolve, ms)
        );

const normalizePid =
    (value) => {
        const pid =
            Number(value);

        return Number.isInteger(pid) &&
            pid > 0
            ? pid
            : null;
    };

const isProcessAlive =
    (pid) => {
        const normalized =
            normalizePid(pid);

        if (!normalized) {
            return false;
        }

        try {
            process.kill(
                normalized,
                0
            );

            return true;
        }
        catch (error) {
            if (
                error?.code ===
                'EPERM'
            ) {
                return true;
            }

            return false;
        }
    };

const readLockFile =
    async (lockPath) => {
        try {
            const raw =
                await readFile(
                    lockPath,
                    'utf8'
                );

            const data =
                JSON.parse(raw);

            return {
                ok: true,
                data
            };
        }
        catch (error) {
            return {
                ok: false,
                error,
                data: null
            };
        }
    };

const inspectLock =
    async (
        lockPath,
        staleMs
    ) => {

        const info =
            await stat(
                lockPath
            ).catch(
                () => null
            );

        if (!info) {
            return {
                exists: false,
                stale: false,
                alive: false,
                data: null
            };
        }

        const parsed =
            await readLockFile(
                lockPath
            );

        if (!parsed.ok) {
            const age =
                Date.now() -
                info.mtimeMs;

            return {
                exists: true,
                stale:
                    age >
                    staleMs,
                alive: false,
                data: null,
                malformed: true,
                age
            };
        }

        const data =
            parsed.data;

        const pid =
            normalizePid(
                data?.pid
            );

        const alive =
            isProcessAlive(
                pid
            );

        /*
         * Gunakan heartbeat terakhir sebagai activity timestamp.
         * createdAt hanya fallback untuk lock lama yang belum
         * memiliki heartbeatAt.
         */
        const activityAt =
            Number(
                data?.heartbeatAt ??
                data?.createdAt
            ) || info.mtimeMs;

        const age =
            Math.max(
                0,
                Date.now() -
                    activityAt
            );

        /*
         * Jangan mencuri lock dari PID yang masih hidup.
         *
         * Jika PID tidak terlihat dari process ini
         * (misalnya process mati / namespace berbeda),
         * heartbeat menjadi penentu orphan lock.
         */
        const stale =
            !alive &&
            age >
                staleMs;

        return {
            exists: true,
            stale,
            alive,
            data,
            age,
            malformed: false
        };
    };

export class VenexvoraSessionLock {
    constructor(
        sessionPath,
        options = {}
    ) {
        this.sessionPath =
            String(
                sessionPath
            );

        this.lockName =
            String(
                options.lockName ??
                DEFAULT_LOCK_NAME
            );

        this.lockPath =
            join(
                this.sessionPath,
                this.lockName
            );

        this.staleMs =
            Number(
                options.staleMs ??
                DEFAULT_STALE_MS
            );

        this.instanceId =
            options.instanceId ??
            randomUUID();

        this.ownerPid =
            process.pid;

        this.acquired =
            false;
    }

    async acquire(
        options = {}
    ) {
        await mkdir(
            this.sessionPath,
            {
                recursive: true
            }
        );

        const retries =
            Number(
                options.retries ??
                0
            );

        const retryDelayMs =
            Number(
                options.retryDelayMs ??
                150
            );

        let attempt =
            0;

        while (true) {
            attempt += 1;

            try {
                const handle =
                    await open(
                        this.lockPath,
                        'wx',
                        0o600
                    );

                const payload = {
                    version: 1,
                    pid:
                        this.ownerPid,
                    instanceId:
                        this.instanceId,
                    createdAt:
                        Date.now(),
                    heartbeatAt:
                        Date.now(),
                    sessionPath:
                        this.sessionPath
                };

                await handle.writeFile(
                    JSON.stringify(
                        payload,
                        null,
                        2
                    ),
                    'utf8'
                );

                await handle.close();

                this.acquired =
                    true;

                return {
                    acquired: true,
                    staleRecovered: false,
                    lockPath:
                        this.lockPath,
                    owner: payload
                };
            }
            catch (error) {
                if (
                    error?.code !==
                    'EEXIST'
                ) {
                    throw error;
                }

                const current =
                    await inspectLock(
                        this.lockPath,
                        this.staleMs
                    );

                if (
                    current.exists &&
                    current.stale
                ) {
                    await rm(
                        this.lockPath,
                        {
                            force: true
                        }
                    );

                    continue;
                }

                if (
                    attempt <=
                    retries
                ) {
                    await sleep(
                        retryDelayMs
                    );

                    continue;
                }

                const lockError =
                    new Error(
                        'Venexvora session is already owned by another process'
                    );

                lockError.code =
                    'VENEXVORA_SESSION_LOCKED';

                lockError.data = {
                    lockPath:
                        this.lockPath,

                    owner:
                        current.data ??
                        null,

                    alive:
                        current.alive,

                    stale:
                        current.stale,

                    age:
                        current.age ??
                        null
                };

                throw lockError;
            }
        }
    }

    async inspect() {
        return inspectLock(
            this.lockPath,
            this.staleMs
        );
    }

    async refresh() {
        if (!this.acquired) {
            const error =
                new Error(
                    'Cannot refresh an unowned Venexvora session lock'
                );

            error.code =
                'VENEXVORA_SESSION_LOCK_NOT_OWNED';

            throw error;
        }

        const current =
            await readLockFile(
                this.lockPath
            );

        if (
            !current.ok ||
            current.data
                ?.instanceId !==
                this.instanceId
        ) {
            const error =
                new Error(
                    'Venexvora session lock ownership changed'
                );

            error.code =
                'VENEXVORA_SESSION_LOCK_OWNERSHIP_LOST';

            throw error;
        }

        const payload = {
            ...current.data,
            heartbeatAt:
                Date.now()
        };

        await writeFile(
            this.lockPath,
            JSON.stringify(
                payload,
                null,
                2
            ),
            {
                encoding:
                    'utf8',
                mode: 0o600
            }
        );

        return payload;
    }

    async release() {
        if (!this.acquired) {
            return {
                released: false,
                reason:
                    'NOT_ACQUIRED'
            };
        }

        const current =
            await readLockFile(
                this.lockPath
            );

        if (
            current.ok &&
            current.data
                ?.instanceId !==
                this.instanceId
        ) {
            const error =
                new Error(
                    'Refusing to remove session lock owned by another instance'
                );

            error.code =
                'VENEXVORA_SESSION_LOCK_OWNER_MISMATCH';

            throw error;
        }

        await rm(
            this.lockPath,
            {
                force: true
            }
        );

        this.acquired =
            false;

        return {
            released: true
        };
    }
}

export const createVenexvoraSessionLock =
    (
        sessionPath,
        options = {}
    ) =>
        new VenexvoraSessionLock(
            sessionPath,
            options
        );

export const inspectVenexvoraSessionLock =
    async (
        sessionPath,
        options = {}
    ) => {

        const lockPath =
            join(
                String(
                    sessionPath
                ),
                String(
                    options.lockName ??
                    DEFAULT_LOCK_NAME
                )
            );

        return inspectLock(
            lockPath,
            Number(
                options.staleMs ??
                    DEFAULT_STALE_MS
            )
        );
    };

export const VENEXVORA_SESSION_LOCK_FEATURES =
    Object.freeze({
        crossProcessLock: true,
        exclusiveCreate: true,
        ownerVerification: true,
        staleRecovery: true,
        heartbeat: true,
        safeRelease: true
    });

import {
    mkdir,
    readdir,
    rm,
    stat
} from 'fs/promises';
import { join, resolve } from 'path';

import {
    inspectVenexvoraAuthSession
} from './venexvora-session-inspector.js';

import {
    createVenexvoraSessionLock,
    inspectVenexvoraSessionLock
} from './venexvora-session-lock.js';

const normalizeSessionId = (value) => {
    const id =
        String(value ?? '')
            .replace(/[^0-9]/g, '');

    if (
        id.length < 7 ||
        id.length > 15
    ) {
        throw new TypeError(
            'Invalid Venexvora session id'
        );
    }

    return id;
};

export class VenexvoraSessionManager {
    constructor(options = {}) {
        this.root =
            resolve(
                String(
                    options.root ??
                    './session/jadibot'
                )
            );

        this.type =
            'jadibot';

        /*
         * Runtime registry HARUS scoped ke manager instance.
         *
         * Dua manager dengan root berbeda boleh mengelola
         * nomor yang sama tanpa saling menganggap aktif.
         *
         * Duplicate pada root/path yang sama tetap dijaga
         * oleh filesystem ownership lock.
         */
        this.activeSessions =
            new Map();

        this.sessionLocks =
            new Map();

        /*
         * Filesystem lock configuration.
         *
         * Default:
         * - heartbeat setiap 30 detik
         * - stale setelah 2 menit
         */
        this.lockStaleMs =
            Math.max(
                1000,
                Number(
                    options.lockStaleMs ??
                    2 * 60 * 1000
                )
            );

        this.heartbeatIntervalMs =
            Math.max(
                250,
                Number(
                    options.heartbeatIntervalMs ??
                    Math.min(
                        30 * 1000,
                        Math.max(
                            1000,
                            Math.floor(
                                this.lockStaleMs / 3
                            )
                        )
                    )
                )
            );
    }

    _getSessionLock(id) {
        let lock =
            this.sessionLocks.get(
                id
            );

        if (!lock) {
            lock = {
                busy:
                    false
            };

            this.sessionLocks.set(
                id,
                lock
            );
        }

        return lock;
    }

    async _withSessionLock(
        id,
        fn
    ) {
        const lock =
            this._getSessionLock(
                id
            );

        if (lock.busy) {
            const error =
                new Error(
                    `Session ${id} is busy`
                );

            error.code =
                'VENEXVORA_SESSION_BUSY';

            throw error;
        }

        lock.busy =
            true;

        try {
            return await fn();
        }
        finally {
            lock.busy =
                false;

            /*
             * Tidak ada waiter queue pada lock sederhana ini.
             * Setelah operation selesai, entry aman dibersihkan.
             */
            if (
                this.sessionLocks.get(
                    id
                ) === lock
            ) {
                this.sessionLocks.delete(
                    id
                );
            }
        }
    }

    _stopLockHeartbeat(runtime) {
        if (
            runtime?.heartbeatTimer
        ) {
            clearInterval(
                runtime.heartbeatTimer
            );

            runtime.heartbeatTimer =
                null;
        }
    }

    _startLockHeartbeat(runtime) {
        this._stopLockHeartbeat(
            runtime
        );

        if (
            !runtime?.lock
        ) {
            return;
        }

        const tick =
            async () => {
                /*
                 * Hindari concurrent heartbeat apabila filesystem
                 * sedang lambat.
                 */
                if (
                    runtime.heartbeatBusy
                ) {
                    return;
                }

                runtime.heartbeatBusy =
                    true;

                try {
                    const payload =
                        await runtime
                            .lock
                            .refresh();

                    runtime.lastHeartbeatAt =
                        Number(
                            payload?.heartbeatAt
                        ) || Date.now();

                    runtime.lockHealthy =
                        true;

                    runtime.lockError =
                        null;
                }
                catch (error) {
                    /*
                     * Ownership berubah/hilang.
                     * Jangan terus menulis lock.
                     */
                    runtime.lockHealthy =
                        false;

                    runtime.lockError = {
                        code:
                            error?.code ??
                            'VENEXVORA_SESSION_LOCK_HEARTBEAT_FAILED',

                        message:
                            error?.message ??
                            'Session lock heartbeat failed',

                        at:
                            Date.now()
                    };

                    runtime.status =
                        'LOCK_LOST';

                    this._stopLockHeartbeat(
                        runtime
                    );
                }
                finally {
                    runtime.heartbeatBusy =
                        false;
                }
            };

        runtime.heartbeatTimer =
            setInterval(
                () => {
                    void tick();
                },
                this.heartbeatIntervalMs
            );

        /*
         * Timer heartbeat tidak boleh membuat process Node
         * tetap hidup jika seluruh pekerjaan lain sudah selesai.
         */
        runtime
            .heartbeatTimer
            .unref?.();

        runtime.lockHealthy =
            true;

        runtime.lastHeartbeatAt =
            Date.now();

        runtime.lockError =
            null;
    }

    async ensureRoot() {
        await mkdir(
            this.root,
            {
                recursive: true
            }
        );

        return this.root;
    }

    normalizeId(id) {
        return normalizeSessionId(
            id
        );
    }

    getPath(id) {
        const normalized =
            this.normalizeId(id);

        return join(
            this.root,
            normalized
        );
    }

    isActive(id) {
        const normalized =
            this.normalizeId(id);

        return this.activeSessions.has(
            normalized
        );
    }

    getRuntime(id) {
        const normalized =
            this.normalizeId(id);

        const runtime =
            this.activeSessions.get(
                normalized
            );

        if (!runtime) {
            return null;
        }

        return {
            id:
                runtime.id,

            status:
                runtime.status,

            startedAt:
                runtime.startedAt,

            stoppedAt:
                runtime.stoppedAt ??
                null,

            reconnecting:
                Boolean(
                    runtime.reconnecting
                ),

            hasSocket:
                Boolean(
                    runtime.socket
                ),

            lockOwned:
                Boolean(
                    runtime.lock
                        ?.acquired
                ),

            lockHealthy:
                runtime.lockHealthy !==
                    false,

            lastHeartbeatAt:
                runtime.lastHeartbeatAt ??
                null,

            lockError:
                runtime.lockError ??
                null
        };
    }

    async inspect(id) {
        const normalized =
            this.normalizeId(id);

        const path =
            this.getPath(
                normalized
            );

        const health =
            await inspectVenexvoraAuthSession(
                path
            );

        return {
            id:
                normalized,

            active:
                this.isActive(
                    normalized
                ),

            ...health
        };
    }

    async list() {
        await this.ensureRoot();

        const entries =
            await readdir(
                this.root,
                {
                    withFileTypes:
                        true
                }
            );

        const result = [];

        for (
            const entry of entries
        ) {
            if (
                !entry.isDirectory()
            ) {
                continue;
            }

            const id =
                entry.name;

            if (
                !/^[0-9]{7,15}$/.test(
                    id
                )
            ) {
                continue;
            }

            result.push(
                await this.inspect(
                    id
                )
            );
        }

        return result;
    }

    async reserve(id) {
        const normalized =
            this.normalizeId(id);

        return this._withSessionLock(
            normalized,
            async () => {
                await this.ensureRoot();

                if (
                    this.activeSessions.has(
                        normalized
                    )
                ) {
                    const error =
                        new Error(
                            `Session ${normalized} is already active`
                        );

                    error.code =
                        'VENEXVORA_SESSION_ALREADY_ACTIVE';

                    throw error;
                }

                const path =
                    this.getPath(
                        normalized
                    );

                await mkdir(
                    path,
                    {
                        recursive: true
                    }
                );

                /*
                 * Cross-process ownership lock.
                 *
                 * this.activeSessions melindungi duplicate pada manager ini.
                 * Filesystem lock melindungi duplicate untuk session path
                 * yang sama dari manager/process/container lain.
                 */
                const lock =
                    createVenexvoraSessionLock(
                        path,
                        {
                            staleMs:
                                this.lockStaleMs
                        }
                    );

                try {
                    await lock.acquire();
                }
                catch (error) {
                    /*
                     * Jangan tandai session sebagai aktif jika
                     * filesystem ownership gagal diperoleh.
                     */
                    throw error;
                }

                const runtime = {
                    id:
                        normalized,

                    path,

                    status:
                        'RESERVED',

                    startedAt:
                        Date.now(),

                    stoppedAt:
                        null,

                    reconnecting:
                        false,

                    socket:
                        null,

                    lock,

                    heartbeatTimer:
                        null,

                    heartbeatBusy:
                        false,

                    lastHeartbeatAt:
                        Date.now(),

                    lockHealthy:
                        true,

                    lockError:
                        null
                };

                try {
                    this.activeSessions.set(
                        normalized,
                        runtime
                    );

                    this._startLockHeartbeat(
                        runtime
                    );
                }
                catch (error) {
                    this._stopLockHeartbeat(
                        runtime
                    );

                    await lock
                        .release()
                        .catch(
                            () => {}
                        );

                    this.activeSessions.delete(
                        normalized
                    );

                    throw error;
                }

                return {
                    id:
                        normalized,

                    path,

                    status:
                        runtime.status,

                    lockOwned:
                        true
                };
            }
        );
    }

    attachSocket(
        id,
        socket
    ) {
        const normalized =
            this.normalizeId(id);

        const runtime =
            this.activeSessions.get(
                normalized
            );

        if (!runtime) {
            const error =
                new Error(
                    `Session ${normalized} is not reserved`
                );

            error.code =
                'VENEXVORA_SESSION_NOT_RESERVED';

            throw error;
        }

        runtime.socket =
            socket ?? null;

        runtime.status =
            'ACTIVE';

        runtime.startedAt ||=
            Date.now();

        return this.getRuntime(
            normalized
        );
    }

    setReconnecting(
        id,
        value = true
    ) {
        const normalized =
            this.normalizeId(id);

        const runtime =
            this.activeSessions.get(
                normalized
            );

        if (!runtime) {
            return false;
        }

        runtime.reconnecting =
            Boolean(value);

        runtime.status =
            value
                ? 'RECONNECTING'
                : (
                    runtime.socket
                        ? 'ACTIVE'
                        : 'RESERVED'
                );

        return true;
    }

    async release(
        id,
        options = {}
    ) {
        const normalized =
            this.normalizeId(id);

        return this._withSessionLock(
            normalized,
            async () => {
                const runtime =
                    this.activeSessions.get(
                        normalized
                    );

                if (!runtime) {
                    return {
                        id:
                            normalized,

                        released:
                            false,

                        reason:
                            'NOT_ACTIVE'
                    };
                }

                runtime.status =
                    'STOPPING';

                const socket =
                    runtime.socket;

                if (
                    options.closeSocket !==
                        false &&
                    socket
                ) {
                    try {
                        if (
                            typeof socket.end ===
                            'function'
                        ) {
                            await socket.end(
                                new Error(
                                    'VENEXVORA_SESSION_RELEASED'
                                )
                            );
                        }
                        else if (
                            typeof socket.ws?.close ===
                            'function'
                        ) {
                            await socket.ws.close();
                        }
                    }
                    catch {
                        // Stop manager tetap lanjut.
                    }
                }

                runtime.socket =
                    null;

                runtime.reconnecting =
                    false;

                runtime.status =
                    'STOPPED';

                runtime.stoppedAt =
                    Date.now();

                let lockError =
                    null;

                /*
                 * Stop heartbeat sebelum filesystem ownership
                 * dilepas agar timer tidak menulis lock lagi.
                 */
                this._stopLockHeartbeat(
                    runtime
                );

                if (
                    runtime.lock
                        ?.acquired
                ) {
                    try {
                        await runtime
                            .lock
                            .release();
                    }
                    catch (error) {
                        /*
                         * Jangan pernah menghapus lock milik
                         * instance lain jika ownership berubah.
                         */
                        lockError =
                            error;
                    }
                }

                this.activeSessions.delete(
                    normalized
                );

                if (lockError) {
                    throw lockError;
                }

                return {
                    id:
                        normalized,

                    released:
                        true,

                    status:
                        'STOPPED',

                    lockReleased:
                        true
                };
            }
        );
    }

    async remove(
        id,
        options = {}
    ) {
        const normalized =
            this.normalizeId(id);

        if (
            this.isActive(
                normalized
            )
        ) {
            const error =
                new Error(
                    `Cannot remove active session ${normalized}`
                );

            error.code =
                'VENEXVORA_SESSION_ACTIVE';

            throw error;
        }

        const path =
            this.getPath(
                normalized
            );

        const info =
            await stat(
                path
            ).catch(
                () => null
            );

        if (!info) {
            return {
                id:
                    normalized,

                removed:
                    false
            };
        }

        /*
         * Session mungkin aktif di process/container lain,
         * walaupun tidak ada di this.activeSessions process ini.
         */
        const filesystemLock =
            await inspectVenexvoraSessionLock(
                path
            );

        if (
            filesystemLock.exists &&
            filesystemLock.alive &&
            !filesystemLock.stale
        ) {
            const error =
                new Error(
                    `Cannot remove session ${normalized} because it is owned by another running process`
                );

            error.code =
                'VENEXVORA_SESSION_LOCKED';

            error.data = {
                owner:
                    filesystemLock.data ??
                    null
            };

            throw error;
        }

        if (
            options.force !==
            true
        ) {
            const health =
                await inspectVenexvoraAuthSession(
                    path
                );

            if (
                health.registered
            ) {
                const error =
                    new Error(
                        `Refusing to remove registered session ${normalized} without force`
                    );

                error.code =
                    'VENEXVORA_SESSION_REMOVE_PROTECTED';

                throw error;
            }
        }

        await rm(
            path,
            {
                recursive: true,
                force: true
            }
        );

        return {
            id:
                normalized,

            removed:
                true
        };
    }

    getActiveCount() {
        return this.activeSessions.size;
    }

    getActiveIds() {
        return [
            ...this.activeSessions.keys()
        ];
    }
}

export const createVenexvoraSessionManager =
    (options = {}) =>
        new VenexvoraSessionManager(
            options
        );

export const VENEXVORA_SESSION_MANAGER_FEATURES =
    Object.freeze({
        isolatedFolders: true,
        duplicateInstanceProtection: true,
        perManagerRuntimeIsolation: true,
        perManagerOperationLock: true,
        crossProcessOwnership: true,
        filesystemLock: true,
        lockHeartbeat: true,
        orphanRecovery: true,
        ownershipLossDetection: true,
        runtimeRegistry: true,
        sessionHealth: true,
        safeRelease: true,
        protectedRemove: true
    });

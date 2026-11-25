import makeWASocket from '../Socket/index.js';

import {
    DisconnectReason
} from '../Types/index.js';

import {
    useMultiFileAuthState
} from '../Utils/use-multi-file-auth-state.js';

import {
    createVenexvoraSessionManager
} from './venexvora-session-manager.js';

import {
    createVenexvoraSelfHealingSupervisor
} from './venexvora-self-healing.js';

import {
    createVenexvoraHealthMonitor
} from './venexvora-health.js';

const VENEXVORA_DEFAULT_PAIRING_CODE =
    'ANMALYAA';

const DEFAULT_RECONNECT_DELAY_MS =
    1500;

const DEFAULT_MAX_RECONNECT =
    5;

const normalizePhone = value => {
    const phone =
        String(value ?? '')
            .replace(/[^0-9]/g, '');

    if (
        phone.length < 7 ||
        phone.length > 15
    ) {
        throw new TypeError(
            'Invalid Jadibot phone number'
        );
    }

    return phone;
};

const normalizePairingCode = value => {
    const code =
        String(
            value ??
            VENEXVORA_DEFAULT_PAIRING_CODE
        )
            .trim()
            .toUpperCase();

    if (
        !/^[A-Z0-9]{8}$/.test(
            code
        )
    ) {
        throw new TypeError(
            'Venexvora pairing code must be exactly 8 alphanumeric characters'
        );
    }

    return code;
};

const getDisconnectStatusCode =
    update => {

        const error =
            update
                ?.lastDisconnect
                ?.error;

        return (
            error
                ?.output
                ?.statusCode ??
            error
                ?.statusCode ??
            error
                ?.data
                ?.statusCode ??
            null
        );
    };

const sleep =
    ms =>
        new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    ms
                )
        );

const FATAL_DISCONNECT_REASONS =
    new Set(
        [
            DisconnectReason.loggedOut,
            DisconnectReason.badSession,
            DisconnectReason.connectionReplaced,
            DisconnectReason.multideviceMismatch,
            DisconnectReason.forbidden
        ].filter(
            value =>
                Number.isFinite(
                    value
                )
        )
    );

const isFatalDisconnect =
    statusCode =>
        FATAL_DISCONNECT_REASONS
            .has(
                statusCode
            );

const isRestartRequired =
    statusCode =>
        statusCode ===
        DisconnectReason.restartRequired;

export class VenexvoraJadibotSession {
    constructor(options = {}) {
        this.manager =
            options.manager ??
            createVenexvoraSessionManager({
                root:
                    options.root ??
                    './session/jadibot',

                lockStaleMs:
                    options.lockStaleMs,

                heartbeatIntervalMs:
                    options.heartbeatIntervalMs
            });

        this.makeSocket =
            options.makeSocket ??
            makeWASocket;

        this.socketConfig = {
            ...(options.socketConfig ??
                {})
        };

        this.autoReconnect =
            options.autoReconnect !==
            false;

        this.reconnectDelayMs =
            Math.max(
                250,
                Number(
                    options.reconnectDelayMs ??
                    DEFAULT_RECONNECT_DELAY_MS
                )
            );

        this.maxReconnect =
            Math.max(
                0,
                Number(
                    options.maxReconnect ??
                    DEFAULT_MAX_RECONNECT
                )
            );

        this.defaultPairingCode =
            normalizePairingCode(
                options.pairingCode ??
                VENEXVORA_DEFAULT_PAIRING_CODE
            );

        this.id =
            null;

        this.path =
            null;

        this.auth =
            null;

        this.saveCreds =
            null;

        this.socket =
            null;

        this.phone =
            null;

        this.pairingCode =
            this.defaultPairingCode;

        this.status =
            'IDLE';

        this.reconnectAttempts =
            0;

        /*
         * Fatal disconnect menghentikan auto reconnect
         * tanpa mengubah konfigurasi autoReconnect permanen.
         */
        this.reconnectBlocked =
            false;

        this.reconnectTimer =
            null;

        this.generation =
            0;

        this.starting =
            false;

        this.stopping =
            false;

        this.startedAt =
            null;

        this.openedAt =
            null;

        this.lastDisconnect =
            null;

        this.lastError =
            null;

        this.listeners =
            new Map();

        this.selfHealingEnabled =
            options.selfHealing !== false;

        this.selfHealing =
            createVenexvoraSelfHealingSupervisor({
                staleMs: options.selfHealingStaleMs,
                cooldownMs: options.selfHealingCooldownMs,
                maxRecoveries: options.selfHealingMaxRecoveries,
                windowMs: options.selfHealingWindowMs,
                recover: async ({ reason, context }) =>
                    this._requestSelfHealingRecovery(reason, context)
            });

        this.healthMonitor =
            createVenexvoraHealthMonitor({
                runtime: this,
                selfHealing:
                    this.selfHealing,
                includeMemory:
                    options.healthMemory !== false
            });
    }

    on(
        event,
        handler
    ) {
        if (
            typeof handler !==
            'function'
        ) {
            throw new TypeError(
                'Venexvora Jadibot event handler must be a function'
            );
        }

        let set =
            this.listeners.get(
                event
            );

        if (!set) {
            set =
                new Set();

            this.listeners.set(
                event,
                set
            );
        }

        set.add(
            handler
        );

        return () => {
            set.delete(
                handler
            );
        };
    }

    _emit(
        event,
        payload
    ) {
        const handlers =
            this.listeners.get(
                event
            );

        if (!handlers) {
            return;
        }

        for (
            const handler of
            handlers
        ) {
            try {
                handler(
                    payload
                );
            }
            catch {
                // Event consumer tidak boleh merusak lifecycle session.
            }
        }
    }

    async _requestSelfHealingRecovery(
        reason,
        context = {}
    ) {
        if (
            this.selfHealingEnabled ===
            false
        ) {
            return {
                scheduled:
                    false,

                reason:
                    'SELF_HEALING_DISABLED'
            };
        }

        if (
            this.id ===
            null
        ) {
            return {
                scheduled:
                    false,

                reason:
                    'NOT_STARTED'
            };
        }

        if (
            this.stopping ===
            true
        ) {
            return {
                scheduled:
                    false,

                reason:
                    'STOPPING'
            };
        }

        if (
            this.reconnectBlocked ===
            true
        ) {
            return {
                scheduled:
                    false,

                reason:
                    'RECONNECT_BLOCKED'
            };
        }

        if (
            this.autoReconnect ===
            false
        ) {
            return {
                scheduled:
                    false,

                reason:
                    'AUTO_RECONNECT_DISABLED'
            };
        }

        const runtime =
            this.manager
                .getRuntime(
                    this.id
                );

        if (
            runtime ===
            null
        ) {
            this.reconnectBlocked =
                true;

            this.status =
                'SESSION_OWNERSHIP_LOST';

            this.manager
                .setReconnecting(
                    this.id,
                    false
                );

            this._clearReconnectTimer();

            return {
                scheduled:
                    false,

                reason:
                    'SESSION_OWNERSHIP_LOST'
            };
        }

        if (
            runtime.status ===
                'LOCK_LOST' ||
            runtime.lockHealthy ===
                false ||
            runtime.lockOwned ===
                false
        ) {
            this.reconnectBlocked =
                true;

            this.status =
                'LOCK_LOST';

            this.manager
                .setReconnecting(
                    this.id,
                    false
                );

            this._clearReconnectTimer();

            return {
                scheduled:
                    false,

                reason:
                    'LOCK_LOST'
            };
        }

        /*
         * Existing Jadibot reconnect scheduler adalah
         * satu-satunya pemilik reconnect timer.
         *
         * Self-healing tidak membuat timer sendiri.
         */
        if (
            this.reconnectTimer !==
            null
        ) {
            return {
                scheduled:
                    false,

                reason:
                    'RECONNECT_ALREADY_SCHEDULED',

                attempt:
                    this.reconnectAttempts
            };
        }

        /*
         * Stale socket dibersihkan terlebih dahulu.
         *
         * Listener dilepas sebelum socket ditutup supaya
         * stale socket tidak menghasilkan reconnect kedua.
         */
        const staleSocket =
            this.socket;

        if (
            staleSocket
        ) {
            this._detachSocketListeners(
                staleSocket
            );

            try {
                if (
                    typeof staleSocket
                        .end ===
                    'function'
                ) {
                    await staleSocket
                        .end(
                            new Error(
                                'VENEXVORA_SELF_HEALING_RECOVERY'
                            )
                        );
                }
                else if (
                    typeof staleSocket
                        .ws
                        ?.close ===
                    'function'
                ) {
                    await staleSocket
                        .ws
                        .close();
                }
            }
            catch {
                /*
                 * Cleanup stale socket best effort.
                 * Scheduler recovery tetap boleh lanjut.
                 */
            }

            if (
                this.socket ===
                staleSocket
            ) {
                this.socket =
                    null;
            }
        }

        const update = {
            connection:
                'close',

            lastDisconnect:
                this.lastDisconnect,

            selfHealing: {
                reason,
                context
            }
        };

        await this
            ._scheduleReconnect(
                update
            );

        return {
            scheduled:
                this.reconnectTimer !==
                null,

            reason,

            attempt:
                this.reconnectAttempts
        };
    }

    getSelfHealingStatus() {
        return {
            enabled:
                this.selfHealingEnabled,

            ...this.selfHealing
                .getStatus(),

            stats:
                this.selfHealing
                    .getStats()
        };
    }

    getHealth(extra = {}) {
        return this.healthMonitor
            .snapshot({
                runtimeStatus:
                    this.status,

                generation:
                    this.generation,

                reconnectAttempts:
                    this.reconnectAttempts,

                reconnectBlocked:
                    this.reconnectBlocked,

                starting:
                    this.starting,

                stopping:
                    this.stopping,

                startedAt:
                    this.startedAt,

                openedAt:
                    this.openedAt,

                selfHealingEnabled:
                    this.selfHealingEnabled,

                ...extra
            });
    }

    async checkSelfHealing() {
        if (
            this.selfHealingEnabled ===
            false
        ) {
            return {
                status:
                    'SKIPPED',

                reason:
                    'SELF_HEALING_DISABLED'
            };
        }

        if (
            this.stopping ===
            true
        ) {
            return {
                status:
                    'SKIPPED',

                reason:
                    'STOPPING'
            };
        }

        if (
            this.id ===
            null
        ) {
            return {
                status:
                    'SKIPPED',

                reason:
                    'NOT_STARTED'
            };
        }

        const runtime =
            this.manager
                .getRuntime(
                    this.id
                );

        if (
            runtime ===
            null
        ) {
            this.reconnectBlocked =
                true;

            this.status =
                'SESSION_OWNERSHIP_LOST';

            this._clearReconnectTimer();

            const result =
                await this.selfHealing
                    .handle({
                        runtimeStatus:
                            'SESSION_OWNERSHIP_LOST'
                    });

            this._emit(
                'self_healing.blocked',
                {
                    id:
                        this.id,

                    reason:
                        'SESSION_OWNERSHIP_LOST'
                }
            );

            return {
                ...result,
                runtime:
                    null
            };
        }

        if (
            runtime.status ===
                'LOCK_LOST' ||
            runtime.lockHealthy ===
                false ||
            runtime.lockOwned ===
                false
        ) {
            this.reconnectBlocked =
                true;

            this.status =
                'LOCK_LOST';

            this.manager
                .setReconnecting(
                    this.id,
                    false
                );

            this._clearReconnectTimer();

            const result =
                await this.selfHealing
                    .handle({
                        runtimeStatus:
                            'LOCK_LOST'
                    });

            this._emit(
                'self_healing.blocked',
                {
                    id:
                        this.id,

                    reason:
                        'LOCK_LOST',

                    runtime
                }
            );

            return {
                ...result,
                runtime
            };
        }

        /*
         * Bila reconnect timer lama masih aktif,
         * self-healing cukup mengobservasi.
         *
         * Recovery budget tidak boleh terpakai hanya
         * karena reconnect normal sedang menunggu timer.
         */
        if (
            this.reconnectTimer !==
            null
        ) {
            this.selfHealing
                .markState(
                    'RECONNECTING'
                );

            return {
                status:
                    'PENDING',

                reason:
                    'RECONNECT_ALREADY_SCHEDULED',

                runtime
            };
        }

        const result =
            await this.selfHealing
                .check({
                    id:
                        this.id,

                    runtime,

                    runtimeStatus:
                        this.status
                });

        if (
            result?.status ===
            'RECOVERY_REQUESTED'
        ) {
            this._emit(
                'self_healing.recovery',
                {
                    id:
                        this.id,

                    result
                }
            );
        }

        if (
            result?.status ===
            'CIRCUIT_OPEN'
        ) {
            this._emit(
                'self_healing.blocked',
                {
                    id:
                        this.id,

                    reason:
                        result.reason
                }
            );
        }

        return {
            ...result,
            runtime
        };
    }

    _clearReconnectTimer() {
        if (
            this.reconnectTimer
        ) {
            clearTimeout(
                this.reconnectTimer
            );

            this.reconnectTimer =
                null;
        }
    }

    _detachSocketListeners(
        socket
    ) {
        if (
            !socket?.ev
        ) {
            return;
        }

        const refs =
            socket.__venexvoraJadibotListeners;

        if (!refs) {
            return;
        }

        try {
            if (
                typeof socket.ev.off ===
                'function'
            ) {
                socket.ev.off(
                    'creds.update',
                    refs.creds
                );

                socket.ev.off(
                    'connection.update',
                    refs.connection
                );
            }
            else if (
                typeof socket.ev.removeListener ===
                'function'
            ) {
                socket.ev.removeListener(
                    'creds.update',
                    refs.creds
                );

                socket.ev.removeListener(
                    'connection.update',
                    refs.connection
                );
            }
        }
        catch {
            // Cleanup best effort.
        }

        delete socket
            .__venexvoraJadibotListeners;
    }

    async _bindSocket(
        socket,
        generation
    ) {
        if (!socket?.ev) {
            throw new TypeError(
                'Invalid Baileys socket: event emitter not found'
            );
        }

        const onCredsUpdate =
            async () => {

                if (
                    generation !==
                    this.generation
                ) {
                    return;
                }

                try {
                    await this.saveCreds();

                    this._emit(
                        'creds.saved',
                        {
                            id:
                                this.id
                        }
                    );
                }
                catch (error) {
                    this.lastError =
                        error;

                    this._emit(
                        'error',
                        {
                            id:
                                this.id,

                            stage:
                                'save-creds',

                            error
                        }
                    );
                }
            };

        const onConnectionUpdate =
            async update => {

                if (
                    generation !==
                    this.generation
                ) {
                    return;
                }

                this._emit(
                    'connection.update',
                    {
                        id:
                            this.id,

                        update
                    }
                );

                if (
                    update?.connection ===
                    'connecting'
                ) {
                    this.status =
                        'CONNECTING';

                    this.manager
                        .setReconnecting(
                            this.id,
                            this.reconnectAttempts >
                                0
                        );

                    // Venexvora self-healing: observe connecting state.
                    if (
                        this.selfHealingEnabled
                    ) {
                        this.selfHealing
                            .markState(
                                this.reconnectAttempts >
                                    0
                                    ? 'RECONNECTING'
                                    : 'CONNECTING'
                            );
                    }
                }

                if (
                    update?.connection ===
                    'open'
                ) {
                    this.status =
                        'OPEN';

                    this.openedAt =
                        Date.now();

                    this.reconnectAttempts =
                        0;

                    this.manager
                        .setReconnecting(
                            this.id,
                            false
                        );

                    // Venexvora self-healing: healthy connection.
                    if (
                        this.selfHealingEnabled
                    ) {
                        this.selfHealing
                            .markHealthy({
                                id:
                                    this.id,

                                connection:
                                    'open'
                            });
                    }

                    this._emit(
                        'ready',
                        {
                            id:
                                this.id,

                            socket:
                                this.socket
                        }
                    );
                }

                if (
                    update?.connection ===
                    'close'
                ) {
                    this.lastDisconnect =
                        update
                            ?.lastDisconnect ??
                        null;

                    const statusCode =
                        getDisconnectStatusCode(
                            update
                        );

                    const loggedOut =
                        statusCode ===
                        DisconnectReason.loggedOut;

                    const fatal =
                        isFatalDisconnect(
                            statusCode
                        );

                    if (fatal) {
                        this.reconnectBlocked =
                            true;

                        this.manager
                            .setReconnecting(
                                this.id,
                                false
                            );

                        this.status =
                            loggedOut
                                ? 'LOGGED_OUT'
                                : 'FATAL_DISCONNECT';

                        // Venexvora self-healing: fatal disconnect blocks recovery.
                        if (
                            this.selfHealingEnabled
                        ) {
                            await this.selfHealing
                                .handle({
                                    runtimeStatus:
                                        this.status,

                                    statusCode
                                });
                        }

                        this._emit(
                            loggedOut
                                ? 'logged_out'
                                : 'fatal_disconnect',
                            {
                                id:
                                    this.id,

                                statusCode
                            }
                        );

                        return;
                    }

                    if (
                        this.stopping ||
                        !this.autoReconnect ||
                        this.reconnectBlocked
                    ) {
                        this.status =
                            'CLOSED';

                        return;
                    }

                    // Venexvora self-healing observes existing reconnect.
                    if (
                        this.selfHealingEnabled
                    ) {
                        this.selfHealing
                            .markState(
                                'RECONNECTING'
                            );
                    }

                    await this
                        ._scheduleReconnect(
                            update,
                            {
                                immediate:
                                    isRestartRequired(
                                        statusCode
                                    )
                            }
                        );
                }
            };

        socket.__venexvoraJadibotListeners = {
            creds:
                onCredsUpdate,

            connection:
                onConnectionUpdate
        };

        socket.ev.on(
            'creds.update',
            onCredsUpdate
        );

        socket.ev.on(
            'connection.update',
            onConnectionUpdate
        );
    }

    async _createSocket() {
        this.generation +=
            1;

        const generation =
            this.generation;

        const oldSocket =
            this.socket;

        if (oldSocket) {
            this._detachSocketListeners(
                oldSocket
            );
        }

        const socket =
            this.makeSocket({
                ...this.socketConfig,

                auth:
                    this.auth
            });

        if (
            !socket ||
            typeof socket !==
                'object'
        ) {
            throw new TypeError(
                'makeWASocket returned an invalid socket'
            );
        }

        this.socket =
            socket;

        this.manager.attachSocket(
            this.id,
            socket
        );

        await this._bindSocket(
            socket,
            generation
        );

        return socket;
    }

    async _scheduleReconnect(
        update,
        options = {}
    ) {
        if (
            this.reconnectTimer ||
            this.stopping ||
            this.reconnectBlocked ||
            !this.autoReconnect
        ) {
            return;
        }

        if (
            this.reconnectAttempts >=
            this.maxReconnect
        ) {
            this.status =
                'RECONNECT_EXHAUSTED';

            this.manager
                .setReconnecting(
                    this.id,
                    false
                );

            this._emit(
                'reconnect.exhausted',
                {
                    id:
                        this.id,

                    attempts:
                        this.reconnectAttempts,

                    update
                }
            );

            // Venexvora self-healing: reconnect exhaustion opens circuit.
            if (
                this.selfHealingEnabled
            ) {
                await this.selfHealing
                    .handle({
                        runtimeStatus:
                            'RECONNECT_EXHAUSTED'
                    });
            }

            return;
        }

        this.reconnectAttempts +=
            1;

        this.status =
            'RECONNECTING';

        this.manager
            .setReconnecting(
                this.id,
                true
            );

        // Venexvora self-healing: observe scheduler reconnect.
        if (
            this.selfHealingEnabled
        ) {
            this.selfHealing
                .markState(
                    'RECONNECTING'
                );
        }

        const attempt =
            this.reconnectAttempts;

        /*
         * restartRequired memang meminta socket baru.
         * Tidak perlu menunggu backoff panjang.
         */
        const delay =
            options.immediate
                ? 250
                : Math.min(
                    this.reconnectDelayMs *
                        Math.max(
                            1,
                            attempt
                        ),
                    30_000
                );

        this._emit(
            'reconnecting',
            {
                id:
                    this.id,

                attempt,

                delay
            }
        );

        this.reconnectTimer =
            setTimeout(
                async () => {
                    this.reconnectTimer =
                        null;

                    if (
                        this.stopping
                    ) {
                        return;
                    }

                    try {
                        await this
                            ._createSocket();
                    }
                    catch (error) {
                        this.lastError =
                            error;

                        this._emit(
                            'error',
                            {
                                id:
                                    this.id,

                                stage:
                                    'reconnect',

                                error
                            }
                        );

                        if (
                            !this.stopping &&
                            this.autoReconnect
                        ) {
                            await this
                                ._scheduleReconnect(
                                    update
                                );
                        }
                    }
                },
                delay
            );

        /*
         * Jangan unref reconnect timer.
         *
         * Jika WebSocket ditutup dengan restartRequired (515)
         * sesudah pairing, timer inilah yang harus menjaga
         * process tetap hidup sampai socket baru dibuat.
         *
         * unref() sebelumnya dapat membuat Node keluar dengan:
         * "Detected unsettled top-level await"
         * sebelum reconnect dijalankan.
         */
    }

    async start(
        options = {}
    ) {
        if (
            this.starting
        ) {
            const error =
                new Error(
                    'Venexvora Jadibot session is already starting'
                );

            error.code =
                'VENEXVORA_JADIBOT_START_BUSY';

            throw error;
        }

        if (
            this.id
        ) {
            const error =
                new Error(
                    'Venexvora Jadibot session is already initialized'
                );

            error.code =
                'VENEXVORA_JADIBOT_ALREADY_STARTED';

            throw error;
        }

        this.starting =
            true;

        /*
         * Instance yang pernah stop/fatal boleh dipakai lagi.
         */
        this.reconnectBlocked =
            false;

        this.reconnectAttempts =
            0;

        this._clearReconnectTimer();

        // Venexvora self-healing: reusable instance start.
        if (
            this.selfHealingEnabled
        ) {
            this.selfHealing
                .resetCircuit();

            this.selfHealing
                .markState(
                    'STARTING'
                );
        }

        try {
            const phone =
                normalizePhone(
                    options.phone ??
                    options.id
                );

            const pairingCode =
                normalizePairingCode(
                    options.pairingCode ??
                    this.defaultPairingCode
                );

            this.phone =
                phone;

            this.id =
                phone;

            this.pairingCode =
                pairingCode;

            let reserved;

            try {
                reserved =
                    await this.manager
                        .reserve(
                            phone
                        );
            }
            catch (error) {
                /*
                 * reserve() gagal sebelum auth/socket dibuat.
                 * Jangan tinggalkan id semu di instance.
                 */
                this.lastError =
                    error;

                this.id =
                    null;

                this.phone =
                    null;

                this.path =
                    null;

                this.auth =
                    null;

                this.saveCreds =
                    null;

                this.socket =
                    null;

                this.status =
                    'FAILED';

                throw error;
            }

            this.path =
                reserved.path;

            try {
                const auth =
                    await useMultiFileAuthState(
                        this.path
                    );

                this.auth =
                    auth.state;

                this.saveCreds =
                    auth.saveCreds;

                this.status =
                    'STARTING';

                this.startedAt =
                    Date.now();

                const socket =
                    await this
                        ._createSocket();

                this._emit(
                    'started',
                    {
                        id:
                            this.id,

                        path:
                            this.path,

                        registered:
                            Boolean(
                                this.auth
                                    ?.creds
                                    ?.registered
                            )
                    }
                );

                /*
                 * Pairing hanya diminta jika session belum registered.
                 * Session lama yang sehat langsung reconnect memakai creds.
                 */
                let requestedPairingCode =
                    null;

                if (
                    !this.auth
                        ?.creds
                        ?.registered &&
                    options.requestPairing !==
                        false
                ) {
                    if (
                        typeof socket
                            .requestPairingCode !==
                        'function'
                    ) {
                        const error =
                            new Error(
                                'requestPairingCode is not available on this socket'
                            );

                        error.code =
                            'VENEXVORA_PAIRING_UNAVAILABLE';

                        throw error;
                    }

                    requestedPairingCode =
                        await socket
                            .requestPairingCode(
                                phone,
                                pairingCode
                            );

                    this._emit(
                        'pairing_code',
                        {
                            id:
                                this.id,

                            code:
                                requestedPairingCode
                        }
                    );
                }

                return {
                    id:
                        this.id,

                    path:
                        this.path,

                    socket,

                    registered:
                        Boolean(
                            this.auth
                                ?.creds
                                ?.registered
                        ),

                    pairingCode:
                        requestedPairingCode,

                    status:
                        this.status
                };
            }
            catch (error) {
                this.lastError =
                    error;

                /*
                 * start() gagal -> jangan tinggalkan
                 * filesystem ownership lock.
                 */
                await this.manager
                    .release(
                        phone,
                        {
                            closeSocket:
                                false
                        }
                    )
                    .catch(
                        () => {}
                    );

                this.socket =
                    null;

                this.auth =
                    null;

                this.saveCreds =
                    null;

                this.path =
                    null;

                this.id =
                    null;

                this.phone =
                    null;

                this.status =
                    'FAILED';

                throw error;
            }
        }
        finally {
            this.starting =
                false;
        }
    }

    async requestPairingCode(
        options = {}
    ) {
        if (
            !this.socket
        ) {
            const error =
                new Error(
                    'Venexvora Jadibot socket has not been started'
                );

            error.code =
                'VENEXVORA_JADIBOT_NOT_STARTED';

            throw error;
        }

        if (
            this.auth
                ?.creds
                ?.registered
        ) {
            const error =
                new Error(
                    'Venexvora Jadibot session is already registered'
                );

            error.code =
                'VENEXVORA_JADIBOT_ALREADY_REGISTERED';

            throw error;
        }

        const phone =
            normalizePhone(
                options.phone ??
                this.phone
            );

        const pairingCode =
            normalizePairingCode(
                options.pairingCode ??
                this.pairingCode
            );

        return this.socket
            .requestPairingCode(
                phone,
                pairingCode
            );
    }

    async inspect() {
        if (!this.id) {
            return {
                status:
                    'IDLE',

                active:
                    false
            };
        }

        const health =
            await this.manager
                .inspect(
                    this.id
                );

        return {
            ...health,

            runtimeStatus:
                this.status,

            reconnectAttempts:
                this.reconnectAttempts,

            startedAt:
                this.startedAt,

            openedAt:
                this.openedAt,

            selfHealing:
                this.getSelfHealingStatus()
        };
    }

    async stop(
        options = {}
    ) {
        if (
            this.stopping
        ) {
            return {
                stopped:
                    false,

                reason:
                    'ALREADY_STOPPING'
            };
        }

        if (!this.id) {
            return {
                stopped:
                    false,

                reason:
                    'NOT_STARTED'
            };
        }

        this.stopping =
            true;

        const id =
            this.id;

        try {
            this._clearReconnectTimer();

            // Venexvora self-healing: stop means no more recovery.
            if (
                this.selfHealingEnabled
            ) {
                this.selfHealing
                    .stop(
                        'STOPPING'
                    );
            }

            const socket =
                this.socket;

            if (socket) {
                this._detachSocketListeners(
                    socket
                );
            }

            await this.manager
                .release(
                    id,
                    {
                        closeSocket:
                            options.closeSocket !==
                            false
                    }
                );

            this.socket =
                null;

            this.auth =
                null;

            this.saveCreds =
                null;

            this.path =
                null;

            this.status =
                'STOPPED';

            this.reconnectBlocked =
                false;

            this.reconnectAttempts =
                0;

            this._emit(
                'stopped',
                {
                    id
                }
            );

            this.id =
                null;

            this.phone =
                null;

            return {
                stopped:
                    true,

                id
            };
        }
        finally {
            this.stopping =
                false;
        }
    }
}

export const createVenexvoraJadibot =
    options =>
        new VenexvoraJadibotSession(
            options
        );

export const VENEXVORA_JADIBOT_FEATURES =
    Object.freeze({
        isolatedAuth: true,
        multiFileAuth: true,
        filesystemOwnership: true,
        customPairingCode: true,
        customPairingDefault:
            VENEXVORA_DEFAULT_PAIRING_CODE,
        credsPersistence: true,
        connectionLifecycle: true,
        reconnectGuard: true,
        noMessagesUpsertHandler: true
    });

import {
    createVenexvoraSessionManager
} from './venexvora-session-manager.js';

import {
    createVenexvoraJadibot
} from './venexvora-jadibot-factory.js';

export const VENEXVORA_JADIBOT_RESTORER_FEATURES =
    Object.freeze({
        scanOnStartup: true,
        healthyOnly: true,
        registeredOnly: true,
        noPairingRestore: true,
        sequentialRestore: true,
        ownershipAware: true,
        trackedSessions: true,
        safeStopAll: true,
        noMessagesUpsertHandler: true
    });

const isHealthy =
    inspection =>
        inspection?.status === 'HEALTHY' &&
        inspection?.registered === true;

export class VenexvoraJadibotRestorer {
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

        this.createSession =
            options.createSession ??
            createVenexvoraJadibot;

        this.sessionOptions = {
            autoReconnect:
                options.autoReconnect !== false,

            reconnectDelayMs:
                options.reconnectDelayMs,

            maxReconnect:
                options.maxReconnect,

            pairingCode:
                options.pairingCode ??
                'ANMALYAA',

            selfHealing:
                options.selfHealing !== false,

            selfHealingStaleMs:
                options.selfHealingStaleMs,

            selfHealingCooldownMs:
                options.selfHealingCooldownMs,

            selfHealingMaxRecoveries:
                options.selfHealingMaxRecoveries,

            selfHealingWindowMs:
                options.selfHealingWindowMs,

            socketConfig: {
                ...(options.socketConfig ?? {})
            }
        };

        this.sessions =
            new Map();

        this.restoring =
            new Set();
    }

    async scan() {
        return this.manager.list();
    }

    getSession(id) {
        const normalized =
            this.manager.normalizeId(id);

        return (
            this.sessions.get(normalized) ??
            null
        );
    }

    getActiveIds() {
        return [
            ...this.sessions.keys()
        ];
    }

    getActiveCount() {
        return this.sessions.size;
    }

    async _dropSession(
        id,
        session
    ) {
        if (
            this.sessions.get(id) !==
            session
        ) {
            return;
        }

        this.sessions.delete(id);

        await session
            .stop({
                closeSocket: false
            })
            .catch(() => {});
    }

    _trackSession(
        id,
        session
    ) {
        const drop =
            () => {
                queueMicrotask(
                    () => {
                        void this._dropSession(
                            id,
                            session
                        );
                    }
                );
            };

        session.on(
            'logged_out',
            drop
        );

        session.on(
            'fatal_disconnect',
            drop
        );

        session.on(
            'reconnect.exhausted',
            drop
        );

        session.on(
            'self_healing.blocked',
            payload => {
                if (
                    payload?.reason === 'LOCK_LOST' ||
                    payload?.reason === 'SESSION_OWNERSHIP_LOST'
                ) {
                    drop();
                }
            }
        );
    }

    async restoreOne(
        id,
        options = {}
    ) {
        const normalized =
            this.manager.normalizeId(id);

        if (
            this.sessions.has(
                normalized
            )
        ) {
            return {
                id:
                    normalized,

                status:
                    'SKIPPED',

                reason:
                    'ALREADY_TRACKED'
            };
        }

        if (
            this.restoring.has(
                normalized
            )
        ) {
            return {
                id:
                    normalized,

                status:
                    'SKIPPED',

                reason:
                    'RESTORE_BUSY'
            };
        }

        this.restoring.add(
            normalized
        );

        try {
            if (
                this.manager.isActive(
                    normalized
                )
            ) {
                return {
                    id:
                        normalized,

                    status:
                        'SKIPPED',

                    reason:
                        'ALREADY_ACTIVE'
                };
            }

            const inspection =
                options.inspection ??
                await this.manager.inspect(
                    normalized
                );

            if (
                !isHealthy(
                    inspection
                )
            ) {
                return {
                    id:
                        normalized,

                    status:
                        'SKIPPED',

                    reason:
                        inspection?.registered
                            ? 'AUTH_NOT_HEALTHY'
                            : 'NOT_REGISTERED',

                    authStatus:
                        inspection?.status ??
                        'UNKNOWN'
                };
            }

            const session =
                this.createSession({
                    manager:
                        this.manager,

                    ...this.sessionOptions
                });

            this._trackSession(
                normalized,
                session
            );

            try {
                const started =
                    await session.start({
                        phone:
                            normalized,

                        requestPairing:
                            false
                    });

                if (
                    started?.registered !==
                    true
                ) {
                    await session
                        .stop({
                            closeSocket:
                                true
                        })
                        .catch(() => {});

                    return {
                        id:
                            normalized,

                        status:
                            'SKIPPED',

                        reason:
                            'RESTORE_NOT_REGISTERED'
                    };
                }

                this.sessions.set(
                    normalized,
                    session
                );

                return {
                    id:
                        normalized,

                    status:
                        'RESTORED',

                    registered:
                        true
                };
            }
            catch (error) {
                await session
                    .stop({
                        closeSocket:
                            false
                    })
                    .catch(() => {});

                if (
                    [
                        'VENEXVORA_SESSION_LOCKED',
                        'VENEXVORA_SESSION_ALREADY_ACTIVE',
                        'VENEXVORA_SESSION_BUSY'
                    ].includes(
                        error?.code
                    )
                ) {
                    return {
                        id:
                            normalized,

                        status:
                            'SKIPPED',

                        reason:
                            'OWNERSHIP_LOCKED',

                        errorCode:
                            error.code
                    };
                }

                throw error;
            }
        }
        finally {
            this.restoring.delete(
                normalized
            );
        }
    }

    async restoreAll() {
        const found =
            await this.scan();

        const results =
            [];

        for (
            const inspection of
            found
        ) {
            try {
                results.push(
                    await this.restoreOne(
                        inspection.id,
                        {
                            inspection
                        }
                    )
                );
            }
            catch (error) {
                results.push({
                    id:
                        inspection.id,

                    status:
                        'FAILED',

                    reason:
                        error?.code ??
                        'RESTORE_ERROR',

                    message:
                        error?.message
                });
            }
        }

        return {
            root:
                this.manager.root,

            scanned:
                found.length,

            restored:
                results.filter(
                    item =>
                        item.status ===
                        'RESTORED'
                ).length,

            skipped:
                results.filter(
                    item =>
                        item.status ===
                        'SKIPPED'
                ).length,

            failed:
                results.filter(
                    item =>
                        item.status ===
                        'FAILED'
                ).length,

            results
        };
    }

    async stopOne(
        id,
        options = {}
    ) {
        const normalized =
            this.manager.normalizeId(id);

        const session =
            this.sessions.get(
                normalized
            );

        if (!session) {
            return false;
        }

        this.sessions.delete(
            normalized
        );

        await session.stop({
            closeSocket:
                options.closeSocket !==
                false
        });

        return true;
    }

    async stopAll(
        options = {}
    ) {
        const ids =
            this.getActiveIds();

        for (
            const id of
            ids
        ) {
            await this.stopOne(
                id,
                options
            ).catch(
                () => {}
            );
        }

        return {
            stopped:
                ids.length
        };
    }
}

export const createVenexvoraJadibotRestorer =
    options =>
        new VenexvoraJadibotRestorer(
            options
        );

export const restoreVenexvoraJadibotsOnStartup =
    async options => {
        const restorer =
            createVenexvoraJadibotRestorer(
                options
            );

        const report =
            await restorer.restoreAll();

        return {
            restorer,
            report
        };
    };

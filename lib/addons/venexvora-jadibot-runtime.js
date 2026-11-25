import {
    createVenexvoraJadibotRestorer
} from './venexvora-jadibot-restorer.js';

import {
    createVenexvoraRuntimeWatchdog
} from './venexvora-runtime-watchdog.js';

export const VENEXVORA_JADIBOT_RUNTIME_FEATURES =
    Object.freeze({
        startupRestore: true,
        idempotentStart: true,
        gracefulStop: true,
        shutdownHooks: true,
        runtimeHealth: true,
        multiSessionHealth: true,
        sessionAccess: true,
        noPairingOnRestore: true,
        runtimeWatchdog: true,
        noOverlappingWatchdog: true,
        trackedSessionsOnlyWatchdog: true,
        noRestoreInWatchdog: true,
        noMessagesUpsertHandler: true
    });

export class VenexvoraJadibotRuntime {
    constructor(options = {}) {
        this.restorer =
            options.restorer ??
            createVenexvoraJadibotRestorer(
                options
            );

        this.started =
            false;

        this.startedAt =
            null;

        this.stoppedAt =
            null;

        this.lastReport =
            null;

        this.lastError =
            null;

        this.startPromise =
            null;

        this.stopPromise =
            null;

        this.listeners =
            new Map();

        this.signalHandlers =
            new Map();

        this.signalStopping =
            false;

        this.watchdog =
            createVenexvoraRuntimeWatchdog({
                enabled: options.watchdog !== false,
                intervalMs: options.watchdogIntervalMs,
                getIds: () => this.getActiveIds(),
                getSession: id => this.getSession(id),
                onReport: report => this._emit('watchdog', report)
            });
    }

    on(event, handler) {
        if (
            typeof handler !==
            'function'
        ) {
            throw new TypeError(
                'Runtime event handler must be a function'
            );
        }

        let handlers =
            this.listeners.get(
                event
            );

        if (!handlers) {
            handlers =
                new Set();

            this.listeners.set(
                event,
                handlers
            );
        }

        handlers.add(
            handler
        );

        return () =>
            handlers.delete(
                handler
            );
    }

    _emit(event, payload) {
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
                // Listener user tidak boleh merusak runtime.
            }
        }
    }

    async start() {
        if (
            this.started
        ) {
            return {
                status:
                    'ALREADY_STARTED',

                report:
                    this.lastReport
            };
        }

        if (
            this.startPromise
        ) {
            return this.startPromise;
        }

        this.startPromise =
            (async () => {
                this.lastError =
                    null;

                this._emit(
                    'starting',
                    {}
                );

                try {
                    const report =
                        await this.restorer
                            .restoreAll();

                    this.lastReport =
                        report;

                    this.started =
                        true;

                    this.startedAt =
                        Date.now();

                    this.stoppedAt =
                        null;

                    this.startWatchdog();

                    this._emit(
                        'started',
                        {
                            report
                        }
                    );

                    return {
                        status:
                            'STARTED',

                        report
                    };
                }
                catch (error) {
                    this.lastError =
                        error;

                    this._emit(
                        'error',
                        {
                            stage:
                                'startup',

                            error
                        }
                    );

                    throw error;
                }
            })();

        try {
            return await this
                .startPromise;
        }
        finally {
            this.startPromise =
                null;
        }
    }

    async stop(options = {}) {
        if (
            this.stopPromise
        ) {
            return this.stopPromise;
        }

        this.stopPromise =
            (async () => {
                this._emit(
                    'stopping',
                    {}
                );

                await this.stopWatchdog({
                    wait: true
                });

                const result =
                    await this.restorer
                        .stopAll({
                            closeSocket:
                                options
                                    .closeSocket !==
                                false
                        });

                this.started =
                    false;

                this.stoppedAt =
                    Date.now();

                this._emit(
                    'stopped',
                    result
                );

                return result;
            })();

        try {
            return await this
                .stopPromise;
        }
        finally {
            this.stopPromise =
                null;
        }
    }

    runWatchdogCheck() {
        return this.watchdog.run();
    }

    startWatchdog() {
        return this.watchdog.start();
    }

    stopWatchdog(options = {}) {
        return this.watchdog.stop(options);
    }

    getWatchdogStatus() {
        return this.watchdog.getStatus();
    }

    getSession(id) {
        return this.restorer
            .getSession(
                id
            );
    }

    getActiveIds() {
        return this.restorer
            .getActiveIds();
    }

    getActiveCount() {
        return this.restorer
            .getActiveCount();
    }


    getHealthSummary(extra = {}) {
        const ids =
            this.getActiveIds();

        const sessions = [];

        let healthy = 0;
        let degraded = 0;
        let critical = 0;
        let unavailable = 0;

        for (const id of ids) {
            const session =
                this.getSession(id);

            if (
                typeof session?.getHealth !==
                'function'
            ) {
                unavailable++;

                sessions.push({
                    id,
                    status: 'UNAVAILABLE',
                    reason:
                        'HEALTH_UNAVAILABLE'
                });

                continue;
            }

            try {
                const health =
                    session.getHealth({
                        source:
                            'runtime-summary'
                    });

                let status =
                    health?.status;

                if (
                    status !== 'HEALTHY' &&
                    status !== 'DEGRADED' &&
                    status !== 'CRITICAL'
                ) {
                    status =
                        'DEGRADED';
                }

                if (
                    status === 'HEALTHY'
                ) {
                    healthy++;
                } else if (
                    status === 'CRITICAL'
                ) {
                    critical++;
                } else {
                    degraded++;
                }

                sessions.push({
                    id,
                    status,
                    health
                });
            } catch (error) {
                unavailable++;

                sessions.push({
                    id,
                    status: 'UNAVAILABLE',
                    reason:
                        'HEALTH_READ_ERROR',
                    message:
                        error?.message ??
                        String(error)
                });
            }
        }

        const status =
            critical > 0
                ? 'CRITICAL'
                : (
                    degraded > 0 ||
                    unavailable > 0
                )
                    ? 'DEGRADED'
                    : 'HEALTHY';

        const watchdog =
            this.getWatchdogStatus();

        return {
            status,

            timestamp:
                new Date()
                    .toISOString(),

            totalSessions:
                ids.length,

            healthy,
            degraded,
            critical,
            unavailable,

            runtime: {
                started:
                    this.started,

                startedAt:
                    this.startedAt,

                stoppedAt:
                    this.stoppedAt,

                activeCount:
                    ids.length,

                restoringCount:
                    Number(
                        this.restorer
                            ?.restoring
                            ?.size ??
                        0
                    ),

                lastError:
                    this.lastError
                        ? {
                            code:
                                this.lastError
                                    ?.code ??
                                null,

                            message:
                                this.lastError
                                    ?.message ??
                                String(
                                    this.lastError
                                )
                        }
                        : null
            },

            watchdog,
            sessions,

            extra: {
                ...(extra ?? {})
            }
        };
    }

    getStatus() {
        return {
            started:
                this.started,

            startedAt:
                this.startedAt,

            stoppedAt:
                this.stoppedAt,

            activeCount:
                this.getActiveCount(),

            activeIds:
                this.getActiveIds(),

            watchdog:
                this.getWatchdogStatus(),

            lastReport:
                this.lastReport,

            lastError:
                this.lastError
                    ? {
                        code:
                            this.lastError
                                ?.code ??
                            null,

                        message:
                            this.lastError
                                ?.message ??
                            String(
                                this.lastError
                            )
                    }
                    : null
        };
    }

    installShutdownHooks(
        options = {}
    ) {
        const signals =
            options.signals ??
            [
                'SIGINT',
                'SIGTERM'
            ];

        const exitOnSignal =
            options.exitOnSignal !==
            false;

        for (
            const signal of
            signals
        ) {
            if (
                this.signalHandlers.has(
                    signal
                )
            ) {
                continue;
            }

            const handler =
                async () => {
                    if (
                        this.signalStopping
                    ) {
                        return;
                    }

                    this.signalStopping =
                        true;

                    try {
                        await this.stop({
                            closeSocket:
                                true
                        });
                    }
                    catch {
                        // Shutdown tetap dilanjutkan.
                    }

                    if (
                        exitOnSignal
                    ) {
                        process.exit(0);
                    }

                    this.signalStopping =
                        false;
                };

            this.signalHandlers.set(
                signal,
                handler
            );

            process.on(
                signal,
                handler
            );
        }

        return {
            installed:
                [
                    ...this
                        .signalHandlers
                        .keys()
                ]
        };
    }

    removeShutdownHooks() {
        for (
            const [
                signal,
                handler
            ] of
            this.signalHandlers
        ) {
            process.removeListener(
                signal,
                handler
            );
        }

        this.signalHandlers
            .clear();

        return true;
    }
}

export const createVenexvoraJadibotRuntime =
    options =>
        new VenexvoraJadibotRuntime(
            options
        );

export const startVenexvoraJadibotRuntime =
    async options => {
        const runtime =
            createVenexvoraJadibotRuntime(
                options
            );

        const result =
            await runtime.start();

        return {
            runtime,
            result
        };
    };

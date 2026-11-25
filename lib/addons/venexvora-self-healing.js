const DEFAULT_STALE_MS =
    30_000

const DEFAULT_COOLDOWN_MS =
    5_000

const DEFAULT_MAX_RECOVERIES =
    3

const DEFAULT_WINDOW_MS =
    60_000

const FATAL_CODES =
    new Set([
        401, // loggedOut
        403, // forbidden
        411, // multideviceMismatch
        440, // connectionReplaced
        500  // badSession
    ])

const RECOVERABLE_CODES =
    new Set([
        408, // connectionLost / timedOut
        428, // connectionClosed
        503, // unavailableService
        515  // restartRequired
    ])

const FATAL_SIGNALS =
    new Set([
        'LOGGED_OUT',
        'LOGGEDOUT',
        'FATAL_DISCONNECT',
        'BAD_SESSION',
        'FORBIDDEN',
        'CONNECTION_REPLACED',
        'MULTIDEVICE_MISMATCH',
        'LOCK_LOST',
        'RECONNECT_EXHAUSTED',
        'SESSION_OWNERSHIP_LOST'
    ])

const STOP_SIGNALS =
    new Set([
        'STOP',
        'STOPPED',
        'STOPPING',
        'LOGOUT',
        'LOGGED_OUT_BY_USER'
    ])

const HEALTHY_SIGNALS =
    new Set([
        'OPEN',
        'HEALTHY',
        'ACTIVE',
        'ONLINE'
    ])

const PENDING_SIGNALS =
    new Set([
        'STARTING',
        'CONNECTING',
        'RECONNECTING',
        'RECOVERING'
    ])

const normalizeInteger =
    (
        value,
        fallback,
        minimum = 0
    ) => {
        const number =
            Number(value)

        if (
            !Number.isFinite(number)
        ) {
            return fallback
        }

        return Math.max(
            minimum,
            Math.floor(number)
        )
    }

const normalizeSignalName =
    value =>
        String(
            value ?? ''
        )
            .trim()
            .replace(
                /[.\-\s]+/g,
                '_'
            )
            .toUpperCase()

const extractStatusCode =
    input => {
        const candidates = [
            input?.statusCode,
            input?.code,
            input?.error?.statusCode,
            input?.error?.output?.statusCode,
            input?.lastDisconnect
                ?.error
                ?.statusCode,
            input?.lastDisconnect
                ?.error
                ?.output
                ?.statusCode
        ]

        for (
            const candidate
            of candidates
        ) {
            const number =
                Number(candidate)

            if (
                Number.isFinite(number)
            ) {
                return number
            }
        }

        return undefined
    }

const extractSignalName =
    input => {
        if (
            typeof input === 'string'
        ) {
            return normalizeSignalName(
                input
            )
        }

        const candidates = [
            input?.signal,
            input?.type,
            input?.event,
            input?.reason,
            input?.status,
            input?.connection,
            input?.runtimeStatus
        ]

        for (
            const candidate
            of candidates
        ) {
            const normalized =
                normalizeSignalName(
                    candidate
                )

            if (normalized) {
                return normalized
            }
        }

        return ''
    }

export const classifyVenexvoraHealingSignal =
    input => {
        const name =
            extractSignalName(
                input
            )

        const statusCode =
            extractStatusCode(
                input
            )

        if (
            STOP_SIGNALS.has(name)
        ) {
            return {
                kind: 'STOP',
                name,
                statusCode
            }
        }

        if (
            FATAL_SIGNALS.has(name) ||
            (
                statusCode !==
                    undefined &&
                FATAL_CODES.has(
                    statusCode
                )
            )
        ) {
            return {
                kind: 'FATAL',
                name,
                statusCode
            }
        }

        if (
            HEALTHY_SIGNALS.has(name)
        ) {
            return {
                kind: 'HEALTHY',
                name,
                statusCode
            }
        }

        if (
            PENDING_SIGNALS.has(name)
        ) {
            return {
                kind: 'PENDING',
                name,
                statusCode
            }
        }

        if (
            statusCode !== undefined &&
            RECOVERABLE_CODES.has(
                statusCode
            )
        ) {
            return {
                kind: 'TRANSIENT',
                name,
                statusCode
            }
        }

        if (
            name === 'CLOSE' ||
            name ===
                'CONNECTION_CLOSED' ||
            name ===
                'CONNECTION_LOST' ||
            name ===
                'TIMED_OUT' ||
            name ===
                'UNAVAILABLE_SERVICE' ||
            name ===
                'RESTART_REQUIRED'
        ) {
            return {
                kind: 'TRANSIENT',
                name,
                statusCode
            }
        }

        return {
            kind: 'UNKNOWN',
            name,
            statusCode
        }
    }

export const VENEXVORA_SELF_HEALING_FEATURES =
    Object.freeze({
        boundedRecovery: true,
        staleRuntimeDetection: true,
        cooldownGuard: true,
        circuitBreaker: true,
        fatalDisconnectGuard: true,
        lockLossGuard: true,
        noReconnectLoop: true,
        noInternalTimer: true,
        noSessionMutation: true,
        externalRecoveryHook: true,
        statistics: true
    })

export class VenexvoraSelfHealingSupervisor {
    constructor(
        options = {}
    ) {
        this.staleMs =
            normalizeInteger(
                options.staleMs,
                DEFAULT_STALE_MS,
                1
            )

        this.cooldownMs =
            normalizeInteger(
                options.cooldownMs,
                DEFAULT_COOLDOWN_MS,
                0
            )

        this.maxRecoveries =
            normalizeInteger(
                options.maxRecoveries,
                DEFAULT_MAX_RECOVERIES,
                1
            )

        this.windowMs =
            normalizeInteger(
                options.windowMs,
                DEFAULT_WINDOW_MS,
                1
            )

        this.recover =
            typeof options.recover ===
                'function'
                ? options.recover
                : null

        this.now =
            typeof options.now ===
                'function'
                ? options.now
                : () => Date.now()

        this.state =
            'IDLE'

        this.stateSince =
            this.now()

        this.lastHealthyAt =
            null

        this.lastRecoveryAt =
            null

        this.recoveryHistory =
            []

        this.recovering =
            false

        this.circuitOpen =
            false

        this.blockedReason =
            null

        this.stopped =
            false

        this.stats = {
            signals: 0,
            healthy: 0,
            transient: 0,
            fatal: 0,
            pending: 0,
            unknown: 0,
            staleDetections: 0,
            recoveryAttempts: 0,
            recovered: 0,
            recoveryErrors: 0,
            cooldownSkips: 0,
            busySkips: 0,
            circuitTrips: 0,
            blockedSkips: 0,
            stoppedSkips: 0
        }
    }

    _setState(
        state
    ) {
        if (
            this.state !== state
        ) {
            this.state =
                state

            this.stateSince =
                this.now()
        }

        return this.state
    }

    _pruneHistory() {
        const cutoff =
            this.now() -
            this.windowMs

        this.recoveryHistory =
            this.recoveryHistory
                .filter(
                    timestamp =>
                        timestamp >=
                        cutoff
                )
    }

    markHealthy(
        context = {}
    ) {
        const now =
            this.now()

        this._setState(
            'HEALTHY'
        )

        this.lastHealthyAt =
            now

        this.recoveryHistory =
            []

        this.lastRecoveryAt =
            null

        this.circuitOpen =
            false

        this.blockedReason =
            null

        this.stats.healthy +=
            1

        return {
            status: 'HEALTHY',
            state:
                this.state,
            at: now,
            context
        }
    }

    markState(
        state
    ) {
        const normalized =
            normalizeSignalName(
                state
            ) || 'UNKNOWN'

        this._setState(
            normalized
        )

        return this.state
    }

    async requestRecovery(
        reason,
        context = {}
    ) {
        const now =
            this.now()

        if (
            this.stopped
        ) {
            this.stats.stoppedSkips +=
                1

            return {
                status: 'SKIPPED',
                reason: 'STOPPED'
            }
        }

        if (
            this.circuitOpen
        ) {
            this.stats.blockedSkips +=
                1

            return {
                status:
                    'CIRCUIT_OPEN',
                reason:
                    this.blockedReason ??
                    'CIRCUIT_OPEN'
            }
        }

        if (
            this.recovering
        ) {
            this.stats.busySkips +=
                1

            return {
                status: 'SKIPPED',
                reason:
                    'RECOVERY_BUSY'
            }
        }

        if (
            this.lastRecoveryAt !==
                null &&
            now -
                this.lastRecoveryAt <
                this.cooldownMs
        ) {
            this.stats.cooldownSkips +=
                1

            return {
                status: 'SKIPPED',
                reason:
                    'RECOVERY_COOLDOWN'
            }
        }

        this._pruneHistory()

        if (
            this.recoveryHistory
                .length >=
            this.maxRecoveries
        ) {
            this.circuitOpen =
                true

            this.blockedReason =
                'RECOVERY_EXHAUSTED'

            this._setState(
                'CIRCUIT_OPEN'
            )

            this.stats.circuitTrips +=
                1

            return {
                status:
                    'CIRCUIT_OPEN',
                reason:
                    'RECOVERY_EXHAUSTED'
            }
        }

        if (!this.recover) {
            return {
                status: 'SKIPPED',
                reason:
                    'NO_RECOVERY_HANDLER'
            }
        }

        this.recovering =
            true

        this.lastRecoveryAt =
            now

        this.recoveryHistory.push(
            now
        )

        this.stats.recoveryAttempts +=
            1

        this._setState(
            'RECOVERING'
        )

        try {
            const result =
                await this.recover({
                    reason,
                    context,
                    attempt:
                        this.recoveryHistory
                            .length,
                    supervisor:
                        this
                })

            this.stats.recovered +=
                1

            if (
                this.circuitOpen === false &&
                this.stopped === false
            ) {
                this._setState(
                    'RECOVERY_REQUESTED'
                )
            }

            return {
                status:
                    'RECOVERY_REQUESTED',
                reason,
                result
            }
        }
        catch (error) {
            this.stats.recoveryErrors +=
                1

            this._setState(
                'RECOVERY_ERROR'
            )

            return {
                status:
                    'RECOVERY_ERROR',
                reason,
                error
            }
        }
        finally {
            this.recovering =
                false
        }
    }

    async handle(
        input = {}
    ) {
        this.stats.signals +=
            1

        const classification =
            classifyVenexvoraHealingSignal(
                input
            )

        switch (
            classification.kind
        ) {
            case 'HEALTHY':
                return this.markHealthy(
                    input
                )

            case 'PENDING':
                this.stats.pending +=
                    1

                this._setState(
                    classification.name ||
                    'CONNECTING'
                )

                return {
                    status: 'OBSERVED',
                    classification
                }

            case 'TRANSIENT':
                this.stats.transient +=
                    1

                return this.requestRecovery(
                    classification.name ||
                    `DISCONNECT_${classification.statusCode}`,
                    {
                        input,
                        classification
                    }
                )

            case 'FATAL':
                this.stats.fatal +=
                    1

                this.circuitOpen =
                    true

                this.blockedReason =
                    classification.name ||
                    `FATAL_${classification.statusCode}`

                this._setState(
                    'FATAL'
                )

                return {
                    status: 'BLOCKED',
                    reason:
                        this.blockedReason,
                    classification
                }

            case 'STOP':
                return this.stop(
                    classification.name
                )

            default:
                this.stats.unknown +=
                    1

                return {
                    status: 'IGNORED',
                    classification
                }
        }
    }

    async check(
        context = {}
    ) {
        if (
            this.stopped
        ) {
            this.stats.stoppedSkips +=
                1

            return {
                status: 'SKIPPED',
                reason: 'STOPPED'
            }
        }

        if (
            this.circuitOpen
        ) {
            return {
                status:
                    'CIRCUIT_OPEN',
                reason:
                    this.blockedReason
            }
        }

        const staleStates =
            new Set([
                'STARTING',
                'CONNECTING',
                'RECONNECTING',
                'RECOVERING'
            ])

        if (
            !staleStates.has(
                this.state
            )
        ) {
            return {
                status: 'HEALTHY_ENOUGH',
                state:
                    this.state
            }
        }

        const age =
            this.now() -
            this.stateSince

        if (
            age < this.staleMs
        ) {
            return {
                status: 'PENDING',
                state:
                    this.state,
                age
            }
        }

        this.stats.staleDetections +=
            1

        return this.requestRecovery(
            'STALE_RUNTIME',
            {
                ...context,
                state:
                    this.state,
                age
            }
        )
    }

    resetCircuit() {
        this.stopped =
            false

        this.recovering =
            false

        this.circuitOpen =
            false

        this.blockedReason =
            null

        this.recoveryHistory =
            []

        this.lastRecoveryAt =
            null

        this._setState(
            'IDLE'
        )

        return true
    }

    stop(
        reason = 'STOPPED'
    ) {
        this.stopped =
            true

        this.recovering =
            false

        this.circuitOpen =
            true

        this.blockedReason =
            normalizeSignalName(
                reason
            ) || 'STOPPED'

        this._setState(
            'STOPPED'
        )

        return {
            status: 'STOPPED',
            reason:
                this.blockedReason
        }
    }

    getStatus() {
        this._pruneHistory()

        return {
            state:
                this.state,
            stateSince:
                this.stateSince,
            lastHealthyAt:
                this.lastHealthyAt,
            lastRecoveryAt:
                this.lastRecoveryAt,
            recoveryCount:
                this.recoveryHistory
                    .length,
            recovering:
                this.recovering,
            circuitOpen:
                this.circuitOpen,
            blockedReason:
                this.blockedReason,
            stopped:
                this.stopped
        }
    }

    getStats() {
        return {
            ...this.stats
        }
    }
}

export const createVenexvoraSelfHealingSupervisor =
    options =>
        new VenexvoraSelfHealingSupervisor(
            options
        )

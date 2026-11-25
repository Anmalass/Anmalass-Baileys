const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_INTERVAL_MS = 200

const normalizeInteger =
    (
        value,
        fallback,
        minimum = 0
    ) => {
        const number =
            Number(value)

        if (!Number.isFinite(number)) {
            return fallback
        }

        return Math.max(
            minimum,
            Math.floor(number)
        )
    }

const createAbortError =
    (signal) => {
        if (
            signal?.reason instanceof Error
        ) {
            return signal.reason
        }

        const error =
            new Error(
                'Verification aborted'
            )

        error.name =
            'AbortError'

        return error
    }

const sleep =
    async (
        ms,
        signal
    ) => {
        if (
            signal?.aborted
        ) {
            throw createAbortError(
                signal
            )
        }

        if (ms <= 0) {
            return
        }

        if (!signal) {
            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        ms
                    )
            )

            return
        }

        await new Promise(
            (resolve, reject) => {
                let timer

                const cleanup =
                    () => {
                        if (timer) {
                            clearTimeout(
                                timer
                            )
                        }

                        signal
                            .removeEventListener(
                                'abort',
                                onAbort
                            )
                    }

                const onAbort =
                    () => {
                        cleanup()

                        reject(
                            createAbortError(
                                signal
                            )
                        )
                    }

                timer =
                    setTimeout(
                        () => {
                            cleanup()
                            resolve()
                        },
                        ms
                    )

                signal
                    .addEventListener(
                        'abort',
                        onAbort,
                        {
                            once: true
                        }
                    )
            }
        )
    }

export class VenexvoraVerificationError
    extends Error {
    constructor(
        message,
        result
    ) {
        super(message)

        this.name =
            'VenexvoraVerificationError'

        this.result =
            result

        this.code =
            'VENEXVORA_ACTION_VERIFICATION_FAILED'
    }
}

export const VENEXVORA_ACTION_VERIFIER_FEATURES =
    Object.freeze({
        boundedPolling: true,
        eventualConsistencySupport: true,
        customPredicate: true,
        beforeAttemptHook: true,
        attemptHook: true,
        abortSignal: true,
        assertMode: true,
        statistics: true,
        noExternalDependency: true
    })

export class VenexvoraActionVerifier {
    constructor(
        defaults = {}
    ) {
        this.defaults = {
            maxAttempts:
                normalizeInteger(
                    defaults.maxAttempts,
                    DEFAULT_MAX_ATTEMPTS,
                    1
                ),

            intervalMs:
                normalizeInteger(
                    defaults.intervalMs,
                    DEFAULT_INTERVAL_MS,
                    0
                )
        }

        this.stats = {
            verifications: 0,
            verified: 0,
            failed: 0,
            attempts: 0,
            aborted: 0,
            fetchErrors: 0
        }
    }

    async verify(
        fetchActual,
        isVerified,
        options = {}
    ) {
        if (
            typeof fetchActual !==
            'function'
        ) {
            throw new TypeError(
                'Verification fetchActual must be a function'
            )
        }

        if (
            typeof isVerified !==
            'function'
        ) {
            throw new TypeError(
                'Verification predicate must be a function'
            )
        }

        const maxAttempts =
            normalizeInteger(
                options.maxAttempts,
                this.defaults.maxAttempts,
                1
            )

        const intervalMs =
            normalizeInteger(
                options.intervalMs,
                this.defaults.intervalMs,
                0
            )

        const signal =
            options.signal

        const startedAt =
            Date.now()

        this.stats.verifications++

        let lastActual
        let lastError = null

        for (
            let attempt = 1;
            attempt <= maxAttempts;
            attempt++
        ) {
            if (
                signal?.aborted
            ) {
                this.stats.aborted++

                throw createAbortError(
                    signal
                )
            }

            this.stats.attempts++

            if (
                typeof options.beforeAttempt ===
                'function'
            ) {
                await options.beforeAttempt({
                    attempt,
                    maxAttempts,
                    signal
                })
            }

            try {
                lastActual =
                    await fetchActual({
                        attempt,
                        maxAttempts,
                        signal
                    })

                lastError = null
            }
            catch (error) {
                this.stats.fetchErrors++
                lastError = error

                if (
                    options.continueOnFetchError !==
                    true
                ) {
                    throw error
                }
            }

            let verified = false

            if (!lastError) {
                verified =
                    Boolean(
                        await isVerified(
                            lastActual,
                            {
                                attempt,
                                maxAttempts,
                                signal
                            }
                        )
                    )
            }

            if (
                typeof options.onAttempt ===
                'function'
            ) {
                await options.onAttempt({
                    attempt,
                    maxAttempts,
                    verified,
                    actual:
                        lastActual,
                    error:
                        lastError,
                    signal
                })
            }

            if (verified) {
                const result = {
                    verified: true,
                    attempts:
                        attempt,
                    actual:
                        lastActual,
                    error: null,
                    elapsedMs:
                        Date.now() -
                        startedAt
                }

                this.stats.verified++

                return result
            }

            if (
                attempt <
                maxAttempts
            ) {
                await sleep(
                    intervalMs,
                    signal
                )
            }
        }

        const result = {
            verified: false,
            attempts:
                maxAttempts,
            actual:
                lastActual,
            error:
                lastError,
            elapsedMs:
                Date.now() -
                startedAt
        }

        this.stats.failed++

        return result
    }

    async assert(
        fetchActual,
        isVerified,
        options = {}
    ) {
        const result =
            await this.verify(
                fetchActual,
                isVerified,
                options
            )

        if (!result.verified) {
            throw new VenexvoraVerificationError(
                options.message ??
                'Action verification failed',
                result
            )
        }

        return result
    }

    getStats() {
        return {
            ...this.stats
        }
    }

    resetStats() {
        for (
            const key of
            Object.keys(this.stats)
        ) {
            this.stats[key] = 0
        }

        return true
    }
}

export const createVenexvoraActionVerifier =
    (options = {}) =>
        new VenexvoraActionVerifier(
            options
        )

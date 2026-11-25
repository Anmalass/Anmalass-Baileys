const DEFAULT_MAX_ATTEMPTS = 4
const DEFAULT_BASE_DELAY_MS = 250
const DEFAULT_MAX_DELAY_MS = 4000
const DEFAULT_JITTER_RATIO = 0.20

const RETRYABLE_STATUS_CODES =
    new Set([
        408,
        429,
        500,
        502,
        503,
        504
    ])

const RETRYABLE_ERROR_CODES =
    new Set([
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'EPIPE',
        'ENETRESET',
        'ENETUNREACH',
        'EHOSTUNREACH',
        'EAI_AGAIN',
        'UND_ERR_CONNECT_TIMEOUT',
        'UND_ERR_HEADERS_TIMEOUT',
        'UND_ERR_BODY_TIMEOUT',
        'UND_ERR_SOCKET',
        'ERR_STREAM_PREMATURE_CLOSE'
    ])

const NON_RETRYABLE_MESSAGE_PATTERNS = [
    /invalid\s+jid/i,
    /bad\s+request/i,
    /forbidden/i,
    /not\s+admin/i,
    /not\s+an?\s+admin/i,
    /unauthorized/i,
    /permission\s+denied/i,
    /access\s+denied/i,
    /authentication\s+failed/i,
    /invalid\s+credentials/i,
    /logged\s+out/i,
    /invalid\s+argument/i,
    /invalid\s+participant/i,
    /participant\s+not\s+found/i
]

const RETRYABLE_MESSAGE_PATTERNS = [
    /timed?\s*out/i,
    /timeout/i,
    /connection\s+reset/i,
    /connection\s+closed/i,
    /connection\s+terminated/i,
    /socket\s+hang\s+up/i,
    /temporar(?:y|ily)\s+unavailable/i,
    /service\s+unavailable/i,
    /network\s+error/i,
    /network\s+unreachable/i,
    /try\s+again/i
]

const sleep =
    (ms) =>
        new Promise(resolve =>
            setTimeout(resolve, ms)
        )

const normalizeInteger =
    (
        value,
        fallback,
        minimum = 1
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

const normalizeRatio =
    (value, fallback) => {
        const number =
            Number(value)

        if (
            !Number.isFinite(number)
        ) {
            return fallback
        }

        return Math.min(
            1,
            Math.max(
                0,
                number
            )
        )
    }

const extractStatusCode =
    (error) => {
        const raw =
            error?.status ??
            error?.statusCode ??
            error?.response?.status ??
            error?.output?.statusCode

        const status =
            Number(raw)

        return Number.isInteger(status)
            ? status
            : null
    }

const extractErrorCode =
    (error) => {
        const value =
            error?.code ??
            error?.cause?.code

        if (
            value === undefined ||
            value === null
        ) {
            return null
        }

        return String(value)
            .trim()
            .toUpperCase() || null
    }

const extractErrorMessage =
    (error) =>
        String(
            error?.message ??
            error?.cause?.message ??
            error ??
            ''
        )

const createAbortError =
    (signal) => {
        if (
            signal?.reason instanceof Error
        ) {
            return signal.reason
        }

        const error =
            new Error(
                'Operation aborted'
            )

        error.name =
            'AbortError'

        return error
    }

const waitWithSignal =
    async (
        delayMs,
        signal
    ) => {
        if (
            signal?.aborted
        ) {
            throw createAbortError(
                signal
            )
        }

        if (!signal) {
            await sleep(delayMs)
            return
        }

        await new Promise(
            (resolve, reject) => {
                let timer = null

                const cleanup =
                    () => {
                        if (timer) {
                            clearTimeout(timer)
                        }

                        signal.removeEventListener(
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
                        delayMs
                    )

                signal.addEventListener(
                    'abort',
                    onAbort,
                    {
                        once: true
                    }
                )
            }
        )
    }

export const VENEXVORA_SMART_RETRY_FEATURES =
    Object.freeze({
        boundedRetry: true,
        exponentialBackoff: true,
        jitter: true,
        retryClassification: true,
        abortSignal: true,
        customPredicate: true,
        retryHook: true,
        statistics: true,
        noExternalDependency: true
    })

export const classifyVenexvoraRetryError =
    (error) => {
        const status =
            extractStatusCode(error)

        const code =
            extractErrorCode(error)

        const message =
            extractErrorMessage(error)

        if (
            error?.name ===
                'AbortError' ||
            error?.code ===
                'ABORT_ERR'
        ) {
            return {
                retryable: false,
                reason:
                    'operation-aborted',
                status,
                code,
                message
            }
        }

        if (
            NON_RETRYABLE_MESSAGE_PATTERNS
                .some(pattern =>
                    pattern.test(message)
                )
        ) {
            return {
                retryable: false,
                reason:
                    'non-retryable-message',
                status,
                code,
                message
            }
        }

        if (
            status !== null &&
            RETRYABLE_STATUS_CODES
                .has(status)
        ) {
            return {
                retryable: true,
                reason:
                    `retryable-status-${status}`,
                status,
                code,
                message
            }
        }

        if (
            status !== null &&
            status >= 400 &&
            status < 500
        ) {
            return {
                retryable: false,
                reason:
                    `client-status-${status}`,
                status,
                code,
                message
            }
        }

        if (
            code &&
            RETRYABLE_ERROR_CODES
                .has(code)
        ) {
            return {
                retryable: true,
                reason:
                    `retryable-code-${code}`,
                status,
                code,
                message
            }
        }

        if (
            RETRYABLE_MESSAGE_PATTERNS
                .some(pattern =>
                    pattern.test(message)
                )
        ) {
            return {
                retryable: true,
                reason:
                    'retryable-message',
                status,
                code,
                message
            }
        }

        return {
            retryable: false,
            reason:
                'unknown-non-retryable',
            status,
            code,
            message
        }
    }

export const computeVenexvoraRetryDelay =
    (
        retryNumber,
        options = {}
    ) => {
        const baseDelayMs =
            normalizeInteger(
                options.baseDelayMs,
                DEFAULT_BASE_DELAY_MS,
                0
            )

        const maxDelayMs =
            normalizeInteger(
                options.maxDelayMs,
                DEFAULT_MAX_DELAY_MS,
                0
            )

        const jitterRatio =
            normalizeRatio(
                options.jitterRatio,
                DEFAULT_JITTER_RATIO
            )

        const exponent =
            Math.max(
                0,
                Number(retryNumber) - 1
            )

        const rawDelay =
            Math.min(
                maxDelayMs,
                baseDelayMs *
                    (2 ** exponent)
            )

        if (
            jitterRatio === 0 ||
            rawDelay === 0
        ) {
            return Math.round(
                rawDelay
            )
        }

        const jitterRange =
            rawDelay *
            jitterRatio

        const jitter =
            (
                Math.random() * 2 - 1
            ) *
            jitterRange

        return Math.max(
            0,
            Math.round(
                rawDelay + jitter
            )
        )
    }

export class VenexvoraSmartRetry {
    constructor(
        defaults = {}
    ) {
        this.defaults = {
            maxAttempts:
                normalizeInteger(
                    defaults.maxAttempts,
                    DEFAULT_MAX_ATTEMPTS
                ),
            baseDelayMs:
                normalizeInteger(
                    defaults.baseDelayMs,
                    DEFAULT_BASE_DELAY_MS,
                    0
                ),
            maxDelayMs:
                normalizeInteger(
                    defaults.maxDelayMs,
                    DEFAULT_MAX_DELAY_MS,
                    0
                ),
            jitterRatio:
                normalizeRatio(
                    defaults.jitterRatio,
                    DEFAULT_JITTER_RATIO
                )
        }

        this.stats = {
            runs: 0,
            attempts: 0,
            retries: 0,
            succeeded: 0,
            failed: 0,
            exhausted: 0,
            nonRetryable: 0,
            aborted: 0
        }
    }

    async run(
        factory,
        options = {}
    ) {
        if (
            typeof factory !==
            'function'
        ) {
            throw new TypeError(
                'Retry factory must be a function'
            )
        }

        const maxAttempts =
            normalizeInteger(
                options.maxAttempts,
                this.defaults.maxAttempts
            )

        const baseDelayMs =
            normalizeInteger(
                options.baseDelayMs,
                this.defaults.baseDelayMs,
                0
            )

        const maxDelayMs =
            normalizeInteger(
                options.maxDelayMs,
                this.defaults.maxDelayMs,
                0
            )

        const jitterRatio =
            normalizeRatio(
                options.jitterRatio,
                this.defaults.jitterRatio
            )

        const signal =
            options.signal

        this.stats.runs++

        for (
            let attempt = 1;
            attempt <= maxAttempts;
            attempt++
        ) {
            if (
                signal?.aborted
            ) {
                this.stats.failed++
                this.stats.aborted++

                throw createAbortError(
                    signal
                )
            }

            this.stats.attempts++

            try {
                const result =
                    await factory({
                        attempt,
                        maxAttempts,
                        signal
                    })

                this.stats.succeeded++

                return result
            }
            catch (error) {
                if (
                    signal?.aborted ||
                    error?.name ===
                        'AbortError'
                ) {
                    this.stats.failed++
                    this.stats.aborted++

                    throw error
                }

                const classification =
                    classifyVenexvoraRetryError(
                        error
                    )

                let retryable =
                    classification.retryable

                if (
                    typeof options.shouldRetry ===
                    'function'
                ) {
                    retryable =
                        Boolean(
                            await options
                                .shouldRetry(
                                    error,
                                    {
                                        attempt,
                                        maxAttempts,
                                        classification
                                    }
                                )
                        )
                }

                const hasMoreAttempts =
                    attempt <
                    maxAttempts

                if (
                    !retryable ||
                    !hasMoreAttempts
                ) {
                    this.stats.failed++

                    if (!retryable) {
                        this.stats
                            .nonRetryable++
                    }
                    else {
                        this.stats
                            .exhausted++
                    }

                    throw error
                }

                const retryNumber =
                    attempt

                const delayMs =
                    computeVenexvoraRetryDelay(
                        retryNumber,
                        {
                            baseDelayMs,
                            maxDelayMs,
                            jitterRatio
                        }
                    )

                this.stats.retries++

                if (
                    typeof options.onRetry ===
                    'function'
                ) {
                    await options.onRetry(
                        {
                            error,
                            attempt,
                            nextAttempt:
                                attempt + 1,
                            maxAttempts,
                            retryNumber,
                            delayMs,
                            classification
                        }
                    )
                }

                await waitWithSignal(
                    delayMs,
                    signal
                )
            }
        }

        throw new Error(
            'VenexvoraSmartRetry reached an unreachable state'
        )
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

export const createVenexvoraSmartRetry =
    (options = {}) =>
        new VenexvoraSmartRetry(
            options
        )

export const withVenexvoraSmartRetry =
    (
        factory,
        options = {}
    ) =>
        createVenexvoraSmartRetry(
            options
        ).run(
            factory,
            options
        )

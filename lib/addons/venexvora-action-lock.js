const validateKey = (key) => {
    if (
        typeof key !== 'string' ||
        key.trim().length === 0
    ) {
        throw new TypeError(
            'Action lock key must be a non-empty string'
        )
    }

    return key.trim()
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
                'Action aborted'
            )

        error.name =
            'AbortError'

        return error
    }

export const VENEXVORA_ACTION_LOCK_FEATURES =
    Object.freeze({
        perKeySerialization: true,
        fifoQueue: true,
        parallelDifferentKeys: true,
        failureSafeRelease: true,
        abortSignal: true,
        statistics: true,
        automaticCleanup: true,
        noExternalDependency: true
    })

export class VenexvoraActionLock {
    constructor() {
        this.locks =
            new Map()

        this.stats = {
            requests: 0,
            acquired: 0,
            queued: 0,
            resolved: 0,
            rejected: 0,
            aborted: 0,
            maxQueueDepth: 0
        }
    }

    run(
        key,
        factory,
        options = {}
    ) {
        key =
            validateKey(key)

        if (
            typeof factory !==
            'function'
        ) {
            throw new TypeError(
                'Action factory must be a function'
            )
        }

        const signal =
            options.signal

        this.stats.requests++

        let state =
            this.locks.get(key)

        if (!state) {
            state = {
                key,
                tail:
                    Promise.resolve(),
                pending: 0,
                active: false
            }

            this.locks.set(
                key,
                state
            )
        }

        if (
            state.pending > 0
        ) {
            this.stats.queued++
        }

        state.pending++

        this.stats.maxQueueDepth =
            Math.max(
                this.stats.maxQueueDepth,
                state.pending
            )

        const previous =
            state.tail.catch(
                () => undefined
            )

        const current =
            previous.then(
                async () => {
                    if (
                        signal?.aborted
                    ) {
                        this.stats.aborted++

                        throw createAbortError(
                            signal
                        )
                    }

                    state.active = true
                    this.stats.acquired++

                    if (
                        typeof options.onAcquire ===
                        'function'
                    ) {
                        await options.onAcquire({
                            key,
                            pending:
                                state.pending,
                            signal
                        })
                    }

                    try {
                        const result =
                            await factory({
                                key,
                                signal
                            })

                        this.stats.resolved++

                        return result
                    }
                    catch (error) {
                        if (
                            signal?.aborted ||
                            error?.name ===
                                'AbortError'
                        ) {
                            this.stats.aborted++
                        }

                        this.stats.rejected++

                        throw error
                    }
                    finally {
                        state.active = false

                        if (
                            typeof options.onRelease ===
                            'function'
                        ) {
                            await options.onRelease({
                                key,
                                pending:
                                    state.pending,
                                signal
                            })
                        }
                    }
                }
            )

        state.tail =
            current.catch(
                () => undefined
            )

        current.finally(
            () => {
                state.pending =
                    Math.max(
                        0,
                        state.pending - 1
                    )

                if (
                    state.pending === 0 &&
                    this.locks.get(key) ===
                        state
                ) {
                    this.locks.delete(
                        key
                    )
                }
            }
        ).catch(
            () => undefined
        )

        return current
    }

    isLocked(key) {
        key =
            validateKey(key)

        const state =
            this.locks.get(key)

        return Boolean(
            state &&
            state.pending > 0
        )
    }

    isActive(key) {
        key =
            validateKey(key)

        return Boolean(
            this.locks.get(key)
                ?.active
        )
    }

    getPending(key) {
        key =
            validateKey(key)

        return (
            this.locks.get(key)
                ?.pending ??
            0
        )
    }

    get size() {
        return this.locks.size
    }

    getKeys() {
        return [
            ...this.locks.keys()
        ]
    }

    getStats() {
        let pending = 0
        let active = 0

        for (
            const state of
            this.locks.values()
        ) {
            pending +=
                state.pending

            if (state.active) {
                active++
            }
        }

        return {
            ...this.stats,
            lockKeys:
                this.locks.size,
            pending,
            active
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

    wrap(
        keyFactory,
        factory
    ) {
        if (
            typeof keyFactory !==
                'function' ||
            typeof factory !==
                'function'
        ) {
            throw new TypeError(
                'keyFactory and factory must be functions'
            )
        }

        return (...args) => {
            const key =
                keyFactory(...args)

            return this.run(
                key,
                () =>
                    factory(...args)
            )
        }
    }
}

export const createVenexvoraActionLock =
    () =>
        new VenexvoraActionLock()

const validateKey = key => {
    if (
        typeof key !== 'string' ||
        key.trim().length === 0
    ) {
        throw new TypeError(
            'Request dedup key must be a non-empty string'
        )
    }

    return key
}

export const VENEXVORA_REQUEST_DEDUP_FEATURES =
    Object.freeze({
        inflightDedup: true,
        sharedPromise: true,
        automaticCleanup: true,
        retryAfterFailure: true,
        statistics: true,
        manualForget: true,
        noExternalDependency: true
    })

export class VenexvoraRequestDeduper {
    constructor() {
        this.inflight = new Map()

        this.stats = {
            requests: 0,
            executed: 0,
            deduplicated: 0,
            resolved: 0,
            rejected: 0,
            forgotten: 0,
            clears: 0
        }
    }

    run(key, factory) {
        key = validateKey(key)

        if (
            typeof factory !==
            'function'
        ) {
            throw new TypeError(
                'Request factory must be a function'
            )
        }

        this.stats.requests++

        const existing =
            this.inflight.get(key)

        if (existing) {
            this.stats.deduplicated++

            return existing
        }

        this.stats.executed++

        let promise

        promise =
            Promise.resolve()
                .then(() => factory())
                .then(
                    result => {
                        this.stats.resolved++

                        return result
                    },
                    error => {
                        this.stats.rejected++

                        throw error
                    }
                )
                .finally(() => {
                    if (
                        this.inflight.get(key) ===
                        promise
                    ) {
                        this.inflight.delete(key)
                    }
                })

        this.inflight.set(
            key,
            promise
        )

        return promise
    }

    has(key) {
        key = validateKey(key)

        return this.inflight.has(key)
    }

    get(key) {
        key = validateKey(key)

        return (
            this.inflight.get(key) ??
            null
        )
    }

    forget(key) {
        key = validateKey(key)

        const removed =
            this.inflight.delete(key)

        if (removed) {
            this.stats.forgotten++
        }

        return removed
    }

    clear() {
        const count =
            this.inflight.size

        this.inflight.clear()

        this.stats.clears++

        return count
    }

    get size() {
        return this.inflight.size
    }

    getKeys() {
        return [
            ...this.inflight.keys()
        ]
    }

    getStats() {
        return {
            ...this.stats,
            inflight:
                this.inflight.size
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

    wrap(keyFactory, factory) {
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
                () => factory(...args)
            )
        }
    }
}

export const createVenexvoraRequestDeduper =
    () =>
        new VenexvoraRequestDeduper()

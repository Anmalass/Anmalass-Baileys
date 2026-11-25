import {
    createVenexvoraSmartCache
} from './venexvora-smart-cache.js'

import {
    createVenexvoraRequestDeduper
} from './venexvora-request-deduper.js'

const validateKey = key => {
    if (
        typeof key !== 'string' ||
        key.trim().length === 0
    ) {
        throw new TypeError(
            'Optimizer key must be a non-empty string'
        )
    }

    return key
}

export const VENEXVORA_REQUEST_OPTIMIZER_FEATURES =
    Object.freeze({
        smartCache: true,
        requestDedup: true,
        cacheFirst: true,
        doubleCheckCache: true,
        forceRefresh: true,
        invalidation: true,
        statistics: true,
        noExternalDependency: true
    })

export class VenexvoraRequestOptimizer {
    constructor(options = {}) {
        this.cache =
            options.cache ??
            createVenexvoraSmartCache({
                ttlMs:
                    options.ttlMs ??
                    30_000,

                maxEntries:
                    options.maxEntries ??
                    500,

                cleanupIntervalMs:
                    options.cleanupIntervalMs ??
                    60_000
            })

        this.deduper =
            options.deduper ??
            createVenexvoraRequestDeduper()

        this.stats = {
            calls: 0,
            cacheHits: 0,
            cacheMisses: 0,
            networkExecutions: 0,
            forceRefreshes: 0
        }
    }

    async getOrCreate(
        key,
        factory,
        options = {}
    ) {
        key = validateKey(key)

        if (
            typeof factory !==
            'function'
        ) {
            throw new TypeError(
                'Optimizer factory must be a function'
            )
        }

        this.stats.calls++

        const forceRefresh =
            options.forceRefresh === true

        if (forceRefresh) {
            this.stats.forceRefreshes++
        }

        if (
            !forceRefresh &&
            this.cache.has(key)
        ) {
            this.stats.cacheHits++

            return this.cache.get(key)
        }

        this.stats.cacheMisses++

        return this.deduper.run(
            key,
            async () => {
                if (
                    !forceRefresh &&
                    this.cache.has(key)
                ) {
                    return this.cache.get(key)
                }

                this.stats.networkExecutions++

                const result =
                    await factory()

                this.cache.set(
                    key,
                    result,
                    {
                        ttlMs:
                            options.ttlMs
                    }
                )

                return result
            }
        )
    }

    has(key) {
        return this.cache.has(
            validateKey(key)
        )
    }

    get(key) {
        key = validateKey(key)

        if (!this.cache.has(key)) {
            return undefined
        }

        return this.cache.get(key)
    }

    invalidate(key) {
        return this.cache.delete(
            validateKey(key)
        )
    }

    clear() {
        const cached =
            this.cache.clear()

        const inflight =
            this.deduper.clear()

        return {
            cached,
            inflight
        }
    }

    getStats() {
        return {
            ...this.stats,

            cache:
                this.cache.getStats(),

            dedup:
                this.deduper.getStats()
        }
    }

    resetStats() {
        for (
            const key of
            Object.keys(this.stats)
        ) {
            this.stats[key] = 0
        }

        this.cache.resetStats()
        this.deduper.resetStats()

        return true
    }

    close() {
        this.cache.close()

        return true
    }
}

export const createVenexvoraRequestOptimizer =
    options =>
        new VenexvoraRequestOptimizer(
            options
        )

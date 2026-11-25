const now = () => Date.now()

const numberOption = (value, fallback, name, min = 0) => {
    const result = value ?? fallback

    if (
        typeof result !== 'number' ||
        !Number.isFinite(result) ||
        result < min
    ) {
        throw new TypeError(
            `${name} must be a finite number >= ${min}`
        )
    }

    return result
}

export const VENEXVORA_SMART_CACHE_FEATURES =
    Object.freeze({
        ttl: true,
        maxEntries: true,
        lruEviction: true,
        lazyExpiration: true,
        backgroundCleanup: true,
        perEntryTtl: true,
        statistics: true,
        noExternalDependency: true
    })

export class VenexvoraSmartCache {
    constructor(options = {}) {
        this.ttlMs = numberOption(
            options.ttlMs,
            30_000,
            'ttlMs'
        )

        this.maxEntries = numberOption(
            options.maxEntries,
            500,
            'maxEntries',
            1
        )

        this.cleanupIntervalMs = numberOption(
            options.cleanupIntervalMs,
            60_000,
            'cleanupIntervalMs'
        )

        this.store = new Map()

        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            expirations: 0,
            evictions: 0,
            clears: 0
        }

        this.cleanupTimer = null

        if (this.cleanupIntervalMs > 0) {
            this.cleanupTimer = setInterval(
                () => {
                    this.pruneExpired()
                },
                this.cleanupIntervalMs
            )

            this.cleanupTimer.unref?.()
        }
    }

    _isExpired(entry, time = now()) {
        return (
            entry.expiresAt !== null &&
            entry.expiresAt <= time
        )
    }

    _expiresAt(ttlMs) {
        if (ttlMs === 0) {
            return null
        }

        return now() + ttlMs
    }

    _touch(key, entry) {
        this.store.delete(key)
        this.store.set(key, entry)
    }

    _evictIfNeeded() {
        while (
            this.store.size >=
            this.maxEntries
        ) {
            const oldest =
                this.store.keys().next()

            if (oldest.done) {
                return
            }

            this.store.delete(
                oldest.value
            )

            this.stats.evictions++
        }
    }

    set(key, value, options = {}) {
        const ttlMs = numberOption(
            options.ttlMs,
            this.ttlMs,
            'ttlMs'
        )

        if (this.store.has(key)) {
            this.store.delete(key)
        }
        else {
            this._evictIfNeeded()
        }

        this.store.set(key, {
            value,
            createdAt: now(),
            expiresAt:
                this._expiresAt(ttlMs)
        })

        this.stats.sets++

        return value
    }

    get(key) {
        const entry =
            this.store.get(key)

        if (!entry) {
            this.stats.misses++
            return undefined
        }

        if (this._isExpired(entry)) {
            this.store.delete(key)
            this.stats.expirations++
            this.stats.misses++
            return undefined
        }

        this._touch(key, entry)

        this.stats.hits++

        return entry.value
    }

    peek(key) {
        const entry =
            this.store.get(key)

        if (!entry) {
            return undefined
        }

        if (this._isExpired(entry)) {
            this.store.delete(key)
            this.stats.expirations++
            return undefined
        }

        return entry.value
    }

    has(key) {
        const entry =
            this.store.get(key)

        if (!entry) {
            return false
        }

        if (this._isExpired(entry)) {
            this.store.delete(key)
            this.stats.expirations++
            return false
        }

        return true
    }

    delete(key) {
        const deleted =
            this.store.delete(key)

        if (deleted) {
            this.stats.deletes++
        }

        return deleted
    }

    clear() {
        const count =
            this.store.size

        this.store.clear()

        this.stats.clears++

        return count
    }

    pruneExpired() {
        const time = now()

        let removed = 0

        for (
            const [key, entry]
            of this.store
        ) {
            if (
                this._isExpired(
                    entry,
                    time
                )
            ) {
                this.store.delete(key)

                this.stats.expirations++

                removed++
            }
        }

        return removed
    }

    get size() {
        this.pruneExpired()

        return this.store.size
    }

    getStats() {
        return {
            ...this.stats,
            size: this.size,
            maxEntries:
                this.maxEntries,
            ttlMs:
                this.ttlMs
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

    close() {
        if (this.cleanupTimer) {
            clearInterval(
                this.cleanupTimer
            )

            this.cleanupTimer =
                null
        }

        return true
    }
}

export const createVenexvoraSmartCache =
    options =>
        new VenexvoraSmartCache(options)

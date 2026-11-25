export declare const VENEXVORA_SMART_CACHE_FEATURES: Readonly<{
    ttl: true;
    maxEntries: true;
    lruEviction: true;
    lazyExpiration: true;
    backgroundCleanup: true;
    perEntryTtl: true;
    statistics: true;
    noExternalDependency: true;
}>;

export declare class VenexvoraSmartCache<K = any, V = any> {
    constructor(options?: {
        ttlMs?: number;
        maxEntries?: number;
        cleanupIntervalMs?: number;
    });

    ttlMs: number;
    maxEntries: number;

    set(
        key: K,
        value: V,
        options?: {
            ttlMs?: number;
        }
    ): V;

    get(key: K): V | undefined;

    peek(key: K): V | undefined;

    has(key: K): boolean;

    delete(key: K): boolean;

    clear(): number;

    pruneExpired(): number;

    readonly size: number;

    getStats(): {
        hits: number;
        misses: number;
        sets: number;
        deletes: number;
        expirations: number;
        evictions: number;
        clears: number;
        size: number;
        maxEntries: number;
        ttlMs: number;
    };

    resetStats(): boolean;

    close(): boolean;
}

export declare const createVenexvoraSmartCache:
    <K = any, V = any>(
        options?: {
            ttlMs?: number;
            maxEntries?: number;
            cleanupIntervalMs?: number;
        }
    ) => VenexvoraSmartCache<K, V>;

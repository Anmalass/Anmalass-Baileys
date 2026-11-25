export declare const VENEXVORA_REQUEST_OPTIMIZER_FEATURES: Readonly<{
    smartCache: true;
    requestDedup: true;
    cacheFirst: true;
    doubleCheckCache: true;
    forceRefresh: true;
    invalidation: true;
    statistics: true;
    noExternalDependency: true;
}>;

export declare class VenexvoraRequestOptimizer {
    constructor(options?: {
        ttlMs?: number;
        maxEntries?: number;
        cleanupIntervalMs?: number;
        cache?: any;
        deduper?: any;
    });

    cache: any;
    deduper: any;

    getOrCreate<T>(
        key: string,
        factory: () => Promise<T> | T,
        options?: {
            ttlMs?: number;
            forceRefresh?: boolean;
        }
    ): Promise<T>;

    has(key: string): boolean;

    get<T = any>(
        key: string
    ): T | undefined;

    invalidate(
        key: string
    ): boolean;

    clear(): {
        cached: number;
        inflight: number;
    };

    getStats(): any;

    resetStats(): boolean;

    close(): boolean;
}

export declare const createVenexvoraRequestOptimizer:
    (
        options?: any
    ) => VenexvoraRequestOptimizer;

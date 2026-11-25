export declare const VENEXVORA_REQUEST_DEDUP_FEATURES: Readonly<{
    inflightDedup: true;
    sharedPromise: true;
    automaticCleanup: true;
    retryAfterFailure: true;
    statistics: true;
    manualForget: true;
    noExternalDependency: true;
}>;

export declare class VenexvoraRequestDeduper {
    constructor();

    readonly size: number;

    run<T>(
        key: string,
        factory: () => Promise<T> | T
    ): Promise<T>;

    has(key: string): boolean;

    get<T = any>(
        key: string
    ): Promise<T> | null;

    forget(key: string): boolean;

    clear(): number;

    getKeys(): string[];

    getStats(): {
        requests: number;
        executed: number;
        deduplicated: number;
        resolved: number;
        rejected: number;
        forgotten: number;
        clears: number;
        inflight: number;
    };

    resetStats(): boolean;

    wrap<TArgs extends any[], TResult>(
        keyFactory:
            (...args: TArgs) => string,

        factory:
            (...args: TArgs) =>
                Promise<TResult> |
                TResult

    ): (
        ...args: TArgs
    ) => Promise<TResult>;
}

export declare const createVenexvoraRequestDeduper:
    () => VenexvoraRequestDeduper;

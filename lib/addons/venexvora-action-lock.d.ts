export interface VenexvoraActionLockContext {
    key: string;
    signal?: AbortSignal;
}

export interface VenexvoraActionLockOptions {
    signal?: AbortSignal;

    onAcquire?: (
        context: {
            key: string;
            pending: number;
            signal?: AbortSignal;
        }
    ) =>
        void |
        Promise<void>;

    onRelease?: (
        context: {
            key: string;
            pending: number;
            signal?: AbortSignal;
        }
    ) =>
        void |
        Promise<void>;
}

export declare const VENEXVORA_ACTION_LOCK_FEATURES:
    Readonly<{
        perKeySerialization: true;
        fifoQueue: true;
        parallelDifferentKeys: true;
        failureSafeRelease: true;
        abortSignal: true;
        statistics: true;
        automaticCleanup: true;
        noExternalDependency: true;
    }>;

export declare class VenexvoraActionLock {
    constructor();

    readonly size: number;

    run<T>(
        key: string,
        factory:
            (
                context:
                    VenexvoraActionLockContext
            ) =>
                Promise<T> | T,
        options?: VenexvoraActionLockOptions
    ): Promise<T>;

    isLocked(
        key: string
    ): boolean;

    isActive(
        key: string
    ): boolean;

    getPending(
        key: string
    ): number;

    getKeys():
        string[];

    getStats(): {
        requests: number;
        acquired: number;
        queued: number;
        resolved: number;
        rejected: number;
        aborted: number;
        maxQueueDepth: number;
        lockKeys: number;
        pending: number;
        active: number;
    };

    resetStats():
        boolean;

    wrap<
        TArgs extends any[],
        TResult
    >(
        keyFactory:
            (...args: TArgs) =>
                string,
        factory:
            (...args: TArgs) =>
                Promise<TResult> |
                TResult
    ): (
        ...args: TArgs
    ) => Promise<TResult>;
}

export declare const createVenexvoraActionLock:
    () => VenexvoraActionLock;

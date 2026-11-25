export interface VenexvoraRetryClassification {
    retryable: boolean;
    reason: string;
    status: number | null;
    code: string | null;
    message: string;
}

export interface VenexvoraSmartRetryOptions {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    jitterRatio?: number;
    signal?: AbortSignal;
    shouldRetry?: (
        error: any,
        context: {
            attempt: number;
            maxAttempts: number;
            classification:
                VenexvoraRetryClassification;
        }
    ) => boolean | Promise<boolean>;
    onRetry?: (
        context: {
            error: any;
            attempt: number;
            nextAttempt: number;
            maxAttempts: number;
            retryNumber: number;
            delayMs: number;
            classification:
                VenexvoraRetryClassification;
        }
    ) => void | Promise<void>;
}

export interface VenexvoraRetryFactoryContext {
    attempt: number;
    maxAttempts: number;
    signal?: AbortSignal;
}

export declare const VENEXVORA_SMART_RETRY_FEATURES:
    Readonly<{
        boundedRetry: true;
        exponentialBackoff: true;
        jitter: true;
        retryClassification: true;
        abortSignal: true;
        customPredicate: true;
        retryHook: true;
        statistics: true;
        noExternalDependency: true;
    }>;

export declare const classifyVenexvoraRetryError:
    (
        error: any
    ) => VenexvoraRetryClassification;

export declare const computeVenexvoraRetryDelay:
    (
        retryNumber: number,
        options?: {
            baseDelayMs?: number;
            maxDelayMs?: number;
            jitterRatio?: number;
        }
    ) => number;

export declare class VenexvoraSmartRetry {
    constructor(
        defaults?: VenexvoraSmartRetryOptions
    );

    defaults: {
        maxAttempts: number;
        baseDelayMs: number;
        maxDelayMs: number;
        jitterRatio: number;
    };

    run<T>(
        factory:
            (
                context:
                    VenexvoraRetryFactoryContext
            ) =>
                Promise<T> | T,
        options?: VenexvoraSmartRetryOptions
    ): Promise<T>;

    getStats(): {
        runs: number;
        attempts: number;
        retries: number;
        succeeded: number;
        failed: number;
        exhausted: number;
        nonRetryable: number;
        aborted: number;
    };

    resetStats(): boolean;
}

export declare const createVenexvoraSmartRetry:
    (
        options?: VenexvoraSmartRetryOptions
    ) => VenexvoraSmartRetry;

export declare const withVenexvoraSmartRetry:
    <T>(
        factory:
            (
                context:
                    VenexvoraRetryFactoryContext
            ) =>
                Promise<T> | T,
        options?: VenexvoraSmartRetryOptions
    ) => Promise<T>;

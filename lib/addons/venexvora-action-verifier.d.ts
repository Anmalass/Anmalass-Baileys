export interface VenexvoraVerificationContext {
    attempt: number;
    maxAttempts: number;
    signal?: AbortSignal;
}

export interface VenexvoraVerificationResult<T = any> {
    verified: boolean;
    attempts: number;
    actual: T | undefined;
    error: any;
    elapsedMs: number;
}

export interface VenexvoraActionVerifierOptions {
    maxAttempts?: number;
    intervalMs?: number;
    signal?: AbortSignal;

    continueOnFetchError?: boolean;

    message?: string;

    beforeAttempt?: (
        context:
            VenexvoraVerificationContext
    ) =>
        void |
        Promise<void>;

    onAttempt?: (
        context: {
            attempt: number;
            maxAttempts: number;
            verified: boolean;
            actual: any;
            error: any;
            signal?: AbortSignal;
        }
    ) =>
        void |
        Promise<void>;
}

export declare class VenexvoraVerificationError
    extends Error {
    constructor(
        message: string,
        result:
            VenexvoraVerificationResult
    );

    name:
        'VenexvoraVerificationError';

    code:
        'VENEXVORA_ACTION_VERIFICATION_FAILED';

    result:
        VenexvoraVerificationResult;
}

export declare const VENEXVORA_ACTION_VERIFIER_FEATURES:
    Readonly<{
        boundedPolling: true;
        eventualConsistencySupport: true;
        customPredicate: true;
        beforeAttemptHook: true;
        attemptHook: true;
        abortSignal: true;
        assertMode: true;
        statistics: true;
        noExternalDependency: true;
    }>;

export declare class VenexvoraActionVerifier {
    constructor(
        defaults?:
            VenexvoraActionVerifierOptions
    );

    defaults: {
        maxAttempts: number;
        intervalMs: number;
    };

    verify<T>(
        fetchActual:
            (
                context:
                    VenexvoraVerificationContext
            ) =>
                Promise<T> | T,

        isVerified:
            (
                actual: T,
                context:
                    VenexvoraVerificationContext
            ) =>
                boolean |
                Promise<boolean>,

        options?:
            VenexvoraActionVerifierOptions
    ):
        Promise<
            VenexvoraVerificationResult<T>
        >;

    assert<T>(
        fetchActual:
            (
                context:
                    VenexvoraVerificationContext
            ) =>
                Promise<T> | T,

        isVerified:
            (
                actual: T,
                context:
                    VenexvoraVerificationContext
            ) =>
                boolean |
                Promise<boolean>,

        options?:
            VenexvoraActionVerifierOptions
    ):
        Promise<
            VenexvoraVerificationResult<T>
        >;

    getStats(): {
        verifications: number;
        verified: number;
        failed: number;
        attempts: number;
        aborted: number;
        fetchErrors: number;
    };

    resetStats():
        boolean;
}

export declare const createVenexvoraActionVerifier:
    (
        options?:
            VenexvoraActionVerifierOptions
    ) => VenexvoraActionVerifier;

export interface VenexvoraSelfHealingClassification {
    kind:
        | 'STOP'
        | 'FATAL'
        | 'HEALTHY'
        | 'PENDING'
        | 'TRANSIENT'
        | 'UNKNOWN';
    name: string;
    statusCode?: number;
}

export interface VenexvoraSelfHealingOptions {
    staleMs?: number;
    cooldownMs?: number;
    maxRecoveries?: number;
    windowMs?: number;
    now?: () => number;
    recover?: (
        context: {
            reason: string;
            context: any;
            attempt: number;
            supervisor:
                VenexvoraSelfHealingSupervisor;
        }
    ) =>
        any |
        Promise<any>;
}

export declare const VENEXVORA_SELF_HEALING_FEATURES:
    Readonly<{
        boundedRecovery: true;
        staleRuntimeDetection: true;
        cooldownGuard: true;
        circuitBreaker: true;
        fatalDisconnectGuard: true;
        lockLossGuard: true;
        noReconnectLoop: true;
        noInternalTimer: true;
        noSessionMutation: true;
        externalRecoveryHook: true;
        statistics: true;
    }>;

export declare const classifyVenexvoraHealingSignal:
    (
        input: any
    ) =>
        VenexvoraSelfHealingClassification;

export declare class VenexvoraSelfHealingSupervisor {
    constructor(
        options?:
            VenexvoraSelfHealingOptions
    );

    staleMs: number;
    cooldownMs: number;
    maxRecoveries: number;
    windowMs: number;

    state: string;
    stateSince: number;

    lastHealthyAt:
        number |
        null;

    lastRecoveryAt:
        number |
        null;

    recovering: boolean;
    circuitOpen: boolean;

    blockedReason:
        string |
        null;

    stopped: boolean;

    markHealthy(
        context?: any
    ): any;

    markState(
        state: string
    ): string;

    requestRecovery(
        reason: string,
        context?: any
    ): Promise<any>;

    handle(
        input?: any
    ): Promise<any>;

    check(
        context?: any
    ): Promise<any>;

    resetCircuit(): boolean;

    stop(
        reason?: string
    ): any;

    getStatus(): any;
    getStats(): Record<
        string,
        number
    >;
}

export declare const createVenexvoraSelfHealingSupervisor:
    (
        options?:
            VenexvoraSelfHealingOptions
    ) =>
        VenexvoraSelfHealingSupervisor;

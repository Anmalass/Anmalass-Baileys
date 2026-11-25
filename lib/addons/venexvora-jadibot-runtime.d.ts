export declare const VENEXVORA_JADIBOT_RUNTIME_FEATURES: Readonly<{
    startupRestore: true;
    idempotentStart: true;
    gracefulStop: true;
    shutdownHooks: true;
    runtimeHealth: true;
    multiSessionHealth: true;
    sessionAccess: true;
    noPairingOnRestore: true;
    runtimeWatchdog: true;
    noOverlappingWatchdog: true;
    trackedSessionsOnlyWatchdog: true;
    noRestoreInWatchdog: true;
    noMessagesUpsertHandler: true;
}>;

export interface VenexvoraJadibotHealthSession {
    id: string;
    status:
        | 'HEALTHY'
        | 'DEGRADED'
        | 'CRITICAL'
        | 'UNAVAILABLE';
    health?: any;
    reason?: string;
    message?: string;
}

export interface VenexvoraJadibotHealthSummary {
    status:
        | 'HEALTHY'
        | 'DEGRADED'
        | 'CRITICAL';
    timestamp: string;
    totalSessions: number;
    healthy: number;
    degraded: number;
    critical: number;
    unavailable: number;
    runtime: {
        started: boolean;
        startedAt: number | null;
        stoppedAt: number | null;
        activeCount: number;
        restoringCount: number;
        lastError: {
            code: any;
            message: string;
        } | null;
    };
    watchdog: any;
    sessions:
        VenexvoraJadibotHealthSession[];
    extra: Record<string, unknown>;
}

export declare class VenexvoraJadibotRuntime {
    constructor(options?: any);

    restorer: any;
    started: boolean;
    startedAt: number | null;
    stoppedAt: number | null;
    lastReport: any;
    lastError: any;

    on(
        event: string,
        handler: (payload: any) => void
    ): () => void;

    start(): Promise<any>;

    stop(
        options?: {
            closeSocket?: boolean;
        }
    ): Promise<any>;

    runWatchdogCheck(): Promise<any>;
    startWatchdog(): any;
    stopWatchdog(options?: { wait?: boolean }): Promise<any>;
    getWatchdogStatus(): any;
    getSession(
        id: string
    ): any;

    getActiveIds(): string[];

    getActiveCount(): number;

    getHealthSummary(
        extra?: Record<string, unknown>
    ): VenexvoraJadibotHealthSummary;
    getStatus(): any;

    installShutdownHooks(
        options?: {
            signals?: string[];
            exitOnSignal?: boolean;
        }
    ): {
        installed: string[];
    };

    removeShutdownHooks(): boolean;
}

export declare const createVenexvoraJadibotRuntime:
    (
        options?: any
    ) => VenexvoraJadibotRuntime;

export declare const startVenexvoraJadibotRuntime:
    (
        options?: any
    ) => Promise<{
        runtime: VenexvoraJadibotRuntime;
        result: any;
    }>;

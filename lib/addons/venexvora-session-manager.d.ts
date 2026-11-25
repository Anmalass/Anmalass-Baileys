export interface VenexvoraSessionManagerOptions {
    root?: string;
    lockStaleMs?: number;
    heartbeatIntervalMs?: number;
}

export interface VenexvoraSessionRuntime {
    id: string;
    status: string;
    startedAt: number;
    stoppedAt: number | null;
    reconnecting: boolean;
    hasSocket: boolean;
    lockOwned: boolean;
    lockHealthy: boolean;
    lastHeartbeatAt: number | null;
    lockError: {
        code: string;
        message: string;
        at: number;
    } | null;
}

export declare class VenexvoraSessionManager {
    constructor(
        options?: VenexvoraSessionManagerOptions
    );

    root: string;
    type: string;

    ensureRoot():
        Promise<string>;

    normalizeId(
        id: string
    ): string;

    getPath(
        id: string
    ): string;

    isActive(
        id: string
    ): boolean;

    getRuntime(
        id: string
    ):
        VenexvoraSessionRuntime |
        null;

    inspect(
        id: string
    ): Promise<any>;

    list():
        Promise<any[]>;

    reserve(
        id: string
    ): Promise<{
        id: string;
        path: string;
        status: string;
    }>;

    attachSocket(
        id: string,
        socket: any
    ): VenexvoraSessionRuntime;

    setReconnecting(
        id: string,
        value?: boolean
    ): boolean;

    release(
        id: string,
        options?: {
            closeSocket?: boolean;
        }
    ): Promise<any>;

    remove(
        id: string,
        options?: {
            force?: boolean;
        }
    ): Promise<any>;

    getActiveCount():
        number;

    getActiveIds():
        string[];
}

export declare const createVenexvoraSessionManager:
    (
        options?: VenexvoraSessionManagerOptions
    ) => VenexvoraSessionManager;

export declare const VENEXVORA_SESSION_MANAGER_FEATURES:
    Readonly<{
        isolatedFolders: true;
        duplicateInstanceProtection: true;
        perManagerRuntimeIsolation: true;
        perManagerOperationLock: true;
        crossProcessOwnership: true;
        filesystemLock: true;
        lockHeartbeat: true;
        orphanRecovery: true;
        ownershipLossDetection: true;
        runtimeRegistry: true;
        sessionHealth: true;
        safeRelease: true;
        protectedRemove: true;
    }>;

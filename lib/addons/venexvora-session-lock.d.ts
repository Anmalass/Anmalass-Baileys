export interface VenexvoraSessionLockOptions {
    lockName?: string;
    staleMs?: number;
    instanceId?: string;
}

export declare class VenexvoraSessionLock {
    constructor(
        sessionPath: string,
        options?: VenexvoraSessionLockOptions
    );

    sessionPath: string;
    lockName: string;
    lockPath: string;
    staleMs: number;
    instanceId: string;
    ownerPid: number;
    acquired: boolean;

    acquire(
        options?: {
            retries?: number;
            retryDelayMs?: number;
        }
    ): Promise<any>;

    inspect():
        Promise<any>;

    refresh():
        Promise<any>;

    release():
        Promise<any>;
}

export declare const createVenexvoraSessionLock:
    (
        sessionPath: string,
        options?: VenexvoraSessionLockOptions
    ) => VenexvoraSessionLock;

export declare const inspectVenexvoraSessionLock:
    (
        sessionPath: string,
        options?: VenexvoraSessionLockOptions
    ) => Promise<any>;

export declare const VENEXVORA_SESSION_LOCK_FEATURES:
    Readonly<{
        crossProcessLock: true;
        exclusiveCreate: true;
        ownerVerification: true;
        staleRecovery: true;
        heartbeat: true;
        safeRelease: true;
    }>;

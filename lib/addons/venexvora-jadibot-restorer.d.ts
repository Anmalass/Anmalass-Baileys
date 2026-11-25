export declare const VENEXVORA_JADIBOT_RESTORER_FEATURES: Readonly<{
    scanOnStartup: true;
    healthyOnly: true;
    registeredOnly: true;
    noPairingRestore: true;
    sequentialRestore: true;
    ownershipAware: true;
    trackedSessions: true;
    safeStopAll: true;
    noMessagesUpsertHandler: true;
}>;

export declare class VenexvoraJadibotRestorer {
    constructor(options?: any);

    manager: any;
    sessions: Map<string, any>;

    scan(): Promise<any[]>;

    getSession(
        id: string
    ): any;

    getActiveIds(): string[];

    getActiveCount(): number;

    restoreOne(
        id: string,
        options?: any
    ): Promise<any>;

    restoreAll(): Promise<any>;

    stopOne(
        id: string,
        options?: any
    ): Promise<boolean>;

    stopAll(
        options?: any
    ): Promise<{
        stopped: number;
    }>;
}

export declare const createVenexvoraJadibotRestorer:
    (
        options?: any
    ) => VenexvoraJadibotRestorer;

export declare const restoreVenexvoraJadibotsOnStartup:
    (
        options?: any
    ) => Promise<{
        restorer: VenexvoraJadibotRestorer;
        report: any;
    }>;

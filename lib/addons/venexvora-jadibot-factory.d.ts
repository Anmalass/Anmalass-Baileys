import type { VenexvoraSelfHealingSupervisor } from './venexvora-self-healing.js';
export interface VenexvoraJadibotFactoryOptions {
    manager?: any;

    root?: string;

    lockStaleMs?: number;

    heartbeatIntervalMs?: number;

    makeSocket?: (
        config: any
    ) => any;

    socketConfig?: Record<
        string,
        any
    >;

    autoReconnect?: boolean;

    reconnectDelayMs?: number;

    maxReconnect?: number;

    pairingCode?: string;
    selfHealing?: boolean;
    selfHealingStaleMs?: number;
    selfHealingCooldownMs?: number;
    selfHealingMaxRecoveries?: number;
    selfHealingWindowMs?: number;
    healthMemory?: boolean
}

export interface VenexvoraJadibotStartOptions {
    phone?: string;
    id?: string;

    pairingCode?: string;

    requestPairing?: boolean;
}

export declare class VenexvoraJadibotSession {
    constructor(
        options?:
            VenexvoraJadibotFactoryOptions
    );

    manager: any;

    socket: any;

    auth: any;

    saveCreds:
        (() => Promise<void>) |
        null;

    id: string | null;

    phone:
        string |
        null;

    path:
        string |
        null;

    status: string;

    reconnectAttempts:
        number;
    selfHealingEnabled:
        boolean;
    selfHealing:
        VenexvoraSelfHealingSupervisor;

    start(
        options:
            VenexvoraJadibotStartOptions
    ): Promise<any>;

    requestPairingCode(
        options?: {
            phone?: string;
            pairingCode?: string;
        }
    ): Promise<string>;

    getHealth(extra?: Record<string, unknown>): import('./venexvora-health.js').VenexvoraHealthSnapshot;
    inspect():
        Promise<any>;
    getSelfHealingStatus():
        any;
    checkSelfHealing():
        Promise<any>;

    stop(
        options?: {
            closeSocket?: boolean;
        }
    ): Promise<any>;

    on(
        event: string,
        handler:
            (payload: any) =>
                void
    ): () => void;
}

export declare const createVenexvoraJadibot:
    (
        options?:
            VenexvoraJadibotFactoryOptions
    ) => VenexvoraJadibotSession;

export declare const VENEXVORA_JADIBOT_FEATURES:
    Readonly<{
        isolatedAuth: true;
        multiFileAuth: true;
        filesystemOwnership: true;
        customPairingCode: true;
        customPairingDefault:
            'ANMALYAA';
        credsPersistence: true;
        connectionLifecycle: true;
        reconnectGuard: true;
        noMessagesUpsertHandler: true;
    }>;

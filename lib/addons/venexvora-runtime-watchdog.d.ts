export declare const VENEXVORA_RUNTIME_WATCHDOG_FEATURES: Readonly<Record<string, boolean>>;
export declare class VenexvoraRuntimeWatchdog {
    constructor(options?: any);
    enabled: boolean;
    intervalMs: number;
    run(): Promise<any>;
    start(): any;
    stop(options?: { wait?: boolean }): Promise<any>;
    getStatus(): any;
}
export declare const createVenexvoraRuntimeWatchdog: (options?: any) => VenexvoraRuntimeWatchdog;

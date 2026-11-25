export type VenexvoraSessionStatus =
    | 'NEW'
    | 'HEALTHY'
    | 'UNREGISTERED'
    | 'RECOVERABLE'
    | 'DEGRADED'
    | 'CORRUPT'
    | 'UNSUPPORTED';

export interface VenexvoraSessionInspection {
    ok: boolean;

    status:
        VenexvoraSessionStatus;

    type:
        | 'multi-file'
        | 'single-file'
        | 'unknown';

    pathExists: boolean;

    registered: boolean;

    hasCreds: boolean;
    hasBackup: boolean;

    credsReadable: boolean;
    backupReadable: boolean;

    jsonFiles: number;
    keyFiles: number;
    backupFiles: number;
    tempFiles: number;
}

export declare const inspectVenexvoraAuthSession:
    (
        targetPath: string
    ) => Promise<VenexvoraSessionInspection>;

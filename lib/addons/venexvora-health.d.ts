export interface VenexvoraHealthIssue {
    level: 'warning' | 'critical'
    component: string
    code: string
}

export interface VenexvoraHealthComponent {
    available: boolean
    status?: unknown
    stats?: unknown
    state?: Record<string, unknown>
}

export interface VenexvoraHealthSnapshot {
    status:
        | 'HEALTHY'
        | 'DEGRADED'
        | 'CRITICAL'
    timestamp: string
    timestampMs: number
    uptimeMs: number
    monitorUptimeMs: number
    components: Record<
        string,
        VenexvoraHealthComponent
    >
    issues: VenexvoraHealthIssue[]
    memory?: Record<string, unknown>
    extra: unknown
}

export interface VenexvoraHealthOptions {
    runtime?: unknown
    factory?: unknown
    session?: unknown
    selfHealing?: unknown
    watchdog?: unknown
    cache?: unknown
    deduper?: unknown
    optimizer?: unknown
    retry?: unknown
    actionLock?: unknown
    verifier?: unknown
    includeMemory?: boolean
}

export declare const VENEXVORA_HEALTH_FEATURES:
    Readonly<Record<string, boolean>>

export declare class VenexvoraHealthMonitor {
    constructor(options?: VenexvoraHealthOptions)

    snapshot(
        extra?: unknown
    ): VenexvoraHealthSnapshot

    getStatus():
        VenexvoraHealthSnapshot
}

export declare const createVenexvoraHealthMonitor:
    (
        options?: VenexvoraHealthOptions
    ) => VenexvoraHealthMonitor

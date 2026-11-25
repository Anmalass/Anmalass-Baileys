export type VenexvoraFlowNext =
    () => Promise<unknown>

export type VenexvoraMiddleware<
    TContext = Record<
        string,
        unknown
    >
> = (
    context: TContext,
    next: VenexvoraFlowNext
) =>
    | unknown
    | Promise<unknown>

export interface VenexvoraFlowStats {
    runs: number
    completed: number
    failed: number
    middlewareCalls: number
    shortCircuits: number
    size: number
}

export interface VenexvoraFlowOptions<
    TContext = Record<
        string,
        unknown
    >
> {
    onError?: (
        error: unknown,
        context: TContext
    ) =>
        | unknown
        | Promise<unknown>
}

export declare const VENEXVORA_FLOW_FEATURES:
    Readonly<Record<string, boolean>>

export declare class VenexvoraFlow<
    TContext = Record<
        string,
        unknown
    >
> {
    constructor(
        options?: VenexvoraFlowOptions<
            TContext
        >
    )

    readonly size: number

    use(
        middleware:
            VenexvoraMiddleware<TContext>
    ): this

    run(
        context?: TContext
    ): Promise<TContext>

    clear(): this

    getStats():
        VenexvoraFlowStats

    resetStats(): this
}

export declare const createVenexvoraFlow:
    <
        TContext = Record<
            string,
            unknown
        >
    >(
        options?: VenexvoraFlowOptions<
            TContext
        >
    ) => VenexvoraFlow<TContext>

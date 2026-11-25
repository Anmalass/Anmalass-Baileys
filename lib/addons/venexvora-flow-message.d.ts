import type {
    VenexvoraMiddleware,
    VenexvoraFlow
} from './venexvora-flow.js';

export interface VenexvoraMessageContextOptions {
    socket?: any
    sdk?: any
    runtime?: any
    state?: Record<string, unknown>
    meta?: Record<string, unknown>
}

export interface VenexvoraMessageFlowContext {
    input: any

    socket: any
    sdk: any
    runtime: any

    key: any
    jid: string | null
    participant: string | null

    type: string | null
    mediaType: string | null
    text: string

    message: any
    quoted: any
    revoke: any
    edited: any
    contextInfo: any

    state:
        Record<string, unknown>

    meta:
        Record<string, unknown>

    [key: string]: unknown
}

export type VenexvoraFlowPredicate<
    TContext = VenexvoraMessageFlowContext
> = (
    context: TContext
) =>
    | boolean
    | Promise<boolean>

export declare const VENEXVORA_FLOW_MESSAGE_FEATURES:
    Readonly<Record<string, boolean>>

export declare const when:
    <TContext>(
        predicate:
            VenexvoraFlowPredicate<TContext>,
        middleware:
            VenexvoraMiddleware<TContext>
    ) => VenexvoraMiddleware<TContext>

export declare const unless:
    <TContext>(
        predicate:
            VenexvoraFlowPredicate<TContext>,
        middleware:
            VenexvoraMiddleware<TContext>
    ) => VenexvoraMiddleware<TContext>

export declare const matchText:
    (
        matcher:
            | string
            | RegExp
            | (
                (
                    text: string,
                    context:
                        VenexvoraMessageFlowContext
                ) =>
                    | boolean
                    | Promise<boolean>
              ),
        middleware:
            VenexvoraMiddleware<
                VenexvoraMessageFlowContext
            >
    ) =>
        VenexvoraMiddleware<
            VenexvoraMessageFlowContext
        >

export declare const createVenexvoraMessageContext:
    (
        input: any,
        options?:
            VenexvoraMessageContextOptions
    ) =>
        VenexvoraMessageFlowContext

export declare const runMessageFlow:
    (
        flow:
            VenexvoraFlow<
                VenexvoraMessageFlowContext
            >,
        input: any,
        options?:
            VenexvoraMessageContextOptions
    ) =>
        Promise<
            VenexvoraMessageFlowContext
        >

import type {
    AnyMessageContent,
    MiscMessageGenerationOptions,
    MessageRelayOptions,
    ParticipantAction,
    GroupMetadata,
    WAMessage,
    proto
} from '../index.js';

export interface VenexvoraSDKOptions {
    socket?: any
    sock?: any
    runtime?: any
}

export interface VenexvoraSDKMessage {
    send(
        jid: string,
        content: AnyMessageContent,
        options?:
            MiscMessageGenerationOptions
    ): Promise<WAMessage | undefined>

    relay(
        jid: string,
        message: proto.IMessage,
        options: MessageRelayOptions
    ): Promise<any>
}

export interface VenexvoraSDKGroup {
    metadata(
        jid: string
    ): Promise<GroupMetadata>

    participants(
        jid: string,
        participants: string[],
        action: ParticipantAction
    ): ReturnType<any>

    subject(
        jid: string,
        subject: string
    ): Promise<void>

    description(
        jid: string,
        description?: string
    ): Promise<void>

    setting(
        jid: string,
        setting:
            | 'announcement'
            | 'not_announcement'
            | 'locked'
            | 'unlocked'
    ): Promise<void>

    ephemeral(
        jid: string,
        expiration: number
    ): Promise<void>
}

export interface VenexvoraSDKRuntime {
    status(): any

    health(
        extra?: Record<
            string,
            unknown
        >
    ): import(
        './venexvora-jadibot-runtime.js'
    ).VenexvoraJadibotHealthSummary

    watchdog(): any
}

export interface VenexvoraSDKSession {
    get(
        id: string
    ): any

    health(
        id: string,
        extra?: Record<
            string,
            unknown
        >
    ):
        | import(
            './venexvora-health.js'
        ).VenexvoraHealthSnapshot
        | null
}

export declare const VENEXVORA_SDK_FEATURES:
    Readonly<Record<string, boolean>>

export declare class VenexvoraSDK {
    constructor(
        options?: VenexvoraSDKOptions
    )

    socket: any
    jadibotRuntime: any

    message: VenexvoraSDKMessage
    group: VenexvoraSDKGroup
    runtime: VenexvoraSDKRuntime
    session: VenexvoraSDKSession

    send(
        jid: string,
        content: AnyMessageContent,
        options?:
            MiscMessageGenerationOptions
    ): Promise<WAMessage | undefined>

    relay(
        jid: string,
        message: proto.IMessage,
        options: MessageRelayOptions
    ): Promise<any>

    health(
        extra?: Record<string, unknown>
    ): import(
        './venexvora-jadibot-runtime.js'
    ).VenexvoraJadibotHealthSummary

    sessionHealth(
        id: string,
        extra?: Record<string, unknown>
    ):
        | import(
            './venexvora-health.js'
        ).VenexvoraHealthSnapshot
        | null

    hasSocket(): boolean
    hasRuntime(): boolean

    withSocket(
        socket: any
    ): VenexvoraSDK

    withRuntime(
        runtime: any
    ): VenexvoraSDK

    getSocket(): any
    getRuntime(): any
}

export declare const createVenexvoraSDK:
    (
        options?: VenexvoraSDKOptions
    ) => VenexvoraSDK

export declare const bindVenexvoraSDK:
    (
        socket: any,
        runtime?: any
    ) => VenexvoraSDK

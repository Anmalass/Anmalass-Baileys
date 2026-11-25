export const VENEXVORA_SDK_FEATURES =
    Object.freeze({
        thinWrapper: true,
        messageDelegation: true,
        groupDelegation: true,
        runtimeDiagnostics: true,
        sessionAccess: true,
        ergonomicAliases: true,
        immutableBinding: true,
        boundSDKHelper: true,
        noSocketMutation: true,
        noReconnectLogic: true,
        noRestoreLogic: true,
        noPairingLogic: true
    });

const requireMethod = (
    target,
    method,
    scope
) => {
    if (
        !target ||
        typeof target[method] !==
            'function'
    ) {
        throw new TypeError(
            `${scope}.${method} is unavailable`
        );
    }

    return target[method]
        .bind(target);
};

export class VenexvoraSDK {
    constructor(options = {}) {
        this.socket =
            options.socket ??
            options.sock ??
            null;

        this.jadibotRuntime =
            options.runtime ??
            null;

        const socket =
            () => this.socket;

        const runtime =
            () => this.jadibotRuntime;

        this.message =
            Object.freeze({
                send: (
                    jid,
                    content,
                    sendOptions
                ) =>
                    requireMethod(
                        socket(),
                        'sendMessage',
                        'socket'
                    )(
                        jid,
                        content,
                        sendOptions
                    ),

                relay: (
                    jid,
                    message,
                    relayOptions
                ) =>
                    requireMethod(
                        socket(),
                        'relayMessage',
                        'socket'
                    )(
                        jid,
                        message,
                        relayOptions
                    )
            });

        this.group =
            Object.freeze({
                metadata: jid =>
                    requireMethod(
                        socket(),
                        'groupMetadata',
                        'socket'
                    )(jid),

                participants: (
                    jid,
                    participants,
                    action
                ) =>
                    requireMethod(
                        socket(),
                        'groupParticipantsUpdate',
                        'socket'
                    )(
                        jid,
                        participants,
                        action
                    ),

                subject: (
                    jid,
                    subject
                ) =>
                    requireMethod(
                        socket(),
                        'groupUpdateSubject',
                        'socket'
                    )(
                        jid,
                        subject
                    ),

                description: (
                    jid,
                    description
                ) =>
                    requireMethod(
                        socket(),
                        'groupUpdateDescription',
                        'socket'
                    )(
                        jid,
                        description
                    ),

                setting: (
                    jid,
                    setting
                ) =>
                    requireMethod(
                        socket(),
                        'groupSettingUpdate',
                        'socket'
                    )(
                        jid,
                        setting
                    ),

                ephemeral: (
                    jid,
                    expiration
                ) =>
                    requireMethod(
                        socket(),
                        'groupToggleEphemeral',
                        'socket'
                    )(
                        jid,
                        expiration
                    )
            });

        this.runtime =
            Object.freeze({
                status: () =>
                    requireMethod(
                        runtime(),
                        'getStatus',
                        'runtime'
                    )(),

                health: (
                    extra = {}
                ) =>
                    requireMethod(
                        runtime(),
                        'getHealthSummary',
                        'runtime'
                    )(extra),

                watchdog: () =>
                    requireMethod(
                        runtime(),
                        'getWatchdogStatus',
                        'runtime'
                    )()
            });

        this.session =
            Object.freeze({
                get: id =>
                    requireMethod(
                        runtime(),
                        'getSession',
                        'runtime'
                    )(id),

                health: (
                    id,
                    extra = {}
                ) => {
                    const session =
                        requireMethod(
                            runtime(),
                            'getSession',
                            'runtime'
                        )(id);

                    if (!session) {
                        return null;
                    }

                    return requireMethod(
                        session,
                        'getHealth',
                        'session'
                    )(extra);
                }
            });
    }

    send(
        jid,
        content,
        options
    ) {
        return this.message.send(
            jid,
            content,
            options
        );
    }

    relay(
        jid,
        message,
        options
    ) {
        return this.message.relay(
            jid,
            message,
            options
        );
    }

    health(extra = {}) {
        return this.runtime.health(
            extra
        );
    }

    sessionHealth(
        id,
        extra = {}
    ) {
        return this.session.health(
            id,
            extra
        );
    }

    hasSocket() {
        return this.socket !== null;
    }

    hasRuntime() {
        return this.jadibotRuntime !== null;
    }

    withSocket(socket) {
        return new VenexvoraSDK({
            socket,
            runtime:
                this.jadibotRuntime
        });
    }

    withRuntime(runtime) {
        return new VenexvoraSDK({
            socket:
                this.socket,
            runtime
        });
    }

    getSocket() {
        return this.socket;
    }

    getRuntime() {
        return this.jadibotRuntime;
    }
}

export const createVenexvoraSDK =
    options =>
        new VenexvoraSDK(
            options
        );

export const bindVenexvoraSDK =
    (
        socket,
        runtime = null
    ) =>
        new VenexvoraSDK({
            socket,
            runtime
        });

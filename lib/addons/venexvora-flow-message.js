import {
    getMessageInfo,
    getContextInfo
} from './venexvora-message.js';

export const VENEXVORA_FLOW_MESSAGE_FEATURES =
    Object.freeze({
        conditionalMiddleware: true,
        asyncPredicate: true,
        textMatcher: true,
        messageContextAdapter: true,
        existingMessageHelpers: true,
        noInputMutation: true,
        noSocketMutation: true,
        noEventListener: true,
        noReconnectLogic: true,
        noRestoreLogic: true,
        noPairingLogic: true
    });

const requireFunction = (
    value,
    name
) => {
    if (
        typeof value !==
        'function'
    ) {
        throw new TypeError(
            `${name} must be a function`
        );
    }

    return value;
};

export const when = (
    predicate,
    middleware
) => {
    requireFunction(
        predicate,
        'predicate'
    );

    requireFunction(
        middleware,
        'middleware'
    );

    return async (
        context,
        next
    ) => {
        const matched =
            await predicate(
                context
            );

        if (matched) {
            return middleware(
                context,
                next
            );
        }

        return next();
    };
};

export const unless = (
    predicate,
    middleware
) => {
    requireFunction(
        predicate,
        'predicate'
    );

    requireFunction(
        middleware,
        'middleware'
    );

    return when(
        async context =>
            !(
                await predicate(
                    context
                )
            ),
        middleware
    );
};

export const matchText = (
    matcher,
    middleware
) => {
    requireFunction(
        middleware,
        'middleware'
    );

    let predicate;

    if (
        typeof matcher ===
        'string'
    ) {
        predicate =
            context =>
                context?.text ===
                matcher;
    } else if (
        matcher instanceof
        RegExp
    ) {
        predicate =
            context => {
                matcher.lastIndex =
                    0;

                return matcher.test(
                    String(
                        context?.text ??
                        ''
                    )
                );
            };
    } else if (
        typeof matcher ===
        'function'
    ) {
        predicate =
            context =>
                matcher(
                    String(
                        context?.text ??
                        ''
                    ),
                    context
                );
    } else {
        throw new TypeError(
            'matcher must be a string, RegExp, or function'
        );
    }

    return when(
        predicate,
        middleware
    );
};

export const createVenexvoraMessageContext =
    (
        input,
        options = {}
    ) => {
        const info =
            getMessageInfo(
                input
            );

        const contextInfo =
            getContextInfo(
                input
            );

        return {
            input,

            socket:
                options.socket ??
                null,

            sdk:
                options.sdk ??
                null,

            runtime:
                options.runtime ??
                null,

            key:
                info.key,

            jid:
                info.jid,

            participant:
                info.participant,

            type:
                info.type,

            mediaType:
                info.mediaType,

            text:
                info.text,

            message:
                info.message,

            quoted:
                info.quoted,

            revoke:
                info.revoke,

            edited:
                info.edited,

            contextInfo,

            state: {
                ...(
                    options.state ??
                    {}
                )
            },

            meta: {
                ...(
                    options.meta ??
                    {}
                )
            }
        };
    };

export const runMessageFlow =
    (
        flow,
        input,
        options = {}
    ) => {
        if (
            !flow ||
            typeof flow.run !==
                'function'
        ) {
            throw new TypeError(
                'flow.run is unavailable'
            );
        }

        const context =
            createVenexvoraMessageContext(
                input,
                options
            );

        return flow.run(
            context
        );
    };

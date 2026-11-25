export const VENEXVORA_FLOW_FEATURES =
    Object.freeze({
        asyncMiddleware: true,
        composable: true,
        contextPreservation: true,
        shortCircuit: true,
        nextOnceGuard: true,
        errorIsolation: true,
        statistics: true,
        noSocketMutation: true,
        noEventListener: true,
        noReconnectLogic: true,
        noRestoreLogic: true,
        noPairingLogic: true
    });

const createFlowError = (
    code,
    message
) => {
    const error =
        new Error(message);

    error.name =
        'VenexvoraFlowError';

    error.code =
        code;

    return error;
};

export class VenexvoraFlow {
    constructor(options = {}) {
        this.stack = [];

        this.onError =
            typeof options.onError ===
            'function'
                ? options.onError
                : null;

        this.stats = {
            runs: 0,
            completed: 0,
            failed: 0,
            middlewareCalls: 0,
            shortCircuits: 0
        };
    }

    use(middleware) {
        if (
            typeof middleware !==
            'function'
        ) {
            throw new TypeError(
                'Venexvora middleware must be a function'
            );
        }

        this.stack.push(
            middleware
        );

        return this;
    }

    get size() {
        return this.stack.length;
    }

    async run(context = {}) {
        this.stats.runs++;

        let lastIndex =
            -1;

        let deepestIndex =
            -1;

        const dispatch =
            async index => {
                if (
                    index <=
                    lastIndex
                ) {
                    throw createFlowError(
                        'NEXT_ALREADY_CALLED',
                        'next() may only be called once per middleware'
                    );
                }

                lastIndex =
                    index;

                const middleware =
                    this.stack[index];

                if (!middleware) {
                    return;
                }

                deepestIndex =
                    Math.max(
                        deepestIndex,
                        index
                    );

                this.stats
                    .middlewareCalls++;

                let nextCalled =
                    false;

                const next =
                    async () => {
                        if (nextCalled) {
                            throw createFlowError(
                                'NEXT_ALREADY_CALLED',
                                'next() may only be called once per middleware'
                            );
                        }

                        nextCalled =
                            true;

                        return dispatch(
                            index + 1
                        );
                    };

                await middleware(
                    context,
                    next
                );

                if (
                    nextCalled === false &&
                    index <
                        this.stack.length -
                            1
                ) {
                    this.stats
                        .shortCircuits++;
                }
            };

        try {
            await dispatch(0);

            this.stats.completed++;

            return context;
        } catch (error) {
            this.stats.failed++;

            if (this.onError) {
                await this.onError(
                    error,
                    context
                );

                return context;
            }

            throw error;
        }
    }

    clear() {
        this.stack.length =
            0;

        return this;
    }

    getStats() {
        return {
            ...this.stats,
            size:
                this.stack.length
        };
    }

    resetStats() {
        this.stats = {
            runs: 0,
            completed: 0,
            failed: 0,
            middlewareCalls: 0,
            shortCircuits: 0
        };

        return this;
    }
}

export const createVenexvoraFlow =
    options =>
        new VenexvoraFlow(
            options
        );

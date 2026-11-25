export const VENEXVORA_HEALTH_FEATURES = Object.freeze({
    readOnly: true,
    synchronousSnapshot: true,
    componentIsolation: true,
    statistics: true,
    memorySnapshot: true,
    noReconnectLogic: true,
    noRestoreLogic: true,
    noRetryLogic: true,
    noPairingLogic: true
});

const safe = (value, depth = 0, seen = new WeakSet()) => {
    if (
        value == null ||
        ['string', 'number', 'boolean'].includes(typeof value)
    ) return value;

    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'function') return '[Function]';
    if (depth >= 5) return '[MaxDepth]';

    if (typeof value === 'object') {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
    }

    if (Array.isArray(value)) {
        return value.map(v =>
            safe(v, depth + 1, seen)
        );
    }

    if (typeof value === 'object') {
        const out = {};

        for (const [key, entry] of Object.entries(value)) {
            out[key] =
                safe(entry, depth + 1, seen);
        }

        return out;
    }

    return String(value);
};

const call = (source, method) => {
    if (
        !source ||
        typeof source[method] !== 'function'
    ) {
        return undefined;
    }

    try {
        const value = source[method]();

        if (
            value &&
            typeof value.then === 'function'
        ) {
            return {
                unavailable: true,
                reason: `${method} returned Promise`
            };
        }

        return safe(value);
    } catch (error) {
        return {
            error:
                error?.message ||
                String(error)
        };
    }
};

const inspect = source => {
    if (!source) {
        return {
            available: false
        };
    }

    const status =
        call(source, 'getStatus');

    const stats =
        call(source, 'getStats');

    const state = {};

    for (const key of [
        'enabled',
        'running',
        'checking',
        'startedAt',
        'lastRunAt',
        'lastSignalAt',
        'lastHealthyAt',
        'lastRecoveryAt',
        'circuitOpen',
        'size'
    ]) {
        try {
            if (source[key] !== undefined) {
                state[key] =
                    safe(source[key]);
            }
        } catch {}
    }

    return {
        available: true,
        ...(status !== undefined
            ? { status }
            : {}),
        ...(stats !== undefined
            ? { stats }
            : {}),
        state
    };
};

export class VenexvoraHealthMonitor {
    constructor(options = {}) {
        this.createdAt =
            Date.now();

        this.includeMemory =
            options.includeMemory !== false;

        this.sources = {
            runtime:
                options.runtime ||
                options.factory ||
                null,

            session:
                options.session ||
                null,

            selfHealing:
                options.selfHealing ||
                null,

            watchdog:
                options.watchdog ||
                null,

            cache:
                options.cache ||
                null,

            deduper:
                options.deduper ||
                null,

            optimizer:
                options.optimizer ||
                null,

            retry:
                options.retry ||
                null,

            actionLock:
                options.actionLock ||
                null,

            verifier:
                options.verifier ||
                null
        };
    }

    snapshot(extra = {}) {
        const components = {};

        for (
            const [name, source]
            of Object.entries(this.sources)
        ) {
            components[name] =
                inspect(source);
        }

        const issues = [];

        const healing =
            components.selfHealing;

        if (
            healing?.status?.circuitOpen === true ||
            healing?.state?.circuitOpen === true
        ) {
            issues.push({
                level: 'critical',
                component: 'selfHealing',
                code: 'CIRCUIT_OPEN'
            });
        }

        for (
            const [component, data]
            of Object.entries(components)
        ) {
            if (
                data?.status?.error ||
                data?.stats?.error
            ) {
                issues.push({
                    level: 'warning',
                    component,
                    code:
                        'DIAGNOSTIC_READ_ERROR'
                });
            }
        }

        const status =
            issues.some(
                item =>
                    item.level === 'critical'
            )
                ? 'CRITICAL'
                : issues.length
                    ? 'DEGRADED'
                    : 'HEALTHY';

        const now =
            Date.now();

        const result = {
            status,
            timestamp:
                new Date(now)
                    .toISOString(),
            timestampMs: now,

            uptimeMs:
                Math.floor(
                    process.uptime() *
                    1000
                ),

            monitorUptimeMs:
                now -
                this.createdAt,

            components,
            issues,
            extra:
                safe(extra)
        };

        if (
            this.includeMemory &&
            typeof process.memoryUsage ===
                'function'
        ) {
            result.memory =
                safe(
                    process.memoryUsage()
                );
        }

        return result;
    }

    getStatus() {
        return this.snapshot();
    }
}

export const createVenexvoraHealthMonitor =
    options =>
        new VenexvoraHealthMonitor(
            options
        );

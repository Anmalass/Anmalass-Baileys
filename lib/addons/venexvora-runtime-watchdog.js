export const VENEXVORA_RUNTIME_WATCHDOG_FEATURES = Object.freeze({ boundedInterval: true, noOverlap: true, trackedSessionsOnly: true, perSessionIsolation: true, noRestoreLogic: true, noPairingLogic: true, noReconnectEngine: true, gracefulStop: true, statistics: true });

export class VenexvoraRuntimeWatchdog {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.intervalMs = Math.max(1000, Number(options.intervalMs) || 15000);
        this.getIds = options.getIds ?? (() => []);
        this.getSession = options.getSession ?? (() => null);
        this.onReport = typeof options.onReport === 'function' ? options.onReport : null;
        this.timer = null;
        this.current = null;
        this.startedAt = null;
        this.lastRunAt = null;
        this.lastReport = null;
        this.stats = { runs: 0, checked: 0, skipped: 0, failed: 0, recoveryRequested: 0, blocked: 0, overlapSkips: 0 };
    }

    async run() {
        if (this.enabled === false) return { status: 'SKIPPED', reason: 'WATCHDOG_DISABLED', results: [] };
        if (this.current) {
            this.stats.overlapSkips += 1;
            return { status: 'SKIPPED', reason: 'WATCHDOG_BUSY', results: [] };
        }
        const task = (async () => {
            const startedAt = Date.now();
            const ids = [...this.getIds()];
            const results = [];
            this.stats.runs += 1;
            for (const id of ids) {
                const session = this.getSession(id);
                if (typeof session?.checkSelfHealing !== 'function') {
                    this.stats.skipped += 1;
                    results.push({ id, status: 'SKIPPED', reason: 'SELF_HEALING_UNAVAILABLE' });
                    continue;
                }
                try {
                    const result = await session.checkSelfHealing();
                    this.stats.checked += 1;
                    if (result?.status === 'RECOVERY_REQUESTED') this.stats.recoveryRequested += 1;
                    if (result?.status === 'BLOCKED' || result?.status === 'CIRCUIT_OPEN') this.stats.blocked += 1;
                    results.push({ id, status: result?.status ?? 'UNKNOWN', result });
                }
                catch (error) {
                    this.stats.failed += 1;
                    results.push({ id, status: 'FAILED', reason: error?.code ?? 'WATCHDOG_CHECK_ERROR', message: error?.message ?? String(error) });
                }
            }
            const report = { status: 'CHECKED', startedAt, finishedAt: Date.now(), total: ids.length, checked: results.filter(item => item.status !== 'SKIPPED' && item.status !== 'FAILED').length, skipped: results.filter(item => item.status === 'SKIPPED').length, failed: results.filter(item => item.status === 'FAILED').length, results };
            this.lastRunAt = report.finishedAt;
            this.lastReport = report;
            if (this.onReport) {
                try { this.onReport(report); } catch {}
            }
            return report;
        })();
        this.current = task;
        try { return await task; }
        finally { if (this.current === task) this.current = null; }
    }

    start() {
        if (this.enabled === false) return { status: 'SKIPPED', reason: 'WATCHDOG_DISABLED' };
        if (this.timer) return { status: 'ALREADY_RUNNING', intervalMs: this.intervalMs };
        this.startedAt = Date.now();
        this.timer = setInterval(() => { void this.run().catch(() => {}); }, this.intervalMs);
        if (typeof this.timer.unref === 'function') this.timer.unref();
        return { status: 'STARTED', intervalMs: this.intervalMs };
    }

    async stop(options = {}) {
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (options.wait !== false && this.current) await this.current.catch(() => {});
        return { status: 'STOPPED' };
    }

    getStatus() {
        return { enabled: this.enabled, running: Boolean(this.timer), checking: Boolean(this.current), intervalMs: this.intervalMs, startedAt: this.startedAt, lastRunAt: this.lastRunAt, lastReport: this.lastReport, stats: { ...this.stats } };
    }
}

export const createVenexvoraRuntimeWatchdog = options => new VenexvoraRuntimeWatchdog(options);

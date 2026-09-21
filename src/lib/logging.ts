/**
 * Logging helpers.
 *
 * Log concept of the adapter (see README, section "Logging and debugging"):
 * - error: the adapter cannot work (configuration)
 * - warn:  a problem the user has to act on, reported once and repeated only at debug level until it is resolved
 * - info:  lifecycle milestones (configuration, connected, lost, recovered, gateway found), once each
 * - debug: every step of the program flow with its inputs, decisions, correlation IDs and durations
 * - silly: raw protocol trace of tuyapi and heartbeats
 * Every message starts with a component tag like "[conn]" so a log can be filtered by area.
 * Secrets (local key, session keys) are never written to the log.
 */
import { format } from "node:util";

/** Replacement for secrets in log messages */
export const MASK = "***";

const SESSION_KEY_PATTERN = /((?:Local Random|Remote Random|Session) Key: )[0-9a-f]+/gi;
// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

/**
 * Masks the given secrets and the session keys printed by tuyapi for protocol 3.4/3.5.
 *
 * @param text - log message
 * @param secrets - values that must never appear in the log
 */
export function redact(text: string, secrets: readonly string[] = []): string {
    let out = text.replace(SESSION_KEY_PATTERN, `$1${MASK}`);
    for (const secret of secrets) {
        if (secret) {
            out = out.split(secret).join(MASK);
        }
    }
    return out;
}

/**
 * Shortens long values (payloads, frame lists) for log lines.
 *
 * @param text - text to shorten
 * @param max - maximum length
 */
export function shorten(text: string, max = 300): string {
    return text.length > max ? `${text.slice(0, max)}… (${text.length} characters)` : text;
}

/**
 * Formats a duration for log messages, e.g. "850 ms", "12.3 s", "4.5 min".
 *
 * @param ms - duration in milliseconds
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) {
        return `${Math.round(ms)} ms`;
    }
    if (ms < 60_000) {
        return `${(ms / 1000).toFixed(1)} s`;
    }
    if (ms < 3_600_000) {
        return `${(ms / 60_000).toFixed(1)} min`;
    }
    return `${(ms / 3_600_000).toFixed(1)} h`;
}

/**
 * Removes the decorations the "debug" module adds (colours, time stamp, namespace, "+12ms") and joins multi-line
 * object dumps into one line, so every trace entry is a single, complete ioBroker log line.
 *
 * @param line - formatted debug output
 * @param namespace - debug namespace
 */
export function cleanDebugLine(line: string, namespace: string): string {
    return line
        .replace(ANSI_PATTERN, "")
        .trim()
        .replace(/^\d{4}-\d{2}-\d{2}T\S+Z\s+/, "")
        .replace(new RegExp(`^${namespace}\\s+`), "")
        .replace(/\s+\+\d+(?:ms|s|m|h)$/, "")
        .replace(/\s*\n\s*/g, " ");
}

/** The part of the "debug" module that is used here */
interface DebugModule {
    enable(namespaces: string): void;
    disable(): string;
    log: (...args: unknown[]) => void;
}

const TUYAPI_NAMESPACE = "TuyAPI";

/**
 * Routes tuyapi's internal protocol trace (debug namespace "TuyAPI") to the given log function.
 * The "debug" instance tuyapi itself resolves is used, other namespaces keep their previous output.
 *
 * @param write - receives every trace line, already cleaned and redacted
 * @param secrets - values that must never appear in the log
 * @returns function that restores the previous state of the debug module
 */
export function bridgeTuyapiDebug(write: (message: string) => void, secrets: readonly string[]): () => void {
    const debugPath = require.resolve("debug", { paths: [require.resolve("tuyapi")] });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const createDebug = require(debugPath) as DebugModule;
    const previousNamespaces = createDebug.disable();
    const previousLog = createDebug.log;

    createDebug.enable(previousNamespaces ? `${previousNamespaces},${TUYAPI_NAMESPACE}` : TUYAPI_NAMESPACE);
    createDebug.log = function (this: { namespace?: string } | undefined, ...args: unknown[]): void {
        if (this?.namespace === TUYAPI_NAMESPACE) {
            write(redact(cleanDebugLine(format(...args), TUYAPI_NAMESPACE), secrets));
        } else {
            previousLog.apply(this, args);
        }
    };

    return () => {
        createDebug.log = previousLog;
        createDebug.disable();
        if (previousNamespaces) {
            createDebug.enable(previousNamespaces);
        }
    };
}

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

type LogContext = Record<string, unknown>;

const emit = (level: LogLevel, message: string, context?: LogContext) => {
    const payload = {
        ts: new Date().toISOString(),
        level,
        message,
        ...context,
    };

    const serialized = JSON.stringify(payload);
    if (level === 'ERROR') {
        console.error(serialized);
        return;
    }
    if (level === 'WARN') {
        console.warn(serialized);
        return;
    }
    console.log(serialized);
};

export const logger = {
    info: (message: string, context?: LogContext) => emit('INFO', message, context),
    warn: (message: string, context?: LogContext) => emit('WARN', message, context),
    error: (message: string, context?: LogContext) => emit('ERROR', message, context),
};


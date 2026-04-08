import fs from 'fs';
import path from 'path';

/**
 * Available log levels for the application
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

/**
 * Appends a log entry to logs.log in the project root.
 * Note: This only works in Node.js environments (Server Side).
 */
export function logToFile(level: LogLevel, source: string, message: string, context?: any) {
  const timestamp = new Date().toISOString();
  
  // Handle Error objects in context to ensure stack traces are logged
  let processedContext = context;
  if (context instanceof Error) {
    processedContext = {
      message: context.message,
      stack: context.stack,
      ...context
    };
  }

  const contextString = context 
    ? ` | Context: ${JSON.stringify(processedContext, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value
      )}` 
    : '';
  
  const logEntry = `[${timestamp}] [${level}] [${source.toUpperCase()}] ${message}${contextString}\n`;
  const logPath = path.join(process.cwd(), 'logs.log');

  try {
    fs.appendFileSync(logPath, logEntry, 'utf8');
  } catch (err) {
    console.error('CRITICAL: Failed to write to log file:', err);
  }
}
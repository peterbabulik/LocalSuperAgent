// logger.js - Handle logging to the JSONL file

import fs from 'fs/promises';
import { LOG_FILE } from './config.js';

/**
 * Append a log entry to the log file
 * @param {Object} logEntry - The log entry to append
 * @returns {Promise<void>}
 */
async function appendToLog(logEntry) {
    try {
        const logLine = JSON.stringify(logEntry) + '\n';
        await fs.appendFile(LOG_FILE, logLine, 'utf8');
    } catch (error) { 
        console.error("Error appending to log:", error); 
    }
}

export {
    appendToLog
};
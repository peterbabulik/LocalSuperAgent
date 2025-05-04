// command_executor.js - Handle the execution of shell commands

import { exec } from 'child_process';
import { PROJECT_WORKSPACE } from './config.js';

/**
 * Execute a shell command in the specified directory
 * @param {string} command - The command to execute
 * @param {string} cwd - The working directory for the command (defaults to PROJECT_WORKSPACE)
 * @returns {Promise<string>} - The command output
 */
async function executeCommand(command, cwd = PROJECT_WORKSPACE) {
    console.log(`[SYSTEM] Executing command: ${command} in ${cwd}`);
    return new Promise((resolve) => {
        // Basic command sanitization (example - enhance for security)
        if (!command || typeof command !== 'string' || command.includes('&&') || command.includes('|') || command.includes(';')) {
            console.error(`[SYSTEM] Potentially unsafe command blocked: ${command}`);
            resolve("Error: Command blocked due to potentially unsafe characters.");
            return;
        }

        exec(command, { cwd, timeout: 15000, shell: process.env.SHELL || true }, (error, stdout, stderr) => { // Use default shell
            let output = "";
            const exitCode = error ? error.code : 0;
            output += `Exit Code: ${exitCode}\n`; // Include exit code

            if (stderr) {
                console.warn(`[SYSTEM] Command Stderr (${command}):\n${stderr}`);
                output += `Stderr:\n${stderr}\n`;
            }
            if (stdout) {
                console.log(`[SYSTEM] Command Stdout (${command}):\n${stdout}`);
                output += `Stdout:\n${stdout}\n`;
            }
            if (error) {
                console.error(`[SYSTEM] Command Error (${command}): ${error.message}`);
                // Don't double-print message if already in stderr
                if (!stderr || !stderr.includes(error.message)) {
                    output += `Error: ${error.message}\n`;
                }
            }

            if (exitCode === 0 && !stderr && !stdout) {
                output += "Command executed successfully with no output.";
            } else if (exitCode !== 0 && !output.includes("Error:")) {
                output += `Error: Command failed with exit code ${exitCode}.`; // Add generic error if specific one missed
            }

            resolve(output.substring(0, 1500) + (output.length > 1500 ? "\n... (output truncated)" : ""));
        });
    });
}

export {
    executeCommand
};
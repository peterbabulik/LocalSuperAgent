// file_system_utils.js - Encapsulate all direct interactions with the file system

import fs from 'fs/promises';
import path from 'path';
import { PROJECT_WORKSPACE } from './config.js';

/**
 * Get the project file structure
 * @param {string} dir - The directory to get the structure for (defaults to PROJECT_WORKSPACE)
 * @returns {Promise<string>} - A string representation of the project structure
 */
async function getProjectStructure(dir = PROJECT_WORKSPACE) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        // Filter out hidden files/dirs like .git
        const structure = entries
            .filter(dirent => !dirent.name.startsWith('.'))
            .map(dirent => dirent.isDirectory() ? `${dirent.name}/` : dirent.name);
        // Limit structure length for context
        const structureString = structure.join(', ');
        return structureString.substring(0, 500) + (structureString.length > 500 ? '...' : '') || 'Empty';
    } catch (error) {
        if (error.code === 'ENOENT') return 'Empty';
        console.error(`Error reading project structure in ${dir}:`, error);
        return 'Error reading structure';
    }
}

/**
 * List the contents of a directory
 * @param {string} relativePath - The relative path to list
 * @returns {Promise<Object>} - The directory listing result
 */
async function performListDirectory(relativePath) {
    // Strip leading slash if present
    if (relativePath && typeof relativePath === 'string' && relativePath.startsWith('/')) {
        relativePath = relativePath.substring(1);
    }
    
    // Basic path validation
    if (!relativePath || typeof relativePath !== 'string' || relativePath.includes('..') || path.isAbsolute(relativePath)) {
        console.warn(`[SYSTEM] Invalid or forbidden path specified for LIST_DIRECTORY: ${relativePath}`);
        return { success: false, error: 'Invalid path' };
    }
    
    const absolutePath = path.resolve(PROJECT_WORKSPACE, relativePath);
    // Ensure path stays within the workspace directory
    if (!absolutePath.startsWith(PROJECT_WORKSPACE + path.sep) && absolutePath !== PROJECT_WORKSPACE) {
        console.warn(`[SYSTEM] Attempt to access path outside workspace rejected: ${relativePath}`);
        return { success: false, error: 'Path outside workspace' };
    }

    try {
        // Check if directory exists
        const stats = await fs.stat(absolutePath);
        if (!stats.isDirectory()) {
            console.warn(`[SYSTEM] Path is not a directory: ${relativePath}`);
            return { success: false, error: 'Path is not a directory' };
        }

        const entries = await fs.readdir(absolutePath, { withFileTypes: true });
        // Filter out hidden files/dirs like .git
        const listing = entries
            .filter(dirent => !dirent.name.startsWith('.'))
            .map(dirent => {
                const type = dirent.isDirectory() ? 'directory' : 'file';
                const name = dirent.isDirectory() ? `${dirent.name}/` : dirent.name;
                return { name, type };
            });

        console.log(`[SYSTEM] Directory listed: ${relativePath} (${listing.length} entries)`);
        return { 
            success: true, 
            path: relativePath,
            listing: listing,
            formattedListing: listing.map(item => item.name).join('\n')
        };
    } catch (error) {
        console.error(`[SYSTEM] Error listing directory (${relativePath}):`, error.code, error.message);
        if (error.code === 'ENOENT') return { success: false, error: 'Directory not found' };
        return { success: false, error: `File system error: ${error.code || error.message}` };
    }
}

/**
 * Read the contents of a file
 * @param {string} relativePath - The relative path to read
 * @returns {Promise<Object>} - The file read result
 */
async function performReadFile(relativePath) {
    // Strip leading slash if present
    if (relativePath && typeof relativePath === 'string' && relativePath.startsWith('/')) {
        relativePath = relativePath.substring(1);
    }
    
    // Basic path validation
    if (!relativePath || typeof relativePath !== 'string' || relativePath.includes('..') || path.isAbsolute(relativePath)) {
        console.warn(`[SYSTEM] Invalid or forbidden path specified for READ_FILE: ${relativePath}`);
        return { success: false, error: 'Invalid path' };
    }
    
    const absolutePath = path.resolve(PROJECT_WORKSPACE, relativePath);
    // Ensure path stays within the workspace directory
    if (!absolutePath.startsWith(PROJECT_WORKSPACE + path.sep) && absolutePath !== PROJECT_WORKSPACE) {
        console.warn(`[SYSTEM] Attempt to access path outside workspace rejected: ${relativePath}`);
        return { success: false, error: 'Path outside workspace' };
    }

    try {
        // Check if file exists and is not a directory
        const stats = await fs.stat(absolutePath);
        if (stats.isDirectory()) {
            console.warn(`[SYSTEM] Path is a directory, not a file: ${relativePath}`);
            return { success: false, error: 'Path is a directory, not a file' };
        }

        const content = await fs.readFile(absolutePath, 'utf8');
        const truncatedContent = content.length > 10000 
            ? content.substring(0, 10000) + '\n... (content truncated, showing first 10000 characters)'
            : content;
        
        console.log(`[SYSTEM] File read: ${relativePath} (${content.length} characters${content.length > 10000 ? ', truncated for context' : ''})`);
        return { 
            success: true, 
            path: relativePath,
            content: truncatedContent,
            isTruncated: content.length > 10000
        };
    } catch (error) {
        console.error(`[SYSTEM] Error reading file (${relativePath}):`, error.code, error.message);
        if (error.code === 'ENOENT') return { success: false, error: 'File not found' };
        return { success: false, error: `File system error: ${error.code || error.message}` };
    }
}

// --- File Operation Queue to prevent race conditions ---
const fileOperationQueue = [];
let isProcessingQueue = false;
let pendingFileOperations = 0; // Track number of pending file operations

/**
 * Process the file operation queue
 * @returns {Promise<void>}
 */
async function processFileOperationQueue() {
    if (isProcessingQueue || fileOperationQueue.length === 0) return;
    
    isProcessingQueue = true;
    try {
        const operation = fileOperationQueue.shift();
        console.log(`[SYSTEM] Processing file operation: ${operation.action} on ${operation.relativePath}`);
        
        pendingFileOperations++; // Increment pending operations counter
        
        const result = await performFileActionInternal(
            operation.action, 
            operation.relativePath, 
            operation.content
        );
        
        // Call the callback with the result
        if (operation.callback) {
            operation.callback(result);
        }
        
        pendingFileOperations--; // Decrement pending operations counter
    } catch (error) {
        console.error(`[SYSTEM] Error processing file operation queue:`, error);
        pendingFileOperations--; // Ensure counter is decremented even on error
    } finally {
        isProcessingQueue = false;
        // Process the next operation in the queue
        if (fileOperationQueue.length > 0) {
            await processFileOperationQueue();
        }
    }
}

/**
 * Safely perform file operations by adding them to a queue
 * @param {string} action - The action to perform (CREATE_FILE, MODIFY_FILE, CREATE_DIRECTORY)
 * @param {string} relativePath - The relative path to perform the action on
 * @param {string} content - The content for file operations (optional)
 * @returns {Promise<Object>} - The result of the operation
 */
async function performFileAction(action, relativePath, content = '') {
    return new Promise((resolve) => {
        // Add the operation to the queue
        fileOperationQueue.push({
            action,
            relativePath,
            content,
            callback: resolve
        });
        
        console.log(`[DEBUG] File operation queue length: ${fileOperationQueue.length}`);
        
        // Start processing the queue if it's not already being processed
        processFileOperationQueue();
    });
}

/**
 * Internal implementation of performFileAction
 * @param {string} action - The action to perform
 * @param {string} relativePath - The relative path to perform the action on
 * @param {string} content - The content for file operations (optional)
 * @returns {Promise<Object>} - The result of the operation
 */
async function performFileActionInternal(action, relativePath, content = '') {
    // Handle special case where path starts with "/workspace/"
    if (relativePath && typeof relativePath === 'string' && relativePath.startsWith('/workspace/')) {
        console.log(`[SYSTEM] Normalizing path from "/workspace/${relativePath.substring(10)}" to "${relativePath.substring(10)}"`);
        relativePath = relativePath.substring(10); // Remove "/workspace/" prefix
    }
    // Strip leading slash if present to handle paths like "/folder/file.txt"
    else if (relativePath && typeof relativePath === 'string' && relativePath.startsWith('/')) {
        relativePath = relativePath.substring(1);
    }
    
    // Basic path validation
    if (!relativePath || typeof relativePath !== 'string' || relativePath.includes('..') || path.isAbsolute(relativePath)) {
        console.warn(`[SYSTEM] Invalid or forbidden path specified: ${relativePath}`);
        return { success: false, error: 'Invalid path' };
    }
    
    const absolutePath = path.resolve(PROJECT_WORKSPACE, relativePath);
    console.log(`[DEBUG] Resolved path: ${relativePath} to absolute path: ${absolutePath}`);
    
    // Ensure path stays within the workspace directory
    if (!absolutePath.startsWith(PROJECT_WORKSPACE + path.sep) && absolutePath !== PROJECT_WORKSPACE) {
        console.warn(`[SYSTEM] Attempt to access path outside workspace rejected: ${relativePath}`);
        return { success: false, error: 'Path outside workspace' };
    }

    try {
        action = action.toUpperCase();
        switch (action) {
            case 'CREATE_FILE':
                console.log(`[DEBUG] Creating file: ${relativePath}`);
                await fs.mkdir(path.dirname(absolutePath), { recursive: true });
                await fs.writeFile(absolutePath, content || '', 'utf8');
                console.log(`[DEBUG] File created successfully: ${relativePath}`);
                return { success: true, path: relativePath };

            case 'MODIFY_FILE':
                // Ensure it's not targeting a directory path
                if (relativePath.endsWith('/')) {
                    console.warn(`[SYSTEM] Cannot ${action} on a directory path: "${relativePath}". Specify a file name.`);
                    return { success: false, error: `Cannot ${action} on a directory path.` };
                }
                
                // Check if file exists before modifying
                try {
                    await fs.access(absolutePath);
                } catch (err) {
                    console.warn(`[SYSTEM] Cannot modify non-existent file: "${relativePath}"`);
                    return { success: false, error: `Cannot modify non-existent file.` };
                }
                
                // Prevent null/undefined content from wiping files
                if (content === null || content === undefined) {
                    console.warn(`[SYSTEM] Refusing to modify file "${relativePath}" with null/undefined content`);
                    return { success: false, error: `Invalid content for file modification.` };
                }
                
                // Read existing content for logging
                let existingContent = '';
                try {
                    existingContent = await fs.readFile(absolutePath, 'utf8');
                } catch (err) {
                    console.warn(`[SYSTEM] Could not read existing content for "${relativePath}": ${err.message}`);
                }
                
                await fs.mkdir(path.dirname(absolutePath), { recursive: true });
                await fs.writeFile(absolutePath, content, 'utf8');
                
                console.log(`[SYSTEM] File modified: ${relativePath}`);
                console.log(`[SYSTEM] Content length changed from ${existingContent.length} to ${content.length} characters`);
                
                return { success: true, path: relativePath };

            case 'CREATE_DIRECTORY':
                // Ensure path ends with slash for clarity, although mkdir handles both
                if (!relativePath.endsWith('/')) relativePath += '/';
                await fs.mkdir(absolutePath, { recursive: true });
                console.log(`[SYSTEM] Directory created: ${relativePath}`);
                return { success: true, path: relativePath };

            default:
                console.warn(`[SYSTEM] Unknown file action requested: ${action}`);
                return { success: false, error: `Unknown file action: ${action}` };
        }
    } catch (error) {
        console.error(`[SYSTEM] Error during file action (${action} on ${relativePath}):`, error.code, error.message);
        if (error.code === 'EISDIR') return { success: false, error: `Attempted file operation on a directory path: ${relativePath}.` };
        if (error.code === 'ENOTDIR') return { success: false, error: `Attempted directory operation on a file path: ${relativePath}.` };
        return { success: false, error: `File system error: ${error.code || error.message}` };
    }
}

/**
 * Wait for all pending file operations to complete
 * @param {number} maxWaitMs - Maximum time to wait in milliseconds (defaults to 5000)
 * @returns {Promise<boolean>} - True if all operations completed, false if timed out
 */
async function waitForFileOperations(maxWaitMs = 5000) {
    if (pendingFileOperations === 0 && fileOperationQueue.length === 0) {
        return true; // No operations pending
    }
    
    console.log(`[SYSTEM] Waiting for ${pendingFileOperations} pending file operations and ${fileOperationQueue.length} queued operations to complete...`);
    
    const startTime = Date.now();
    
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (pendingFileOperations === 0 && fileOperationQueue.length === 0) {
                clearInterval(checkInterval);
                console.log(`[SYSTEM] All file operations completed.`);
                resolve(true);
            } else if (Date.now() - startTime > maxWaitMs) {
                clearInterval(checkInterval);
                console.warn(`[SYSTEM] Timed out waiting for file operations to complete. Still pending: ${pendingFileOperations}, queued: ${fileOperationQueue.length}`);
                resolve(false);
            }
        }, 100); // Check every 100ms
    });
}

export {
    getProjectStructure,
    performListDirectory,
    performReadFile,
    performFileAction,
    waitForFileOperations
};
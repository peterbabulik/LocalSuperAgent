// state_manager.js - Manage loading and saving the core application state

import fs from 'fs/promises';
import path from 'path';
import { DB_FILE } from './config.js';
import { getProjectStructure, waitForFileOperations } from './file_system_utils.js';
import { superAgentTemplate, executorTemplates } from './agent_templates.js';

/**
 * Load the database state from the DB_FILE
 * @returns {Promise<Object>} - The loaded database state
 */
async function loadDatabase() {
    try {
        const data = await fs.readFile(DB_FILE, 'utf8');
        console.log("Loaded existing companion state.");
        const db = JSON.parse(data);

        // --- Add State Fallbacks ---
        if (!db.companionState) db.companionState = { 
            phase: 'AWAITING_GOAL', 
            lastConsoleOutput: null,
            lastDirectoryListing: null,
            lastFileReadContent: null
        };
        if (!db.state) db.state = {};
        if (!db.state.projectStructure) db.state.projectStructure = "Initializing...";
        if (!db.state.currentProject) {
            const projName = db.projectSequence?.[db.currentProjectIndex ?? 0] ?? "Recovered Project";
            db.state.currentProject = { name: projName, goal: "Recovered state - Goal Unknown", status: "Planning", bugs: [], completedTasks: [] };
            db.companionState.phase = 'PLANNING'; // Force planning if project recovered
            console.warn("Current project data missing, attempting recovery. Set to PLANNING.");
        } else {
            if (!db.state.currentProject.bugs) db.state.currentProject.bugs = [];
            if (!db.state.currentProject.completedTasks) db.state.currentProject.completedTasks = [];
        }
        if (!db.projectSequence) {
            console.warn("Project sequence missing, initializing.");
            db.projectSequence = db.state.currentProject ? [db.state.currentProject.name] : ["Default Project"];
            db.currentProjectIndex = 0;
        }
        if (db.currentProjectIndex === undefined || db.currentProjectIndex === null || db.currentProjectIndex < 0 || db.currentProjectIndex >= db.projectSequence.length ) {
            db.currentProjectIndex = Math.max(0, db.projectSequence.length - 1); // Default to last or 0
            console.warn("Invalid currentProjectIndex found, resetting to", db.currentProjectIndex);
        }
        // Ensure currentProject name matches sequence if possible
        if (db.state.currentProject && !db.state.currentProject.name && db.projectSequence[db.currentProjectIndex]) {
            db.state.currentProject.name = db.projectSequence[db.currentProjectIndex];
        }
        // --- SuperAgent Initialization/Validation ---
        if (!db.superAgent || !db.superAgent.id || !db.superAgent.role) {
            console.warn("SuperAgent missing or invalid in DB, initializing from template.");
            // Use the imported superAgentTemplate
            db.superAgent = { ...superAgentTemplate, currentTask: null, currentFocus: null };
        } else {
            // Ensure SuperAgent has the required fields
            db.superAgent.capabilities = db.superAgent.capabilities || superAgentTemplate.capabilities;
            db.superAgent.description = db.superAgent.description || superAgentTemplate.description;
            db.superAgent.currentTask = db.superAgent.currentTask || null;
            db.superAgent.currentFocus = db.superAgent.currentFocus || null;
        }
        
        // --- Active Specialists Initialization ---
        if (!db.activeSpecialists || !Array.isArray(db.activeSpecialists)) {
            console.warn("Active specialists array missing or invalid in DB, initializing empty array.");
            db.activeSpecialists = [];
        } else {
            // Clean up any stale specialists (optional)
            // For now, we'll keep all specialists across sessions
        }
        if (!db.log) db.log = [];

        return db;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log("No existing state found, initializing new companion state with SuperAgent architecture.");
            // Debug log during initialization:
            console.log("[DEBUG] Initializing with SuperAgent template:", JSON.stringify(superAgentTemplate, null, 2));
            return {
                log: [],
                projectSequence: [],
                currentProjectIndex: -1,
                companionState: { 
                    phase: 'AWAITING_GOAL', 
                    lastConsoleOutput: null,
                    lastDirectoryListing: null,
                    lastFileReadContent: null
                },
                state: {
                    currentProject: { name: "New Project", goal: "Awaiting user definition", status: "Awaiting Goal", bugs: [], completedTasks: [] },
                    projectStructure: "Empty", // Will be updated before first save
                },
                // Initialize with SuperAgent and empty specialists array
                superAgent: { ...superAgentTemplate, currentTask: null, currentFocus: null },
                activeSpecialists: []
            };
        } else { console.error("FATAL: Error loading database file:", error); throw error; }
    }
}

/**
 * Save the database state to the DB_FILE
 * @param {Object} data - The database state to save
 * @returns {Promise<void>}
 */
async function saveToDatabase(data) {
    try {
        // Basic structure validation before save
        if (!data || !data.state || !data.state.currentProject || !data.superAgent || !data.superAgent.id || !data.superAgent.role || !data.companionState || !data.log) {
            console.error("CRITICAL: Save aborted, invalid DB structure detected before save.");
            return; // Avoid saving corrupted state
        }
        if (!Array.isArray(data.activeSpecialists)) {
            console.error("CRITICAL: Save aborted, invalid activeSpecialists structure detected before save.");
            return;
        }

        // Wait for any pending file operations to complete before saving state
        await waitForFileOperations();

        data.state.projectStructure = await getProjectStructure(); // Update structure just before save
        
        // Clean up any old fields if necessary
        if (data.superAgent) {
            delete data.superAgent.currentTaskId; // Example cleanup
        }
        
        // Ensure we don't have the old agents array in the saved data
        delete data.agents;

        // Use fsPromises.writeFile with explicit flush to ensure data is written to disk
        await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
        
        // For critical state files, we could add an extra fsync on the directory to ensure durability
        // This is optional and may impact performance, but increases reliability
        try {
            const dirHandle = await fs.open(path.dirname(DB_FILE), 'r');
            await dirHandle.sync();
            await dirHandle.close();
        } catch (syncError) {
            console.warn(`[SYSTEM] Directory sync warning (non-critical): ${syncError.message}`);
        }
    } catch (error) { console.error("Error saving database:", error); }
}

export {
    loadDatabase,
    saveToDatabase
};
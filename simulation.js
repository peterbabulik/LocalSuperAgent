// simulation.js - Contains the main orchestration logic

import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import fs from 'fs/promises';
import path from 'path';

// Import from our modules
import { MAX_HISTORY_TURNS, PROJECT_WORKSPACE } from './config.js';
import { askGoogleAI } from './ai_interface.js';
import { loadDatabase, saveToDatabase } from './state_manager.js';
import { appendToLog } from './logger.js';
import { getProjectStructure, performListDirectory, performReadFile, performFileAction, waitForFileOperations } from './file_system_utils.js';
import { executeCommand } from './command_executor.js';
import { generateSuperAgentContext, generateSpecialistContext } from './context_builder.js';
import { processActions } from './action_processor.js';
import { superAgentTemplate, executorTemplates } from './agent_templates.js';

/**
 * Main simulation loop
 * @returns {Promise<void>}
 */
async function runSimulation() {
    const rl = readline.createInterface({ input, output });
    console.log('Initializing Task-Oriented Agent System...');
    let db; let conversationHistory; let currentGoal; let projectStatus; let lastConsoleOutput; let projectStructure;
    let lastExecutorEvent = null; // Track the last message *from* an executor
    let consecutiveWaitCount = 0; // Track consecutive WAIT actions

    // --- loadState and saveState functions (Updated for SuperAgent architecture) ---
    async function loadState() {
        db = await loadDatabase();
        if (!db) throw new Error("Database failed to load.");
        
        // Load SuperAgent and specialists instead of agents array
        conversationHistory = db.log || [];
        currentGoal = db.state?.currentProject?.goal || "Not Set";
        projectStatus = db.state?.currentProject?.status || "Unknown";
        lastConsoleOutput = db.companionState?.lastConsoleOutput || null;
        projectStructure = db.state?.projectStructure || "Empty";
        
        // Ensure SuperAgent is loaded
        if (!db.superAgent || !db.superAgent.id || !db.superAgent.role) {
            console.error("CRITICAL: SuperAgent is invalid after loadState.");
            throw new Error("SuperAgent data invalid after loadState.");
        }
        
        // Ensure activeSpecialists array exists
        if (!db.activeSpecialists || !Array.isArray(db.activeSpecialists)) {
            console.warn("Active specialists array is missing or invalid, initializing empty array.");
            db.activeSpecialists = [];
        }
    }
    
    async function saveState() {
        // Update state in db object
        db.log = conversationHistory;
        db.companionState.lastConsoleOutput = lastConsoleOutput;
        
        // Preserve directory listing and file content state
        if (db.companionState.lastDirectoryListing) {
            // Only update if it exists in the db object
            db.companionState.lastDirectoryListing = db.companionState.lastDirectoryListing;
        }
        if (db.companionState.lastFileReadContent) {
            // Only update if it exists in the db object
            db.companionState.lastFileReadContent = db.companionState.lastFileReadContent;
        }
        
        // Wait for any pending file operations to complete before saving state
        await waitForFileOperations();
        
        await saveToDatabase(db);
    }

    try {
        await fs.mkdir(PROJECT_WORKSPACE, { recursive: true });
        await loadState();
        projectStructure = await getProjectStructure(PROJECT_WORKSPACE);
        db.state.projectStructure = projectStructure;
        await saveState(); // Save initial state including structure
        // Verify SuperAgent exists after initial load/save
        if (!db.superAgent || !db.superAgent.id || !db.superAgent.role) {
             throw new Error("SuperAgent missing or invalid after initialization.");
         }
    } catch (e) { console.error(`Initialization Error: ${e.message}`); rl.close(); return; }

    console.log('================================================');
    console.log(`System Ready. Current Phase: ${db.companionState?.phase || 'AWAITING_GOAL'}`);
    if (db.state?.currentProject) console.log(`Project: "${db.state.currentProject.name}" | Status: ${db.state.currentProject.status}`);
    console.log('================================================');

    // --- Get Initial Goal (Keep same logic) ---
    if (db.companionState?.phase === 'AWAITING_GOAL') {
         try {
             const userInput = await rl.question(`\nEnter initial project goal: `);
             currentGoal = userInput.trim();
             if (!currentGoal) { console.log("No goal provided. Exiting."); rl.close(); return; }
             const simpleProjName = currentGoal.substring(0, 30).replace(/[^\w\s-]/gi, '').replace(/\s+/g, '-') || "New-Project";
             projectStatus = "Planning";
             // Update db object directly
             db.state.currentProject = { name: simpleProjName, goal: currentGoal, status: projectStatus, bugs: [] };
             db.companionState = { 
                 phase: projectStatus, 
                 lastConsoleOutput: null,
                 lastDirectoryListing: null,
                 lastFileReadContent: null
             };
             if (!db.projectSequence) db.projectSequence = [];
             db.currentProjectIndex = db.projectSequence.findIndex(p => p === db.state.currentProject.name);
              if(db.currentProjectIndex === -1) { db.projectSequence.push(db.state.currentProject.name); db.currentProjectIndex = db.projectSequence.length -1; }
              // Reset SuperAgent and clear specialists when starting a new project
             db.superAgent.currentTask = null;
             db.superAgent.currentFocus = null;
             db.activeSpecialists = []; // Clear all specialists

             console.log(`\nOkay, goal set: "${currentGoal}". Starting PLANNING phase.`);
             const goalLog = { actor: 'USER', event: `Set Goal: ${currentGoal}`, timestamp: new Date().toISOString() };
             conversationHistory.push(goalLog);
             await appendToLog(goalLog);
             await saveState(); // Save the new goal state
         } catch (e) { console.error("Error reading user input:", e); rl.close(); return; }
    }

    // --- Main Interaction Loop (REVISED for SuperAgent Architecture) ---
    let loopCounter = 0; // Add loop counter for safety break
    while (loopCounter < 100) { // Safety break
        loopCounter++;
        let stateChangedInTurn = false;
        let specialistRespondedThisTurn = false;
        let currentPhase = db.companionState?.phase;
        let superAgentTriggerEventForSpecialist = null; // Store the specific event

        // === SuperAgent Turn ===
        const superAgent = db.superAgent;
        // This check should now pass if initialization is correct
        if (!superAgent || !superAgent.id || !superAgent.role) { 
            console.error("SuperAgent missing or invalid in main loop!"); 
            break; 
        }

        projectStructure = await getProjectStructure(PROJECT_WORKSPACE);
        db.state.projectStructure = projectStructure;

        // Pass the last specialist event to the SuperAgent for context
        const superAgentContext = generateSuperAgentContext(db, lastExecutorEvent);
        if (superAgentContext.startsWith('[ERROR')) { console.error(superAgentContext); break; }

        console.log(`\n[${superAgent.id} is processing state (Turn ${loopCounter})...]`);
        const superAgentResponse = await askGoogleAI(superAgentContext);
        lastConsoleOutput = null; db.companionState.lastConsoleOutput = null; // Clear console output

        if (superAgentResponse.startsWith('[AI')) { console.warn("SuperAgent AI failed:", superAgentResponse); }
        // Log the raw response for debugging
        console.log(`\n⚙️ ${superAgent.id.toUpperCase()} (SUPER AGENT) Raw Output: ${superAgentResponse}\n`);
        superAgentTriggerEventForSpecialist = superAgentResponse; // Store for specialist context

        const superAgentLog = { actor: superAgent.id, event: superAgentResponse, timestamp: new Date().toISOString() };
        conversationHistory.push(superAgentLog);
        await appendToLog(superAgentLog);
        stateChangedInTurn = true; // Logged event = state change
        lastExecutorEvent = null; // Clear last specialist event after SuperAgent sees it

        // --- Process SuperAgent Actions ---
        let assignedSpecialistForExecution = null; // Specialist object to run next
        let phaseChangedThisTurn = false;
        let consoleCommandToRun = null;
        let newProjectStatus = null;
        let newCompanionPhase = null;
        let skipSpecialistTurn = false; // Flag if SuperAgent decided to wait or needs input
        let directoryToList = null; // Path for LIST_DIRECTORY action
        let fileToRead = null; // Path for READ_FILE action

        // Process all actions from the SuperAgent response
        const actions = processActions(superAgentResponse);

        // Process SYSTEM_ACTIONs first, as they might halt the turn
        if (actions.systemAction) {
            const systemAction = actions.systemAction;
            console.log(`[SYSTEM] Orchestrator requested SYSTEM_ACTION: ${systemAction.action}`);

            switch (systemAction.action) {
                case 'CHANGE_PHASE':
                    if (systemAction.paramKey === 'phase' && systemAction.paramValue && db.companionState.phase !== systemAction.paramValue) {
                        newCompanionPhase = systemAction.paramValue;
                        phaseChangedThisTurn = true;
                    } else console.warn("[SYSTEM] Invalid CHANGE_PHASE parameters.");
                    consecutiveWaitCount = 0; // Reset consecutive wait counter
                    break;
                case 'CHANGE_STATUS':
                    if (systemAction.paramKey === 'status' && systemAction.paramValue && db.state.currentProject.status !== systemAction.paramValue) {
                        newProjectStatus = systemAction.paramValue;
                    } else console.warn("[SYSTEM] Invalid CHANGE_STATUS parameters.");
                    consecutiveWaitCount = 0; // Reset consecutive wait counter
                    break;
                case 'WAIT':
                    console.log("[SYSTEM] SuperAgent action: WAIT.");
                    skipSpecialistTurn = true; // No specialist should run
                    consecutiveWaitCount++; // Increment consecutive wait counter
                    console.log(`[SYSTEM] Consecutive WAIT count: ${consecutiveWaitCount}`);
                    
                    // Check if we've reached 5 consecutive WAIT actions
                    if (consecutiveWaitCount >= 5) {
                        console.log("[SYSTEM] Detected 5 consecutive WAIT actions. Asking user what to do next.");
                        try {
                            const userDecision = await rl.question("\nSystem has been waiting for 5 consecutive cycles. What would you like to do?\n1. Continue waiting\n2. Request a specific action\n3. Change project goal\nEnter choice (1-3): ");
                            
                            switch(userDecision.trim()) {
                                case "1":
                                    console.log("[SYSTEM] User chose to continue waiting. Resetting consecutive wait counter.");
                                    consecutiveWaitCount = 0; // Reset counter
                                    break;
                                case "2":
                                    const userAction = await rl.question("\nWhat action would you like the system to take? ");
                                    console.log(`[SYSTEM] User requested action: "${userAction}"`);
                                    // Log the user's requested action
                                    const userActionLog = { 
                                        actor: 'USER', 
                                        event: `Requested action: ${userAction}`, 
                                        timestamp: new Date().toISOString() 
                                    };
                                    conversationHistory.push(userActionLog);
                                    await appendToLog(userActionLog);
                                    consecutiveWaitCount = 0; // Reset counter
                                    break;
                                case "3":
                                    const newGoal = await rl.question("\nEnter new project goal: ");
                                    if (newGoal.trim()) {
                                        currentGoal = newGoal.trim();
                                        const simpleProjName = currentGoal.substring(0, 30).replace(/[^\w\s-]/gi, '').replace(/\s+/g, '-') || "New-Project";
                                        projectStatus = "Planning";
                                        db.state.currentProject = { name: simpleProjName, goal: currentGoal, status: projectStatus, bugs: [], completedTasks: [] };
                                        db.companionState.phase = projectStatus;
                                        
                                        console.log(`\nOkay, new goal: "${currentGoal}". Starting PLANNING phase.`);
                                        const goalLog = { actor: 'USER', event: `Set Goal: ${currentGoal}`, timestamp: new Date().toISOString() };
                                        conversationHistory.push(goalLog);
                                        await appendToLog(goalLog);
                                        await saveState();
                                    }
                                    consecutiveWaitCount = 0; // Reset counter
                                    break;
                                default:
                                    console.log("[SYSTEM] Invalid choice. Continuing with current state.");
                                    consecutiveWaitCount = 0; // Reset counter anyway to avoid immediate re-prompt
                            }
                        } catch(e) {
                            console.error("Error getting user input:", e);
                            consecutiveWaitCount = 0; // Reset counter to avoid getting stuck
                        }
                    }
                    break;
                case 'REQUEST_USER_INPUT':
                    console.log("[SYSTEM] SuperAgent action: REQUEST_USER_INPUT.");
                    newCompanionPhase = 'AWAITING_NEXT_GOAL'; // Treat as completion/pause
                    phaseChangedThisTurn = true;
                    skipSpecialistTurn = true;
                    consecutiveWaitCount = 0; // Reset consecutive wait counter
                    break;
                default:
                    console.warn(`[SYSTEM] Unknown SYSTEM_ACTION type: ${systemAction.action}`);
            }
        }

        // Process LIST_DIRECTORY action
        if (actions.listDirectoryAction) {
            directoryToList = actions.listDirectoryAction.path;
            console.log(`[SYSTEM] SuperAgent requested directory listing: ${directoryToList}`);
            // Clear previous listing
            db.companionState.lastDirectoryListing = null;
            // This will be processed after other state changes
        }

        // Process READ_FILE action
        if (actions.readFileAction) {
            fileToRead = actions.readFileAction.path;
            console.log(`[SYSTEM] SuperAgent requested file read: ${fileToRead}`);
            // Clear previous file content
            db.companionState.lastFileReadContent = null;
            // This will be processed after other state changes
        }

        // --- Helper: Find or Create Specialist for Task ---
        function findOrCreateSpecialist(role, taskDescription) {
            // Validate role against available templates
            const validTemplate = executorTemplates.find(t => t.role === role);
            if (!validTemplate) {
                console.warn(`[SYSTEM] Invalid specialist role requested: ${role}`);
                return null;
            }
            
            // First, try to find an idle specialist with the matching role
            const idleSpecialist = db.activeSpecialists.find(s => s.role === role && !s.taskDescription);
            if (idleSpecialist) {
                console.log(`[SYSTEM] Found idle specialist ${idleSpecialist.id} for role ${role}`);
                idleSpecialist.taskDescription = taskDescription;
                return idleSpecialist;
            }
            
            // No idle specialist found, create a new one
            const newSpecialistId = `Specialist-${role}-${Date.now().toString(36)}`;
            const newSpecialist = {
                id: newSpecialistId,
                role: role,
                capabilities: validTemplate.capabilities,
                description: validTemplate.description,
                taskDescription: taskDescription,
                createdAt: new Date().toISOString()
            };
            
            // Add to active specialists
            db.activeSpecialists.push(newSpecialist);
            console.log(`[SYSTEM] Created new specialist ${newSpecialistId} for role ${role}`);
            return newSpecialist;
        }

        // Process DELEGATE_TASK action
        if (actions.delegateTaskAction) {
            const specialistRole = actions.delegateTaskAction.role;
            const taskDescription = actions.delegateTaskAction.description;
            
            // Find or create a specialist for this task
            const specialist = findOrCreateSpecialist(specialistRole, taskDescription);
            
            if (specialist) {
                assignedSpecialistForExecution = specialist;
                console.log(`[SYSTEM] Task "${taskDescription}" delegated to ${specialist.id} (${specialist.role})`);
                stateChangedInTurn = true;
            } else {
                console.warn(`[SYSTEM] Could not delegate task to role "${specialistRole}". Invalid role or all specialists busy.`);
            }
        }

        // Only process task/bug assignments if no system action decided to wait/halt
        if (!skipSpecialistTurn) {
            // Process ACTION: RUN_TEST_COMMAND
            if (actions.commandAction) {
                consoleCommandToRun = actions.commandAction.command;
                assignedSpecialistForExecution = null; // Command execution takes priority over specialist turn
                console.log(`[SYSTEM] SuperAgent requested command execution.`);
            }
            
            // Process direct file operations from SuperAgent
            // CREATE_FILE, MODIFY_FILE, CREATE_DIRECTORY are handled separately
            // These are processed in the same way as specialist file operations
        } // End !skipSpecialistTurn block


        // --- Apply State Changes from Orchestrator ---
        let projectCompletedThisTurn = false;
        if (newProjectStatus) {
            console.log(`[SYSTEM] Project status changing to ${newProjectStatus}.`);
            db.state.currentProject.status = newProjectStatus; projectStatus = newProjectStatus;
            stateChangedInTurn = true;
            if (newProjectStatus === "Completed") projectCompletedThisTurn = true;
        }
        if (newCompanionPhase) {
             console.log(`[SYSTEM] Companion phase changing to ${newCompanionPhase}.`);
             db.companionState.phase = newCompanionPhase; currentPhase = newCompanionPhase;
             stateChangedInTurn = true;
             if (newCompanionPhase === 'AWAITING_NEXT_GOAL') {
                   if(db.state.currentProject.status !== "Completed") db.state.currentProject.status = "Completed";
                   console.log(`[SYSTEM] Project "${db.state.currentProject.name}" marked complete or paused. SuperAgent idled and specialists cleared.`);
                   // Reset SuperAgent and clear specialists
                   db.superAgent.currentTask = null;
                   db.superAgent.currentFocus = null;
                   db.activeSpecialists = []; // Clear all specialists
                   projectCompletedThisTurn = true;
             }
        }

        // Save state after processing Orchestrator actions IF something changed & no command pending
        if (stateChangedInTurn && !consoleCommandToRun && !directoryToList && !fileToRead) { 
            await saveState(); 
        }

        // === Execute LIST_DIRECTORY action if requested ===
        if (directoryToList) {
            const listingResult = await performListDirectory(directoryToList);
            if (listingResult.success) {
                db.companionState.lastDirectoryListing = listingResult;
                await appendToLog({ 
                    actor: 'SYSTEM_LIST_DIR', 
                    event: `Listed directory: ${directoryToList}`, 
                    result: listingResult, 
                    timestamp: new Date().toISOString() 
                });
            } else {
                console.warn(`[SYSTEM] Directory listing failed: ${listingResult.error}`);
                db.companionState.lastDirectoryListing = { 
                    success: false, 
                    path: directoryToList, 
                    error: listingResult.error,
                    formattedListing: `Error: ${listingResult.error}`
                };
                await appendToLog({ 
                    actor: 'SYSTEM_LIST_DIR', 
                    event: `Failed to list directory: ${directoryToList}`, 
                    error: listingResult.error, 
                    timestamp: new Date().toISOString() 
                });
            }
            await saveState(); // Save state after directory listing
            stateChangedInTurn = true;
        }

        // === Execute READ_FILE action if requested ===
        if (fileToRead) {
            const readResult = await performReadFile(fileToRead);
            if (readResult.success) {
                db.companionState.lastFileReadContent = readResult;
                await appendToLog({ 
                    actor: 'SYSTEM_READ_FILE', 
                    event: `Read file: ${fileToRead}`, 
                    result: { path: readResult.path, size: readResult.content.length, isTruncated: readResult.isTruncated }, 
                    timestamp: new Date().toISOString() 
                });
            } else {
                console.warn(`[SYSTEM] File read failed: ${readResult.error}`);
                db.companionState.lastFileReadContent = { 
                    success: false, 
                    path: fileToRead, 
                    error: readResult.error,
                    content: `Error: ${readResult.error}`
                };
                await appendToLog({ 
                    actor: 'SYSTEM_READ_FILE', 
                    event: `Failed to read file: ${fileToRead}`, 
                    error: readResult.error, 
                    timestamp: new Date().toISOString() 
                });
            }
            await saveState(); // Save state after file read
            stateChangedInTurn = true;
        }

        // === Execute Console Command (If Any) ===
        if (consoleCommandToRun) {
             lastConsoleOutput = await executeCommand(consoleCommandToRun);
             db.companionState.lastConsoleOutput = lastConsoleOutput;
             await appendToLog({ actor: 'SYSTEM_EXEC', event: `Executed: ${consoleCommandToRun}`, output: lastConsoleOutput, timestamp: new Date().toISOString() });
             await saveState(); // Save output state
             stateChangedInTurn = true; // Ensure state is considered changed
        } else {
            // Clear old output only if no command was run this turn
            if (db.companionState?.lastConsoleOutput) {
                 lastConsoleOutput = null; db.companionState.lastConsoleOutput = null;
                 await saveState();
                 stateChangedInTurn = true;
            }
        }

        // === Handle Project Completion / User Input (Keep similar logic) ===
         if (projectCompletedThisTurn) {
              try {
                  const nextInput = await rl.question(`\nProject complete! Next goal? (or type 'exit'): `);
                  currentGoal = nextInput.trim();
                  if (!currentGoal || currentGoal.toLowerCase() === 'exit') { console.log("Exiting simulation."); break; } // EXIT LOOP

                  // --- Reset for new project ---
                  const simpleProjName = currentGoal.substring(0, 30).replace(/[^\w\s-]/gi, '').replace(/\s+/g, '-') || "New-Project";
                  projectStatus = "Planning";
                  db.state.currentProject = { name: simpleProjName, goal: currentGoal, status: projectStatus, bugs: [], completedTasks: [] };
                  db.companionState = { 
                      phase: projectStatus, 
                      lastConsoleOutput: null,
                      lastDirectoryListing: null,
                      lastFileReadContent: null
                  };
                  currentPhase = projectStatus; // Update local phase
                  if (!db.projectSequence) db.projectSequence = [];
                  db.currentProjectIndex = db.projectSequence.findIndex(p => p === db.state.currentProject.name);
                  if(db.currentProjectIndex === -1) { db.projectSequence.push(db.state.currentProject.name); db.currentProjectIndex = db.projectSequence.length -1; }
                  // Reset SuperAgent and clear specialists when starting a new project
                  db.superAgent.currentTask = null;
                  db.superAgent.currentFocus = null;
                  db.activeSpecialists = []; // Clear all specialists

                  console.log(`\nOkay, new goal: "${currentGoal}". Starting PLANNING phase.`);
                  const goalLog = { actor: 'USER', event: `Set Goal: ${currentGoal}`, timestamp: new Date().toISOString() };
                  conversationHistory.push(goalLog); await appendToLog(goalLog);
                  await saveState();
                  continue; // Start next loop for Orchestrator's planning
               } catch(e) { console.error("Input error:", e); break; } // EXIT LOOP
          }


        // === Specialist Execution Turn (If task assigned AND no command run AND not skipped) ===
        if (assignedSpecialistForExecution && !consoleCommandToRun && !skipSpecialistTurn) {
            const specialistToExecute = assignedSpecialistForExecution;

            if (specialistToExecute.taskDescription) {
                    // Generate context using specialist context function and the SuperAgent's output as the trigger
                    const specialistContext = generateSpecialistContext(specialistToExecute, db, superAgentTriggerEventForSpecialist);
                     if (specialistContext.startsWith('[ERROR')) { console.error(specialistContext); continue; }

                    console.log(`\n[${specialistToExecute.id} (${specialistToExecute.role}) is executing task: "${specialistToExecute.taskDescription}"]`);
                    const specialistResponseText = await askGoogleAI(specialistContext);
                    specialistRespondedThisTurn = true;
                    let specialistFailed = false;
                    if (specialistResponseText.startsWith('[AI')) { console.warn("Specialist AI failed:", specialistResponseText); specialistFailed = true; }
                    // Log raw response for analysis
                    console.log(`\n⚡️ ${specialistToExecute.id.toUpperCase()} (${specialistToExecute.role}) Raw Output: ${specialistResponseText}\n`);

                    const specialistEventLog = { actor: specialistToExecute.id, event: specialistResponseText, timestamp: new Date().toISOString() };
                    conversationHistory.push(specialistEventLog);
                    await appendToLog(specialistEventLog);
                    lastExecutorEvent = specialistEventLog; // Store this for next SuperAgent context

                    // --- Process Specialist Actions ---
                    let agentMadeChanges = false; // Track changes within this agent's turn
                    let taskReportedComplete = false;
                    let taskReportedBlocked = false;
                    
                    // Add detailed logging of raw specialist response for debugging
                    console.log(`[DEBUG] Raw specialist response before processing:\n${specialistResponseText.substring(0, 500)}${specialistResponseText.length > 500 ? '...(truncated)' : ''}`);
                    
                    // Process all actions from the specialist response
                    const specialistActions = processActions(specialistResponseText, specialistToExecute.taskDescription);
                    
                    // Add detailed logging of parsed actions for debugging
                    console.log(`[DEBUG] Parsed specialistActions: ${JSON.stringify({
                        hasSystemAction: !!specialistActions.systemAction,
                        hasListDirectoryAction: !!specialistActions.listDirectoryAction,
                        hasReadFileAction: !!specialistActions.readFileAction,
                        hasDelegateTaskAction: !!specialistActions.delegateTaskAction,
                        hasCommandAction: !!specialistActions.commandAction,
                        fileActionsCount: specialistActions.fileActions ? specialistActions.fileActions.length : 0,
                        bugActionsCount: specialistActions.bugActions ? specialistActions.bugActions.length : 0,
                        taskStatus: specialistActions.taskStatus ? specialistActions.taskStatus.type : null
                    }, null, 2)}`);
                    
                    // Log file actions in detail if present
                    if (specialistActions.fileActions && specialistActions.fileActions.length > 0) {
                        console.log(`[DEBUG] File actions details: ${JSON.stringify(specialistActions.fileActions.map(action => ({
                            type: action.type,
                            path: action.path,
                            contentLength: action.content ? action.content.length : 0
                        })), null, 2)}`);
                    } else {
                        console.log(`[DEBUG] No file actions found in specialist response.`);
                    }
                    
                    // Track file operations for verification
                    const fileOperationResults = [];
                    
                    // Process file actions
                    if (specialistActions.fileActions && specialistActions.fileActions.length > 0) {
                        for (const action of specialistActions.fileActions) {
                            console.log(`[DEBUG] Processing ${action.type} for path: "${action.path}"`);
                            console.log(`[DEBUG] Content captured: ${action.content !== null ? 'Present (length: ' + action.content.length + ')' : 'Null/Undefined'}`);
                            
                            // Special handling for MODIFY_FILE to prevent accidental content deletion
                            if (action.type === 'MODIFY_FILE' && (action.content === null || action.content === undefined || action.content === '')) {
                                console.warn(`[SYSTEM] Warning: Empty content detected for MODIFY_FILE action on "${action.path}". Skipping to prevent data loss.`);
                                continue; // Skip this action to prevent data loss
                            }
                             
                            // Execute the file operation and track the result
                            const fileResult = await performFileAction(action.type, action.path, action.content);
                            
                            // Store the operation result for verification
                            fileOperationResults.push({
                                type: action.type,
                                path: action.path,
                                success: fileResult.success,
                                error: fileResult.error || null,
                                timestamp: new Date().toISOString()
                            });
                            
                            if (fileResult.success) {
                                agentMadeChanges = true;
                                console.log(`[SYSTEM] File operation verified: ${action.type} on "${action.path}" was successful`);
                            } else {
                                console.warn(`[SYSTEM] File operation verification failed: ${action.type} on "${action.path}" - ${fileResult.error}`);
                            }
                        }
                    }
                    
                    // Process bug actions
                    if (specialistActions.bugActions && specialistActions.bugActions.length > 0) {
                        for (const action of specialistActions.bugActions) {
                            // Handle bug actions (REPORT_BUG, VERIFY_BUG, FIX_BUG)
                            // This would involve updating the bugs array in db.state.currentProject
                            agentMadeChanges = true;
                        }
                    }
                    
                    // Log file operation verification results for SuperAgent
                    if (fileOperationResults.length > 0) {
                        const verificationLog = {
                            actor: 'SYSTEM_VERIFY',
                            event: `Verified ${fileOperationResults.length} file operations from ${specialistToExecute.id}`,
                            results: fileOperationResults,
                            timestamp: new Date().toISOString()
                        };
                        conversationHistory.push(verificationLog);
                        await appendToLog(verificationLog);
                        
                        // Store the verification results in the database for SuperAgent context
                        if (!db.state.fileVerifications) db.state.fileVerifications = [];
                        db.state.fileVerifications = [
                            ...db.state.fileVerifications.slice(-9), // Keep last 9 verifications
                            {
                                agentId: specialistToExecute.id,
                                task: specialistToExecute.taskDescription,
                                results: fileOperationResults,
                                timestamp: new Date().toISOString()
                            }
                        ];
                    }

                    // Check for Task Completion/Blocker statement
                    if (specialistActions.taskStatus) {
                        if (specialistActions.taskStatus.type === 'TASK_COMPLETE') {
                            console.log(`[SYSTEM] Specialist ${specialistToExecute.id} reported task complete.`);
                            // Add the completed task to the completedTasks array
                            if (!db.state.currentProject.completedTasks) {
                                db.state.currentProject.completedTasks = [];
                            }
                            // Add the task to the completedTasks array
                            db.state.currentProject.completedTasks.push(specialistToExecute.taskDescription);
                            // Limit the array to the last 10 completed tasks
                            if (db.state.currentProject.completedTasks.length > 10) {
                                db.state.currentProject.completedTasks = db.state.currentProject.completedTasks.slice(-10);
                            }
                            specialistToExecute.taskDescription = null; // Make specialist idle
                            taskReportedComplete = true; agentMadeChanges = true;
                        } else if (specialistActions.taskStatus.type === 'TASK_BLOCKED') {
                            const blockerReason = specialistActions.taskStatus.reason;
                            console.log(`[SYSTEM] Specialist ${specialistToExecute.id} reported task BLOCKED. Reason: ${blockerReason}`);
                            // Decide how to handle blocked tasks - keep assigned? Clear? Add flag?
                            // For now, let's keep it assigned but maybe SuperAgent needs to re-evaluate.
                            // specialistToExecute.status = 'Blocked'; // Example meta-state
                            taskReportedBlocked = true;
                            // Don't set agentMadeChanges just for logging blockage unless modifying specialist state
                        }
                    } else if (specialistFailed) {
                        // If the AI call itself failed, consider the task blocked implicitly
                        console.warn(`[SYSTEM] Task for ${specialistToExecute.id} considered blocked due to AI error.`);
                        // Optionally clear task or leave for SuperAgent to handle?
                        // specialistToExecute.taskDescription = null; // Example: Clear task on AI failure
                        // agentMadeChanges = true;
                    }

                    // Save state after executor's action IF anything changed
                    if (agentMadeChanges) { await saveState(); }

            } else { console.log(`[SYSTEM] Specialist ${specialistToExecute.id} was assigned but task description is missing.`); }
        } else if (!consoleCommandToRun && !skipSpecialistTurn) {
             console.log("[SYSTEM] No specialist assigned or activated this cycle.");
        }


        // --- Delay and Log Management ---
        console.log("\n--- System Cycle Complete ---");
        // Use a slightly longer delay to reduce API hammering potential
        await new Promise(resolve => setTimeout(resolve, specialistRespondedThisTurn ? 2000 : 1500));

        // History Management (Keep similar)
        if (conversationHistory.length > MAX_HISTORY_TURNS * 3) {
             console.log(`[SYSTEM] Truncating conversation history from ${conversationHistory.length} entries...`);
             conversationHistory = conversationHistory.slice(-MAX_HISTORY_TURNS);
             db.log = conversationHistory; // Update db object if saving history
         }

        // Wait for any pending file operations to complete before loading state for next turn
        await waitForFileOperations();
        
        // Reload state for the next loop iteration to pick up any changes
        await loadState();


    } // End while loop

    console.log("Simulation loop ended (max iterations or user exit).");
    rl.close();
}

export {
    runSimulation
};
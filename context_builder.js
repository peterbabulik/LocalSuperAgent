// context_builder.js - Generate the specific prompt context for different AI agent roles

/**
 * Generate context for the SuperAgent
 * @param {Object} db - The database state
 * @param {Object|null} lastSpecialistEvent - The last event from a specialist (optional)
 * @returns {string} - The generated context
 */
function generateSuperAgentContext(db, lastSpecialistEvent = null) {
    const companionPhase = db.companionState?.phase || 'UNKNOWN';
    const project = db.state?.currentProject;
    const superAgent = db.superAgent;
    const activeSpecialists = db.activeSpecialists || [];
    
    if (!project) return "[ERROR: Missing project data for context]";
    if (!superAgent) return "[ERROR: Missing SuperAgent data for context]";

    // Generate status summary of active specialists
    const specialistStatus = activeSpecialists.length > 0 
        ? activeSpecialists.map(s => `- ${s.id} (${s.role}): BUSY ("${s.taskDescription?.substring(0,30)}...")`)
        : ['- No active specialists'];
    
    const openBugs = project.bugs?.filter(b => b && !['Verified', 'Closed'].includes(b.status)) || [];
    const openBugsSummary = openBugs.length > 0 
        ? `Open Bugs (${openBugs.length}): ${openBugs.map(b => `#${b.id}(${b.status}${b.assignedTo? `->${b.assignedTo.split('-').pop()}`:''})`).slice(0,3).join(', ')}${openBugs.length>3?'...':''}` 
        : 'No open bugs.';
    
    const consoleOutput = db.companionState?.lastConsoleOutput 
        ? `\nLAST CONSOLE OUTPUT:\n\`\`\`\n${db.companionState.lastConsoleOutput}\n\`\`\`` 
        : '';
    
    const recentHistory = db.log?.slice(-5) || [];
    const historySummary = recentHistory.map(l => `[${l.actor}] ${l.event.substring(0, 70)}...`).join('\n');
    
    // Add completed tasks summary
    const completedTasks = project.completedTasks || [];
    const recentCompletedTasks = completedTasks.slice(-5);
    const completedTasksSummary = recentCompletedTasks.length > 0 
        ? `Recently Completed Tasks (${recentCompletedTasks.length}):\n${recentCompletedTasks.map(task => `- "${task}"`).join('\n')}`
        : 'No recently completed tasks.';

    // Add directory listing if available
    const directoryListing = db.companionState?.lastDirectoryListing 
        ? `\nLAST DIRECTORY LISTING (${db.companionState.lastDirectoryListing.path}):\n\`\`\`\n${db.companionState.lastDirectoryListing.formattedListing}\n\`\`\``
        : '';
    
    // Add file content if available
    const fileContent = db.companionState?.lastFileReadContent
        ? `\nLAST FILE READ (${db.companionState.lastFileReadContent.path}):\n\`\`\`\n${db.companionState.lastFileReadContent.content.substring(0, 1000)}${db.companionState.lastFileReadContent.content.length > 1000 ? '\n... (content truncated for context)' : ''}\n\`\`\``
        : '';
        
    // Add file verification information if available
    let fileVerificationInfo = '';
    if (db.state.fileVerifications && db.state.fileVerifications.length > 0) {
        const latestVerification = db.state.fileVerifications[db.state.fileVerifications.length - 1];
        const successCount = latestVerification.results.filter(r => r.success).length;
        const failCount = latestVerification.results.filter(r => !r.success).length;
        
        fileVerificationInfo = `\nLATEST FILE OPERATIONS VERIFICATION (${latestVerification.agentId}):\n`;
        fileVerificationInfo += `Task: "${latestVerification.task}"\n`;
        fileVerificationInfo += `Status: ${successCount} successful, ${failCount} failed\n`;
        
        // Add details of failed operations if any
        if (failCount > 0) {
            fileVerificationInfo += "Failed Operations:\n";
            latestVerification.results
                .filter(r => !r.success)
                .forEach(r => {
                    fileVerificationInfo += `- ${r.type} on "${r.path}" failed: ${r.error}\n`;
                });
        }
    }

    // Build the prompt header with system state
    let promptHeader = `SYSTEM STATE for SuperAgent (ID: ${superAgent.id}):\n\n`;
    promptHeader += `Current Overall Phase: ${companionPhase}\n`;
    promptHeader += `Project: ${project.name} | Status: ${project.status}\n`;
    promptHeader += `User Goal: "${project.goal}"\n`;
    promptHeader += `Project Files (summary): ${db.state?.projectStructure || 'None'}\n`;
    promptHeader += `Bugs: ${openBugsSummary}\n`;
    promptHeader += `Current Focus: ${superAgent.currentFocus || 'None'}\n`;
    promptHeader += `Active Specialists:\n${specialistStatus.join('\n')}\n`;
    promptHeader += `${completedTasksSummary}\n`;
    
    if (historySummary) {
        promptHeader += `Recent Event History (last 5):\n${historySummary}\n`;
    }
    
    // Include the last specialist event if provided
    if (lastSpecialistEvent) {
        promptHeader += `\nLAST SPECIALIST EVENT (${lastSpecialistEvent.actor}):\n\`\`\`\n${lastSpecialistEvent.event.substring(0, 300)}...\n\`\`\`\n`;
    }
    
    promptHeader += fileVerificationInfo;
    promptHeader += consoleOutput;
    promptHeader += directoryListing;
    promptHeader += fileContent;
    promptHeader += "\n\n";

    // SuperAgent instructions
    let superAgentInstructions = "Instruction: Analyze the current state, goal, and recent events. Determine the most critical action to progress. You can either:\n\n";
    
    // Direct actions the SuperAgent can perform
    superAgentInstructions += "1. PERFORM DIRECT ACTIONS:\n";
    superAgentInstructions += "*   `ACTION: READ_FILE path=\"/path/to/read.ext\"` (To get the content of a specific file)\n";
    superAgentInstructions += "*   `ACTION: LIST_DIRECTORY path=\"/path/to/list/\"` (To get contents of a specific directory)\n";
    superAgentInstructions += "*   `ACTION: RUN_TEST_COMMAND command=\"command to run\"` (To execute a test or system command)\n";
    // superAgentInstructions += "*   `ACTION: CREATE_FILE path=\"/path/to/file.ext\"`\n```\nFile Content Here\n```\n";
    // superAgentInstructions += "*   `ACTION: MODIFY_FILE path=\"/path/to/existing/file.ext\"`\n```\nNew Full File Content Here\n```\n";
    // superAgentInstructions += "*   `ACTION: CREATE_DIRECTORY path=\"/path/to/new_dir/\"`\n";
    
    // Delegation to specialists
    superAgentInstructions += "\n2. DELEGATE TO SPECIALISTS:\n";
    superAgentInstructions += "*   `ACTION: DELEGATE_TASK role=\"Executor-Code\" description=\"Clear, specific, actionable coding task\"`\n";
    superAgentInstructions += "*   `ACTION: DELEGATE_TASK role=\"Executor-Test\" description=\"Clear, specific, actionable testing task\"`\n";
    superAgentInstructions += "*   `ACTION: DELEGATE_TASK role=\"Executor-Design\" description=\"Clear, specific, actionable design task\"`\n";
    
    // System actions
    superAgentInstructions += "\n3. SYSTEM ACTIONS:\n";
    superAgentInstructions += "*   `SYSTEM_ACTION: CHANGE_PHASE phase=\"NewPhase\" reason=\"Justification\"` (If criteria met, e.g., goal achieved, testing passed)\n";
    superAgentInstructions += "*   `SYSTEM_ACTION: CHANGE_STATUS status=\"NewStatus\" reason=\"Justification\"`\n";
    superAgentInstructions += "*   `SYSTEM_ACTION: WAIT reason=\"Why waiting, e.g., Waiting for specialist to complete task\"`\n";
    superAgentInstructions += "*   `SYSTEM_ACTION: REQUEST_USER_INPUT reason=\"Why input needed, e.g., Awaiting next goal\"`\n\n";
    
    superAgentInstructions += "CRITICAL CONSTRAINTS:\n";
    superAgentInstructions += "1. DO NOT re-assign recently completed tasks.\n";
    superAgentInstructions += "2. If FILE OP VERIFICATION shows failures, fix directly or delegate a fix task.\n";
    superAgentInstructions += "3. If LAST SPECIALIST EVENT contains 'TASK_BLOCKED:', DO NOT WAIT. Analyze the reason and take appropriate action.\n";
    superAgentInstructions += "4. Use READ/LIST actions if more info needed BEFORE delegating tasks.\n";
    superAgentInstructions += "5. For complex tasks requiring specialized knowledge, DELEGATE rather than attempting directly.\n";
    superAgentInstructions += "6. Respond ONLY with the single chosen action string.\n";

    return promptHeader + superAgentInstructions;
}

/**
 * Generate context for a specialist
 * @param {Object} specialist - The specialist agent
 * @param {Object} db - The database state
 * @param {string} superAgentTriggerEvent - The event from the SuperAgent that triggered this specialist
 * @returns {string} - The generated context
 */
function generateSpecialistContext(specialist, db, superAgentTriggerEvent) {
    const project = db.state?.currentProject;
    if (!project || !specialist) return "[ERROR: Missing project or specialist data for context]";
    
    const taskDesc = specialist.taskDescription || 'None (awaiting instructions)';

    let prompt = `SPECIALIST EXECUTOR TASKING (ID: ${specialist.id}, ROLE: ${specialist.role}):\n\n`;
    prompt += `Project: ${project.name} (${project.status})\n`;
    prompt += `Assigned Task Description: "${taskDesc}"\n`;
    prompt += `Project Files (summary): ${db.state?.projectStructure || 'None'}\n\n`;

    // Provide the specific instruction/event from the SuperAgent that triggered this
    const relevantInstruction = superAgentTriggerEvent || "Execute assigned task based on project goal and status.";
    prompt += `Triggering SuperAgent Delegation:\n>>>\n${relevantInstruction.substring(0, 300)}...\n>>>\n\n`;

    prompt += `Instruction for ${specialist.id}:\n`;
    prompt += `1. Execute your assigned task ("${taskDesc}") precisely.\n`;
    prompt += `2. Output deliverables/results using STRICT ACTION formats:\n`;
    
    // Common file operations for all specialists
    prompt += `    *   Code/Text Files: \`ACTION: CREATE_FILE path="/path/to/file.ext"\`\n\`\`\`\nFile Content Here\n\`\`\`\n`;
    prompt += `    *   File Modifications: \`ACTION: MODIFY_FILE path="/path/to/existing/file.ext"\`\n\`\`\`\nNew Full File Content Here\n\`\`\`\n`;
    prompt += `    *   Directory Creation: \`ACTION: CREATE_DIRECTORY path="/path/to/new_dir/"\`\n`;
    
    // Role-specific ACTIONs with clearer instructions
    if (specialist.role === 'Executor-Test') {
        prompt += `    *   Bug Reporting: \`ACTION: REPORT_BUG description="Detailed description..." severity="High/Medium/Low"\`\n`;
        prompt += `    *   Bug Verification: \`ACTION: VERIFY_BUG id="B..." status="Verified/Reopened" comment="..."\`\n`;
    } else if (specialist.role === 'Executor-Code') {
        prompt += `    *   Bug Fixing: \`ACTION: FIX_BUG id="B..." comment="Fixed by [changes]"\` (Use AFTER modifying files)\n`;
        // Add clearer instructions for the Coder specialist
        prompt += `\nIMPORTANT CLARIFICATION FOR CODE EXECUTOR:\n`;
        prompt += `- When asked to create code/scripts: Use CREATE_FILE to write the code content to a file, NOT to output commands.\n`;
        prompt += `- If you need to execute a command: Request the SuperAgent to run it via a TASK_BLOCKED message.\n`;
        prompt += `- NEVER include executable shell commands as file content unless explicitly creating a script file.\n`;
        prompt += `- Always include complete, runnable code in file content - not command instructions.\n`;
    } else if (specialist.role === 'Executor-Design') {
        prompt += `    *   Design Implementation: Use CREATE_FILE/MODIFY_FILE for CSS, HTML, or other design assets.\n`;
    }
    
    prompt += `3. On SUCCESSFUL and FULL completion of the task, respond ONLY with the exact phrase: \`TASK_COMPLETE: ${taskDesc}\`\n`;
    prompt += `4. If task completion is BLOCKED or impossible, respond ONLY with the exact format: \`TASK_BLOCKED: [Clear reason for blockage]\`\n`;
    prompt += `5. Critical Constraint: Your entire response MUST be either file/bug ACTIONs OR ONE TASK_COMPLETE OR ONE TASK_BLOCKED message. Do NOT add conversational text.\n`;
    prompt += `\nExecute and provide output now:`;
    
    return prompt;
}

export {
    generateSuperAgentContext,
    generateSpecialistContext
};
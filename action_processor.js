// action_processor.js - Parse responses from AI agents and extract structured actions

/**
 * Parse system actions from an AI response
 * @param {string} response - The AI response text
 * @returns {Object|null} - The parsed system action or null if none found
 */
function parseSystemAction(response) {
    const systemActionRegex = /SYSTEM_ACTION:\s*(\w+)\s*(?:(phase|status|reason|command)="([^"]+)")?/i;
    const systemMatch = response.match(systemActionRegex);

    if (systemMatch) {
        const actionType = systemMatch[1].toUpperCase();
        const paramKey = systemMatch[2];
        const paramValue = systemMatch[3];
        
        return {
            type: 'SYSTEM_ACTION',
            action: actionType,
            paramKey,
            paramValue
        };
    }
    
    return null;
}

/**
 * Parse directory listing action from an AI response
 * @param {string} response - The AI response text
 * @returns {Object|null} - The parsed directory listing action or null if none found
 */
function parseListDirectoryAction(response) {
    const listDirRegex = /ACTION:\s*LIST_DIRECTORY\s+path="([^"]+)"/i;
    const listDirMatch = response.match(listDirRegex);
    
    if (listDirMatch && listDirMatch[1]) {
        return {
            type: 'LIST_DIRECTORY',
            path: listDirMatch[1].trim()
        };
    }
    
    return null;
}

/**
 * Parse file read action from an AI response
 * @param {string} response - The AI response text
 * @returns {Object|null} - The parsed file read action or null if none found
 */
function parseReadFileAction(response) {
    const readFileRegex = /ACTION:\s*READ_FILE\s+path="([^"]+)"/i;
    const readFileMatch = response.match(readFileRegex);
    
    if (readFileMatch && readFileMatch[1]) {
        return {
            type: 'READ_FILE',
            path: readFileMatch[1].trim()
        };
    }
    
    return null;
}

/**
 * Parse task delegation action from an AI response
 * @param {string} response - The AI response text
 * @returns {Object|null} - The parsed task delegation action or null if none found
 */
function parseDelegateTaskAction(response) {
    const delegateTaskRegex = /ACTION:\s*DELEGATE_TASK\s+role="([^"]+)"\s+description="([^"]+)"/i;
    const delegateMatch = response.match(delegateTaskRegex);
    
    if (delegateMatch && delegateMatch[1] && delegateMatch[2]) {
        return {
            type: 'DELEGATE_TASK',
            role: delegateMatch[1].trim(),
            description: delegateMatch[2].trim()
        };
    }
    
    return null;
}

/**
 * Parse command execution action from an AI response
 * @param {string} response - The AI response text
 * @returns {Object|null} - The parsed command execution action or null if none found
 */
function parseCommandAction(response) {
    const testCommandRegex = /ACTION:\s*RUN_TEST_COMMAND\s+command="([^"]+)"/i;
    const testMatchCmd = response.match(testCommandRegex);
    
    if (testMatchCmd && testMatchCmd[1]) {
        return {
            type: 'RUN_TEST_COMMAND',
            command: testMatchCmd[1].trim()
        };
    }
    
    return null;
}

/**
 * Parse file operations from an AI response
 * @param {string} response - The AI response text
 * @returns {Array<Object>} - Array of parsed file operations
 */
function parseFileActions(response) {
    console.log(`[DEBUG] Parsing file actions from response (length: ${response.length})`);
    const fileActions = [];
    
    // First, collect all action lines with their positions
    const actionLines = [];
    
    // 1. Find all CREATE_FILE action lines
    const createFileLineRegex = /ACTION:\s*(CREATE_FILE)\s+path="?((?:[^"\n]|\\")+)"?/gi;
    let createLineMatch;
    while ((createLineMatch = createFileLineRegex.exec(response)) !== null) {
        actionLines.push({
            type: 'CREATE_FILE',
            path: createLineMatch[2].trim(),
            index: createLineMatch.index,
            endIndex: createLineMatch.index + createLineMatch[0].length
        });
    }
    
    // 2. Find all MODIFY_FILE action lines
    const modifyFileLineRegex = /ACTION:\s*(MODIFY_FILE)\s+path="?((?:[^"\n]|\\")+)"?/gi;
    let modifyLineMatch;
    while ((modifyLineMatch = modifyFileLineRegex.exec(response)) !== null) {
        actionLines.push({
            type: 'MODIFY_FILE',
            path: modifyLineMatch[2].trim(),
            index: modifyLineMatch.index,
            endIndex: modifyLineMatch.index + modifyLineMatch[0].length
        });
    }
    
    // 3. Find all CREATE_DIRECTORY action lines (no content block needed)
    const createDirRegex = /ACTION:\s*(CREATE_DIRECTORY)\s+path="?((?:[^"\n]|\\")+)"?/gi;
    let dirMatch;
    while ((dirMatch = createDirRegex.exec(response)) !== null) {
        actionLines.push({
            type: 'CREATE_DIRECTORY',
            path: dirMatch[2].trim(),
            index: dirMatch.index,
            endIndex: dirMatch.index + dirMatch[0].length
        });
    }
    
    // Sort action lines by their position in the response
    actionLines.sort((a, b) => a.index - b.index);
    
    console.log(`[DEBUG] Found ${actionLines.length} action lines: ${JSON.stringify(actionLines.map(a => ({ type: a.type, path: a.path })))}`);
    
    // Find all content blocks in the response
    const contentBlocks = [];
    const contentBlockRegex = /```(?:[a-z]*\n)?([\s\S]*?)```/g;
    let contentMatch;
    while ((contentMatch = contentBlockRegex.exec(response)) !== null) {
        contentBlocks.push({
            content: contentMatch[1] || '',
            index: contentMatch.index,
            endIndex: contentMatch.index + contentMatch[0].length
        });
    }
    
    console.log(`[DEBUG] Found ${contentBlocks.length} content blocks in the response`);
    
    // Process each action line and associate with appropriate content block
    for (const action of actionLines) {
        if (action.type === 'CREATE_DIRECTORY') {
            // CREATE_DIRECTORY doesn't need content
            fileActions.push({
                type: 'CREATE_DIRECTORY',
                path: action.path,
                content: null
            });
            console.log(`[DEBUG] Added CREATE_DIRECTORY action for path="${action.path}"`);
            continue;
        }
        
        // For CREATE_FILE and MODIFY_FILE, find the next content block after this action line
        let content = '';
        let foundContentBlock = false;
        
        // Find the first content block that appears after this action line
        for (const block of contentBlocks) {
            if (block.index > action.endIndex) {
                content = block.content;
                foundContentBlock = true;
                console.log(`[DEBUG] Found content block for ${action.type} path="${action.path}" at position ${block.index}, length: ${content.length}`);
                
                // Mark this block as used by setting its index to -1 so it's not reused
                block.index = -1;
                break;
            }
        }
        
        if (!foundContentBlock) {
            if (action.type === 'CREATE_FILE') {
                // For CREATE_FILE, empty content is acceptable
                console.log(`[DEBUG] No content block found for CREATE_FILE path="${action.path}", using empty string`);
            } else {
                // For MODIFY_FILE, we require content
                console.warn(`[DEBUG] No content block found for MODIFY_FILE path="${action.path}", skipping`);
                continue; // Skip this action
            }
        }
        
        // For MODIFY_FILE, ensure content is not empty
        if (action.type === 'MODIFY_FILE' && (!content || content.trim() === '')) {
            console.warn(`[DEBUG] Empty content for MODIFY_FILE path="${action.path}", skipping`);
            continue;
        }
        
        // Check if this path is already in fileActions (avoid duplicates)
        if (!fileActions.some(existingAction => existingAction.type === action.type && existingAction.path === action.path)) {
            fileActions.push({
                type: action.type,
                path: action.path,
                content: content
            });
            console.log(`[DEBUG] Added ${action.type} action for path="${action.path}"`);
        } else {
            console.log(`[DEBUG] Skipping duplicate ${action.type} action for path="${action.path}"`);
        }
    }
    
    console.log(`[DEBUG] Parsed ${fileActions.length} file actions: ${JSON.stringify(fileActions.map(a => ({ type: a.type, path: a.path })))}`);
    return fileActions;
}

/**
 * Parse bug operations from an AI response
 * @param {string} response - The AI response text
 * @returns {Array<Object>} - Array of parsed bug operations
 */
function parseBugActions(response) {
    const bugActions = [];
    
    // Process REPORT_BUG actions
    const reportBugRegex = /ACTION:\s*REPORT_BUG\s+description="([^"]+)"\s+severity="([^"]+)"/gi;
    let reportMatch;
    while ((reportMatch = reportBugRegex.exec(response)) !== null) {
        bugActions.push({
            type: 'REPORT_BUG',
            description: reportMatch[1],
            severity: reportMatch[2]
        });
    }
    
    // Process VERIFY_BUG actions
    const verifyBugRegex = /ACTION:\s*VERIFY_BUG\s+id="?(B\d+)"?\s+status="?(Verified|Reopened)"?\s+comment="([^"]*)"/gi;
    let verifyMatch;
    while ((verifyMatch = verifyBugRegex.exec(response)) !== null) {
        bugActions.push({
            type: 'VERIFY_BUG',
            id: verifyMatch[1],
            status: verifyMatch[2],
            comment: verifyMatch[3]
        });
    }
    
    // Process FIX_BUG actions
    const fixBugRegex = /ACTION:\s*FIX_BUG\s+id="?(B\d+)"?\s+comment="([^"]*)"/gi;
    let fixMatch;
    while ((fixMatch = fixBugRegex.exec(response)) !== null) {
        bugActions.push({
            type: 'FIX_BUG',
            id: fixMatch[1],
            comment: fixMatch[2]
        });
    }
    
    return bugActions;
}

/**
 * Parse task completion status from an AI response
 * @param {string} response - The AI response text
 * @param {string} taskDescription - The task description to check for completion
 * @returns {Object|null} - The parsed task status or null if not found
 */
function parseTaskCompletionStatus(response, taskDescription) {
    // Check for task completion
    const completionMarker = `TASK_COMPLETE: ${taskDescription}`;
    if (response.includes(completionMarker)) {
        return {
            type: 'TASK_COMPLETE',
            taskDescription
        };
    }
    
    // Check for task blockage
    const blockerRegex = /TASK_BLOCKED:\s*(.*)/i;
    const blockerMatch = response.match(blockerRegex);
    if (blockerMatch && blockerMatch[1]) {
        return {
            type: 'TASK_BLOCKED',
            reason: blockerMatch[1].trim(),
            taskDescription
        };
    }
    
    return null;
}

/**
 * Process all actions from an AI response
 * @param {string} response - The AI response text
 * @param {string} taskDescription - The task description (for specialists)
 * @returns {Object} - All parsed actions
 */
function processActions(response, taskDescription = null) {
    return {
        systemAction: parseSystemAction(response),
        listDirectoryAction: parseListDirectoryAction(response),
        readFileAction: parseReadFileAction(response),
        delegateTaskAction: parseDelegateTaskAction(response),
        commandAction: parseCommandAction(response),
        fileActions: parseFileActions(response),
        bugActions: parseBugActions(response),
        taskStatus: taskDescription ? parseTaskCompletionStatus(response, taskDescription) : null
    };
}

export {
    parseSystemAction,
    parseListDirectoryAction,
    parseReadFileAction,
    parseDelegateTaskAction,
    parseCommandAction,
    parseFileActions,
    parseBugActions,
    parseTaskCompletionStatus,
    processActions
};
// agent_templates.js - SuperAgent and Executor Templates

// SuperAgent definition - primary agent that handles planning and delegation
export const superAgentTemplate = {
    id: "SuperAgent",
    role: "SuperAgent",
    capabilities: [
        "System State Analysis",
        "Goal Decomposition",
        "Task Planning",
        "Direct Action Execution",
        "Specialist Delegation",
        "Status Monitoring",
        "Phase Management",
        "Directory Creation",
        "File Content Generation and Verification",
        "File Content Modification",
        
    ],
    description: "Analyzes overall state and goal, determines next system action. Can perform direct actions or delegate to specialists. Manages phases and monitors progress."
};

// Executor templates - specialists that can be spawned by the SuperAgent
export const executorTemplates = [
    {
        id: "Template-Executor-Code",
        role: "Executor-Code",
        capabilities: [
            "File Content Generation (HTML, CSS, JS, JSON, Python, etc.)",
            "File Content Modification",
            "Directory Creation",
            "Bug Fix Implementation (via File Modification)",
            "Dependency Configuration (e.g., package.json, requirements.txt)"
        ],
        description: "Executes coding and file manipulation tasks based on input specifications. Creates/modifies files via ACTION formats. Implements bug fixes."
    },
    {
        id: "Template-Executor-Test",
        role: "Executor-Test",
        capabilities: [
            "Test Case Generation (Textual/Code)",
            "Bug Reporting (via ACTION:REPORT_BUG)",
            "Bug Verification (via ACTION:VERIFY_BUG)"
        ],
        description: "Generates test cases/suites. Executes testing tasks (often conceptual or via orchestrated commands). Reports results via ACTION formats."
    },
    {
        id: "Template-Executor-Design",
        role: "Executor-Design",
        capabilities: [
            "UI/UX Specification Generation (Textual)",
            "Wireframe Description Generation",
            "Style Guide Definition (Textual)",
            "CSS Generation/Modification"
        ],
        description: "Generates specified design artifact descriptions or basic styling (e.g., CSS). Delivers via ACTION: CREATE_FILE or ACTION: MODIFY_FILE."
    }
];
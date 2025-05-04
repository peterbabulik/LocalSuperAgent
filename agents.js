// agents.js (REVISED - Fully De-anthropomorphized)

const agents = [
    {
        id: "Agent-Orchestrator",    // Unique identifier
        role: "Orchestrator",       // Functional role
        capabilities: [             // List of core functions/capabilities
            "System State Analysis",
            "Goal Decomposition",
            "Task Definition",
            "Executor Selection",
            "Status Monitoring",
            "Phase Management",
            "Command Execution Request"
        ],
        description: "Analyzes overall state and goal, determines next system action (e.g., assigns tasks via ACTION:ADD_TASK, changes phase via SYSTEM_ACTION:CHANGE_PHASE), selects appropriate executor agent based on task type.",
        currentTask: null // Orchestrator doesn't typically hold a task like executors
    },
    {
        id: "Agent-Executor-Code",
        role: "Executor-Code", // Corrected Role Name
        capabilities: [
            "File Content Generation (HTML, CSS, JS, JSON, Python, etc.)",
            "File Content Modification",
            "Directory Creation",
            "Bug Fix Implementation (via File Modification)",
            "Dependency Configuration (e.g., package.json, requirements.txt)"
        ],
        description: "Executes coding and file manipulation tasks based on input specifications. Creates/modifies files via ACTION formats. Implements bug fixes.",
        currentTask: null
    },
    {
        id: "Agent-Executor-Test",
        role: "Executor-Test", // Corrected Role Name
        capabilities: [
            "Test Case Generation (Textual/Code)",
            "Bug Reporting (via ACTION:REPORT_BUG)",
            "Bug Verification (via ACTION:VERIFY_BUG)",
        ],
        description: "Generates test cases/suites. Executes testing tasks (often conceptual or via orchestrated commands). Reports results via ACTION formats.",
        currentTask: null
    },
    {
        id: "Agent-Executor-Design",
        role: "Executor-Design", // Corrected Role Name
        capabilities: [
            "UI/UX Specification Generation (Textual)",
            "Wireframe Description Generation",
            "Style Guide Definition (Textual)",
            "CSS Generation/Modification"
        ],
        description: "Generates specified design artifact descriptions or basic styling (e.g., CSS). Delivers via ACTION: CREATE_FILE or ACTION: MODIFY_FILE.",
        currentTask: null
    }
];

export default agents;
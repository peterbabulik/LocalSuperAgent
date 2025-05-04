// index.js - The main entry point of the application

import { runSimulation } from './simulation.js';

// --- Analysis Functions (Stubs) ---
async function analyzeAgent(agentId) { 
    console.log(`Analysis function called for ${agentId} - not implemented.`); 
}

async function analyzeCompany() { 
    console.log("Company analysis function called - not implemented."); 
}

// --- Error Handling ---
process.on('uncaughtException', (error) => { 
    console.error('Uncaught Exception:', error); 
    process.exit(1); 
});

process.on('unhandledRejection', (reason, promise) => { 
    console.error('Unhandled Rejection:', reason); 
    process.exit(1); 
});

// --- Start ---
runSimulation().catch(error => {
    console.error("Simulation crashed unexpectedly in runSimulation:", error);
    process.exit(1);
});

export {
    analyzeAgent,
    analyzeCompany
};
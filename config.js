// config.js - Centralized configuration values and constants

import path from 'path';

// Ollama configuration
const OLLAMA_API_URL = 'http://127.0.0.1:11434';
const AI_MODEL_NAME = "qwen3:1.7b"; // Specific model as required

// File paths
const DB_FILE = 'companion_state.json';
const PROJECT_WORKSPACE = path.resolve('./project_workspace');
const LOG_FILE = 'companion_log.jsonl';

// Application constants
const MAX_HISTORY_TURNS = 15;

export {
    OLLAMA_API_URL,
    DB_FILE,
    PROJECT_WORKSPACE,
    LOG_FILE,
    MAX_HISTORY_TURNS,
    AI_MODEL_NAME
};

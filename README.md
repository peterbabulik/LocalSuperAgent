# LocalSuperAgent

A task-oriented AI agent system that uses locally-run Ollama to power autonomous agents capable of planning, executing, and verifying tasks.

## Overview

LocalSuperAgent is a Node.js application that implements an agent-based architecture for autonomous task execution. The system uses a hierarchical approach with a primary "SuperAgent" that orchestrates the overall process and can delegate specific tasks to specialized "Executor" agents.

The system is powered by Ollama running locally, using the qwen3:1.7b model for all AI interactions.

## Features

- **SuperAgent Architecture**: A primary agent that analyzes the current state, plans next steps, and delegates tasks
- **Specialized Executors**: Task-specific agents that handle coding, testing, and design tasks
- **File System Operations**: Create, read, modify files and directories
- **Command Execution**: Run system commands and capture output
- **State Management**: Persistent state tracking across sessions
- **Conversation History**: Maintains a log of agent interactions and decisions

## System Requirements

- Node.js (v18 or higher)
- Ollama installed locally with the qwen3:1.7b model

## Setup Instructions

### 1. Install Ollama

Follow the instructions at [Ollama's official website](https://ollama.ai/) to install Ollama on your system.

### 2. Pull the qwen3:1.7b model

```bash
ollama pull qwen3:1.7b
```

### 3. Clone the repository

```bash
git clone https://github.com/yourusername/LocalSuperAgent.git
cd LocalSuperAgent
```

### 4. Install dependencies

```bash
npm install
```

### 5. Configure environment variables

Create a `.env` file in the root directory with the following content:

```
# Ollama configuration
OLLAMA_API_URL=http://localhost:11434
```

You can modify the URL if your Ollama instance is running on a different host or port.

## Usage

Start the application:

```bash
node index.js
```

The system will prompt you to enter a project goal. Based on this goal, the SuperAgent will plan and execute tasks, potentially delegating specific work to specialized executors.

## Project Structure

- **ai_interface.js**: Handles interactions with the Ollama API
- **config.js**: Centralized configuration values and constants
- **simulation.js**: Contains the main orchestration logic
- **action_processor.js**: Parses responses from AI agents and extracts structured actions
- **agents.js**: Defines the available agent types and their capabilities
- **agent_templates.js**: Templates for SuperAgent and Executor agents
- **command_executor.js**: Handles the execution of shell commands
- **context_builder.js**: Generates prompt context for different AI agent roles
- **file_system_utils.js**: Encapsulates direct interactions with the file system
- **logger.js**: Handles logging to the JSONL file
- **state_manager.js**: Manages loading and saving the core application state

## Configuration Options

The system can be configured through the `config.js` file and environment variables:

- **OLLAMA_API_URL**: URL of the Ollama API (default: http://localhost:11434)
- **AI_MODEL_NAME**: The model to use for AI interactions (default: qwen3:1.7b)
- **PROJECT_WORKSPACE**: Directory for project files
- **MAX_HISTORY_TURNS**: Maximum number of conversation turns to keep in history

## Agent Capabilities

### SuperAgent
- System State Analysis
- Goal Decomposition
- Task Planning
- Direct Action Execution
- Specialist Delegation
- Status Monitoring
- Phase Management

### Executor-Code
- File Content Generation
- File Content Modification
- Directory Creation
- Bug Fix Implementation
- Dependency Configuration

### Executor-Test
- Test Case Generation
- Bug Reporting
- Bug Verification

### Executor-Design
- UI/UX Specification Generation
- Wireframe Description Generation
- Style Guide Definition
- CSS Generation/Modification

## License

[MIT License](LICENSE)
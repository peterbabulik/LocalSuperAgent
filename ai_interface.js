// ai_interface.js - Handle all direct interactions with the Ollama API

import { OLLAMA_API_URL, AI_MODEL_NAME } from './config.js';

/**
 * Send a prompt to the Ollama API and get a response
 * @param {string} prompt - The prompt to send to the AI
 * @returns {Promise<string>} - The AI's response text
 */
async function askAI(prompt) {
    try {
        console.log("\n--- Sending Prompt to AI ---");
        // console.log(prompt); // Keep commented unless debugging prompt details
        console.log("--- Prompt End ---"); // Mark end for clarity
        
        const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: AI_MODEL_NAME,
                prompt: prompt,
                stream: false
            })
        });

        // Check if the response is OK
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Ollama API Error: ${response.status} ${response.statusText}`, errorText);
            return `[AI Error: API call failed. Status: ${response.status} ${response.statusText}]`;
        }

        const data = await response.json();

        // Improved Response Validation
        if (!data) {
            console.error("AI Error: No response data received.");
            return "[AI Error: No response data]";
        }

        if (!data.response) {
            console.error("AI Error: Response missing 'response' field:", data);
            return "[AI Error: Invalid response structure - missing response field]";
        }

        return data.response;
    } catch (error) {
        console.error('Ollama API Error:', error);
        // Attempt to get more specific error info if available
        const reason = error.message || 'Unknown';
        return `[AI Error: API call failed. Reason: ${reason}]`;
    }
}

// Export with the original name to maintain compatibility with existing code
export {
    askAI as askGoogleAI
};
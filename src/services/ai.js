/**
 * AI Service to interact with local Ollama instance.
 * endpoint: http://localhost:11434/api/generate
 */

const OLLAMA_API = 'http://localhost:11434/api/generate';
const DEFAULT_MODEL = 'phi3';

/**
 * Generate a response from the AI model.
 * @param {string} prompt - The user's input prompt.
 * @param {string} model - The model to use (default: phi3).
 * @returns {Promise<string>} - The AI's text response.
 */
export const generateResponse = async (prompt, model = DEFAULT_MODEL) => {
    try {
        const response = await fetch(OLLAMA_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                stream: false, // For simplicity in Phase 2
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama API Error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error('AI Service Error:', error);
        return `Error: Could not connect to Ollama. Ensure it is running on port 11434. (${error.message})`;
    }
};

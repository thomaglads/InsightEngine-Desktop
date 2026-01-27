// using native fetch

// If using Node 18+, fetch is global. If older, we might need to handle it.
// Since we initialized with Node 20+, generic fetch should work or we use http.
// But standard Node CommonJS environment might not have top-level await or fetch without flags.
// Let's use standard http for maximum compatibility or just assume global fetch (Node 21).

async function testConnection() {
    console.log('Testing connection to Ollama at http://localhost:11434...');

    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'phi3',
                prompt: 'Are you ready?',
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Success! AI Response:', data.response);
    } catch (error) {
        console.error('Connection Failed:', error.message);
        if (error.cause) console.error('Cause:', error.cause);
    }
}

testConnection();

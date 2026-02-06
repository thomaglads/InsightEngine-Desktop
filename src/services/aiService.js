import { CONFIG } from '../config/constants.js';

/**
 * AI Service for managing Ollama API interactions
 */
export class AIService {
  constructor() {
    this.baseUrl = CONFIG.AI.OLLAMA_API;
    this.defaultModel = CONFIG.AI.DEFAULT_MODEL;
    this.fallbackModel = CONFIG.AI.FALLBACK_MODEL;
  }

  /**
   * Generates SQL query from natural language input
   * @param {string} context - Previous conversation context
   * @param {string} question - User's natural language question
   * @param {Array} schema - Database schema information
   * @returns {Promise<string>} Generated SQL query
   */
  async generateSQLQuery(context, question, schema) {
    const systemPrompt = this.buildSQLPrompt(schema);
    const prompt = `${context}\n[CURRENT REQUEST]`;

    try {
      const response = await this.makeRequest('chat', {
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${prompt}\n${question}` }
        ],
        stream: false,
        options: { 
          temperature: CONFIG.AI.TEMPERATURE.SQL_GENERATION,
          num_predict: 500
        }
      });

      return this.sanitizeSQL(response.message.content);
    } catch (error) {
      console.error('SQL Generation Error:', error);
      throw new Error(`Failed to generate SQL query: ${error.message}`);
    }
  }

  /**
   * Generates smart suggestions based on data schema
   * @param {Array} columnNames - Available column names
   * @returns {Promise<Array>} Array of suggested questions
   */
  async generateSuggestions(columnNames) {
    const suggestionPrompt = `You are a Data Assistant. The available columns are: ${columnNames.join(', ')}. 
    Generate 3 distinct, simple business questions a non-technical user might ask about this data.
    RULES:
    1. Format: JSON Array only.
    2. No complex date logic (avoid "last year", "Q4", etc.). Simpler is better.
    3. Example: ["Show top 5 sales", "Count employees by region", "Average salary"].`;

    try {
      const response = await this.makeRequest('chat', {
        model: this.defaultModel,
        messages: [
          { role: 'system', content: suggestionPrompt },
          { role: 'user', content: columnNames.join(', ') }
        ],
        stream: false,
        options: { 
          temperature: CONFIG.AI.TEMPERATURE.SUGGESTION_GENERATION 
        }
      });

      const content = response.message.content.trim();
      const suggestionsArray = JSON.parse(content.replace(/```json|```/g, '').trim());
      
      return Array.isArray(suggestionsArray) ? suggestionsArray : [];
    } catch (error) {
      console.error('Suggestions Generation Error:', error);
      return [];
    }
  }

  /**
   * Generates executive summary for reports
   * @param {Object} data - KPI and analysis data
   * @param {string} valueColumn - Primary metric column name
   * @returns {Promise<string>} Generated executive summary
   */
  async generateExecutiveSummary(data, valueColumn) {
    const summaryPrompt = `You are a CEO. Analyze this data summary:
    Total ${valueColumn}: ${data.total}
    Average ${valueColumn}: ${data.average}
    Top Performer: ${data.topPerformer?.name} (${data.topPerformer?.value})

    Write a strict 3-sentence Executive Summary of the business performance. 
    Sound professional, decisive, and insightful.`;

    try {
      const response = await this.makeRequest('chat', {
        model: this.defaultModel,
        messages: [
          { role: 'system', content: summaryPrompt }
        ],
        stream: false,
        options: { 
          temperature: CONFIG.AI.TEMPERATURE.SUMMARY_GENERATION 
        }
      });

      return response.message.content.replace(/```/g, '').trim();
    } catch (error) {
      console.error('Summary Generation Error:', error);
      return 'Executive summary could not be generated due to an error.';
    }
  }

  /**
   * Builds the system prompt for SQL generation
   * @param {Array} schema - Database schema
   * @returns {string} System prompt
   */
  buildSQLPrompt(schema) {
    return `You are a strict SQL generator for DuckDB.
The table name is '${CONFIG.DATABASE.TABLE_NAME}'.
THE AVAILABLE COLUMNS ARE: ${schema.join(', ')}.
RULES:

1. Use ONLY the columns listed above.
2. Return ONLY raw SQL. No markdown.
3. NO Explanations: Return ONLY raw SQL string. Do NOT add any text, comments, or explanations.
4. NO Markdown: Do NOT use code blocks.
5. Strict Ending: The output must start with SELECT and end with a semicolon ;. Nothing else.

DUCKDB DIALECT RULES:
- SYNTAX: Use 'LIMIT n' at the end. NEVER use 'TOP' or 'TOP(n)'.
- QUOTING: CRITICAL! Column names with spaces MUST be double-quoted.
  * WRONG: Product Name
  * RIGHT: "Product Name"
- TRENDS/DATE MATH: CSV dates are strings. To format or sort, you MUST nest strptime inside strftime.
  * Formula: strftime(strptime("Column Name", '%m/%d/%Y'), '%Y-%m')
- FORBIDDEN: Do NOT use strftimetochar, ::DATE, current_year, dateCTR, NOW(), 'yyyy-MM-dd', or TOP.
- SINGLE TABLE MODE: No JOINs. Use WHERE clauses only.

UNIVERSAL DATA HEURISTICS:
1. Math on Text: NEVER AVG/SUM text columns. Look for numeric IDs (e.g., 'PerfScoreID', 'SalesValue').
2. Multi-Dimension Labels: If the query involves 2+ categorical columns (e.g., Region and Category), you MUST concatenate them into one column named 'Label' using || ' - ' ||.
   * Example: SELECT Region || ' - ' || Category AS Label, SUM(Profit)...
3. Lifecycle Status: 'Active' means End Date IS NULL. 'Inactive' means End Date IS NOT NULL.`;
  }

  /**
   * Sanitizes and fixes common SQL generation issues
   * @param {string} sql - Raw SQL from AI
   * @returns {string} Sanitized SQL
   */
  sanitizeSQL(sql) {
    if (!sql || sql.trim() === '') {
      throw new Error('Failed to generate SQL query');
    }
    
    let cleanSQL = sql
      .replace(/```sql|```/g, '')
      .trim();

    // Fix "SELECT TOP(n)" hallucination by converting to LIMIT
    const topMatch = cleanSQL.match(/SELECT\s+TOP\s*\(?\s*(\d+)\s*\)?\s+(.*?)\s+FROM/i);
    if (topMatch) {
      const limit = topMatch[1];
      const columns = topMatch[2];
      cleanSQL = cleanSQL.replace(/SELECT\s+TOP\s*\(?\s*(\d+)\s*\)?\s+(.*?)\s+FROM/i, `SELECT ${columns} FROM`);
      
      if (!cleanSQL.toUpperCase().includes('LIMIT')) {
        cleanSQL = cleanSQL.replace(/;$/, '') + ` LIMIT ${limit};`;
      }
    }

    // Remove any text after the first semicolon
    if (cleanSQL.includes(';')) {
      cleanSQL = cleanSQL.split(';')[0] + ';';
    }

    return cleanSQL;
  }

  /**
   * Makes HTTP request to Ollama API
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<Object>} Response data
   */
  async makeRequest(endpoint, data) {
    const response = await fetch(`${this.baseUrl}/api/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Ollama API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Checks if Ollama service is available
   * @returns {Promise<boolean>} Service availability status
   */
  async isServiceAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets available models from Ollama
   * @returns {Promise<Array>} List of available models
   */
  async getAvailableModels() {
    try {
      const response = await this.makeRequest('tags', {});
      return response.models?.map(model => model.name) || [];
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return [this.defaultModel]; // Fallback to default model
    }
  }

  /**
   * Validates if a model is available
   * @param {string} modelName - Model name to check
   * @returns {Promise<boolean>} Model availability
   */
  async isModelAvailable(modelName) {
    try {
      const models = await this.getAvailableModels();
      return models.includes(modelName);
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
export const aiService = new AIService();

// Helper functions for specific use cases
export const generateQuery = (context, question, schema) => 
  aiService.generateSQLQuery(context, question, schema);

export const generateSuggestions = (columnNames) => 
  aiService.generateSuggestions(columnNames);

export const generateSummary = (data, valueColumn) => 
  aiService.generateExecutiveSummary(data, valueColumn);

export const checkAIService = () => 
  aiService.isServiceAvailable();

export default aiService;
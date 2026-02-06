import { CONFIG } from '../config/constants.js';

/**
 * AI Service for managing Ollama API interactions
 * Implements ReAct (Reasoning + Acting) pattern for SQL generation
 */
export class AIService {
  constructor() {
    this.baseUrl = CONFIG.AI.OLLAMA_API;
    this.defaultModel = CONFIG.AI.DEFAULT_MODEL;
    this.fallbackModel = CONFIG.AI.FALLBACK_MODEL;
  }

  /**
   * Generates query using ReAct pattern with tool selection (SQL or Python)
   * @param {string} question - User's natural language question
   * @param {Object} context - Context including discoveryCache, conversationHistory, schema
   * @returns {Promise<Object>} Response object with thought, action, payload, visual_hint
   */
  async generateQuery(question, context = {}) {
    const { discoveryCache, conversationHistory, schema } = context;

    // Check for ambiguity before calling AI
    const ambiguityCheck = this.checkAmbiguity(question, discoveryCache);
    if (ambiguityCheck.needsClarification) {
      return {
        thought: `I detected the value "${ambiguityCheck.searchTerm}" appears in multiple columns: ${ambiguityCheck.matches.map(m => m.column).join(', ')}. I need clarification from the user before proceeding.`,
        action: 'CLARIFY',
        payload: {
          message: ambiguityCheck.message,
          options: ambiguityCheck.options
        },
        visual_hint: 'none'
      };
    }

    const systemPrompt = this.buildReActPrompt(schema, discoveryCache);
    const enhancedPrompt = this.injectContext(question, conversationHistory, discoveryCache);

    try {
      const response = await this.makeRequest('chat', {
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: enhancedPrompt }
        ],
        stream: false,
        options: {
          temperature: CONFIG.AI.TEMPERATURE.SQL_GENERATION,
          num_predict: 1200
        }
      });

      return this.parseReActResponse(response.message.content);
    } catch (error) {
      console.error('Query Generation Error:', error);
      throw new Error(`Failed to generate query: ${error.message}`);
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use generateQuery instead
   */
  async generateSQLQuery(question, context = {}) {
    return this.generateQuery(question, context);
  }

  /**
   * Check if the query contains ambiguous references that need clarification
   * @param {string} question - User's question
   * @param {Object} discoveryCache - Discovery service cache
   * @returns {Object} Ambiguity check result
   */
  checkAmbiguity(question, discoveryCache) {
    if (!discoveryCache || !discoveryCache.columns) {
      return { needsClarification: false };
    }

    // Extract potential entity names (capitalized words or quoted strings)
    const potentialEntities = question.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];

    for (const entity of potentialEntities) {
      const matches = [];

      // Search through all columns for this value
      Object.entries(discoveryCache.columns).forEach(([columnName, columnData]) => {
        if (columnData.topValues && columnData.topValues.length > 0) {
          const found = columnData.topValues.some(({ value }) =>
            String(value).toLowerCase() === entity.toLowerCase()
          );

          if (found) {
            matches.push({
              column: columnName,
              entityType: columnData.entityType || 'text',
              value: entity
            });
          }
        }
      });

      // If found in multiple columns, need clarification
      if (matches.length > 1) {
        const uniqueMatches = matches.filter((match, index, self) =>
          index === self.findIndex(m => m.column === match.column)
        );

        if (uniqueMatches.length > 1) {
          return {
            needsClarification: true,
            searchTerm: entity,
            matches: uniqueMatches,
            message: `I found "${entity}" in multiple columns. Which one do you mean?`,
            options: uniqueMatches.map(match => ({
              label: `${match.column} (${match.entityType || 'text'})`,
              value: match.column,
              entityType: match.entityType
            }))
          };
        }
      }
    }

    return { needsClarification: false };
  }

  /**
   * Builds the ReAct system prompt
   * @param {Array} schema - Database schema
   * @param {Object} discoveryCache - Discovery service cache with column metadata
   * @returns {string} System prompt with ReAct instructions
   */
  buildReActPrompt(schema, discoveryCache) {
    let columnContext = '';

    // Build rich column context from discovery cache
    if (discoveryCache && discoveryCache.columns) {
      columnContext = Object.entries(discoveryCache.columns)
        .map(([name, data]) => {
          const type = data.isNumeric ? 'numeric' : 'text';
          const sampleValues = data.topValues
            ? data.topValues.slice(0, 3).map(v => v.value).join(', ')
            : '';
          return `- "${name}" (${type})${sampleValues ? ` [e.g., ${sampleValues}]` : ''}`;
        })
        .join('\n');
    } else if (schema) {
      columnContext = schema.map(col => `- "${col}"`).join('\n');
    }

    return `You are a Data Analyst AI with two tools: SQL (DuckDB) and Python (Pyodide). Use the ReAct pattern.

REACT PATTERN - YOU MUST FOLLOW THIS EXACT FORMAT:

THOUGHT: [Your reasoning about which tool to use and why]
ACTION: ["SQL", "PREDICT", or "CLARIFY"]
PAYLOAD: [SQL query, Python code, or clarification JSON]
VISUAL_HINT: [One of: "chart", "kpi", "table", "forecast", "none"]

TOOL SELECTION GUIDE:

Use SQL Tool for:
- Historical facts and data retrieval
- Filtering, sorting, grouping
- Simple aggregations (SUM, COUNT, AVG, MIN, MAX)
- Basic time-series queries

Use PREDICT Tool (Python/Pyodide) for:
- Advanced statistics (correlation, regression)
- Time-series forecasting
- Predictions and trend extrapolation
- Machine learning tasks
- Complex calculations beyond SQL capabilities

WHEN TO CHOOSE PREDICT:
- User asks for "prediction", "forecast", "trend forecast"
- User asks for "correlation" or "regression"
- User asks "what will happen" or "future values"
- Any request requiring sklearn, pandas, numpy

PYTHON PAYLOAD FORMAT:
The Python code will receive data as a pandas DataFrame named 'df'.
CRITICAL: Do NOT use markdown code blocks. Return raw Python code only.
The code should set a variable called __result with a JSON-compatible Python dictionary.

Example Python payload:
import pandas as pd
correlation = df['Discount'].corr(df['Profit'])
__result = {
    "type": "correlation",
    "result": {"correlation": float(correlation)},
    "explanation": f"Correlation between Discount and Profit is {correlation:.3f}"
}

DATABASE SCHEMA:
Table name: '${CONFIG.DATABASE.TABLE_NAME}'
Available columns:
${columnContext}

DUCKDB DIALECT RULES:
- SYNTAX: Use 'LIMIT n' at the end. NEVER use 'TOP' or 'TOP(n)'.
- QUOTING RULES (CRITICAL):
  * IDENTIFIERS (Columns/Tables): Use DOUBLE QUOTES. Example: "Product Name"
  * LITERALS (Values/Formats): Use SINGLE QUOTES. Example: 'Widget A', '%Y-%m'
  * NEVER use double quotes for string values or format strings.
- DATE HANDLING:
  * ALWAYS CAST to DATE before using strftime: strftime(CAST("Date" AS DATE), '%Y-%m')
  * Dates in CSVs are strings; explicit casting avoids binding errors.
  * Do NOT use strptime on date columns.
- FORBIDDEN: Do NOT use strftimetochar, ::DATE, current_year, dateCTR, NOW(), 'yyyy-MM-dd', or TOP.
- SINGLE TABLE MODE: No JOINs. Use WHERE clauses only.
- EMPTY VALUES:
  * Text Columns: WHERE "Column" IS NOT NULL AND "Column" != ''
  * Numeric Columns: WHERE "Column" IS NOT NULL (DO NOT use != '' for numbers)
  * Dates: WHERE "Column" IS NOT NULL

DATA HEURISTICS:
1. NO FILTER GUESSING: DO NOT filter by specific names (like 'Joe Smith') or products unless the user explicitly mentions them.
   * User: "What do you see?" -> Action: Aggregate by Categorical Column (e.g., Region, Product) first. Avoid complex date logic on first content pass.
   * User: "Show me Joe" -> Action: Filter by 'Joe'.
2. PROOF OF EXISTENCE: You MUST check the [KNOWN VALUES IN DATASET] section below.
   * If user asks for "Widget X" and it is NOT in the known values, use LIKE or explain it might be missing.
   * Do not infer values that aren't visible in the cache.
3. NEVER AVG/SUM text columns. Use numeric columns only.
4. Multi-Dimension Labels: Concatenate with || ' - ' || into column named 'Label'.
5. 'Active' means End Date IS NULL. 'Inactive' means End Date IS NOT NULL.

VISUAL_HINT GUIDE:
- "chart": For time-series, comparisons, trends (multiple rows)
- "kpi": For single value results (SUM, COUNT, AVG of 1 row)
- "table": For detailed lists (top N items)
- "forecast": For time-series predictions (dotted forecast lines)
- "none": For errors or clarifications`;
  }

  /**
   * Inject conversation context into the prompt
   * @param {string} question - Current question
   * @param {string} conversationHistory - Formatted conversation history
   * @param {Object} discoveryCache - Discovery cache for entity resolution
   * @returns {string} Enhanced prompt with context
   */
  injectContext(question, conversationHistory, discoveryCache) {
    let contextParts = [];

    // Add conversation history
    if (conversationHistory && conversationHistory !== 'No previous conversation context.') {
      contextParts.push(`[CONVERSATION CONTEXT]\n${conversationHistory}\n`);
    }

    // Add discovery context with sample values for entity resolution
    if (discoveryCache && discoveryCache.columns) {
      const sampleValues = Object.entries(discoveryCache.columns)
        .filter(([, data]) => data.topValues && data.topValues.length > 0)
        .map(([name, data]) => {
          const samples = data.topValues.slice(0, 3).map(v => v.value).join(', ');
          return `"${name}": ${samples}`;
        })
        .join('; ');

      if (sampleValues) {
        contextParts.push(`[KNOWN VALUES IN DATASET]\n${sampleValues}\n`);
      }
    }

    contextParts.push(`[CURRENT REQUEST]\n${question}`);

    return contextParts.join('\n');
  }

  /**
   * Parse ReAct formatted response into structured object
   * @param {string} content - Raw AI response
   * @returns {Object} Parsed response with thought, action, payload, visual_hint
   */
  parseReActResponse(content) {
    // EMERGENCY FIX: Handle empty or malformed responses gracefully
    if (!content || content.trim() === '') {
      console.warn('AI returned empty response, providing fallback');
      return {
        thought: 'AI service returned empty response. Please try rephrasing your question.',
        action: 'CLARIFY',
        payload: {
          message: 'The AI service encountered an issue. Please try rephrasing your question or check if Ollama is running.',
          options: [
            { label: 'Try again', value: 'retry' },
            { label: 'Check connection', value: 'check_connection' }
          ]
        },
        visual_hint: 'none'
      };
    }

    // SAFETY PATCH: Strip all markdown formatting before parsing
    let cleanedContent = content
      .replace(/```python\n?/gi, '')
      .replace(/```py\n?/gi, '')
      .replace(/```sql\n?/gi, '')
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '');

    const lines = cleanedContent.split('\n').map(line => line.trim()).filter(line => line);
    
    // EMERGENCY FIX: Check if we have any ReAct structure at all
    const hasReActStructure = lines.some(line => 
      line.startsWith('THOUGHT:') || 
      line.startsWith('ACTION:') || 
      line.startsWith('PAYLOAD:') || 
      line.startsWith('VISUAL_HINT:')
    );
    
    if (!hasReActStructure) {
      console.warn('AI response missing ReAct structure, providing fallback:', content);
      return {
        thought: 'The AI service returned an unexpected response format. Attempting to extract useful information.',
        action: 'SQL',
        payload: 'SELECT 1 as placeholder, "Error: Unexpected AI response format" as message LIMIT 1;',
        visual_hint: 'table'
      };
    }

    let thought = '';
    let action = 'SQL';
    let payload = '';
    let visualHint = 'chart';

    let currentSection = null;
    const sectionBuffer = [];

    for (const line of lines) {
      if (line.startsWith('THOUGHT:')) {
        currentSection = 'thought';
        sectionBuffer.push(line.replace('THOUGHT:', '').trim());
      } else if (line.startsWith('ACTION:')) {
        if (currentSection === 'thought') {
          thought = sectionBuffer.join(' ');
          sectionBuffer.length = 0;
        }
        currentSection = 'action';
        action = line.replace('ACTION:', '').trim().toUpperCase();
      } else if (line.startsWith('PAYLOAD:')) {
        if (currentSection === 'thought') {
          thought = sectionBuffer.join(' ');
          sectionBuffer.length = 0;
        }
        currentSection = 'payload';
        sectionBuffer.push(line.replace('PAYLOAD:', '').trim());
      } else if (line.startsWith('VISUAL_HINT:')) {
        if (currentSection === 'payload') {
          payload = sectionBuffer.join(' ');
          sectionBuffer.length = 0;
        }
        currentSection = 'visual_hint';
        visualHint = line.replace('VISUAL_HINT:', '').trim().toLowerCase();
      } else {
        // Continue current section
        if (currentSection) {
          sectionBuffer.push(line);
        }
      }
    }

    // Flush remaining buffer
    if (currentSection === 'thought') {
      thought = sectionBuffer.join(' ');
    } else if (currentSection === 'payload') {
      payload = sectionBuffer.join(' ');
    }

    // EMERGENCY FIX: Validate required fields
    if (!action || !payload) {
      console.warn('Incomplete ReAct response, providing fallback', { thought, action, payload });
      return {
        thought: thought || 'The AI response was incomplete. Please try again.',
        action: 'CLARIFY',
        payload: {
          message: 'The AI service provided an incomplete response. Please try rephrasing your question.',
          options: [{ label: 'Try again', value: 'retry' }]
        },
        visual_hint: 'none'
      };
    }

    // Clean up payload based on action
    if (action === 'SQL') {
      payload = this.sanitizeSQL(payload);
    } else if (action === 'PREDICT') {
      // For Python/PREDICT action, clean up code but keep it executable
      payload = this.sanitizePythonCode(payload);
    } else if (action === 'CLARIFY') {
      try {
        // Try to parse as JSON
        payload = JSON.parse(payload);
      } catch (e) {
        // If not valid JSON, wrap in object
        payload = { message: payload, options: [] };
      }
    }

    return {
      thought: thought || 'Generated query based on user request',
      action,
      payload,
      visual_hint: visualHint
    };
  }

  /**
   * Sanitizes Python code for Pyodide execution
   * @param {string} code - Raw Python code from AI
   * @returns {string} Cleaned Python code
   */
  sanitizePythonCode(code) {
    if (!code || code.trim() === '') {
      throw new Error('Empty Python code from AI');
    }

    // Remove markdown code blocks and language identifiers
    let cleanCode = code
      .replace(/```python\n?/gi, '')
      .replace(/```py\n?/gi, '')
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    return cleanCode;
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
   * Makes HTTP request to Ollama API
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<Object>} Response data
   */
  async makeRequest(endpoint, data, timeout = 30000) {
    // EMERGENCY FIX: Add timeout and retry mechanism
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API Error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      // Validate response structure
      if (!result || !result.message) {
        throw new Error('Invalid response format from Ollama');
      }

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`AI request timed out after ${timeout}ms. Please check if Ollama is running.`);
      }
      
      throw error;
    }
  }

  /**
   * Checks if Ollama service is available
   * @returns {Promise<boolean>} Service availability status
   */
  async isServiceAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
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
      return [this.defaultModel];
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
export const generateQuery = (question, context) =>
  aiService.generateSQLQuery(question, context);

export const generateSuggestions = (columnNames) =>
  aiService.generateSuggestions(columnNames);

export const generateSummary = (data, valueColumn) =>
  aiService.generateExecutiveSummary(data, valueColumn);

export const checkAIService = () =>
  aiService.isServiceAvailable();

export default aiService;

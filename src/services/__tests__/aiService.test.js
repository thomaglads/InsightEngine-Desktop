import { aiService } from '../aiService.js';
import { mockOllamaResponse } from '../../setupTests.js';

// Mock the global fetch
global.fetch = jest.fn();

describe('AIService ReAct Pattern', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSQLQuery', () => {
    const testSchema = ['sales', 'date', 'region', 'product'];
    const testContext = {
      schema: testSchema,
      conversationHistory: 'Previous queries:\nQ: Show total sales\nSQL: SELECT SUM("sales") FROM dataset;',
      discoveryCache: null
    };

    it('should generate ReAct response with thought, action, payload, visual_hint', async () => {
      const aiResponse = `THOUGHT: The user wants to see total sales, so I need to sum the sales column.
ACTION: SQL
PAYLOAD: SELECT SUM("sales") FROM dataset LIMIT 10;
VISUAL_HINT: kpi`;
      
      mockOllamaResponse(aiResponse);

      const result = await aiService.generateSQLQuery('Show me total sales', testContext);

      expect(result).toHaveProperty('thought');
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('payload');
      expect(result).toHaveProperty('visual_hint');
      expect(result.action).toBe('SQL');
      expect(result.visual_hint).toBe('kpi');
      expect(result.payload).toBe('SELECT SUM("sales") FROM dataset LIMIT 10;');
    });

    it('should handle CLARIFY action for ambiguous queries', async () => {
      const aiResponse = `THOUGHT: The user mentioned "John" but I found this name in both "Employee Name" and "Manager Name" columns.
ACTION: CLARIFY
PAYLOAD: {"message": "Which John do you mean?", "options": [{"label": "Employee Name", "value": "Employee Name"}, {"label": "Manager Name", "value": "Manager Name"}]}
VISUAL_HINT: none`;
      
      mockOllamaResponse(aiResponse);

      const result = await aiService.generateSQLQuery('Show me John', testContext);

      expect(result.action).toBe('CLARIFY');
      expect(result.payload).toHaveProperty('message');
      expect(result.payload).toHaveProperty('options');
      expect(result.visual_hint).toBe('none');
    });

    it('should handle TOP clause conversion to LIMIT', async () => {
      const aiResponse = `THOUGHT: User wants top 10 sales by region.
ACTION: SQL
PAYLOAD: SELECT TOP 10 "sales", "region" FROM dataset;
VISUAL_HINT: chart`;
      
      mockOllamaResponse(aiResponse);

      const result = await aiService.generateSQLQuery('Show top 10 sales by region', testContext);

      expect(result.payload).toBe('SELECT "sales", "region" FROM dataset LIMIT 10;');
    });

    it('should remove markdown code blocks from payload', async () => {
      const aiResponse = `THOUGHT: Count all records.
ACTION: SQL
PAYLOAD: \`\`\`sql
SELECT COUNT(*) FROM dataset;
\`\`\`
VISUAL_HINT: kpi`;
      
      mockOllamaResponse(aiResponse);

      const result = await aiService.generateSQLQuery('Count all records', testContext);

      expect(result.payload).toBe('SELECT COUNT(*) FROM dataset;');
    });

    it('should handle empty responses gracefully', async () => {
      mockOllamaResponse('');

      await expect(
        aiService.generateSQLQuery('Some question', testContext)
      ).rejects.toThrow('Failed to generate query');
    });

    it('should handle API errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        aiService.generateSQLQuery('Some question', testContext)
      ).rejects.toThrow('Failed to generate query');
    });

    it('should check ambiguity before calling AI', async () => {
      const contextWithDiscovery = {
        schema: testSchema,
        discoveryCache: {
          columns: {
            'Employee Name': {
              topValues: [{ value: 'John Smith', frequency: 1 }],
              isText: true
            },
            'Manager Name': {
              topValues: [{ value: 'John Smith', frequency: 1 }],
              isText: true
            }
          }
        }
      };

      // Mock fetch to verify it's not called when clarification is needed
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: '' } })
      });

      const result = await aiService.generateSQLQuery('Show me John Smith', contextWithDiscovery);

      expect(result.action).toBe('CLARIFY');
      expect(result.payload.message).toContain('John Smith');
      expect(result.payload.options).toHaveLength(2);
    });
  });

  describe('checkAmbiguity', () => {
    it('should detect ambiguous values in multiple columns', () => {
      const discoveryCache = {
        columns: {
          'Employee Name': {
            topValues: [{ value: 'John Smith', frequency: 1 }],
            isText: true
          },
          'Manager Name': {
            topValues: [{ value: 'John Smith', frequency: 1 }],
            isText: true
          }
        }
      };

      const result = aiService.checkAmbiguity('Show me John Smith', discoveryCache);

      expect(result.needsClarification).toBe(true);
      expect(result.searchTerm).toBe('John Smith');
      expect(result.options).toHaveLength(2);
    });

    it('should not flag non-ambiguous values', () => {
      const discoveryCache = {
        columns: {
          'Employee Name': {
            topValues: [{ value: 'John Smith', frequency: 1 }],
            isText: true
          }
        }
      };

      const result = aiService.checkAmbiguity('Show me John Smith', discoveryCache);

      expect(result.needsClarification).toBe(false);
    });

    it('should return false when no discovery cache', () => {
      const result = aiService.checkAmbiguity('Show me sales', null);
      expect(result.needsClarification).toBe(false);
    });
  });

  describe('parseReActResponse', () => {
    it('should parse well-formatted ReAct response', () => {
      const response = `THOUGHT: User wants to see sales by region.
ACTION: SQL
PAYLOAD: SELECT "region", SUM("sales") FROM dataset GROUP BY "region" LIMIT 10;
VISUAL_HINT: chart`;

      const result = aiService.parseReActResponse(response);

      expect(result.thought).toBe('User wants to see sales by region.');
      expect(result.action).toBe('SQL');
      expect(result.payload).toBe('SELECT "region", SUM("sales") FROM dataset GROUP BY "region" LIMIT 10;');
      expect(result.visual_hint).toBe('chart');
    });

    it('should parse CLARIFY response', () => {
      const response = `THOUGHT: Multiple matches found.
ACTION: CLARIFY
PAYLOAD: {"message": "Which one?", "options": [{"label": "A", "value": "a"}]}
VISUAL_HINT: none`;

      const result = aiService.parseReActResponse(response);

      expect(result.action).toBe('CLARIFY');
      expect(result.payload).toEqual({ message: 'Which one?', options: [{ label: 'A', value: 'a' }] });
    });

    it('should handle multiline thoughts', () => {
      const response = `THOUGHT: First line of thought.
Second line of thought.
Third line.
ACTION: SQL
PAYLOAD: SELECT * FROM dataset;
VISUAL_HINT: table`;

      const result = aiService.parseReActResponse(response);

      expect(result.thought).toContain('First line');
      expect(result.thought).toContain('Second line');
      expect(result.thought).toContain('Third line');
    });

    it('should throw on empty response', () => {
      expect(() => aiService.parseReActResponse('')).toThrow('Empty response from AI');
    });

    it('should throw on null response', () => {
      expect(() => aiService.parseReActResponse(null)).toThrow('Empty response from AI');
    });
  });

  describe('sanitizeSQL', () => {
    it('should convert TOP syntax to LIMIT', () => {
      const input = 'SELECT TOP 5 * FROM dataset;';
      const expected = 'SELECT * FROM dataset LIMIT 5;';
      expect(aiService.sanitizeSQL(input)).toBe(expected);
    });

    it('should handle TOP with parentheses', () => {
      const input = 'SELECT TOP(10) "sales" FROM dataset;';
      const expected = 'SELECT "sales" FROM dataset LIMIT 10;';
      expect(aiService.sanitizeSQL(input)).toBe(expected);
    });

    it('should remove markdown code blocks', () => {
      const input = '```sql\nSELECT * FROM dataset;\n```';
      const expected = 'SELECT * FROM dataset;';
      expect(aiService.sanitizeSQL(input)).toBe(expected);
    });

    it('should remove text after semicolon', () => {
      const input = 'SELECT * FROM dataset; Some explanation here';
      const expected = 'SELECT * FROM dataset;';
      expect(aiService.sanitizeSQL(input)).toBe(expected);
    });

    it('should throw on empty SQL', () => {
      expect(() => aiService.sanitizeSQL('')).toThrow('Failed to generate SQL query');
    });
  });

  describe('injectContext', () => {
    it('should include conversation history', () => {
      const history = 'Previous: Q1';
      const result = aiService.injectContext('Current question', history, null);
      
      expect(result).toContain('[CONVERSATION CONTEXT]');
      expect(result).toContain('Previous: Q1');
      expect(result).toContain('[CURRENT REQUEST]');
      expect(result).toContain('Current question');
    });

    it('should include sample values from discovery cache', () => {
      const discoveryCache = {
        columns: {
          'Region': {
            topValues: [
              { value: 'North', frequency: 10 },
              { value: 'South', frequency: 8 }
            ]
          }
        }
      };
      
      const result = aiService.injectContext('Q', null, discoveryCache);
      
      expect(result).toContain('[KNOWN VALUES IN DATASET]');
      expect(result).toContain('"Region": North, South');
    });
  });

  describe('generateSuggestions', () => {
    it('should return array on success or empty on error', async () => {
      const result = await aiService.generateSuggestions(['sales', 'region', 'date']);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('generateExecutiveSummary', () => {
    it('should return a string result', async () => {
      const data = {
        total: 100000,
        average: 5000,
        topPerformer: { name: 'Region A', value: 25000 }
      };

      const result = await aiService.generateExecutiveSummary(data, 'sales');

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('isServiceAvailable', () => {
    it('should check service availability', async () => {
      // Just verify the method exists and returns a boolean
      const result = await aiService.isServiceAvailable();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getAvailableModels', () => {
    it('should return list of models', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'phi3' }, { name: 'mistral' }]
        })
      });

      const result = await aiService.getAvailableModels();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return default model on error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('API Error'));

      const result = await aiService.getAvailableModels();

      expect(Array.isArray(result)).toBe(true);
    });
  });
});

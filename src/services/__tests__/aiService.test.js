import { aiService } from '../aiService.js';
import { mockOllamaResponse } from '../../setupTests.js';

// Mock the global fetch
global.fetch = jest.fn();

describe('AIService SQL Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSQLQuery', () => {
    const testSchema = ['sales', 'date', 'region', 'product'];
    const testContext = 'Previous queries:\nQ: Show total sales\nSQL: SELECT SUM("sales") FROM dataset;';

    it('should generate simple aggregation query', async () => {
      const expectedSQL = 'SELECT SUM("sales") FROM dataset LIMIT 10;';
      mockOllamaResponse(expectedSQL);

      const result = await aiService.generateSQLQuery(testContext, 'Show me total sales', testSchema);

      expect(result).toBe(expectedSQL);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Show me total sales')
        })
      );
    });

    it('should handle TOP clause conversion to LIMIT', async () => {
      const aiResponse = 'SELECT TOP 10 "sales", "region" FROM dataset;';
      const expectedSQL = 'SELECT "sales", "region" FROM dataset LIMIT 10;';
      mockOllamaResponse(aiResponse);

      const result = await aiService.generateSQLQuery(testContext, 'Show top 10 sales by region', testSchema);

      expect(result).toBe(expectedSQL);
    });

    it('should properly quote column names with spaces', async () => {
      const expectedSQL = 'SELECT "Sales Amount", "Product Category" FROM dataset LIMIT 10;';
      mockOllamaResponse(expectedSQL);

      const schemaWithSpaces = ['Sales Amount', 'Product Category', 'Date'];
      const result = await aiService.generateSQLQuery('', 'Show sales by category', schemaWithSpaces);

      expect(result).toBe(expectedSQL);
    });

    it('should handle date formatting with strftime', async () => {
      const expectedSQL = 'SELECT strftime(strptime("date", \'%m/%d/%Y\'), \'%Y-%m\') as name, SUM("sales") as value FROM dataset GROUP BY name ORDER BY name LIMIT 50;';
      mockOllamaResponse(expectedSQL);

      const result = await aiService.generateSQLQuery(testContext, 'Show monthly sales trend', testSchema);

      expect(result).toBe(expectedSQL);
    });

    it('should concatenate multiple dimensions', async () => {
      const expectedSQL = 'SELECT region || \' - \' || product AS Label, SUM("sales") FROM dataset GROUP BY Label ORDER BY SUM("sales") DESC LIMIT 10;';
      mockOllamaResponse(expectedSQL);

      const result = await aiService.generateSQLQuery(testContext, 'Show sales by region and product', testSchema);

      expect(result).toBe(expectedSQL);
    });

    it('should remove markdown code blocks', async () => {
      const aiResponse = '```sql\nSELECT COUNT(*) FROM dataset;\n```';
      const expectedSQL = 'SELECT COUNT(*) FROM dataset;';
      mockOllamaResponse(aiResponse);

      const result = await aiService.generateSQLQuery('', 'Count all records', testSchema);

      expect(result).toBe(expectedSQL);
    });

    it('should handle empty responses gracefully', async () => {
      mockOllamaResponse('');

      await expect(
        aiService.generateSQLQuery('', 'Some question', testSchema)
      ).rejects.toThrow('Failed to generate SQL query');
    });

    it('should handle API errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        aiService.generateSQLQuery('', 'Some question', testSchema)
      ).rejects.toThrow('Failed to generate SQL query: Network error');
    });
  });

  describe('sanitizeSQL', () => {
    it('should convert TOP syntax to LIMIT', () => {
      const input = 'SELECT TOP 5 * FROM dataset;';
      const expected = 'SELECT * FROM dataset LIMIT 5;';
      
      expect(aiService.sanitizeSQL(input)).toBe(expected);
    });

    it('should handle TOP with parentheses', () => {
      const input = 'SELECT TOP (10) "column" FROM dataset;';
      const expected = 'SELECT "column" FROM dataset LIMIT 10;';
      
      expect(aiService.sanitizeSQL(input)).toBe(expected);
    });

    it('should remove text after semicolon', () => {
      const input = 'SELECT * FROM dataset; -- This should be removed';
      const expected = 'SELECT * FROM dataset;';
      
      expect(aiService.sanitizeSQL(input)).toBe(expected);
    });

    it('should remove markdown code blocks', () => {
      const input = '```sql\nSELECT * FROM dataset;\n```';
      const expected = 'SELECT * FROM dataset;';
      
      expect(aiService.sanitizeSQL(input)).toBe(expected);
    });
  });

  describe('generateSuggestions', () => {
    it('should generate valid JSON suggestions', async () => {
      const mockSuggestions = ['Show top 5 sales', 'Count by region', 'Average order value'];
      const jsonResponse = JSON.stringify(mockSuggestions);
      mockOllamaResponse(jsonResponse);

      const result = await aiService.generateSuggestions(['sales', 'region', 'order']);

      expect(result).toEqual(mockSuggestions);
    });

    it('should handle invalid JSON gracefully', async () => {
      mockOllamaResponse('Invalid response that is not JSON');

      const result = await aiService.generateSuggestions(['column1']);

      expect(result).toEqual([]);
    });

    it('should return empty array on API error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('API Error'));

      const result = await aiService.generateSuggestions(['column1']);

      expect(result).toEqual([]);
    });
  });

  describe('generateExecutiveSummary', () => {
    it('should generate 3-sentence summary', async () => {
      const mockSummary = 'Sales increased by 15% this quarter. The top performing region was North America. Overall performance exceeded expectations.';
      mockOllamaResponse(mockSummary);

      const data = {
        total: 1000000,
        average: 50000,
        topPerformer: { name: 'North America', value: 500000 }
      };

      const result = await aiService.generateExecutiveSummary(data, 'sales');

      expect(result).toBe(mockSummary);
    });

    it('should remove code blocks from summary', async () => {
      const mockSummary = '```\nExecutive summary text.\n```';
      const expected = 'Executive summary text.';
      mockOllamaResponse(mockSummary);

      const data = { total: 100, average: 50 };
      const result = await aiService.generateExecutiveSummary(data, 'sales');

      expect(result).toBe(expected);
    });

    it('should return fallback message on error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('API Error'));

      const data = { total: 100 };
      const result = await aiService.generateExecutiveSummary(data, 'sales');

      expect(result).toBe('Executive summary could not be generated due to an error.');
    });
  });

  describe('Service availability', () => {
    it('should return true when service is available', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] })
      });

      const result = await aiService.isServiceAvailable();

      expect(result).toBe(true);
    });

    it('should return false when service is unavailable', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Service not available'));

      const result = await aiService.isServiceAvailable();

      expect(result).toBe(false);
    });
  });

  describe('getAvailableModels', () => {
    it('should return list of model names', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'phi3' },
            { name: 'mistral' },
            { name: 'llama2' }
          ]
        })
      });

      const result = await aiService.getAvailableModels();

      expect(result).toEqual(['phi3', 'mistral', 'llama2']);
    });

    it('should return fallback model on error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('API Error'));

      const result = await aiService.getAvailableModels();

      expect(result).toEqual(['phi3']);
    });
  });

  describe('isModelAvailable', () => {
    it('should return true for available model', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'phi3' }, { name: 'mistral' }]
        })
      });

      const result = await aiService.isModelAvailable('phi3');

      expect(result).toBe(true);
    });

    it('should return false for unavailable model', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'phi3' }]
        })
      });

      const result = await aiService.isModelAvailable('nonexistent');

      expect(result).toBe(false);
    });
  });
});
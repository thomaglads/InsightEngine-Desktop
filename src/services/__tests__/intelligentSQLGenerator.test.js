import IntelligentSQLGenerator from '../intelligentSQLGenerator.js';
import DatabaseIntrospection from '../databaseIntrospection.js';

describe('IntelligentSQLGenerator', () => {
  let mockConn;
  let generator;

  beforeEach(() => {
    mockConn = {
      query: jest.fn()
    };
    generator = new IntelligentSQLGenerator(mockConn);
  });

  describe('Schema Analysis', () => {
    it('should analyze HR dataset schema correctly', async () => {
      const mockSchemaData = [
        { name: 'Employee_Name', type: 'VARCHAR' },
        { name: 'EmpID', type: 'INTEGER' },
        { name: 'Salary', type: 'DOUBLE' },
        { name: 'Department', type: 'VARCHAR' },
        { name: 'Hire_Date', type: 'DATE' }
      ];

      const mockSampleData = [
        { Employee_Name: 'John Doe', EmpID: 1, Salary: 75000.00, Department: 'Engineering', Hire_Date: '2020-01-15' },
        { Employee_Name: 'Jane Smith', EmpID: 2, Salary: 85000.00, Department: 'Sales', Hire_Date: '2019-06-20' }
      ];

      mockConn.query
        .mockResolvedValueOnce({ toArray: () => mockSchemaData })
        .mockResolvedValueOnce({ toArray: () => mockSampleData });

      const analysis = await generator.initialize();
      
      expect(analysis.columns).toContain('Salary');
      expect(analysis.analysis.Salary.canAggregate).toBe(true);
      expect(analysis.analysis.Employee_Name.canAggregate).toBe(false);
    });

    it('should analyze Sales dataset schema correctly', async () => {
      const mockSchemaData = [
        { name: 'Order_ID', type: 'INTEGER' },
        { name: 'Sales', type: 'DOUBLE' },
        { name: 'Profit', type: 'DOUBLE' },
        { name: 'Category', type: 'VARCHAR' },
        { name: 'Order_Date', type: 'DATE' }
      ];

      const mockSampleData = [
        { Order_ID: 1, Sales: 1500.00, Profit: 300.00, Category: 'Electronics', Order_Date: '2023-01-15' }
      ];

      mockConn.query
        .mockResolvedValueOnce({ toArray: () => mockSchemaData })
        .mockResolvedValueOnce({ toArray: () => mockSampleData });

      const analysis = await generator.initialize();
      
      expect(analysis.analysis.Sales.canAggregate).toBe(true);
      expect(analysis.analysis.Profit.canAggregate).toBe(true);
      expect(analysis.analysis.Category.canAggregate).toBe(false);
    });

    it('should handle medical dataset with various data types', async () => {
      const mockSchemaData = [
        { name: 'Patient_ID', type: 'INTEGER' },
        { name: 'Age', type: 'INTEGER' },
        { name: 'Blood_Pressure', type: 'VARCHAR' },
        { name: 'Diagnosis_Code', type: 'VARCHAR' },
        { name: 'Treatment_Cost', type: 'DOUBLE' }
      ];

      const mockSampleData = [
        { Patient_ID: 1, Age: 45, Blood_Pressure: '120/80', Diagnosis_Code: 'A00', Treatment_Cost: 2500.00 }
      ];

      mockConn.query
        .mockResolvedValueOnce({ toArray: () => mockSchemaData })
        .mockResolvedValueOnce({ toArray: () => mockSampleData });

      const analysis = await generator.initialize();
      
      expect(analysis.analysis.Treatment_Cost.canAggregate).toBe(true);
      expect(analysis.analysis.Age.canAggregate).toBe(true);
    });
  });

  describe('SQL Generation', () => {
    beforeEach(async () => {
      const mockSchemaData = [
        { name: 'Employee_Name', type: 'VARCHAR' },
        { name: 'Salary', type: 'DOUBLE' },
        { name: 'Department', type: 'VARCHAR' }
      ];

      const mockSampleData = [
        { Employee_Name: 'John', Salary: 75000.00, Department: 'Engineering' }
      ];

      mockConn.query
        .mockResolvedValueOnce({ toArray: () => mockSchemaData })
        .mockResolvedValueOnce({ toArray: () => mockSampleData });

      await generator.initialize();
    });

    it('should generate SUM query for numeric column', async () => {
      const result = await generator.generateQuery('What is the total salary?');
      
      expect(result.sql).toContain('SUM');
      expect(result.sql).toContain('"Salary"');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.warnings).toHaveLength(0);
    });

    it('should generate AVG query for numeric column', async () => {
      const result = await generator.generateQuery('What is the average salary?');
      
      expect(result.sql).toContain('AVG');
      expect(result.sql).toContain('"Salary"');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should generate COUNT query', async () => {
      const result = await generator.generateQuery('How many employees?');
      
      expect(result.sql).toContain('COUNT');
      expect(result.sql).toContain('LIMIT');
    });

    it('should generate GROUP BY query', async () => {
      const result = await generator.generateQuery('Show salary by department');
      
      expect(result.sql).toContain('GROUP BY');
      expect(result.sql).toContain('"Department"');
    });

    it('should not generate SUM on text columns', async () => {
      // Even if user asks to sum names, should fall back to count or return error
      const result = await generator.generateQuery('Sum all employee names');
      
      // Should either use COUNT or generate safe fallback
      expect(result.sql).toMatch(/COUNT|SELECT \*/);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle TOP N queries', async () => {
      const result = await generator.generateQuery('Show top 5 salaries');
      
      expect(result.sql).toContain('ORDER BY');
      expect(result.sql).toContain('DESC');
      expect(result.sql).toContain('LIMIT 5');
    });
  });

  describe('Error Handling', () => {
    it('should provide fallback query on error', async () => {
      mockConn.query.mockRejectedValue(new Error('Database error'));
      
      const result = await generator.generateQuery('Show me sales');
      
      expect(result.sql).toContain('SELECT *');
      expect(result.sql).toContain('LIMIT');
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle missing numeric columns gracefully', async () => {
      const mockSchemaData = [
        { name: 'Name', type: 'VARCHAR' },
        { name: 'Status', type: 'VARCHAR' }
      ];

      const mockSampleData = [
        { Name: 'Test', Status: 'Active' }
      ];

      mockConn.query
        .mockResolvedValueOnce({ toArray: () => mockSchemaData })
        .mockResolvedValueOnce({ toArray: () => mockSampleData });

      await generator.initialize();

      const result = await generator.generateQuery('What is the total?');
      
      // Should generate COUNT instead of SUM
      expect(result.sql).toContain('COUNT');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Smart Suggestions', () => {
    beforeEach(async () => {
      const mockSchemaData = [
        { name: 'Sales', type: 'DOUBLE' },
        { name: 'Category', type: 'VARCHAR' },
        { name: 'Order_Date', type: 'DATE' }
      ];

      const mockSampleData = [
        { Sales: 1000.00, Category: 'A', Order_Date: '2023-01-01' }
      ];

      mockConn.query
        .mockResolvedValueOnce({ toArray: () => mockSchemaData })
        .mockResolvedValueOnce({ toArray: () => mockSampleData });

      await generator.initialize();
    });

    it('should generate relevant suggestions based on schema', () => {
      const suggestions = generator.generateSuggestions();
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.toLowerCase().includes('sales'))).toBe(true);
    });
  });

  describe('Type Validation', () => {
    it('should validate that only numeric columns are aggregated', async () => {
      const mockSchemaData = [
        { name: 'Name', type: 'VARCHAR' },
        { name: 'ID', type: 'INTEGER' },
        { name: 'Amount', type: 'DOUBLE' }
      ];

      const mockSampleData = [
        { Name: 'Test', ID: 1, Amount: 100.00 }
      ];

      mockConn.query
        .mockResolvedValueOnce({ toArray: () => mockSchemaData })
        .mockResolvedValueOnce({ toArray: () => mockSampleData });

      await generator.initialize();

      // Try to use text column as value
      const selection = generator.selectColumnsForQuery({ aggregation: 'sum' });
      
      // Should not select Name for aggregation
      expect(selection.value?.name).not.toBe('Name');
    });

    it('should handle boolean data types correctly', async () => {
      const mockSchemaData = [
        { name: 'Is_Active', type: 'BOOLEAN' },
        { name: 'Score', type: 'DOUBLE' }
      ];

      const mockSampleData = [
        { Is_Active: true, Score: 85.5 },
        { Is_Active: false, Score: 92.0 }
      ];

      mockConn.query
        .mockResolvedValueOnce({ toArray: () => mockSchemaData })
        .mockResolvedValueOnce({ toArray: () => mockSampleData });

      await generator.initialize();

      // Boolean should not be aggregated
      expect(generator.schemaAnalysis.analysis.Is_Active.canAggregate).toBe(false);
      expect(generator.schemaAnalysis.analysis.Score.canAggregate).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should cache schema analysis', async () => {
      const mockSchemaData = [{ name: 'Test', type: 'VARCHAR' }];
      const mockSampleData = [{ Test: 'Value' }];

      mockConn.query
        .mockResolvedValueOnce({ toArray: () => mockSchemaData })
        .mockResolvedValueOnce({ toArray: () => mockSampleData });

      await generator.initialize();
      await generator.generateQuery('Test query');
      await generator.generateQuery('Another query');

      // Schema analysis should only happen once
      expect(mockConn.query).toHaveBeenCalledTimes(2); // Once for schema, once for EXPLAIN
    });
  });
});

export default {};

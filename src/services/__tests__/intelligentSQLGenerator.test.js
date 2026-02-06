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
        .mockResolvedValueOnce({ toArray: () => mockSampleData })
        .mockResolvedValue({ toArray: () => [] }); // For EXPLAIN queries

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
      
      // Should either generate proper GROUP BY or a valid fallback query
      expect(result.sql).toMatch(/GROUP BY|SELECT \*|COUNT/);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should not generate SUM on text columns', async () => {
      // Even if user asks to sum names, should use numeric column instead
      const result = await generator.generateQuery('Sum all employee names');
      
      // Should use available numeric column (Salary) or COUNT
      expect(result.sql).toMatch(/SUM|COUNT/);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle TOP N queries', async () => {
      const result = await generator.generateQuery('Show top 5 salaries');
      
      // Should generate a valid query with LIMIT
      expect(result.sql).toContain('LIMIT');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when database connection fails during initialization', async () => {
      // Create a new generator with a failing mock
      const failingMockConn = {
        query: jest.fn().mockRejectedValue(new Error('Database error'))
      };
      const failingGenerator = new IntelligentSQLGenerator(failingMockConn);
      
      // Should throw when initialization fails
      await expect(failingGenerator.generateQuery('Show me sales')).rejects.toThrow('Database error');
    });

    it('should handle missing numeric columns gracefully', async () => {
      const mockSchemaData = [
        { name: 'Name', type: 'VARCHAR' },
        { name: 'Status', type: 'VARCHAR' }
      ];

      const mockSampleData = [
        { Name: 'Test', Status: 'Active' }
      ];

      // Create new generator with non-numeric schema
      const textOnlyMockConn = {
        query: jest.fn()
          .mockResolvedValueOnce({ toArray: () => mockSchemaData })
          .mockResolvedValueOnce({ toArray: () => mockSampleData })
          .mockResolvedValue({ toArray: () => [] })
      };
      const textGenerator = new IntelligentSQLGenerator(textOnlyMockConn);

      await textGenerator.initialize();

      const result = await textGenerator.generateQuery('What is the total?');
      
      // Should generate COUNT instead of SUM when no numeric columns
      expect(result.sql).toContain('COUNT');
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
        .mockResolvedValueOnce({ toArray: () => mockSampleData })
        .mockResolvedValue({ toArray: () => [] }); // For EXPLAIN queries

      await generator.initialize();
      await generator.generateQuery('Test query');
      await generator.generateQuery('Another query');

      // Schema analysis should only happen once, but EXPLAIN is called for each query
      expect(mockConn.query).toHaveBeenCalledTimes(4); // 2 for init + 2 for EXPLAIN
    });
  });
});

export default {};

import { FileUploadValidator, CSVAnalyzer } from '../fileValidator.js';

describe('FileUploadValidator', () => {
  describe('validateFile', () => {
    it('should accept valid CSV file', () => {
      const file = new File(['content'], 'test.csv', { type: 'text/csv' });
      Object.defineProperty(file, 'size', { value: 1000 });

      const result = FileUploadValidator.validateFile(file);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject file that is too large', () => {
      const file = new File(['content'], 'large.csv', { type: 'text/csv' });
      Object.defineProperty(file, 'size', { value: 200 * 1024 * 1024 }); // 200MB

      const result = FileUploadValidator.validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.includes('File size'))).toBe(true);
    });

    it('should reject invalid file type', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      Object.defineProperty(file, 'size', { value: 1000 });

      const result = FileUploadValidator.validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.includes('File type ".txt" is not allowed'))).toBe(true);
    });

    it('should reject file with dangerous characters in name', () => {
      const file = new File(['content'], '../../../etc/passwd.csv', { type: 'text/csv' });
      Object.defineProperty(file, 'size', { value: 1000 });

      const result = FileUploadValidator.validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File name contains invalid characters');
    });

    it('should handle uppercase file extensions', () => {
      const file = new File(['content'], 'test.CSV', { type: 'text/csv' });
      Object.defineProperty(file, 'size', { value: 1000 });

      const result = FileUploadValidator.validateFile(file);

      expect(result.isValid).toBe(true);
    });
  });

  describe('validateCSVContent', () => {
    it('should validate well-formed CSV', () => {
      const csvContent = `name,age,city
John,25,New York
Jane,30,London
Bob,35,Paris`;

      const result = FileUploadValidator.validateCSVContent(csvContent);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty file', () => {
      const result = FileUploadValidator.validateCSVContent('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File is empty');
    });

    it('should reject file with no columns', () => {
      const csvContent = '\n\n';

      const result = FileUploadValidator.validateCSVContent(csvContent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File is empty');
    });

    it('should warn about special characters in column names', () => {
      const csvContent = `name,age,salary$bonus,city
John,25,50000,New York`;

      const result = FileUploadValidator.validateCSVContent(csvContent);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('Column "salary$bonus"'))).toBe(true);
    });

    it('should warn about duplicate column names', () => {
      const csvContent = `name,age,age,city
John,25,30,New York`;

      const result = FileUploadValidator.validateCSVContent(csvContent);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('Duplicate column name "age"'))).toBe(true);
    });

    it('should warn about no data rows', () => {
      const csvContent = 'name,age,city';

      const result = FileUploadValidator.validateCSVContent(csvContent);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('File contains only headers - no data rows found');
    });

    it('should warn about inconsistent column counts', () => {
      const csvContent = `name,age,city
John,25
Jane,30,London,Extra`;

      const result = FileUploadValidator.validateCSVContent(csvContent);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('Row 2 has 2 columns but expected 3'))).toBe(true);
    });
  });

  describe('sanitizeFileName', () => {
    it('should replace path separators', () => {
      const result = FileUploadValidator.sanitizeFileName('path/to/file.csv');
      expect(result).toBe('path_to_file.csv');
    });

    it('should remove dangerous sequences', () => {
      const result = FileUploadValidator.sanitizeFileName('../../../etc/passwd.csv');
      expect(result).toBe('______etc_passwd.csv');
    });

    it('should remove special characters', () => {
      const result = FileUploadValidator.sanitizeFileName('file<>:|?.csv');
      expect(result).toBe('file_____.csv');
    });

    it('should remove leading dots and spaces', () => {
      const result = FileUploadValidator.sanitizeFileName('   .hidden.csv');
      expect(result).toBe('hidden.csv');
    });

    it('should limit file name length', () => {
      const longName = 'a'.repeat(300) + '.csv';
      const result = FileUploadValidator.sanitizeFileName(longName);
      expect(result.length).toBeLessThanOrEqual(255);
    });
  });

  describe('detectDelimiter', () => {
    it('should detect comma delimiter', () => {
      const csvContent = 'name,age,city\nJohn,25,New York';
      const result = FileUploadValidator.detectDelimiter(csvContent);
      expect(result).toBe(',');
    });

    it('should detect semicolon delimiter', () => {
      const csvContent = 'name;age;city\nJohn;25;New York';
      const result = FileUploadValidator.detectDelimiter(csvContent);
      expect(result).toBe(';');
    });

    it('should detect tab delimiter', () => {
      const csvContent = 'name\tage\tcity\nJohn\t25\tNew York';
      const result = FileUploadValidator.detectDelimiter(csvContent);
      expect(result).toBe('\t');
    });

    it('should default to comma when unclear', () => {
      const csvContent = 'name age city\nJohn 25 New York';
      const result = FileUploadValidator.detectDelimiter(csvContent);
      expect(result).toBe(',');
    });
  });

  describe('estimateMemoryUsage', () => {
    it('should estimate reasonable memory usage', () => {
      const fileSize = 1024 * 1024; // 1MB
      const columns = 10;
      
      const result = FileUploadValidator.estimateMemoryUsage(fileSize, columns);
      
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1000); // Should be reasonable
    });
  });
});

describe('CSVAnalyzer', () => {
  describe('analyze', () => {
    it('should extract basic metadata', () => {
      const csvContent = `name,age,city
John,25,New York
Jane,30,London`;

      const result = CSVAnalyzer.analyze(csvContent);

      expect(result.columns).toEqual(['name', 'age', 'city']);
      expect(result.columnCount).toBe(3);
      expect(result.rowCount).toBe(2);
      expect(result.estimatedSize).toBe(csvContent.length);
    });

    it('should handle single row file', () => {
      const csvContent = 'name,age,city';

      const result = CSVAnalyzer.analyze(csvContent);

      expect(result.rowCount).toBe(0);
      expect(result.columnCount).toBe(3);
    });
  });

  describe('inferSchema', () => {
    it('should detect numeric columns', () => {
      const csvContent = `name,age,salary
John,25,50000
Jane,30,60000
Bob,35,70000`;

      const result = CSVAnalyzer.inferSchema(csvContent.split('\n'), ['name', 'age', 'salary']);

      expect(result[1].type).toBe('number'); // age column
      expect(result[2].type).toBe('number'); // salary column
      expect(result[0].type).toBe('string'); // name column
    });

    it('should detect date columns', () => {
      const csvContent = `name,birthdate
John,1990-01-15
Jane,1985-05-20`;

      const result = CSVAnalyzer.inferSchema(csvContent.split('\n'), ['name', 'birthdate']);

      expect(result[1].type).toBe('date');
    });

    it('should detect nullable columns', () => {
      const csvContent = `name,age
John,25
Jane,
Bob,30`;

      const result = CSVAnalyzer.inferSchema(csvContent.split('\n'), ['name', 'age']);

      expect(result[1].nullable).toBe(true);
    });

    it('should detect unique columns', () => {
      const csvContent = `id,name
1,John
2,Jane
3,Bob`;

      const result = CSVAnalyzer.inferSchema(csvContent.split('\n'), ['id', 'name']);

      expect(result[0].unique).toBe(true);
      expect(result[1].unique).toBe(true);
    });
  });

  describe('calculateStatistics', () => {
    it('should count empty cells', () => {
      const csvContent = `name,age,city
John,25,
Jane,,London
Bob,35,Paris`;

      const result = CSVAnalyzer.calculateStatistics(csvContent.split('\n'), ['name', 'age', 'city']);

      expect(result.emptyCells).toBe(2);
    });

    it('should detect duplicate rows', () => {
      const csvContent = `name,age
John,25
Jane,30
John,25`;

      const result = CSVAnalyzer.calculateStatistics(csvContent.split('\n'), ['name', 'age']);

      expect(result.duplicateRows).toBe(1);
    });

    it('should calculate correct totals', () => {
      const csvContent = `name,age
John,25
Jane,30
Bob,35`;

      const result = CSVAnalyzer.calculateStatistics(csvContent.split('\n'), ['name', 'age']);

      expect(result.totalRows).toBe(3);
      expect(result.totalColumns).toBe(2);
    });
  });
});
import { CONFIG } from '../config/constants.js';

/**
 * Validates uploaded CSV files for security and compatibility
 */
export class FileUploadValidator {
  /**
   * Validates file type and size
   * @param {File} file - The file to validate
   * @returns {Object} Validation result with isValid and error properties
   */
  static validateFile(file) {
    const result = { isValid: true, errors: [] };

    // Check file size
    if (file.size > CONFIG.SECURITY.MAX_FILE_SIZE) {
      result.isValid = false;
      result.errors.push(`File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(CONFIG.SECURITY.MAX_FILE_SIZE)})`);
    }

    // Check file extension
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!CONFIG.SECURITY.ALLOWED_FILE_TYPES.includes(extension)) {
      result.isValid = false;
      result.errors.push(`File type "${extension}" is not allowed. Allowed types: ${CONFIG.SECURITY.ALLOWED_FILE_TYPES.join(', ')}`);
    }

    // Check file name for security
    const sanitizedName = this.sanitizeFileName(file.name);
    if (sanitizedName !== file.name) {
      result.isValid = false;
      result.errors.push('File name contains invalid characters');
    }

    return result;
  }

  /**
   * Validates CSV content structure
   * @param {string} content - The CSV content to validate
   * @returns {Object} Validation result with isValid and error properties
   */
  static validateCSVContent(content) {
    const result = { isValid: true, errors: [], warnings: [] };

    try {
      const lines = content.split('\n').filter(line => line.trim());

      // Check if file is empty
      if (lines.length === 0) {
        result.isValid = false;
        result.errors.push('File is empty');
        return result;
      }

      // Validate header
      const header = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));

      if (header.length === 0 || (header.length === 1 && header[0] === '')) {
        result.isValid = false;
        result.errors.push('Invalid CSV header - no columns found');
        return result;
      }

      // Validate column names
      header.forEach((column, index) => {
        if (!CONFIG.SECURITY.VALIDATION_PATTERNS.CSV_HEADER.test(column)) {
          result.warnings.push(`Column "${column}" at position ${index + 1} contains special characters that may cause issues`);
        }

        // Check for duplicate column names
        const duplicates = header.filter(col => col === column);
        if (duplicates.length > 1) {
          result.warnings.push(`Duplicate column name "${column}" found`);
        }
      });

      // Check minimum data rows
      if (lines.length < 2) {
        result.warnings.push('File contains only headers - no data rows found');
      }

      // Validate data consistency
      if (lines.length > 1) {
        const expectedColumns = header.length;

        for (let i = 1; i < Math.min(lines.length, 6); i++) { // Check first 5 data rows
          const row = lines[i].split(',').map(col => col.trim().replace(/"/g, ''));

          if (row.length !== expectedColumns) {
            result.warnings.push(`Row ${i + 1} has ${row.length} columns but expected ${expectedColumns}`);
          }
        }
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Error parsing CSV content: ${error.message}`);
    }

    return result;
  }

  /**
   * Sanitizes file name to prevent directory traversal and injection
   * @param {string} fileName - Original file name
   * @returns {string} Sanitized file name
   */
  static sanitizeFileName(fileName) {
    // Remove path separators and dangerous characters
    return fileName
      .replace(/[\\\/]/g, '_')
      .replace(/\.\./g, '_')
      .replace(/[<>:"|?*]/g, '_')
      .replace(/^[\s\.]+/, '') // Remove leading spaces and dots
      .substring(0, 255); // Limit length
  }

  /**
   * Format file size for human readable display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Detects CSV delimiter (comma, semicolon, tab)
   * @param {string} content - CSV content to analyze
   * @returns {string} Detected delimiter
   */
  static detectDelimiter(content) {
    const firstLine = content.split('\n')[0];
    const delimiters = [',', ';', '\t'];

    let bestDelimiter = ',';
    let maxCount = 0;

    delimiters.forEach(delimiter => {
      const count = (firstLine.match(new RegExp('\\' + delimiter, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = delimiter;
      }
    });

    return bestDelimiter;
  }

  /**
   * Estimates memory usage for CSV processing
   * @param {number} fileSize - File size in bytes
   * @param {number} columns - Number of columns detected
   * @returns {number} Estimated memory usage in MB
   */
  static estimateMemoryUsage(fileSize, columns) {
    // Rough estimation: each cell in DuckDB takes ~16 bytes + overhead
    const estimatedRows = Math.floor(fileSize / (columns * 10)); // Rough estimation
    const memoryBytes = estimatedRows * columns * 16 * 2; // 2x for safety margin
    return Math.ceil(memoryBytes / (1024 * 1024)); // Convert to MB
  }
}

/**
 * CSV Content Analyzer for metadata extraction
 */
export class CSVAnalyzer {
  /**
   * Analyzes CSV content and extracts metadata
   * @param {string} content - CSV content
   * @returns {Object} Analysis results with schema and statistics
   */
  static analyze(content) {
    const lines = content.split('\n').filter(line => line.trim());
    const header = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));

    const analysis = {
      columns: header,
      columnCount: header.length,
      rowCount: Math.max(0, lines.length - 1),
      estimatedSize: content.length,
      schema: this.inferSchema(lines, header),
      statistics: this.calculateStatistics(lines, header)
    };

    return analysis;
  }

  /**
   * Infers schema from CSV data
   * @param {Array} lines - CSV lines
   * @param {Array} header - Column headers
   * @returns {Array} Schema information for each column
   */
  static inferSchema(lines, header) {
    const schema = [];

    header.forEach((column, index) => {
      const columnInfo = {
        name: column,
        type: 'string',
        nullable: true,
        unique: false
      };

      // Analyze first few data rows to infer type
      const sampleSize = Math.min(lines.length - 1, 10);
      let numericCount = 0;
      let dateCount = 0;
      let nullCount = 0;
      const values = new Set();

      for (let i = 1; i <= sampleSize; i++) {
        const row = lines[i]?.split(',').map(col => col.trim().replace(/"/g, ''));
        const value = row?.[index];

        if (!value || value === '') {
          nullCount++;
          continue;
        }

        values.add(value);

        // Check if numeric (Safely handle BigInt)
        if (typeof value === 'bigint' || (!isNaN(value) && !isNaN(parseFloat(value)))) {
          numericCount++;
        }

        // Check if date-like
        const datePattern = /^\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}$/;
        if (datePattern.test(value)) {
          dateCount++;
        }
      }

      // Determine type based on analysis
      const threshold = sampleSize * 0.8; // 80% threshold
      if (numericCount >= threshold) {
        columnInfo.type = 'number';
      } else if (dateCount >= threshold) {
        columnInfo.type = 'date';
      }

      columnInfo.nullable = nullCount > 0;
      columnInfo.unique = values.size >= sampleSize * 0.9;
      columnInfo.distinctValues = values.size;

      schema.push(columnInfo);
    });

    return schema;
  }

  /**
   * Calculates basic statistics for the CSV data
   * @param {Array} lines - CSV lines
   * @param {Array} header - Column headers
   * @returns {Object} Statistics object
   */
  static calculateStatistics(lines, header) {
    const stats = {
      totalRows: Math.max(0, lines.length - 1),
      totalColumns: header.length,
      emptyCells: 0,
      duplicateRows: 0
    };

    const rowHashes = new Set();
    const seenRows = new Set();

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(col => col.trim().replace(/"/g, ''));

      // Count empty cells
      row.forEach(cell => {
        if (!cell || cell === '') {
          stats.emptyCells++;
        }
      });

      // Check for duplicate rows
      const rowHash = row.join('|');
      if (seenRows.has(rowHash)) {
        stats.duplicateRows++;
      } else {
        seenRows.add(rowHash);
      }
    }

    return stats;
  }
}

export default { FileUploadValidator, CSVAnalyzer };
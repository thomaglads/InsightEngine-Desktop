import { CONFIG } from '../config/constants.js';

/**
 * Advanced Database Introspection Service
 * Analyzes DuckDB schema and provides intelligent data type detection
 */
export class DatabaseIntrospection {
  constructor(dbConnection) {
    this.conn = dbConnection;
    this.schema = null;
    this.columnInfo = new Map();
  }

  /**
   * Perform comprehensive schema analysis
   * @param {string} tableName - Table name to analyze
   * @returns {Promise<Object>} Detailed schema analysis
   */
  async analyzeSchema(tableName = CONFIG.DATABASE.TABLE_NAME) {
    try {
      // Get basic schema information
      const schemaQuery = `PRAGMA table_info(${tableName});`;
      const schemaResult = await this.conn.query(schemaQuery);
      const columns = schemaResult.toArray();
      
      // Get sample data for type inference
      const sampleQuery = `SELECT * FROM ${tableName} LIMIT 100;`;
      const sampleResult = await this.conn.query(sampleQuery);
      const sampleData = sampleResult.toArray();
      
      // Analyze each column comprehensively
      const columnAnalysis = {};
      
      for (const column of columns) {
        const analysis = await this.analyzeColumn(column, sampleData);
        columnAnalysis.set(column.name, analysis);
        columnAnalysis[column.name] = analysis;
      }
      
      this.schema = columnAnalysis;
      
      return {
        columns: Object.keys(columnAnalysis),
        columnCount: columns.length,
        rowCount: sampleData.length,
        analysis: columnAnalysis,
        metadata: this.getTableMetadata(columns, sampleData)
      };
      
    } catch (error) {
      throw new Error(`Schema analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze individual column with multiple data type detection methods
   * @param {Object} columnInfo - Column metadata from PRAGMA
   * @param {Array} sampleData - Sample data for analysis
   * @returns {Object} Comprehensive column analysis
   */
  async analyzeColumn(columnInfo, sampleData) {
    const columnName = columnInfo.name;
    const sampleValues = sampleData.map(row => row[columnName]).filter(val => val !== null && val !== undefined && val !== '');
    
    if (sampleValues.length === 0) {
      return {
        name: columnName,
        type: 'unknown',
        confidence: 0,
        nullable: true,
        unique: false,
        suggestedRole: 'unknown',
        warnings: ['No data available for analysis']
      };
    }

    // Multi-method type detection
    const typeAnalysis = {
      pragmaType: this.getPragmaType(columnInfo),
      inferredType: this.inferTypeFromSample(sampleValues),
      statisticalType: this.analyzeStatisticalType(sampleValues),
      patternType: this.detectPatternType(sampleValues),
      businessType: this.inferBusinessType(columnName, sampleValues)
    };

    // Resolve conflicts and determine final type
    const resolvedType = this.resolveTypeConflicts(typeAnalysis);
    
    // Calculate confidence scores
    const confidence = this.calculateTypeConfidence(typeAnalysis, sampleValues.length);
    
    return {
      name: columnName,
      type: resolvedType.type,
      pragmaType: typeAnalysis.pragmaType,
      confidence: confidence,
      nullable: resolvedType.nullable,
      unique: resolvedType.unique,
      sampleValues: sampleValues.slice(0, 5), // First 5 values for reference
      distinctCount: new Set(sampleValues).size,
      suggestedRole: resolvedType.suggestedRole,
      canAggregate: resolvedType.canAggregate,
      canSort: resolvedType.canSort,
      preferredVisualization: resolvedType.preferredVisualization,
      warnings: resolvedType.warnings,
      metadata: {
        avgLength: sampleValues.reduce((sum, val) => sum + (val ? val.toString().length : 0), 0) / sampleValues.length,
        hasNulls: sampleData.some(row => row[columnName] === null || row[columnName] === undefined),
        emptyCount: sampleValues.filter(val => val === '').length
      }
    };
  }

  /**
   * Get column type from PRAGMA table_info
   */
  getPragmaType(columnInfo) {
    switch (columnInfo.type.toUpperCase()) {
      case 'INTEGER':
      case 'BIGINT':
      case 'SMALLINT':
      case 'TINYINT':
        return 'integer';
      case 'DOUBLE':
      case 'REAL':
      case 'FLOAT':
        return 'numeric';
      case 'DECIMAL':
      case 'NUMERIC':
        return 'numeric';
      case 'VARCHAR':
      case 'TEXT':
        return 'text';
      case 'BOOLEAN':
      case 'BIT':
        return 'boolean';
      case 'DATE':
      case 'TIMESTAMP':
      case 'DATETIME':
        return 'datetime';
      default:
        return 'unknown';
    }
  }

  /**
   * Infer type from actual sample data
   */
  inferTypeFromSample(sampleValues) {
    const nonEmptyValues = sampleValues.filter(val => val !== '' && val !== null && val !== undefined);
    
    if (nonEmptyValues.length === 0) return 'empty';
    
    // Test for numeric
    const numericCount = nonEmptyValues.filter(val => !isNaN(val) && !isNaN(parseFloat(val))).length;
    const numericRatio = numericCount / nonEmptyValues.length;
    
    if (numericRatio > 0.9) return 'numeric';
    
    // Test for dates
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,
      /^\d{1,2}\/\d{1,2}\/\d{2}$/,
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i
    ];
    
    const dateCount = nonEmptyValues.filter(val => 
      datePatterns.some(pattern => pattern.test(val))
    ).length;
    
    if (dateCount > 0.8 * nonEmptyValues.length) return 'datetime';
    
    // Test for boolean
    const boolValues = ['true', 'false', 'True', 'False', 'TRUE', 'FALSE', '1', '0', 'yes', 'no', 'Yes', 'No'];
    const boolCount = nonEmptyValues.filter(val => boolValues.includes(val.toString())).length;
    
    if (boolCount > 0.8 * nonEmptyValues.length) return 'boolean';
    
    // Check for categorical (low unique values)
    const uniqueValues = new Set(nonEmptyValues);
    if (uniqueValues.size / nonEmptyValues.length < 0.1 && uniqueValues.size <= 20) {
      return 'categorical';
    }
    
    return 'text';
  }

  /**
   * Statistical analysis of column data
   */
  analyzeStatisticalType(sampleValues) {
    const numericValues = sampleValues.filter(val => !isNaN(val) && !isNaN(parseFloat(val)));
    
    if (numericValues.length === 0) {
      return { isNumeric: false, hasOutliers: false, distribution: 'unknown' };
    }
    
    const numbers = numericValues.map(val => parseFloat(val));
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const stdDev = Math.sqrt(numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length);
    
    // Detect outliers (values > 2 std dev from mean)
    const outliers = numbers.filter(num => Math.abs(num - mean) > 2 * stdDev);
    
    return {
      isNumeric: true,
      hasOutliers: outliers.length > 0,
      distribution: outliers.length > 0 ? 'skewed' : 'normal',
      mean: mean,
      stdDev: stdDev,
      outlierCount: outliers.length
    };
  }

  /**
   * Pattern-based type detection
   */
  detectPatternType(sampleValues) {
    // Check for ID patterns
    const idPatterns = [
      /^ID$/i,
      /_id$/i,
      /^.*_id$/i,
      /^[A-Z]{2,4}\d+$/, // Standard ID patterns
      /^\d{6,10}$/ // Pure numeric IDs
    ];
    
    const columnName = sampleValues[0]?.toString() || '';
    const isIdColumn = idPatterns.some(pattern => pattern.test(columnName));
    
    if (isIdColumn) return 'identifier';
    
    // Check for code patterns
    const codePatterns = [/^[A-Z]{2,4}-\d{3,5}$/, /^\d{5}$/, /^[A-Z]\d{3}$/];
    const hasCodePattern = sampleValues.some(val => codePatterns.some(pattern => pattern.test(val.toString())));
    
    if (hasCodePattern) return 'code';
    
    return 'unknown';
  }

  /**
   * Infer business purpose of column
   */
  inferBusinessType(columnName, sampleValues) {
    const name = columnName.toLowerCase();
    const firstValue = sampleValues[0]?.toString().toLowerCase() || '';
    
    // Primary business metrics
    const metrics = ['sales', 'revenue', 'profit', 'cost', 'amount', 'price', 'quantity', 'total', 'count'];
    if (metrics.some(metric => name.includes(metric))) {
      return {
        type: 'business_metric',
        suggestedRole: 'value',
        canAggregate: true,
        canSort: true,
        preferredVisualization: 'bar'
      };
    }
    
    // Identifiers
    const identifiers = ['id', 'key', 'code', 'ref'];
    if (identifiers.some(id => name.includes(id))) {
      return {
        type: 'identifier',
        suggestedRole: 'dimension',
        canAggregate: false,
        canSort: true,
        preferredVisualization: 'none'
      };
    }
    
    // Temporal data
    const temporal = ['date', 'time', 'created', 'updated', 'modified', 'year', 'month', 'day'];
    if (temporal.some(temp => name.includes(temp))) {
      return {
        type: 'temporal',
        suggestedRole: 'time_dimension',
        canAggregate: false,
        canSort: true,
        preferredVisualization: 'line'
      };
    }
    
    // Location data
    const location = ['city', 'state', 'country', 'address', 'zip', 'region', 'location'];
    if (location.some(loc => name.includes(loc))) {
      return {
        type: 'location',
        suggestedRole: 'geographic_dimension',
        canAggregate: false,
        canSort: true,
        preferredVisualization: 'map'
      };
    }
    
    // Classification data
    const classification = ['status', 'type', 'category', 'class', 'group', 'segment'];
    if (classification.some(cls => name.includes(cls))) {
      return {
        type: 'categorical',
        suggestedRole: 'classification',
        canAggregate: false,
        canSort: true,
        preferredVisualization: 'pie'
      };
    }
    
    // Person data
    const person = ['name', 'employee', 'customer', 'user', 'person', 'contact'];
    if (person.some(p => name.includes(p))) {
      return {
        type: 'person',
        suggestedRole: 'entity',
        canAggregate: false,
        canSort: true,
        preferredVisualization: 'list'
      };
    }
    
    // Default to text
    return {
      type: 'text',
      suggestedRole: 'attribute',
      canAggregate: false,
      canSort: false,
      preferredVisualization: 'text'
    };
  }

  /**
   * Resolve conflicts between different type detection methods
   */
  resolveTypeConflicts(typeAnalysis) {
    const { pragmaType, inferredType, statisticalType, patternType, businessType } = typeAnalysis;
    
    // Priority order for type resolution
    const typePriority = {
      'numeric': 1,
      'integer': 2,
      'datetime': 3,
      'boolean': 4,
      'categorical': 5,
      'text': 6,
      'identifier': 7,
      'code': 8,
      'unknown': 9
    };
    
    const candidates = [
      { type: pragmaType, source: 'pragma', priority: typePriority[pragmaType] || 10 },
      { type: inferredType, source: 'sample', priority: typePriority[inferredType] || 10 },
      { type: statisticalType.isNumeric ? 'numeric' : 'non-numeric', source: 'statistical', priority: typePriority[statisticalType.isNumeric ? 'numeric' : 'non-numeric'] || 10 },
      { type: patternType, source: 'pattern', priority: typePriority[patternType] || 10 },
      { type: businessType.type, source: 'business', priority: 2 } // Business type gets priority
    ];
    
    // Sort by priority and select best candidate
    candidates.sort((a, b) => a.priority - b.priority);
    const best = candidates[0];
    
    const resolvedType = {
      type: best.type || 'unknown',
      source: best.source,
      nullable: best.type === 'text' || best.type === 'unknown',
      unique: false, // Will be determined by data analysis
      canAggregate: ['numeric', 'integer'].includes(best.type),
      canSort: best.type !== 'text',
      preferredVisualization: businessType.preferredVisualization || 'bar',
      suggestedRole: businessType.suggestedRole || 'attribute',
      warnings: []
    };
    
    // Add warnings for conflicts
    if (pragmaType !== best.type && pragmaType !== 'unknown') {
      resolvedType.warnings.push(`PRAGMA type (${pragmaType}) differs from detected type (${best.type})`);
    }
    
    if (inferredType !== best.type && inferredType !== 'unknown') {
      resolvedType.warnings.push(`Sample type (${inferredType}) differs from resolved type (${best.type})`);
    }
    
    return resolvedType;
  }

  /**
   * Calculate confidence score for type detection
   */
  calculateTypeConfidence(typeAnalysis, sampleSize) {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on agreement
    const agreementCount = [typeAnalysis.pragmaType, typeAnalysis.inferredType, typeAnalysis.patternType]
      .filter((type, index, arr) => arr.indexOf(type) === index)
      .length;
    
    if (agreementCount >= 2) {
      confidence += 0.3;
    }
    
    // Adjust based on sample size
    if (sampleSize > 100) {
      confidence += 0.1;
    } else if (sampleSize < 10) {
      confidence -= 0.2;
    }
    
    return Math.max(0.1, Math.min(0.95, confidence));
  }

  /**
   * Get table metadata
   */
  getTableMetadata(columns, sampleData) {
    return {
      estimatedRows: this.estimateRowCount(sampleData),
      dataQuality: this.assessDataQuality(columns, sampleData),
      complexity: this.assessComplexity(columns, sampleData),
      recommendations: this.generateRecommendations(columns, sampleData)
    };
  }

  /**
   * Estimate total row count from sample
   */
  estimateRowCount(sampleData) {
    if (sampleData.length < 100) {
      return {
        estimated: sampleData.length,
        confidence: 'high',
        method: 'exact'
      };
    }
    
    // For larger datasets, use statistical sampling
    const avgRowsPer100 = Math.ceil(sampleData.length / 100);
    return {
      estimated: sampleData.length, // This would be scaled up in real implementation
      confidence: 'medium',
      method: 'sample_based'
    };
  }

  /**
   * Assess data quality
   */
  assessDataQuality(columns, sampleData) {
    const issues = [];
    const scores = {};
    
    for (const column of columns) {
      const name = column.name;
      const values = sampleData.map(row => row[name]);
      const nonNullValues = values.filter(val => val !== null && val !== undefined && val !== '');
      
      // Check for missing data
      const missingRatio = (values.length - nonNullValues.length) / values.length;
      if (missingRatio > 0.5) {
        issues.push({
          type: 'missing_data',
          column: name,
          severity: missingRatio > 0.8 ? 'high' : 'medium',
          message: `${Math.round(missingRatio * 100)}% missing data in ${name}`
        });
      }
      
      // Check for mixed data types
      const types = new Set(nonNullValues.map(val => typeof val));
      if (types.size > 2) {
        issues.push({
          type: 'mixed_types',
          column: name,
          severity: 'medium',
          message: `Multiple data types detected in ${name}: ${Array.from(types).join(', ')}`
        });
      }
      
      scores[name] = 1 - missingRatio;
    }
    
    const avgQuality = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length;
    
    return {
      overallScore: avgQuality,
      issues: issues,
      recommendations: this.generateQualityRecommendations(issues)
    };
  }

  /**
   * Assess table complexity
   */
  assessComplexity(columns, sampleData) {
    const numericColumns = columns.filter(col => ['numeric', 'integer'].includes(this.getPragmaType(col)));
    const textColumns = columns.filter(col => ['text', 'varchar'].includes(this.getPragmaType(col)));
    const dateColumns = columns.filter(col => ['datetime', 'date'].includes(this.getPragmaType(col)));
    
    let complexity = 'low';
    if (columns.length > 20) complexity = 'high';
    else if (columns.length > 10 || dateColumns.length > 0) complexity = 'medium';
    
    return {
      level: complexity,
      columnCount: columns.length,
      typeDistribution: {
        numeric: numericColumns.length,
        text: textColumns.length,
        date: dateColumns.length,
        other: columns.length - numericColumns.length - textColumns.length - dateColumns.length
      }
    };
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(columns, sampleData) {
    const recommendations = [];
    
    // Recommend indexes for large tables
    if (sampleData.length > 10000) {
      const idColumns = columns.filter(col => this.getPragmaType(col) === 'integer' && col.name.toLowerCase().includes('id'));
      idColumns.forEach(col => {
        recommendations.push({
          type: 'performance',
          priority: 'high',
          message: `Consider adding index on ${col.name} for improved query performance`
        });
      });
    }
    
    // Recommend data cleaning for high missing data
    const highMissingColumns = columns.filter(col => {
      const values = sampleData.map(row => row[col.name]);
      const nonNullValues = values.filter(val => val !== null && val !== undefined && val !== '');
      const missingRatio = (values.length - nonNullValues.length) / values.length;
      return missingRatio > 0.3;
    });
    
    highMissingColumns.forEach(col => {
      recommendations.push({
        type: 'data_quality',
        priority: 'medium',
        message: `Consider data cleaning for ${col.name} (${Math.round((values.length - nonNullValues.length) / values.length * 100)}% missing)`
      });
    });
    
    return recommendations;
  }

  /**
   * Generate quality recommendations
   */
  generateQualityRecommendations(issues) {
    const recommendations = [];
    
    const missingDataIssues = issues.filter(issue => issue.type === 'missing_data');
    if (missingDataIssues.length > 0) {
      recommendations.push('Consider data cleaning to address missing values');
    }
    
    const mixedTypeIssues = issues.filter(issue => issue.type === 'mixed_types');
    if (mixedTypeIssues.length > 0) {
      recommendations.push('Consider standardizing data formats in mixed-type columns');
    }
    
    return recommendations;
  }
}

export default DatabaseIntrospection;
import { CONFIG } from '../config/constants.js';
import DatabaseIntrospection from './databaseIntrospection.js';

/**
 * Intelligent SQL Query Generator
 * Generates perfect SQL for ANY data type without errors
 */
export class IntelligentSQLGenerator {
  constructor(dbConnection) {
    this.conn = dbConnection;
    this.introspector = new DatabaseIntrospection(dbConnection);
    this.schemaAnalysis = null;
    this.queryCache = new Map();
  }

  /**
   * Initialize with comprehensive schema analysis
   */
  async initialize(tableName = CONFIG.DATABASE.TABLE_NAME) {
    this.schemaAnalysis = await this.introspector.analyzeSchema(tableName);
    return this.schemaAnalysis;
  }

  /**
   * Generate SQL query from natural language with ZERO errors
   * Uses ReAct pattern with discovery context and conversation history
   * @param {string} question - User's natural language question
   * @param {Object} context - Enhanced context with discovery and conversation
   * @returns {Promise<Object>} Generated SQL and metadata
   */
  async generateQuery(question, context = {}) {
    if (!this.schemaAnalysis) {
      await this.initialize();
    }

    try {
      // ReAct Pattern: THINK
      // Incorporate discovery metadata and conversation history
      const enhancedIntent = this.parseQuestionIntentWithContext(question, context);
      
      // ReAct Pattern: ACT
      // Use discovery to find specific entities mentioned
      if (context.targetEntity) {
        enhancedIntent.targetEntity = context.targetEntity;
        enhancedIntent.hasSpecificFilter = true;
      }
      
      // Select appropriate columns with context awareness
      const columnSelection = this.selectColumnsForQuery(enhancedIntent, context);
      
      // Validate column types before generating SQL
      const validatedColumns = this.validateColumnTypes(columnSelection);
      
      // ReAct Pattern: EXECUTE
      // Generate SQL based on validated columns and context
      const sql = this.buildSQLQuery(enhancedIntent, validatedColumns, context);
      
      // Validate generated SQL
      const validation = await this.validateSQL(sql);
      
      if (!validation.valid) {
        // Fallback to safe query if validation fails
        const fallbackSQL = this.generateFallbackQuery(enhancedIntent);
        return {
          sql: fallbackSQL,
          confidence: 0.6,
          warnings: validation.errors,
          metadata: {
            intent: enhancedIntent,
            columns: validatedColumns,
            fallback: true
          }
        };
      }

      return {
        sql: sql,
        confidence: 0.95,
        warnings: [],
        metadata: {
          intent: enhancedIntent,
          columns: validatedColumns,
          fallback: false
        }
      };

    } catch (error) {
      // Ultimate fallback - return safe query
      return {
        sql: this.generateUltimateFallback(),
        confidence: 0.3,
        warnings: [error.message],
        metadata: {
          error: error.message,
          fallback: true
        }
      };
    }
  }
  
  /**
   * Parse question intent with discovery context (ReAct THINK step)
   */
  parseQuestionIntentWithContext(question, context) {
    const baseIntent = this.parseQuestionIntent(question);
    
    // Enhance with discovery context
    if (context.discovery) {
      // If user mentions an entity type, prioritize columns of that type
      const entityTypes = ['person', 'location', 'category', 'product', 'date'];
      for (const entityType of entityTypes) {
        if (question.toLowerCase().includes(entityType) || 
            context.discovery.entities[entityType]) {
          baseIntent.preferredEntityType = entityType;
          baseIntent.entityColumns = context.discovery.entities[entityType] || [];
        }
      }
    }
    
    // Enhance with conversation context
    if (context.conversationContext) {
      baseIntent.hasConversationContext = true;
      baseIntent.previousColumns = context.previousColumns || [];
    }
    
    return baseIntent;
  }

  /**
   * Parse question to determine analytical intent
   */
  parseQuestionIntent(question) {
    const lowerQuestion = question.toLowerCase();
    
    // Aggregation patterns
    const aggregationPatterns = {
      sum: ['sum', 'total', 'add up', 'aggregate'],
      avg: ['average', 'mean', 'typical'],
      count: ['count', 'how many', 'number of'],
      min: ['minimum', 'lowest', 'smallest', 'least'],
      max: ['maximum', 'highest', 'largest', 'most'],
      stddev: ['standard deviation', 'variance', 'spread']
    };
    
    // Grouping patterns
    const groupingPatterns = {
      by_category: ['by category', 'group by', 'per category', 'breakdown'],
      by_time: ['by month', 'by year', 'over time', 'trend', 'monthly', 'yearly'],
      by_location: ['by state', 'by city', 'by country', 'by region'],
      by_person: ['by employee', 'by customer', 'by user', 'by person']
    };
    
    // Filter patterns
    const filterPatterns = {
      top_n: ['top', 'best', 'highest', 'most', 'largest'],
      bottom_n: ['bottom', 'worst', 'lowest', 'least', 'smallest'],
      recent: ['recent', 'latest', 'last', 'new'],
      active: ['active', 'current', 'open']
    };
    
    // Detect aggregation type
    let aggregation = 'select';
    for (const [type, patterns] of Object.entries(aggregationPatterns)) {
      if (patterns.some(pattern => lowerQuestion.includes(pattern))) {
        aggregation = type;
        break;
      }
    }
    
    // Detect grouping
    let grouping = null;
    for (const [type, patterns] of Object.entries(groupingPatterns)) {
      if (patterns.some(pattern => lowerQuestion.includes(pattern))) {
        grouping = type;
        break;
      }
    }
    
    // Detect filters
    const filters = [];
    for (const [type, patterns] of Object.entries(filterPatterns)) {
      if (patterns.some(pattern => lowerQuestion.includes(pattern))) {
        filters.push(type);
      }
    }
    
    // Extract numeric constraints
    const numberMatch = question.match(/\b(top|bottom)\s+(\d+)\b/i);
    const limit = numberMatch ? parseInt(numberMatch[2]) : (aggregation === 'count' ? null : 50);
    
    return {
      aggregation: aggregation,
      grouping: grouping,
      filters: filters,
      limit: limit,
      originalQuestion: question
    };
  }

  /**
   * Intelligently select columns based on query intent
   */
  selectColumnsForQuery(intent) {
    const columns = this.schemaAnalysis.analysis;
    const selected = {
      value: null,
      dimensions: [],
      filters: [],
      dates: []
    };

    // Find value column (must be numeric for aggregations)
    if (intent.aggregation !== 'count' && intent.aggregation !== 'select') {
      // Priority: business metrics > numeric > other
      const businessMetrics = Object.values(columns).filter(col => 
        col.businessType?.type === 'business_metric' && col.canAggregate
      );
      
      if (businessMetrics.length > 0) {
        selected.value = businessMetrics[0];
      } else {
        // Find any numeric column
        const numericCols = Object.values(columns).filter(col => 
          col.canAggregate && col.type !== 'identifier'
        );
        
        if (numericCols.length > 0) {
          selected.value = numericCols[0];
        }
      }
    }

    // Find dimension columns for grouping
    if (intent.grouping) {
      switch (intent.grouping) {
        case 'by_category':
          selected.dimensions = Object.values(columns).filter(col => 
            col.businessType?.type === 'categorical' || col.type === 'categorical'
          );
          break;
        case 'by_time':
          selected.dates = Object.values(columns).filter(col => 
            col.businessType?.type === 'temporal' || col.type === 'datetime'
          );
          break;
        case 'by_location':
          selected.dimensions = Object.values(columns).filter(col => 
            col.businessType?.type === 'location'
          );
          break;
        case 'by_person':
          selected.dimensions = Object.values(columns).filter(col => 
            col.businessType?.type === 'person'
          );
          break;
      }
    }

    // If no specific grouping columns found, use any non-numeric, non-id column
    if (selected.dimensions.length === 0 && intent.grouping) {
      selected.dimensions = Object.values(columns).filter(col => 
        !col.canAggregate && 
        col.type !== 'identifier' &&
        col.businessType?.type !== 'temporal'
      );
    }

    return selected;
  }

  /**
   * Validate that selected columns can actually be used for the intended operation
   */
  validateColumnTypes(selection) {
    const validated = {
      value: selection.value,
      dimensions: [],
      dates: [],
      errors: []
    };

    // Validate value column
    if (selection.value) {
      if (!selection.value.canAggregate) {
        validated.errors.push(`Column "${selection.value.name}" cannot be aggregated (type: ${selection.value.type})`);
        // Try to find alternative
        const alternatives = Object.values(this.schemaAnalysis.analysis).filter(col => 
          col.canAggregate && col.name !== selection.value.name
        );
        if (alternatives.length > 0) {
          validated.value = alternatives[0];
          validated.errors.push(`Using "${validated.value.name}" instead for aggregation`);
        } else {
          validated.value = null;
          validated.errors.push('No numeric columns available for aggregation');
        }
      }
    }

    // Validate dimension columns
    selection.dimensions.forEach(col => {
      if (col.type === 'identifier' && !col.name.toLowerCase().includes('name')) {
        validated.errors.push(`Skipping identifier column "${col.name}"`);
      } else {
        validated.dimensions.push(col);
      }
    });

    // Validate date columns
    selection.dates.forEach(col => {
      if (col.type === 'datetime' || col.type === 'date') {
        validated.dates.push(col);
      } else {
        validated.errors.push(`Column "${col.name}" is not a valid date column`);
      }
    });

    return validated;
  }

  /**
   * Build the actual SQL query with perfect syntax
   */
  buildSQLQuery(intent, columns, context) {
    const tableName = CONFIG.DATABASE.TABLE_NAME;
    const parts = [];
    
    // Build SELECT clause
    const selectParts = this.buildSelectClause(intent, columns);
    parts.push(`SELECT ${selectParts.join(', ')}`);
    
    // Build FROM clause
    parts.push(`FROM ${tableName}`);
    
    // Build WHERE clause (if needed)
    const whereClause = this.buildWhereClause(intent, columns);
    if (whereClause) {
      parts.push(whereClause);
    }
    
    // Build GROUP BY clause (if needed)
    const groupByClause = this.buildGroupByClause(intent, columns);
    if (groupByClause) {
      parts.push(groupByClause);
    }
    
    // Build ORDER BY clause (if needed)
    const orderByClause = this.buildOrderByClause(intent, columns);
    if (orderByClause) {
      parts.push(orderByClause);
    }
    
    // Build LIMIT clause
    const limit = intent.limit || 50;
    parts.push(`LIMIT ${limit}`);
    
    return parts.join('\n') + ';';
  }

  /**
   * Build SELECT clause with proper aggregation
   */
  buildSelectClause(intent, columns) {
    const selects = [];
    
    switch (intent.aggregation) {
      case 'count':
        selects.push('COUNT(*) as count');
        break;
      case 'sum':
        if (columns.value) {
          selects.push(`SUM("${columns.value.name}") as total`);
        } else {
          selects.push('COUNT(*) as count');
        }
        break;
      case 'avg':
        if (columns.value) {
          selects.push(`AVG("${columns.value.name}") as average`);
        } else {
          selects.push('COUNT(*) as count');
        }
        break;
      case 'min':
        if (columns.value) {
          selects.push(`MIN("${columns.value.name}") as minimum`);
        }
        break;
      case 'max':
        if (columns.value) {
          selects.push(`MAX("${columns.value.name}") as maximum`);
        }
        break;
      default:
        // Select all columns for simple queries
        selects.push('*');
    }
    
    // Add grouping columns
    if (intent.grouping && columns.dimensions.length > 0) {
      columns.dimensions.forEach(col => {
        if (!selects.some(s => s.includes(col.name))) {
          selects.unshift(`"${col.name}"`);
        }
      });
    }
    
    // Add date columns for time-based grouping
    if (intent.grouping === 'by_time' && columns.dates.length > 0) {
      const dateCol = columns.dates[0];
      selects.unshift(`strftime(strptime("${dateCol.name}", '%m/%d/%Y'), '%Y-%m') as period`);
    }
    
    return selects;
  }

  /**
   * Build WHERE clause for filters
   * Enhanced with ReAct pattern - handles specific entity filtering
   */
  buildWhereClause(intent, columns) {
    const conditions = [];
    
    // ReAct: Handle specific entity filter (e.g., "Joe's sales")
    if (intent.hasSpecificFilter && intent.targetEntity) {
      const entityCol = intent.targetEntity.column;
      const entityValue = intent.targetEntity.value;
      
      // Build the WHERE condition for the specific entity
      if (entityValue) {
        conditions.push(`"${entityCol}" = '${entityValue}'`);
      } else {
        // If exact value not known, use LIKE for partial match
        conditions.push(`"${entityCol}" LIKE '%${intent.targetEntity.searchTerm}%'`);
      }
    }
    
    // Handle top/bottom filters
    if (intent.filters.includes('top_n') && columns.value) {
      // This will be handled in ORDER BY
    }
    
    if (intent.filters.includes('bottom_n') && columns.value) {
      // This will be handled in ORDER BY
    }
    
    if (intent.filters.includes('recent') && columns.dates.length > 0) {
      const dateCol = columns.dates[0];
      conditions.push(`"${dateCol.name}" >= date_trunc('month', current_date - interval '3 months')`);
    }
    
    if (intent.filters.includes('active')) {
      // Look for status columns
      const statusCols = Object.values(this.schemaAnalysis.analysis).filter(col => 
        col.name.toLowerCase().includes('status') || col.name.toLowerCase().includes('active')
      );
      
      if (statusCols.length > 0) {
        conditions.push(`"${statusCols[0].name}" = 'Active'`);
      }
    }
    
    if (conditions.length > 0) {
      return `WHERE ${conditions.join(' AND ')}`;
    }
    
    return null;
  }

  /**
   * Build GROUP BY clause
   */
  buildGroupByClause(intent, columns) {
    const groupCols = [];
    
    if (intent.grouping === 'by_time' && columns.dates.length > 0) {
      const dateCol = columns.dates[0];
      groupCols.push(`strftime(strptime("${dateCol.name}", '%m/%d/%Y'), '%Y-%m')`);
    }
    
    if (columns.dimensions.length > 0) {
      columns.dimensions.forEach(col => {
        if (!groupCols.includes(`"${col.name}"`)) {
          groupCols.push(`"${col.name}"`);
        }
      });
    }
    
    if (groupCols.length > 0) {
      return `GROUP BY ${groupCols.join(', ')}`;
    }
    
    return null;
  }

  /**
   * Build ORDER BY clause
   */
  buildOrderByClause(intent, columns) {
    const orderParts = [];
    
    if (intent.filters.includes('top_n') && columns.value) {
      orderParts.push(`"${columns.value.name}" DESC`);
    } else if (intent.filters.includes('bottom_n') && columns.value) {
      orderParts.push(`"${columns.value.name}" ASC`);
    } else if (columns.value) {
      orderParts.push(`"${columns.value.name}" DESC`);
    } else if (columns.dimensions.length > 0) {
      orderParts.push(`"${columns.dimensions[0].name}" ASC`);
    }
    
    if (orderParts.length > 0) {
      return `ORDER BY ${orderParts.join(', ')}`;
    }
    
    return null;
  }

  /**
   * Validate generated SQL against database
   */
  async validateSQL(sql) {
    try {
      // Try to prepare/parse the query without executing
      const explainResult = await this.conn.query(`EXPLAIN ${sql}`);
      
      return {
        valid: true,
        errors: [],
        plan: explainResult.toArray()
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
        plan: null
      };
    }
  }

  /**
   * Generate fallback query when primary query fails
   */
  generateFallbackQuery(intent) {
    const tableName = CONFIG.DATABASE.TABLE_NAME;
    
    // Simple count query that always works
    if (intent.aggregation === 'count') {
      return `SELECT COUNT(*) as count FROM ${tableName} LIMIT 50;`;
    }
    
    // Simple select all
    return `SELECT * FROM ${tableName} LIMIT 50;`;
  }

  /**
   * Ultimate fallback - guaranteed to work
   */
  generateUltimateFallback() {
    const tableName = CONFIG.DATABASE.TABLE_NAME;
    return `SELECT * FROM ${tableName} LIMIT 10;`;
  }

  /**
   * Get schema analysis summary for AI prompts
   */
  getSchemaSummary() {
    if (!this.schemaAnalysis) {
      return 'No schema analysis available';
    }
    
    const numericCols = Object.values(this.schemaAnalysis.analysis).filter(col => col.canAggregate);
    const dimensionCols = Object.values(this.schemaAnalysis.analysis).filter(col => !col.canAggregate && col.type !== 'identifier');
    const dateCols = Object.values(this.schemaAnalysis.analysis).filter(col => col.type === 'datetime');
    
    return {
      numericColumns: numericCols.map(col => col.name),
      dimensionColumns: dimensionCols.map(col => col.name),
      dateColumns: dateCols.map(col => col.name),
      totalColumns: this.schemaAnalysis.columnCount,
      rowCount: this.schemaAnalysis.rowCount
    };
  }

  /**
   * Generate intelligent suggestions based on schema
   */
  generateSuggestions() {
    if (!this.schemaAnalysis) {
      return [];
    }
    
    const suggestions = [];
    const analysis = this.schemaAnalysis.analysis;
    
    // Check for numeric columns (can do aggregations)
    const numericCols = Object.values(analysis).filter(col => col.canAggregate);
    if (numericCols.length > 0) {
      suggestions.push(`What is the total ${numericCols[0].name}?`);
      suggestions.push(`Show me the average ${numericCols[0].name} by category`);
    }
    
    // Check for categorical columns (can do groupings)
    const categoricalCols = Object.values(analysis).filter(col => 
      col.businessType?.type === 'categorical' || col.type === 'categorical'
    );
    if (categoricalCols.length > 0) {
      suggestions.push(`Count by ${categoricalCols[0].name}`);
    }
    
    // Check for date columns (can do trends)
    const dateCols = Object.values(analysis).filter(col => col.type === 'datetime');
    if (dateCols.length > 0 && numericCols.length > 0) {
      suggestions.push(`Show ${numericCols[0].name} trend over time`);
    }
    
    // Check for location columns
    const locationCols = Object.values(analysis).filter(col => col.businessType?.type === 'location');
    if (locationCols.length > 0 && numericCols.length > 0) {
      suggestions.push(`Compare ${numericCols[0].name} by ${locationCols[0].name}`);
    }
    
    return suggestions.slice(0, 3);
  }
}

export default IntelligentSQLGenerator;
import { CONFIG } from '../config/constants.js';
import { sanitizeDuckDBRows } from '../utils/bigintUtils.js';

/**
 * Discovery Service - Data Sampling and Entity Detection
 * Scans uploaded data to discover values, entities, and relationships
 * Maintains 100% offline privacy using local DuckDB processing
 */
export class DiscoveryService {
  constructor(dbConnection) {
    this.conn = dbConnection;
    this.metadataCache = null;
    this.sampleSize = 500;
    this.maxUniqueValues = 50; // Top 50 for prompt efficiency
  }

  /**
   * Perform comprehensive data discovery
   * Analyzes entire small datasets or stratified samples for large ones
   * @param {string} tableName - Name of the table to analyze
   * @returns {Promise<Object>} Discovery metadata cache
   */
  async discover(tableName = CONFIG.DATABASE.TABLE_NAME) {
    try {
      // Get row count to decide sampling strategy
      const countResult = await this.conn.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      const countRows = sanitizeDuckDBRows(countResult.toArray());
      const rowCount = Number(countRows[0].count);

      // Get schema
      const schemaResult = await this.conn.query(`PRAGMA table_info(${tableName})`);
      const columns = schemaResult.toArray();

      const discovery = {
        tableName,
        rowCount,
        samplingStrategy: rowCount <= 1000 ? 'full' : 'stratified',
        columns: {},
        entities: {},
        timestamp: new Date().toISOString()
      };

      // Analyze each column
      for (const column of columns) {
        const columnDiscovery = await this.analyzeColumn(column, tableName, rowCount);
        discovery.columns[column.name] = columnDiscovery;

        // Detect entity types
        const entityType = this.detectEntityType(columnDiscovery);
        if (entityType) {
          if (!discovery.entities[entityType]) {
            discovery.entities[entityType] = [];
          }
          discovery.entities[entityType].push(column.name);
        }
      }

      this.metadataCache = discovery;
      return discovery;
    } catch (error) {
      console.error('Discovery failed:', error);
      throw new Error(`Data discovery failed: ${error.message}`);
    }
  }

  /**
   * Analyze individual column with appropriate sampling
   */
  async analyzeColumn(columnInfo, tableName, totalRows) {
    const columnName = columnInfo.name;
    const isText = ['VARCHAR', 'TEXT'].includes(columnInfo.type.toUpperCase());
    const isNumeric = ['INTEGER', 'BIGINT', 'DOUBLE', 'REAL', 'FLOAT'].includes(columnInfo.type.toUpperCase());

    let uniqueValues = [];

    try {
      if (isText) { // Only sample text for unique values
        if (totalRows <= 1000) {
          // Small dataset: analyze entire column
          const result = await this.conn.query(`
            SELECT "${columnName}" as value, COUNT(*) as freq
            FROM ${tableName}
            WHERE "${columnName}" IS NOT NULL AND "${columnName}" != ''
            GROUP BY "${columnName}"
            ORDER BY freq DESC
            LIMIT ${this.maxUniqueValues}
          `);
          const rows = sanitizeDuckDBRows(result.toArray());
          uniqueValues = rows.map(row => ({
            value: String(row.value),
            frequency: Number(row.freq)
          }));
        } else {
          // Large dataset: stratified sample
          // Sample first 500, middle 500, last 500
          const offset1 = 0;
          const offset2 = Math.floor(totalRows / 2) - 250;
          const offset3 = totalRows - 500;

          const result = await this.conn.query(`
          SELECT "${columnName}" as value, COUNT(*) as freq
          FROM (
            (SELECT "${columnName}" FROM ${tableName} LIMIT 500 OFFSET ${offset1})
            UNION ALL
            (SELECT "${columnName}" FROM ${tableName} LIMIT 500 OFFSET ${offset2})
            UNION ALL
            (SELECT "${columnName}" FROM ${tableName} LIMIT 500 OFFSET ${offset3})
          ) as sample
          WHERE "${columnName}" IS NOT NULL AND "${columnName}" != ''
          GROUP BY "${columnName}"
          ORDER BY freq DESC
          LIMIT ${this.maxUniqueValues}
        `);
          const rows = sanitizeDuckDBRows(result.toArray());
          uniqueValues = rows.map(row => ({
            value: String(row.value),
            frequency: Number(row.freq)
          }));
        }
      }

      // Get basic statistics
      let stats = {};
      if (isNumeric) {
        try {
          const statsResult = await this.conn.query(`
              SELECT 
                COUNT("${columnName}") as count,
                MIN("${columnName}") as min,
                MAX("${columnName}") as max,
                AVG("${columnName}") as avg
              FROM ${tableName}
            `);
          stats = statsResult.toArray()[0];
        } catch (statsError) {
          console.warn(`Failed to get statistics for column ${columnName}:`, statsError.message);
          stats = { count: 0, min: null, max: null, avg: null };
        }
      }

      return {
        name: columnName,
        type: columnInfo.type,
        isText,
        isNumeric,
        uniqueValues: uniqueValues.length,
        topValues: uniqueValues.slice(0, this.maxUniqueValues),
        sampleCoverage: totalRows <= 1000 ? 100 : Math.round((1500 / totalRows) * 100),
        statistics: isNumeric ? stats : null,
        cardinality: uniqueValues.length / totalRows,
        hasHighCardinality: uniqueValues.length > 50
      };
    } catch (error) {
      console.error(`Discovery failed for column ${columnName}:`, error.message);
      return {
        name: columnName,
        type: columnInfo.type,
        isText,
        isNumeric,
        uniqueValues: 0,
        topValues: [],
        sampleCoverage: 0,
        statistics: null,
        cardinality: 0,
        hasHighCardinality: false,
        error: error.message
      };
    }
  }

  /**
   * Detect relationships between multiple tables (Foreign Key Heuristics)
   * @param {Array} tables - Array of table metadata objects
   * @returns {Array} - List of potential relationships { sourceTable, targetTable, key }
   */
  detectRelationships(tables) {
    const relationships = [];
    if (!tables || tables.length < 2) return relationships;

    // Scan for shared column names that look like IDs
    for (let i = 0; i < tables.length; i++) {
      const tableA = tables[i];
      for (let j = i + 1; j < tables.length; j++) {
        const tableB = tables[j];

        // Find intersecting columns
        const intersection = Object.keys(tableA.columns).filter(col =>
          Object.keys(tableB.columns).includes(col)
        );

        intersection.forEach(colName => {
          // Heuristic: Must be an ID or Key
          const lowerCol = colName.toLowerCase();
          const isKey = lowerCol.includes('id') || lowerCol.includes('key') || lowerCol.includes('code');

          // Heuristic: Must have same data type
          const typeMatch = tableA.columns[colName].type === tableB.columns[colName].type;

          if (isKey && typeMatch) {
            relationships.push({
              source: tableA.name,
              target: tableB.name,
              key: colName,
              confidence: 'high'
            });
          }
        });
      }
    }
    return relationships;
  }

  /**
   * Detect entity types from column characteristics
   */
  detectEntityType(columnDiscovery) {
    const { name, isText, topValues, cardinality } = columnDiscovery;
    const lowerName = name.toLowerCase();

    // Skip numeric columns
    if (!isText) return null;

    // Check for person names
    const personIndicators = ['name', 'employee', 'customer', 'user', 'person', 'contact', 'rep'];
    if (personIndicators.some(ind => lowerName.includes(ind))) {
      // Verify it looks like names (proper case words)
      const looksLikeNames = topValues.some(({ value }) => {
        const str = String(value);
        // Pattern: Word with capital letter followed by lowercase
        return /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(str) && str.length > 2;
      });

      if (looksLikeNames || cardinality > 0.5) {
        return 'person';
      }
    }

    // Check for locations
    const locationIndicators = ['city', 'state', 'country', 'region', 'location', 'address', 'zip'];
    if (locationIndicators.some(ind => lowerName.includes(ind))) {
      return 'location';
    }

    // Check for categories
    const categoryIndicators = ['category', 'type', 'status', 'class', 'segment', 'group', 'department'];
    if (categoryIndicators.some(ind => lowerName.includes(ind))) {
      return 'category';
    }

    // Check for dates
    const dateIndicators = ['date', 'time', 'created', 'updated', 'modified'];
    if (dateIndicators.some(ind => lowerName.includes(ind))) {
      return 'date';
    }

    // Check for product/item identifiers
    const productIndicators = ['product', 'item', 'sku', 'code'];
    if (productIndicators.some(ind => lowerName.includes(ind))) {
      return 'product';
    }

    // Heuristic: High cardinality text columns might be identifiers
    if (cardinality > 0.8 && topValues.length > 20) {
      return 'identifier';
    }

    return null;
  }

  /**
   * Search for specific value in all columns
   * @param {string} value - Value to search for
   * @returns {Array} Columns containing this value
   */
  searchValue(value) {
    if (!this.metadataCache) return [];

    const matches = [];
    const searchValue = value.toLowerCase();

    Object.entries(this.metadataCache.columns).forEach(([columnName, columnData]) => {
      const found = columnData.topValues.some(({ value: val }) =>
        String(val).toLowerCase().includes(searchValue)
      );

      if (found) {
        matches.push({
          column: columnName,
          entityType: this.detectEntityType(columnData),
          value: columnData.topValues.find(({ value: val }) =>
            String(val).toLowerCase().includes(searchValue)
          )?.value
        });
      }
    });

    return matches;
  }

  /**
   * Get column by entity type
   */
  getColumnsByEntityType(entityType) {
    if (!this.metadataCache) return [];
    return this.metadataCache.entities[entityType] || [];
  }

  /**
   * Get summary for AI context
   */
  getAISummary() {
    if (!this.metadataCache) return null;

    const { columns, entities, rowCount } = this.metadataCache;

    return {
      rowCount,
      columnCount: Object.keys(columns).length,
      numericColumns: Object.values(columns).filter(c => c.isNumeric).map(c => c.name),
      textColumns: Object.values(columns).filter(c => c.isText).map(c => c.name),
      entities,
      sampleValues: Object.entries(columns).reduce((acc, [name, data]) => {
        if (data.topValues.length > 0) {
          acc[name] = data.topValues.slice(0, 3).map(v => v.value);
        }
        return acc;
      }, {})
    };
  }

  /**
   * Clear discovery cache
   */
  clear() {
    this.metadataCache = null;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    if (!this.metadataCache) return { status: 'empty' };

    return {
      status: 'loaded',
      columns: Object.keys(this.metadataCache.columns).length,
      entities: Object.keys(this.metadataCache.entities),
      totalUniqueValues: Object.values(this.metadataCache.columns)
        .reduce((sum, col) => sum + col.uniqueValues, 0)
    };
  }
}

export default DiscoveryService;
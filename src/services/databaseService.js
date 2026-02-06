import { CONFIG } from '../config/constants.js';
import * as duckdb from '@duckdb/duckdb-wasm';

/**
 * Database Service for managing DuckDB connections and operations
 */
export class DatabaseService {
  constructor() {
    this.db = null;
    this.conn = null;
    this.schema = null;
    this.dbSchema = [];
  }

  /**
   * Initialize DuckDB connection
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
      const worker = await duckdb.createWorker(bundle.mainWorker);
      const logger = new duckdb.ConsoleLogger();

      this.db = new duckdb.AsyncDuckDB(logger, worker);
      await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      this.conn = await this.db.connect();

      return true;
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw new Error(`Failed to initialize database: ${error.message}`);
    }
  }

  /**
   * Load CSV file into database
   * @param {File} file - CSV file to load
   * @returns {Promise<Object>} Schema information
   */
  async loadCSVFile(file) {
    if (!this.conn) {
      throw new Error('Database not initialized');
    }

    try {
      // Clear existing table
      await this.conn.query(`DROP TABLE IF EXISTS ${CONFIG.DATABASE.TABLE_NAME};`);

      // Register and create table
      await this.db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
      await this.conn.query(`CREATE TABLE ${CONFIG.DATABASE.TABLE_NAME} AS SELECT * FROM '${file.name}';`);

      // Capture schema
      const pragmaRes = await this.conn.query(`PRAGMA table_info(${CONFIG.DATABASE.TABLE_NAME})`);
      const columnNames = pragmaRes.toArray().map(row => row.name);
      this.dbSchema = columnNames;

      const schemaRes = await this.conn.query(`DESCRIBE ${CONFIG.DATABASE.TABLE_NAME};`);
      const columns = schemaRes.toArray().map(row => row.column_name).join(', ');
      this.schema = columns;

      return {
        columns: columnNames,
        columnCount: columnNames.length,
        schema: this.schema
      };

    } catch (error) {
      throw new Error(`Failed to load CSV file: ${error.message}`);
    }
  }

  /**
   * Execute SQL query
   * @param {string} sql - SQL query to execute
   * @returns {Promise<Array>} Query results
   */
  async executeQuery(sql) {
    if (!this.conn) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.conn.query(sql);
      const rawData = result.toArray().map(row => {
        const newRow = {};
        for (let key in row) {
          const val = row[key];
          // Handle BigInt and number formatting
          newRow[key] = typeof val === 'bigint' ? Number(val) :
            (typeof val === 'number' ? Math.round(val * 100) / 100 : val);
        }
        return newRow;
      });

      // Limit results to prevent performance issues
      const limitedResults = rawData.slice(0, CONFIG.PERFORMANCE.CHART_MAX_POINTS);

      if (rawData.length > CONFIG.PERFORMANCE.CHART_MAX_POINTS) {
        console.warn(`Query returned ${rawData.length} results, limited to ${CONFIG.PERFORMANCE.CHART_MAX_POINTS} for visualization`);
      }

      return limitedResults;
    } catch (error) {
      throw new Error(`SQL execution failed: ${error.message}`);
    }
  }

  /**
   * Get table statistics
   * @returns {Promise<Object>} Table statistics
   */
  async getTableStats() {
    if (!this.conn) {
      throw new Error('Database not initialized');
    }

    try {
      const countRes = await this.conn.query(`SELECT COUNT(*) as count FROM ${CONFIG.DATABASE.TABLE_NAME};`);
      const count = countRes.toArray()[0].count;

      const sizeRes = await this.conn.query(`SELECT COUNT(*) * AVG(LENGTH(CAST(* AS VARCHAR))) as size FROM ${CONFIG.DATABASE.TABLE_NAME};`);
      const size = sizeRes.toArray()[0].size;

      return {
        rowCount: Number(count),
        estimatedSize: Number(size),
        columnCount: this.dbSchema.length,
        columns: this.dbSchema
      };
    } catch (error) {
      throw new Error(`Failed to get table statistics: ${error.message}`);
    }
  }

  /**
   * Validate SQL query syntax
   * @param {string} sql - SQL query to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateQuery(sql) {
    if (!this.conn) {
      return { valid: false, error: 'Database not initialized' };
    }

    try {
      // Basic validation checks
      const upperSQL = sql.toUpperCase();

      // Check for forbidden operations
      const forbidden = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE'];
      const hasForbidden = forbidden.some(op => upperSQL.includes(op));
      if (hasForbidden) {
        return { valid: false, error: 'Query contains forbidden operations' };
      }

      // Check for SELECT clause
      if (!upperSQL.includes('SELECT')) {
        return { valid: false, error: 'Query must be a SELECT statement' };
      }

      // Check for table name
      if (!upperSQL.includes(CONFIG.DATABASE.TABLE_NAME)) {
        return { valid: false, error: `Query must reference ${CONFIG.DATABASE.TABLE_NAME} table` };
      }

      // Check for LIMIT clause
      if (!upperSQL.includes('LIMIT')) {
        return { valid: false, error: 'Query must include LIMIT clause for safety' };
      }

      // Try to explain the query (dry run)
      await this.conn.query(`EXPLAIN ${sql}`);

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get database schema information
   * @returns {Object} Schema information
   */
  getSchema() {
    return {
      columns: this.dbSchema,
      schema: this.schema,
      tableCount: this.db ? 1 : 0,
      connectionStatus: !!this.conn
    };
  }

  /**
   * Check if database is ready
   * @returns {boolean} Database readiness status
   */
  isReady() {
    return !!(this.db && this.conn);
  }

  /**
   * Close database connection
   */
  async close() {
    try {
      if (this.conn) {
        await this.conn.close();
        this.conn = null;
      }
      if (this.db) {
        await this.db.terminate();
        this.db = null;
      }
      this.schema = null;
      this.dbSchema = [];
    } catch (error) {
      console.error('Error closing database:', error);
    }
  }

  /**
   * Clear all data from database
   */
  async clearData() {
    if (!this.conn) {
      throw new Error('Database not initialized');
    }

    try {
      await this.conn.query(`DROP TABLE IF EXISTS ${CONFIG.DATABASE.TABLE_NAME};`);
      this.schema = null;
      this.dbSchema = [];
    } catch (error) {
      throw new Error(`Failed to clear data: ${error.message}`);
    }
  }
}

// Singleton instance
export const dbService = new DatabaseService();

// Helper functions for common operations
export const initializeDatabase = () => dbService.initialize();
export const loadCSVFile = (file, content) => dbService.loadCSVFile(file, content);
export const executeQuery = (sql) => dbService.executeQuery(sql);
export const getTableStats = () => dbService.getTableStats();
export const validateSQL = (sql) => dbService.validateQuery(sql);
export const getDatabaseSchema = () => dbService.getSchema();
export const isDatabaseReady = () => dbService.isReady();
export const closeDatabase = () => dbService.close();
export const clearDatabaseData = () => dbService.clearData();

export default dbService;
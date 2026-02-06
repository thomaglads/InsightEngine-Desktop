import { CONFIG } from '../config/constants.js';

/**
 * Paginated Query Service
 * Provides efficient data retrieval with LIMIT/OFFSET pagination
 * Prevents memory issues with large datasets
 */
export class PaginatedQueryService {
  constructor(dbConnection) {
    this.conn = dbConnection;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Execute a paginated query
   * @param {string} sql - Base SQL query (without LIMIT/OFFSET)
   * @param {Object} options - Pagination options
   * @param {number} options.page - Page number (1-based)
   * @param {number} options.pageSize - Items per page
   * @param {boolean} options.countTotal - Whether to count total rows
   * @returns {Promise<Object>} Paginated results with metadata
   */
  async executeQuery(sql, options = {}) {
    const {
      page = 1,
      pageSize = CONFIG.PERFORMANCE.DEFAULT_PAGE_SIZE || 100,
      countTotal = true
    } = options;

    const offset = (page - 1) * pageSize;
    
    // Create cache key
    const cacheKey = `${sql}|${page}|${pageSize}`;
    
    // Check cache
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Add pagination to query
      const paginatedSQL = `${sql} LIMIT ${pageSize} OFFSET ${offset}`;
      
      // Execute main query
      const result = await this.conn.query(paginatedSQL);
      const data = result.toArray();
      
      let totalCount = null;
      let totalPages = null;
      
      // Count total rows if requested
      if (countTotal) {
        const countSQL = `SELECT COUNT(*) as total FROM (${sql}) as count_query`;
        const countResult = await this.conn.query(countSQL);
        const countData = countResult.toArray();
        totalCount = countData[0]?.total || 0;
        totalPages = Math.ceil(totalCount / pageSize);
      }

      const response = {
        data,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        },
        performance: {
          queryTime: Date.now(),
          rowCount: data.length
        }
      };

      // Cache the result
      this.setCached(cacheKey, response);
      
      return response;
    } catch (error) {
      console.error('Paginated query error:', error);
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  /**
   * Get all data in chunks (for exports)
   * @param {string} sql - SQL query
   * @param {number} chunkSize - Size of each chunk
   * @yields {Array} Data chunks
   */
  async *streamQuery(sql, chunkSize = 1000) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.executeQuery(sql, {
        page,
        pageSize: chunkSize,
        countTotal: page === 1 // Only count on first page
      });

      yield result.data;

      hasMore = result.pagination.hasNextPage;
      page++;

      // Safety limit
      if (page > 10000) {
        console.warn('Stream query reached safety limit');
        break;
      }
    }
  }

  /**
   * Get aggregated statistics without loading all data
   * @param {string} tableName - Table name
   * @param {string} valueColumn - Column to aggregate
   * @returns {Promise<Object>} Statistics
   */
  async getQuickStats(tableName, valueColumn) {
    const cacheKey = `stats|${tableName}|${valueColumn}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const sql = `
        SELECT 
          COUNT(*) as count,
          SUM("${valueColumn}") as total,
          AVG("${valueColumn}") as average,
          MIN("${valueColumn}") as minimum,
          MAX("${valueColumn}") as maximum
        FROM ${tableName}
      `;

      const result = await this.conn.query(sql);
      const stats = result.toArray()[0];

      this.setCached(cacheKey, stats);
      return stats;
    } catch (error) {
      console.error('Stats query error:', error);
      throw error;
    }
  }

  /**
   * Cache management
   */
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCached(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export default PaginatedQueryService;
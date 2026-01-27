import duckdb from 'duckdb';

// Initialize in-memory database
const db = new duckdb.Database(':memory:');

/**
 * Execute a SQL query and return results.
 * @param {string} sql - SQL query to execute.
 * @returns {Promise<any[]>} - Query results.
 */
export const query = (sql) => {
    return new Promise((resolve, reject) => {
        db.all(sql, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
};

export default db;
console.log('DuckDB Service Initialized');

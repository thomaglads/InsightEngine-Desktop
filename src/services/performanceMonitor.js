import { CONFIG } from '../config/constants.js';

/**
 * Performance Monitoring Service
 * Tracks application performance metrics
 * Helps identify bottlenecks and optimize performance
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = [];
    this.isEnabled = CONFIG.PERFORMANCE?.MONITORING_ENABLED ?? true;
    this.maxMetrics = 1000; // Prevent memory issues
    
    // Initialize memory tracking if available
    if (performance.memory) {
      this.initialMemory = performance.memory.usedJSHeapSize;
    }
  }

  /**
   * Start timing an operation
   * @param {string} operationName - Name of the operation
   * @returns {Function} End timer function
   */
  startTimer(operationName) {
    if (!this.isEnabled) return () => {};
    
    const startTime = performance.now();
    const startMemory = performance.memory?.usedJSHeapSize;
    
    return (metadata = {}) => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const endMemory = performance.memory?.usedJSHeapSize;
      const memoryDelta = startMemory ? endMemory - startMemory : 0;
      
      this.recordMetric({
        type: 'timing',
        name: operationName,
        duration,
        memoryDelta,
        timestamp: new Date().toISOString(),
        ...metadata
      });
      
      return duration;
    };
  }

  /**
   * Measure a function's execution time
   * @param {string} operationName - Name of the operation
   * @param {Function} fn - Function to measure
   * @returns {*} Function result
   */
  async measureAsync(operationName, fn, metadata = {}) {
    const endTimer = this.startTimer(operationName);
    
    try {
      const result = await fn();
      endTimer({ ...metadata, status: 'success' });
      return result;
    } catch (error) {
      endTimer({ ...metadata, status: 'error', error: error.message });
      throw error;
    }
  }

  /**
   * Record a metric
   * @param {Object} metric - Metric data
   */
  recordMetric(metric) {
    if (!this.isEnabled) return;
    
    this.metrics.push(metric);
    
    // Prevent memory leaks by limiting stored metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
    
    // Log slow operations in development
    if (metric.type === 'timing' && metric.duration > 1000) {
      console.warn(`Slow operation detected: ${metric.name} took ${metric.duration.toFixed(2)}ms`);
    }
  }

  /**
   * Record a custom metric
   * @param {string} name - Metric name
   * @param {*} value - Metric value
   * @param {string} type - Metric type
   */
  recordCustomMetric(name, value, type = 'gauge') {
    this.recordMetric({
      type,
      name,
      value,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get performance report
   * @returns {Object} Performance statistics
   */
  getReport() {
    if (this.metrics.length === 0) {
      return { message: 'No metrics recorded yet' };
    }

    const timings = this.metrics.filter(m => m.type === 'timing');
    const byOperation = {};
    
    // Group by operation name
    timings.forEach(metric => {
      if (!byOperation[metric.name]) {
        byOperation[metric.name] = [];
      }
      byOperation[metric.name].push(metric);
    });
    
    // Calculate statistics
    const stats = {};
    Object.keys(byOperation).forEach(name => {
      const operations = byOperation[name];
      const durations = operations.map(m => m.duration);
      
      stats[name] = {
        count: operations.length,
        avg: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        total: durations.reduce((a, b) => a + b, 0)
      };
    });
    
    return {
      totalMetrics: this.metrics.length,
      operations: stats,
      memory: this.getMemoryStats()
    };
  }

  /**
   * Get memory statistics
   * @returns {Object} Memory stats
   */
  getMemoryStats() {
    if (!performance.memory) {
      return { message: 'Memory API not available' };
    }
    
    const mem = performance.memory;
    return {
      usedJSHeapSize: this.formatBytes(mem.usedJSHeapSize),
      totalJSHeapSize: this.formatBytes(mem.totalJSHeapSize),
      jsHeapSizeLimit: this.formatBytes(mem.jsHeapSizeLimit),
      usagePercent: ((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100).toFixed(2) + '%'
    };
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get slow operations (for optimization)
   * @param {number} threshold - Threshold in ms
   * @returns {Array} Slow operations
   */
  getSlowOperations(threshold = 1000) {
    return this.metrics
      .filter(m => m.type === 'timing' && m.duration > threshold)
      .sort((a, b) => b.duration - a.duration);
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = [];
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics() {
    return JSON.stringify(this.metrics, null, 2);
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
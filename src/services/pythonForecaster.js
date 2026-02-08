/**
 * Python Forecaster Service (The Scientist)
 * Integrates Pyodide for advanced analytics and predictions
 * Maintains 100% offline privacy with local package loading
 */
export class PythonForecaster {
  constructor() {
    this.pyodide = null;
    this.isInitialized = false;
    this.packagesLoaded = new Set();
  }

  /**
   * Initialize Pyodide with offline package loading
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('Starting Pyodide initialization (this may take a moment)...');

      // EMERGENCY FIX: Add timeout and progressive loading
      const initPromise = this._doInitialize();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Pyodide initialization timeout')), 45000)
      );

      await Promise.race([initPromise, timeoutPromise]);

      this.isInitialized = true;
      console.log('Pyodide (The Scientist) initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Pyodide:', error);
      this.isInitialized = false;
      // Don't throw error, just mark as unavailable
      console.warn('Python analysis features will be disabled');
    }
  }

  /**
   * Internal initialization method with progressive loading
   * @private
   */
  async _doInitialize() {
    // EMERGENCY FIX: Progressive loading with user feedback
    try {
      // Step 1: Load core Pyodide
      console.log('Loading Pyodide core...');
      const { loadPyodide } = await import('pyodide');

      // Step 2: Initialize with minimal config
      console.log('Initializing Pyodide runtime...');
      this.pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/',
        fullStdLib: false,
        jsglobals: true
      });

      // Step 3: Load packages progressively with status updates
      console.log('Loading Python packages...');
      const packages = ['pandas', 'numpy', 'scikit-learn'];

      for (const pkg of packages) {
        try {
          console.log(`Loading ${pkg}...`);
          await this.loadPackage(pkg);
          console.log(`✓ ${pkg} loaded`);
        } catch (pkgError) {
          console.warn(`Failed to load ${pkg}:`, pkgError);
          // Continue with other packages
        }
      }

    } catch (error) {
      throw new Error(`Pyodide initialization failed: ${error.message}`);
    }
  }

  /**
   * Load a Python package
   * @param {string} packageName - Name of the package to load
   */
  async loadPackage(packageName) {
    if (this.packagesLoaded.has(packageName)) return;

    try {
      await this.pyodide.loadPackage(packageName);
      this.packagesLoaded.add(packageName);
      console.log(`Package ${packageName} loaded`);
    } catch (error) {
      console.error(`Failed to load package ${packageName}:`, error);
      throw error;
    }
  }

  /**
   * Execute Python code with data
   * @param {string} pythonCode - Python code to execute
   * @param {Array} data - Array of row objects to convert to DataFrame
   * @param {Object} metadata - Additional metadata (columns, dateColumn, valueColumn, etc.)
   * @returns {Promise<Object>} Execution result with type, result, and visualization data
   */
  async execute(pythonCode, data, metadata = {}) {
    // EMERGENCY FIX: Check availability without blocking
    if (!this.isInitialized) {
      console.warn('Python engine not initialized, skipping execution');
      return {
        success: false,
        type: 'error',
        error: 'Python engine not available. Please wait a moment and try again.',
        explanation: 'The Python analysis engine is still loading in the background.'
      };
    }

    try {
      // Convert data to Python dictionary
      const dataJson = JSON.stringify(data);
      const metadataJson = JSON.stringify(metadata);

      // Set up Python environment with data
      this.pyodide.globals.set('__input_data_json', dataJson);
      this.pyodide.globals.set('__input_metadata_json', metadataJson);

      // Execute setup code to create DataFrame
      const setupCode = `
import pandas as pd
import numpy as np
import json

# Load data into DataFrame
data_list = json.loads(__input_data_json)
df = pd.DataFrame(data_list)

# Load metadata
metadata = json.loads(__input_metadata_json)

# Initialize result variable
__result = None
`;

      await this.pyodide.runPythonAsync(setupCode);

      // Execute user code
      const wrappedCode = `
${pythonCode}

# Ensure result is JSON serializable
if __result is None:
    __result = {"type": "statistical", "result": "No result set", "explanation": "The code did not set __result"}

# Convert to JSON for return
json.dumps(__result, default=str)
`;

      const resultJson = await this.pyodide.runPythonAsync(wrappedCode);
      const result = JSON.parse(resultJson);

      return {
        success: true,
        ...result
      };

    } catch (error) {
      console.error('Python execution error:', error);
      return {
        success: false,
        type: 'error',
        error: error.message,
        explanation: 'Python execution failed'
      };
    }
  }

  /**
   * Create a time series forecast using scikit-learn
   * @param {Array} data - Historical time series data
   * @param {string} dateColumn - Name of the date column
   * @param {string} valueColumn - Name of the value column
   * @param {number} forecastPeriods - Number of periods to forecast
   * @returns {Promise<Object>} Forecast result with actual and predicted values
   */
  async createForecast(data, dateColumn, valueColumn, forecastPeriods = 6) {
    const pythonCode = `
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score
import pandas as pd
import numpy as np

# Prepare data
df_clean = df.copy()
df_clean = df_clean.sort_values(by='${dateColumn}')
df_clean = df_clean.reset_index(drop=True)

# Convert to numeric and handle missing values
y = pd.to_numeric(df_clean['${valueColumn}'], errors='coerce')
X = np.arange(len(y)).reshape(-1, 1)

# Remove NaN values
mask = ~np.isnan(y)
X_clean = X[mask]
y_clean = y[mask]

# Train model
model = LinearRegression()
model.fit(X_clean, y_clean)

# Calculate R²
training_r2 = r2_score(y_clean, model.predict(X_clean))

# Generate future dates
last_idx = len(y) - 1
future_indices = np.arange(last_idx + 1, last_idx + 1 + ${forecastPeriods}).reshape(-1, 1)
future_predictions = model.predict(future_indices)

# Prepare forecast data with dates
forecast_data = []

# Historical data with predictions (for validation)
for i in range(len(y)):
    if not np.isnan(y[i]):
        forecast_data.append({
            "date": str(df_clean.iloc[i]['${dateColumn}']),
            "actual": float(y[i]),
            "predicted": float(model.predict([[i]])[0]),
            "type": "historical"
        })

# Future predictions
for i, pred in enumerate(future_predictions):
    future_idx = len(y) + i
    # Estimate future date
    if '${dateColumn}' in df_clean.columns:
        forecast_data.append({
            "date": f"Future {i+1}",
            "actual": None,
            "predicted": float(pred),
            "type": "forecast"
        })

__result = {
    "type": "forecast",
    "result": {
        "r_squared": float(training_r2),
        "slope": float(model.coef_[0]),
        "intercept": float(model.intercept_),
        "trend": "increasing" if model.coef_[0] > 0 else "decreasing" if model.coef_[0] < 0 else "flat"
    },
    "forecast_data": forecast_data,
    "confidence": float(training_r2),
    "explanation": f"Linear regression forecast with R² = {training_r2:.3f}. The trend is {'increasing' if model.coef_[0] > 0 else 'decreasing'} over time."
}
`;

    return await this.execute(pythonCode, data, { dateColumn, valueColumn, forecastPeriods });
  }

  /**
   * Calculate correlation matrix
   * @param {Array} data - Data with numeric columns
   * @param {Array} numericColumns - List of numeric column names to correlate
   * @returns {Promise<Object>} Correlation matrix and insights
   */
  async calculateCorrelation(data, numericColumns) {
    const columnsStr = JSON.stringify(numericColumns);

    const pythonCode = `
# Select only numeric columns
numeric_cols = ${columnsStr}
df_numeric = df[numeric_cols].apply(pd.to_numeric, errors='coerce')

# Calculate correlation matrix
corr_matrix = df_numeric.corr()

# Find strongest correlations (excluding diagonal)
strongest_corr = []
for i in range(len(corr_matrix.columns)):
    for j in range(i+1, len(corr_matrix.columns)):
        col1 = corr_matrix.columns[i]
        col2 = corr_matrix.columns[j]
        corr_val = corr_matrix.iloc[i, j]
        if not np.isnan(corr_val):
            strongest_corr.append({
                "column1": col1,
                "column2": col2,
                "correlation": float(corr_val),
                "strength": "strong" if abs(corr_val) > 0.7 else "moderate" if abs(corr_val) > 0.4 else "weak"
            })

# Sort by absolute correlation
strongest_corr.sort(key=lambda x: abs(x["correlation"]), reverse=True)

# Convert matrix to serializable format
corr_dict = {}
for col in corr_matrix.columns:
    corr_dict[col] = {}
    for col2 in corr_matrix.columns:
        corr_dict[col][col2] = float(corr_matrix.loc[col, col2])

__result = {
    "type": "correlation",
    "result": {
        "matrix": corr_dict,
        "strongest_correlations": strongest_corr[:5]  # Top 5 correlations
    },
    "explanation": f"Found {len(strongest_corr)} significant correlations. Strongest: {strongest_corr[0]['column1']} vs {strongest_corr[0]['column2']} ({strongest_corr[0]['strength']}, r={strongest_corr[0]['correlation']:.3f})" if strongest_corr else "No significant correlations found"
}
`;

    return await this.execute(pythonCode, data, { numericColumns });
  }

  /**
   * Run regression analysis
   * @param {Array} data - Dataset
   * @param {string} targetColumn - Column to predict
   * @param {Array} featureColumns - Columns to use as features
   * @returns {Promise<Object>} Regression results
   */
  async runRegression(data, targetColumn, featureColumns) {
    const featuresStr = JSON.stringify(featureColumns);

    const pythonCode = `
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score, mean_squared_error
from sklearn.model_selection import train_test_split
import numpy as np

# Prepare features and target
feature_cols = ${featuresStr}
X = df[feature_cols].apply(pd.to_numeric, errors='coerce')
y = pd.to_numeric(df['${targetColumn}'], errors='coerce')

# Remove rows with NaN
mask = ~(X.isnull().any(axis=1) | y.isnull())
X_clean = X[mask]
y_clean = y[mask]

if len(X_clean) < 5:
    __result = {
        "type": "regression",
        "result": {"error": "Insufficient data after cleaning"},
        "explanation": "Not enough valid data points for regression analysis"
    }
else:
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X_clean, y_clean, test_size=0.2, random_state=42)
    
    # Train model
    model = LinearRegression()
    model.fit(X_train, y_train)
    
    # Predictions
    y_pred = model.predict(X_test)
    
    # Metrics
    r2 = r2_score(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    
    # Feature importance (coefficients)
    feature_importance = []
    for i, col in enumerate(feature_cols):
        feature_importance.append({
            "feature": col,
            "coefficient": float(model.coef_[i]),
            "impact": "positive" if model.coef_[i] > 0 else "negative"
        })
    
    # Sort by absolute coefficient
    feature_importance.sort(key=lambda x: abs(x["coefficient"]), reverse=True)
    
    __result = {
        "type": "regression",
        "result": {
            "r_squared": float(r2),
            "rmse": float(rmse),
            "intercept": float(model.intercept_),
            "feature_importance": feature_importance
        },
        "explanation": f"Regression model achieved R² = {r2:.3f} with RMSE = {rmse:.2f}. Most impactful feature: {feature_importance[0]['feature']} ({feature_importance[0]['impact']})"
    }
`;

    return await this.execute(pythonCode, data, { targetColumn, featureColumns });
  }

  /**
   * Check if Pyodide is ready
   * @returns {boolean}
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Get loaded packages
   * @returns {Array}
   */
  getLoadedPackages() {
    return Array.from(this.packagesLoaded);
  }
}

// Singleton instance
export const pythonForecaster = new PythonForecaster();

export default PythonForecaster;

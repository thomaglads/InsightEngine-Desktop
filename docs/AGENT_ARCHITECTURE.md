# Discovery-Led Agent Architecture - Implementation Guide

## Overview

InsightEngine has been transformed from a simple **Query Generator** into an intelligent **Knowledge Agent** that understands your data context, remembers conversation history, and resolves ambiguities through clarifying questions.

## Architecture Components

### 1. Discovery Service (`src/services/discoveryService.js`)

**Purpose**: Automatically analyzes uploaded data to discover values, entities, and relationships.

**Key Features**:
- **Smart Sampling**: Analyzes entire dataset for small files (< 1000 rows), uses stratified sampling for large files
- **Entity Detection**: Automatically identifies column types:
  - `person` - Names (Employee_Name, Customer_Name, etc.)
  - `location` - Geographic data (City, State, Country)
  - `category` - Classifications (Category, Status, Type)
  - `product` - Product identifiers (Product, SKU, Item)
  - `date` - Temporal data (Date, Created, Modified)
- **Value Search**: Enables finding specific values (e.g., "Joe") across columns
- **Top 50 Rule**: Stores only top 50 values per column for prompt efficiency

**Usage**:
```javascript
const discovery = new DiscoveryService(dbConnection);
await discovery.discover('dataset');

// Search for a specific value
const matches = discovery.searchValue('Joe');
// Returns: [{ column: 'Employee_Name', entityType: 'person', value: 'Joe' }]
```

### 2. Conversation Memory (`src/services/conversationMemory.js`)

**Purpose**: Maintains context across conversation turns for pronoun resolution and continuity.

**Key Features**:
- **Context Window**: Stores last 5 exchanges (configurable)
- **Pronoun Resolution**: Resolves "his", "her", "their" to last mentioned entity
- **Clarification Tracking**: Tracks when clarification is needed
- **Fresh Start Rule**: Automatically clears on new file upload

**Example**:
```
User: "What is Joe's salary?"
Agent: "Joe's salary is $85,000"

User: "What about his sales?"
Agent: [Resolves "his" to "Joe"]
→ "Joe's sales total $1.2M"
```

### 3. ReAct Pattern Integration (`src/services/intelligentSQLGenerator.js`)

**Purpose**: Implements Reason + Act pattern for intelligent query generation.

**ReAct Steps**:

1. **THINK**: Analyze user intent with discovery context
   - Parse natural language question
   - Check conversation history for pronouns
   - Search discovery cache for specific entities

2. **ACT**: Take appropriate action based on findings
   - If multiple matches found → Request clarification
   - If single match found → Use that entity
   - If no matches → Proceed with general query

3. **OBSERVE**: Evaluate results
   - Determine if query is ambiguous
   - Check confidence level

4. **EXECUTE**: Generate and run SQL
   - Build query with discovered entities
   - Apply context from conversation history
   - Return results with appropriate visualization

**Example Flow**:
```
User: "What is Joe's profit?"

Agent Thought:
  "User is asking for 'profit' (numeric) and 'Joe' (specific value). 
   I need to find which column contains 'Joe'."

Agent Action:
  Search discovery cache for "Joe"
  Found in: Employee_Name, Manager_Name

Agent Observation:
  Multiple matches found - need clarification

Agent Execution:
  Display: "I found 'Joe' in multiple columns. Which one?"
  Options: [Employee_Name] [Manager_Name]
```

### 4. Clarification UI

**Visual Design**:
- **Yellow Command Pills**: Stand out as interactive options
- **One-Click Resolution**: User clicks pill to resolve ambiguity
- **Natural Integration**: Appears as part of AI response

**Implementation**:
```jsx
{msg.isClarification && (
  <div className="mt-3 flex flex-wrap gap-2">
    {msg.options.map(option => (
      <button className="px-3 py-1.5 bg-yellow-600 text-black rounded-full">
        {option.label}
      </button>
    ))}
  </div>
)}
```

## User Experience Examples

### Example 1: Entity Discovery
```
User uploads: employees.csv

Agent discovers:
- person: Employee_Name, Manager_Name
- location: State, City
- category: Department, Status

User: "Show me Joe"

Agent: "I found 'Joe' in multiple columns. Which one?"
  [Employee_Name] [Manager_Name]

User clicks: Employee_Name

Agent: SELECT * FROM dataset WHERE "Employee_Name" = 'Joe';
→ Shows Joe's full record
```

### Example 2: Pronoun Resolution
```
User: "What is Alice's salary?"

Agent: "Alice's salary is $95,000"

User: "What about her department?"

Agent: [Resolves "her" to "Alice"]
→ "Alice is in the Engineering department"
```

### Example 3: Multi-Turn Conversation
```
User: "Total sales by region"
→ Shows bar chart: West $2M, East $1.5M, South $1M

User: "What about the West region specifically?"

Agent: "The West region has:
  - Top product: Widget A
  - Best month: July
  - Growth: +15% vs last year"
```

## Technical Implementation

### State Management
```javascript
// Agent Architecture State
const [discoveryService, setDiscoveryService] = useState(null);
const [conversationMemory, setConversationMemory] = useState(null);
const [awaitingClarification, setAwaitingClarification] = useState(false);
const [clarificationOptions, setClarificationOptions] = useState([]);
```

### Enhanced Query Flow
```javascript
const handleChat = async (clarificationResponse = null) => {
  // 1. Resolve pronouns from conversation history
  const resolvedText = conversationMemory.resolvePronouns(userText);
  
  // 2. Search discovery cache for entities
  const entityMatches = discoveryService.searchValue(entity);
  
  // 3. Check if clarification needed
  if (entityMatches.length > 1) {
    showClarificationOptions(entityMatches);
    return;
  }
  
  // 4. Build ReAct context
  const enhancedContext = {
    discovery: discoveryService.getAISummary(),
    conversationContext: conversationMemory.getHistoryForPrompt(),
    targetEntity: entityMatches[0]
  };
  
  // 5. Generate query with context
  const result = await sqlGenerator.generateQuery(resolvedText, enhancedContext);
  
  // 6. Update conversation memory
  conversationMemory.addExchange(userText, result);
  
  // 7. Execute and display results
  await runQuery(result.sql);
};
```

## Privacy & Security

✅ **100% Offline**: All processing happens locally via DuckDB and Ollama
✅ **No Data Leakage**: Discovery runs on-device, no external APIs
✅ **Memory Management**: Conversation clears on new file upload
✅ **Secure**: No cloud dependencies, all data stays on user's machine

## Configuration

### Discovery Settings
```javascript
// src/config/constants.js
DISCOVERY: {
  SAMPLE_SIZE: 500,              // Rows to sample for large datasets
  MAX_UNIQUE_VALUES: 50,         // Top values to store
  ENTITY_DETECTION: true,        // Enable entity type detection
  AUTO_DISCOVER: true           // Auto-run on file upload
}
```

### Memory Settings
```javascript
CONVERSATION: {
  MAX_HISTORY: 5,                // Number of exchanges to remember
  PRONOUN_RESOLUTION: true,      // Enable pronoun resolution
  AUTO_CLEAR_ON_UPLOAD: true     // Clear memory on new file
}
```

## Testing the Agent

### Test Case 1: Entity Discovery
```
Upload: sales_data.csv with columns: Customer_Name, Region, Product, Sales

Ask: "Show me Acme Corp"

Expected: Agent finds "Acme Corp" in Customer_Name column
Result: Shows all records for Acme Corp
```

### Test Case 2: Clarification
```
Upload: employees.csv with columns: Employee_Name, Manager_Name

Ask: "What is John's salary?"

Expected: Agent finds "John" in both columns
Result: Shows clarification buttons: [Employee_Name] [Manager_Name]
```

### Test Case 3: Pronoun Resolution
```
Upload: any dataset

Ask: "What is Alice's department?"
Agent: "Alice is in Sales"

Ask: "What about her salary?"

Expected: Agent resolves "her" to "Alice"
Result: Shows Alice's salary
```

## Benefits

1. **No SQL Knowledge Required**: Users ask in plain English
2. **Context Awareness**: Agent remembers previous questions
3. **Ambiguity Resolution**: Asks for clarification when needed
4. **Intelligent Discovery**: Automatically understands data structure
5. **100% Private**: All processing happens locally
6. **Zero Learning Curve**: Natural conversation interface

## Future Enhancements

1. **Multi-Entity Queries**: "Compare Joe and Alice's sales"
2. **Temporal Understanding**: "What were Joe's sales last month?"
3. **Suggestion Engine**: Proactive suggestions based on data patterns
4. **Custom Entity Types**: User-defined entity categories
5. **Persistent Memory**: Save conversation context across sessions

---

**Status**: ✅ IMPLEMENTED AND READY FOR USE

Your InsightEngine is now a true Knowledge Agent that thinks before acting! 🧠✨
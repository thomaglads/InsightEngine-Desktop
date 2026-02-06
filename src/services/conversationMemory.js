/**
 * Conversation Memory Service
 * Manages contextual conversation history for agent reasoning
 * Stores last N exchanges and provides context for pronoun resolution
 */
export class ConversationMemory {
  constructor(maxHistory = 5) {
    this.maxHistory = maxHistory;
    this.history = [];
    this.currentContext = {
      lastMentionedEntity: null,
      lastQueryType: null,
      lastColumnsUsed: [],
      activeFilters: {}
    };
  }

  /**
   * Add exchange to conversation history
   * @param {string} userMessage - User's question
   * @param {Object} agentResponse - Agent's response (sql, action, clarification)
   * @param {Object} metadata - Additional metadata (entities found, columns used, etc.)
   */
  addExchange(userMessage, agentResponse, metadata = {}) {
    const exchange = {
      timestamp: new Date().toISOString(),
      user: userMessage,
      agent: agentResponse,
      metadata: {
        entities: metadata.entities || [],
        columns: metadata.columns || [],
        action: metadata.action || 'query',
        ...metadata
      }
    };

    this.history.push(exchange);
    
    // Keep only last N exchanges
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Update current context
    this.updateContext(exchange);
  }

  /**
   * Update current context based on exchange
   */
  updateContext(exchange) {
    // Track last mentioned entity
    if (exchange.metadata.entities && exchange.metadata.entities.length > 0) {
      this.currentContext.lastMentionedEntity = exchange.metadata.entities[0];
    }

    // Track columns used
    if (exchange.metadata.columns) {
      this.currentContext.lastColumnsUsed = exchange.metadata.columns;
    }

    // Track query type
    if (exchange.metadata.action) {
      this.currentContext.lastQueryType = exchange.metadata.action;
    }
  }

  /**
   * Get conversation history formatted for AI context
   * @returns {string} Formatted conversation history
   */
  getHistoryForPrompt() {
    if (this.history.length === 0) {
      return 'No previous conversation context.';
    }

    const exchanges = this.history.map((exchange, index) => {
      const turn = index + 1;
      return `[Turn ${turn}]
User: "${exchange.user}"
Agent: ${exchange.agent.action === 'clarify' 
  ? `Asked for clarification: "${exchange.agent.question}"`
  : `Executed query using columns: ${exchange.metadata.columns.join(', ')}`}`;
    });

    return `CONVERSATION HISTORY (Last ${this.history.length} exchanges):
${exchanges.join('\n\n')}

CURRENT CONTEXT:
- Last mentioned entity: ${this.currentContext.lastMentionedEntity || 'None'}
- Last columns used: ${this.currentContext.lastColumnsUsed.join(', ') || 'None'}
- Previous query type: ${this.currentContext.lastQueryType || 'None'}`;
  }

  /**
   * Get context for pronoun resolution
   * @param {string} message - Current user message
   * @returns {Object} Resolved context
   */
  resolvePronouns(message) {
    const lowerMessage = message.toLowerCase();
    const pronouns = ['his', 'her', 'their', 'its', 'the', 'this', 'that'];
    
    const hasPronoun = pronouns.some(pronoun => 
      lowerMessage.includes(` ${pronoun} `) || 
      lowerMessage.startsWith(`${pronoun} `)
    );

    if (!hasPronoun) {
      return { hasPronoun: false, resolvedEntity: null };
    }

    // Try to resolve pronoun to last mentioned entity
    if (this.currentContext.lastMentionedEntity) {
      return {
        hasPronoun: true,
        resolvedEntity: this.currentContext.lastMentionedEntity,
        message: message.replace(/\b(his|her|their|its|the)\b/gi, 
          this.currentContext.lastMentionedEntity.name || this.currentContext.lastMentionedEntity)
      };
    }

    return { hasPronoun: true, resolvedEntity: null, message };
  }

  /**
   * Check if we need clarification based on ambiguous reference
   * @param {string} message - User message
   * @param {Array} matches - Potential column matches
   * @returns {Object} Clarification needed
   */
  checkNeedsClarification(message, matches) {
    if (matches.length === 0) {
      return { needsClarification: false };
    }

    if (matches.length === 1) {
      return { needsClarification: false, selected: matches[0] };
    }

    // Multiple matches - need clarification
    return {
      needsClarification: true,
      message: `I found "${message}" in multiple places. Which one do you mean?`,
      options: matches.map(match => ({
        label: `${match.column} (${match.entityType || 'text'})`,
        value: match.column,
        entityType: match.entityType
      }))
    };
  }

  /**
   * Get current context
   */
  getContext() {
    return {
      history: this.history,
      currentContext: this.currentContext,
      exchangeCount: this.history.length
    };
  }

  /**
   * Clear conversation history (call on new file upload)
   */
  clear() {
    this.history = [];
    this.currentContext = {
      lastMentionedEntity: null,
      lastQueryType: null,
      lastColumnsUsed: [],
      activeFilters: {}
    };
  }

  /**
   * Export conversation for debugging
   */
  export() {
    return JSON.stringify({
      history: this.history,
      context: this.currentContext
    }, null, 2);
  }
}

export default ConversationMemory;
# 🥥 Coconut AI: User Welcome Guide
*Welcome to the Future of Offline Analytics.*

## 🚀 The Mission
You are testing **InsightEngine (Coconut AI)**, a 100% offline Data Analyst that runs entirely on your laptop. 
Our goal is to prove that you don't need the cloud to have a smart, secure analyst.

### The "Reliability & Reach" Architecture (NEW!)
We've made a major architectural pivot to solve speed and reliability issues.

**The Problem:** Traditional AI struggles with complex SQL constraints and causes 40-second "cold start" delays.

**The Hybrid-RAG Solution:** We decoupled "Math" from "Language" for maximum performance:
-   **Intent Router (High-Speed JS)**: Instantly determines if you need math/forecasting or general analysis
-   **Direct Math Engine**: Handles forecasting calculations directly - no hallucinations, instant results
-   **SQL LLM (Llama 3.2)**: Translates English to Standard SQL only when needed
-   **The Result**: <1s start time, 0% hallucinations on forecasts, 100% offline on 8GB laptops

---

## 🧪 Your Beta Testing Missions
Don't just look at it—try to break it.

### Mission 1: The "Executive" Check
1.  Upload your own CSV file (Sales, Inventory, Traffic, etc.).
2.  Ask a broad question: *"What are the total sales?"* or *"List the top products."*
3.  **What to Look For**: 
    -   Speed: Should be instant (<1 second)
    -   Accuracy: Cross-check with your data
    -   Chart Quality: Is it professional enough for a slide deck?

### Mission 2: The "Fortune Teller" Break
1.  Ask a prediction question: *"Predict sales for the next 6 months."* or *"What is the trend?"*
2.  **What to Look For**: 
    -   Routing: Should say "Direct Math Engine" (instant)
    -   Click **"Show Work"** to see the routing decision
    -   Forecast quality: Does the dotted line make sense?

### Mission 3: The "Weird Date" Challenge
1.  Ask for unusual date ranges: *"Show me data from last Tuesday"* or *"What about 3 weeks ago?"*
2.  **What to Look For**: 
    -   Does it handle relative dates correctly?
    -   Check the SQL that was generated

### Mission 4: The "Stress Test"
1.  Ask for something impossible: *"Predict sales for the year 2050."*
2.  **What to Look For**: 
    -   Graceful handling vs. crashes
    -   Clear error messages

---

## 🔍 How to Give Feedback
We value **honesty** over politeness. Use the Review Log Template for structured feedback.

### Quick Feedback Options:
1.  **Thumbs Up/Down**: Tap the feedback button on any result
2.  **3-Question Form**: Tell us about Accuracy, Magic Moments, and Frustrations
3.  **Review Log**: Use the template for detailed mission reports

### What We're Watching:
-   **Accuracy**: Are the numbers correct?
-   **Speed**: <1s for math, <3s for SQL queries
-   **Trust**: Does the "Show Work" feature help you understand decisions?
-   **Magic Moments**: Did it solve something that would normally take hours?

### Pro Tips:
-   Click **"Show Work"** on every result to see the routing decision
-   Try to break it - we want to find the edge cases
-   Screenshot weird results and note the exact question you asked

**Thank you for helping us build the future of private AI.**
🥥 *The Coconut Team*

# InsightEngine Desktop

> **The Autonomous, Privacy-First AI Data Analyst for the Enterprise.**

![Status](https://img.shields.io/badge/Status-In%20Development-blue)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Mac-lightgrey)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 📋 Executive Summary

**InsightEngine Desktop** is a secure, autonomous AI analytics platform designed to resolve the critical conflict between **AI productivity** and **Data Sovereignty**.

As enterprises increasingly restrict cloud-based AI (e.g., ChatGPT Enterprise, Copilot) due to data leakage risks, employees are left without modern tools. InsightEngine bridges this gap by deploying an autonomous "AI Data Analyst" directly onto the user's device. By processing all data locally—leveraging embedded analytics (**DuckDB**) and on-device inference (**Ollama**)—we deliver the intelligence of a Large Language Model with the security profile of a strictly offline spreadsheet.

### Strategic Value
* **100% Data Privacy:** No data ever leaves the corporate endpoint.
* **Zero Operational Cost:** Eliminates per-seat SaaS subscription fees by utilizing existing hardware.
* **Regulatory Compliance:** Native compliance with GDPR, HIPAA, and SOC2 requirements.

---

## 📉 The Business Case

### The Problem: The "Cloud AI" Compliance Trap
Organizations in regulated sectors (Finance, Healthcare, Defense) face a trilemma:
1.  **Security Risk:** Uploading sensitive datasets (e.g., PII, Payroll, Strategy) to public or private clouds introduces unacceptable third-party risk.
2.  **Latency:** Cloud-based SQL generation creates friction in high-volume data workflows.
3.  **Cost:** Enterprise AI licenses average ~$360/user/year, creating a massive barrier to adoption for non-technical staff.

### The Solution: Local-First Intelligence
InsightEngine inverts the standard AI model. Instead of moving sensitive data to the AI (Cloud), we move the AI to the data (Edge).
* **Risk Mitigation:** By architecting the system as a local executable (`.exe`), we physically prevent data egress.
* **Operational Efficiency:** Enables non-technical managers to query complex data in plain English, reducing the ad-hoc query burden on Data Science teams by an estimated 40-50%.

---

## 🏗 High-Level Architecture

We utilize a **Hybrid Desktop Architecture** that combines the user experience of a native application with the performance of a modern data warehouse.

```mermaid
graph LR
    User[User Interface] <-->|IPC| Electron[Electron Main Process]
    Electron <-->|SQL Queries| DuckDB[(Embedded DuckDB)]
    Electron <-->|Inference| Ollama[Ollama Local API]

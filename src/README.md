# Gator-Zap: Asynchronous Webhook Processing Pipeline ⚡

Gator-Zap is a resilient, distributed task processing system designed to handle high-volume webhook ingestion and delivery. It allows users to create custom data pipelines that transform incoming payloads and deliver them to multiple subscribers with built-in reliability.

##  Architecture & Technical Decisions

- **Asynchronous Processing (Producer-Consumer Pattern):** To ensure the API remains highly responsive, incoming webhooks are acknowledged immediately and queued in a PostgreSQL database for background processing.
- **Decoupled Services:** The system is split into two distinct services:
  1. **API Service:** Handles CRUD for pipelines and webhook ingestion.
  2. **Worker Service:** An autonomous process that pulls jobs from the queue and executes logic.
- **PostgreSQL as a Task Queue:** We utilized PostgreSQL to ensure **ACID compliance**. This guarantees that no data is lost even if a service crashes mid-processing.
- **Advanced Concurrency Control:** The worker utilizes **`FOR UPDATE SKIP LOCKED`** SQL logic. This allows the system to scale horizontally; multiple workers can run simultaneously without ever processing the same job twice.
- **Resilience:** Built-in retry logic (up to 3 attempts) with exponential backoff and persistent error logging for failed deliveries.

##  Core Features

- **3+ Processing Actions:**
  - `TRANSFORM_UPPERCASE`: Standardizes text payloads.
  - `ENRICH_TIMESTAMP`: Injects processing metadata into the JSON.
  - `FILTER_SENSITIVE`: Automatically scrubs `password`, `secret`, and `token` fields.
- **Observability:** Dedicated Stats API providing real-time success rates and job counts.
- **Infrastructure:** Fully containerized environment with a managed CI/CD pipeline via GitHub Actions.

##  Getting Started

Ensure you have Docker and Docker Compose installed, then run:

```bash
docker compose up --build
The API will be live at http://localhost:3000.
 API Reference
Pipelines
POST /api/pipelines: Create a new pipeline with subscribers and an action.
GET /api/pipelines: List all active pipelines.
DELETE /api/pipelines/:id: Remove a pipeline and its history.
Webhooks & Monitoring
POST /wh/:sourcePath: Send data to a pipeline.
GET /api/pipelines/:id/jobs: View the execution history of a specific pipeline.
GET /api/stats: View global system metrics.
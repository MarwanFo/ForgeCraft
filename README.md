# ForgeCraft AI - Backend Service

This service runs the **ForgeCraft AI** Discord bot, the message-buffering pipelines, AI sentiment processing, and economic logic.

## Prerequisites

- **Python 3.10+**
- **Docker & Docker Compose** (for running PostgreSQL and Redis locally)

---

## Getting Started (Local Development)

### 1. Start the Databases
From the root of the project workspace (`ForgeCraft/`), spin up PostgreSQL and Redis:
```bash
docker-compose up -d
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` (already initialized with default local credentials) and input your `DISCORD_TOKEN` and `GROQ_API_KEY`/`OPENAI_API_KEY`:
```bash
cd backend
# edit the .env file with your tokens/keys
```

### 3. Initialize Python Virtual Environment
Create and activate a virtual environment:
```powershell
python -m venv venv
venv\Scripts\activate
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### 5. Generate Database Client & Synchronize Schema
Generate the typed Python Prisma client and push the schema directly to your local database:
```bash
prisma generate
prisma db push
```

---

## Running the Bot
Once everything is configured, execute the entry script:
```bash
python run.py
```

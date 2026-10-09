# HAMRAH.EXE — Job Seeker’s Companion Agent

**An AI-powered career companion designed to help job seekers navigate their job search, understand opportunities, and make more informed career decisions.**

HAMRAH.EXE is a full-stack career-support platform that combines a web interface, a structured backend API, job-matching capabilities, and AI-assisted interactions to support the job-seeking journey.

## Overview

Searching for a job involves more than finding vacancies. Job seekers need to understand job requirements, evaluate their fit, manage resumes and applications, prepare for interviews, and learn from their experiences.

HAMRAH.EXE aims to bring these activities together in one platform, with an architecture designed to support career-related workflows and AI-assisted guidance.

## Key Capabilities

The project includes modules for:

* **Job Discovery:** Access and manage job opportunities through the job feed.
* **Job Matching:** Evaluate the relationship between a candidate’s profile and available opportunities.
* **Resume Management:** Create, manage, and export resume documents.
* **AI Career Assistant:** Interact with an agent through a chat interface.
* **Career Memory:** Support career-related context and information management.
* **Application Tracking:** Manage job applications and application outcomes.
* **Interview Preparation:** Support interview-related workflows.
* **Profile Management:** Maintain a candidate profile and related information.
* **Dataset Management:** Upload and manage supported datasets.

The availability and behavior of individual features depend on the current implementation and configuration.

## Architecture

HAMRAH.EXE uses a frontend–backend architecture with a relational database and an external language-model provider.

```text
┌──────────────────────────────┐
│          Web Client          │
│       Next.js + React        │
└──────────────┬───────────────┘
               │ HTTP / JSON
               ▼
┌──────────────────────────────┐
│         Django API            │
│     Django REST Framework     │
│                              │
│  Accounts · Jobs · Resumes   │
│  Agent · Matching · Career   │
│  Applications · Interviews   │
└──────────┬───────────┬───────┘
           │           │
           ▼           ▼
┌────────────────┐  ┌──────────────────┐
│   PostgreSQL   │  │   OpenRouter API  │
│  Persistent DB │  │   LLM Integration│
└────────────────┘  └──────────────────┘
```

For containerized deployment, Docker Compose also includes an Nginx reverse proxy for routing requests between the frontend and backend.

## Technology Stack

| Component         | Technology                                                                     |
| ----------------- | ------------------------------------------------------------------------------ |
| Frontend          | Next.js, React, TypeScript                                                     |
| Backend           | Python, Django, Django REST Framework                                          |
| Authentication    | JWT                                                                            |
| Database          | PostgreSQL in the Docker deployment; SQLite is supported for local development |
| AI integration    | OpenRouter API                                                                 |
| API communication | HTTP / JSON                                                                    |
| Containerization  | Docker, Docker Compose                                                         |
| Reverse proxy     | Nginx                                                                          |

## Repository Structure

```text
Job-Seeker-s-Companion-Agent/
├── Backend/
│   ├── apps/
│   │   ├── accounts/
│   │   ├── agent/
│   │   ├── applications/
│   │   ├── career_memory/
│   │   ├── datasets/
│   │   ├── interview/
│   │   ├── jobs/
│   │   ├── match/
│   │   └── resumes/
│   ├── config/
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── Frontend/
│   ├── app/
│   ├── public/
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── README.md
```

## Getting Started

### Prerequisites

For the recommended Docker-based setup, install:

* [Git](https://git-scm.com/)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/)

For development without Docker, Python 3.12+ and Node.js 22+ are suitable starting points for the current container configurations.

### 1. Clone the repository

```bash
git clone https://github.com/nzmirzadeh-sys/Job-Seeker-s-Companion-Agent.git
cd Job-Seeker-s-Companion-Agent
```

### 2. Configure environment variables

Create a `.env` file in the repository root.

Example configuration for local development:

```dotenv
SECRET_KEY=replace-with-a-long-random-secret
DEBUG=0
ALLOWED_HOSTS=localhost,127.0.0.1,backend

DB_PASSWORD=replace-with-a-strong-database-password

CSRF_TRUSTED_ORIGINS=http://localhost,http://localhost:3000

OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-4o-mini
LLM_TIMEOUT=45

PORT=80
```

Replace the example secrets and API key with your own values. Keep real credentials out of Git and never commit your `.env` file.

The language-model integration requires a valid OpenRouter API key for AI-backed requests. The selected model must also be available to your account.

### 3. Start the application

From the repository root, run:

```bash
docker compose up --build
```

Docker Compose builds the frontend and backend images, starts PostgreSQL, applies database migrations through the backend startup process, and launches the reverse proxy.

Once the services are running, open:

* **Application:** http://localhost
* **Backend health check:** http://localhost/api/health/
* **Django admin:** http://localhost/admin/

To stop the application:

```bash
docker compose down
```

To stop the application and remove its database volume, use `docker compose down -v` only if you intentionally want to delete the persisted database data.

## API Overview

The backend exposes REST endpoints under `/api/`.

| Endpoint                        | Purpose                                |
| ------------------------------- | -------------------------------------- |
| `GET /api/health/`              | Health check                           |
| `POST /api/auth/register/`      | Register an account                    |
| `POST /api/auth/token/`         | Obtain JWT tokens                      |
| `POST /api/auth/token/refresh/` | Refresh an access token                |
| `/api/jobs/`                    | Job feed and job-related operations    |
| `/api/resumes/`                 | Resume management                      |
| `/api/chat/`                    | Agent chat and conversation operations |
| `/api/applications/`            | Application-related workflows          |
| `/api/career/`                  | Career memory operations               |
| `/api/match/`                   | Matching-related operations            |
| `/api/interview/`               | Interview-related operations           |
| `/api/datasets/`                | Dataset management                     |

Some endpoints require JWT authentication. For protected requests, send the access token in the HTTP header:

```http
Authorization: Bearer <access_token>
```

For exact request schemas, parameters, and response formats, refer to the backend URL configuration and the relevant application modules.

## Development

### Backend

```bash
cd Backend
python -m venv .venv
source .venv/bin/activate
```

On Windows, activate the environment with:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run database migrations and start Django:

```bash
python manage.py migrate
python manage.py runserver
```

By default, the development configuration uses SQLite unless database environment variables are supplied.

### Frontend

In a separate terminal:

```bash
cd Frontend
npm ci
npm run dev
```

The frontend's API base URL should be configured for the environment in which the application is running. The Docker deployment configures the browser-facing API prefix through Nginx.

## Security Notes

* Use a strong, unique Django `SECRET_KEY` outside local development.
* Never commit API keys, database passwords, access tokens, or production secrets.
* Keep `DEBUG` disabled in production.
* Restrict `ALLOWED_HOSTS`, CORS, and CSRF trusted origins to the appropriate deployment domains.
* Use strong database credentials and persistent storage appropriate for your environment.
* Protect administrative interfaces and verify authentication and authorization rules before exposing the application publicly.
* Review AI-generated guidance before using it to make important career decisions.

## Project Status

HAMRAH.EXE is an evolving project. Its modular architecture provides a foundation for expanding career-support workflows and AI-assisted functionality. Not every planned capability should be assumed to be production-ready; implementation and deployment status may vary by module.

## Contributing

Contributions, bug reports, and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make focused changes and test them.
4. Submit a pull request describing the changes and any relevant limitations.

## License

No license has been specified in this repository yet. Unless a license is added, permission to reuse, distribute, or modify the code should not be assumed.

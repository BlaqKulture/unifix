# UniFix – Campus Maintenance Request System

A full-stack web application that replaces phone calls, paper forms and WhatsApp
messages with one place to **report, assign, track and resolve** university
maintenance requests.

*MIT 8333 – Advanced Web Application Development (Continuous Assessment)*

| | |
|---|---|
| **Frontend** | React 18 + Vite + Tailwind CSS (deployed on Vercel) |
| **Backend** | Python Flask REST API, JWT auth, bcrypt (deployed on Render) |
| **Database** | PostgreSQL (Neon) via SQLAlchemy ORM |
| **API docs** | Swagger UI at `/api/docs/` |
| **Tests** | pytest (44 API tests) · Vitest + React Testing Library (27 UI tests) |

## Roles

| Role | Can do |
|---|---|
| Student / Staff | Register, submit requests with photos, track progress, edit or cancel while pending |
| Maintenance officer | See assigned jobs, start / hold / complete them with notes, add photos |
| Administrator | Manage users and categories, assign and reassign officers, override status, view reports, export CSV/PDF, read the activity log |

## Advanced features implemented (8)

1. JWT authentication with logout token revocation
2. Role-based access control (API decorators and UI route guards)
3. Photo upload as evidence of the fault
4. In-app notifications
5. Search, filter, sort and pagination
6. Audit trail / activity log
7. API documentation with Swagger (OpenAPI 3)
8. Data export to CSV and PDF

## Demo accounts (created automatically)

| Role | Email | Password |
|---|---|---|
| Administrator | admin@unifix.edu.ng | Admin1234 |
| Officer | officer1@unifix.edu.ng | Officer1234 |
| Student | student@unifix.edu.ng | Student1234 |
| Staff | staff@unifix.edu.ng | Staff1234 |

## Run locally

```bash
# 1. API (http://localhost:5000)
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python wsgi.py               # uses SQLite unless DATABASE_URL is set

# 2. Frontend (http://localhost:5173), in a second terminal
cd frontend
npm install
npm run dev
```

## Run the tests

```bash
cd backend && python -m pytest          # 44 API tests
cd frontend && npm test                  # 27 component tests
```

## Project structure

```
backend/
  app/
    __init__.py        application factory, JWT, error handling, Swagger
    models.py          10 database tables and their relationships
    utils.py           validation, role decorator, audit, notifications, pagination
    openapi.yaml       API documentation
    seed.py            roles, categories, demo users, sample requests
    routes/            auth, users, categories, requests, notifications, reports
  tests/               pytest suite
  wsgi.py              gunicorn entry point
frontend/
  src/
    api.js             fetch wrapper (JWT header, errors)
    AuthContext.jsx    login state
    validation.js      form validation rules
    components/        layout, badges, timeline, lists, toasts, route guard
    pages/             login/register, dashboards, requests, admin pages
    test/              Vitest tests
render.yaml            Render deployment blueprint
DEPLOYMENT.md          step-by-step deployment guide
```

See **DEPLOYMENT.md** to put it online.

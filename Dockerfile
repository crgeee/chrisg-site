# ---- Stage 1: Build the React frontend ----
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Python backend + built frontend ----
FROM python:3.11-slim
WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy built frontend into a static directory Flask/Nginx can serve
COPY --from=frontend-build /app/frontend/dist ./static/

EXPOSE 8000

# Run with Gunicorn (4 workers is a good default for a small VPS)
CMD ["gunicorn", "wsgi:app", "--bind", "0.0.0.0:8000", "--workers", "4"]

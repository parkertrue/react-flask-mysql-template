FROM python:3.11-slim

# Prevents Python from writing pyc files & buffers
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Copy and enable entrypoint
RUN chmod +x entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "60","--graceful-timeout", "30", "--keep-alive", "5", "run_app:app"]

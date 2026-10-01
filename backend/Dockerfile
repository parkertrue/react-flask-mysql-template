FROM python:3.12-slim

# Prevents Python from writing pyc files & buffers
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as a non-root user. The code stays root-owned, so a compromised app
# process cannot rewrite it; nothing needs to write under /app at runtime.
RUN chmod +x entrypoint.sh \
    && addgroup --system appgroup \
    && adduser --system --ingroup appgroup appuser

USER appuser

ENTRYPOINT ["./entrypoint.sh"]

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "60", "--graceful-timeout", "30", "--keep-alive", "5", "run_app:app"]

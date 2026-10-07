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

# 2 processes x 4 threads = 8 requests at once, so other requests don't queue
# behind a login's password hash (~75ms CPU, ~32MB each; 8 fit in the 512MB
# limit). Scale workers with CPUs and threads with memory. A distributed login
# flood still saturates the CPU; stopping that belongs to a CDN or WAF.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--worker-class", "gthread", "--workers", "2", "--threads", "4", "--timeout", "60", "--graceful-timeout", "30", "--keep-alive", "5", "wsgi:app"]

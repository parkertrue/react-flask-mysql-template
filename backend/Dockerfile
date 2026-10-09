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
# USER is numeric so a runtime (e.g. Kubernetes runAsNonRoot) can verify it
# is not root without reading the image's /etc/passwd.
RUN chmod +x entrypoint.sh \
    && addgroup --system --gid 10001 appgroup \
    && adduser --system --uid 10001 --ingroup appgroup appuser

USER 10001:10001

ENTRYPOINT ["./entrypoint.sh"]

# 2 processes x 4 threads = 8 requests at once. At most 2 threads per worker
# hash a password at a time (PASSWORD_HASH_CONCURRENCY in app/config.py: ~75ms
# CPU, ~32MB each), so a burst of logins leaves the rest serving the API.
# gunicorn reads its worker count from WEB_CONCURRENCY, so a deployment can
# change it without a rebuild: about one per CPU, with the compose CPU limit
# raised to match. A distributed login flood still saturates the CPU;
# stopping that belongs to a CDN or WAF.
ENV WEB_CONCURRENCY=2
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--worker-class", "gthread", "--threads", "4", "--timeout", "60", "--graceful-timeout", "30", "--keep-alive", "5", "wsgi:app"]

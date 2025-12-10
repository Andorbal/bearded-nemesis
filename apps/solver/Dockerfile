FROM python:3.12-slim-bookworm

# Install build tools for highspy and OpenGL libs for OpenCV
RUN apt-get update && apt-get install -y \
    build-essential \
    g++ \
    cmake \
    curl \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

ENV PORT=8081
EXPOSE 8081

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]

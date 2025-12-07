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

# Download PaddleOCR models to avoid runtime download
RUN mkdir -p /opt/paddleocr-models && \
    curl -L -o /tmp/en_PP-OCRv3_det_infer.tar https://paddleocr.bj.bcebos.com/PP-OCRv3/english/en_PP-OCRv3_det_infer.tar && \
    tar -xf /tmp/en_PP-OCRv3_det_infer.tar -C /opt/paddleocr-models/ && \
    curl -L -o /tmp/en_PP-OCRv3_rec_infer.tar https://paddleocr.bj.bcebos.com/PP-OCRv3/english/en_PP-OCRv3_rec_infer.tar && \
    tar -xf /tmp/en_PP-OCRv3_rec_infer.tar -C /opt/paddleocr-models/ && \
    curl -L -o /tmp/ch_ppocr_mobile_v2.0_cls_infer.tar https://paddleocr.bj.bcebos.com/dygraph_v2.0/ch/ch_ppocr_mobile_v2.0_cls_infer.tar && \
    tar -xf /tmp/ch_ppocr_mobile_v2.0_cls_infer.tar -C /opt/paddleocr-models/ && \
    rm -rf /tmp/*.tar

# Set PaddleOCR model paths
ENV PADDLEOCR_DET_MODEL_DIR=/opt/paddleocr-models/en_PP-OCRv3_det_infer
ENV PADDLEOCR_REC_MODEL_DIR=/opt/paddleocr-models/en_PP-OCRv3_rec_infer
ENV PADDLEOCR_CLS_MODEL_DIR=/opt/paddleocr-models/ch_ppocr_mobile_v2.0_cls_infer

COPY app/ ./app/

ENV PORT=8081
EXPOSE 8081

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]

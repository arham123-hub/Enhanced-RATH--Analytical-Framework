FROM python:3.10

WORKDIR /app

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Clone the causal-learn submodule (not included in zip downloads)
RUN git clone --branch server --depth 1 https://github.com/Asm-Def/causal-learn.git /app/causal-learn && \
    pip install --no-cache-dir /app/causal-learn

COPY . .

EXPOSE 8000
CMD gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --reload

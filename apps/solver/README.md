# Solver Service

The solver is a Python FastAPI service that handles computationally intensive tasks for Bearded Nemesis. It provides two main capabilities: setlist optimization using linear programming and OCR extraction from Rock Band 4 result screen screenshots.

## Running the Service

The solver runs inside Docker alongside PostgreSQL. From the repository root:

```bash
docker-compose up -d solver
```

This builds the Docker image and starts the service on port 8081. The Dockerfile pre-downloads PaddleOCR models to avoid runtime downloads. For local development without Docker, you can run:

```bash
cd apps/solver
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8081
```

Note that running locally requires downloading PaddleOCR models on first use, which may take a few minutes.

## API Endpoints

The service exposes three endpoints:

`GET /health` returns service status for Docker health checks.

`POST /solve` accepts a JSON payload with candidate songs and constraints, returning the optimal setlist. See the Setlist Optimization section below for details.

`POST /ocr` submits a screenshot for asynchronous OCR processing, returning a job ID immediately. `GET /ocr/{job_id}` retrieves the status and results of that job.

## Setlist Optimization

The solver uses HiGHS, an open-source high-performance linear programming solver, to find optimal setlists. Given a pool of candidate songs with player ratings and various constraints, it determines which songs to include to maximize an objective function.

### How It Works

The optimization is formulated as a Binary Integer Program. Each candidate song becomes a binary decision variable: 1 if included in the setlist, 0 if excluded. The solver maximizes the sum of scores for selected songs while satisfying all constraints.

### Objective Functions

Four objective types are available:

**play_rating** maximizes the sum of play ratings, which represent how much players enjoy playing each song on their instrument. This is useful when you want a setlist of songs that are fun to play.

**song_rating** maximizes song ratings, which represent how much players enjoy the songs themselves regardless of instrument. This optimizes for songs people like to listen to.

**discovery** prioritizes songs that have been played less frequently. The discovery score for each song is calculated as `5.0 * (1 - times_played / 20)`, giving unplayed songs a score of 5 and frequently-played songs a score near 0.

**combined** uses a weighted combination of all three objectives. The weights default to 0.4 for play rating, 0.3 for song rating, and 0.3 for discovery, but these can be customized in the request.

### Rating Aggregation

When multiple players participate, their ratings must be combined into a single value for each song. Three aggregation methods are supported:

**average** takes the mean of all player ratings, balancing everyone's preferences equally.

**minimum** uses the lowest rating among all players, ensuring no one has to play songs they dislike.

**maximum** uses the highest rating, optimizing for songs that at least one player loves.

### Constraints

The solver supports numerous constraints that limit the feasible solution space:

**song_count_min** and **song_count_max** set bounds on the number of songs in the setlist.

**max_duration_minutes** caps the total setlist duration. Songs without duration data are treated as having zero duration.

**difficulty_min** and **difficulty_max** restrict songs to a difficulty range (1-7 scale).

**min_avg_play_rating** and **min_avg_song_rating** ensure the average rating across selected songs meets a threshold.

**unplayed_minimum** guarantees at least N songs that have never been played are included.

**avoid_played_within_days** excludes songs played within the specified number of days.

**bpm_min** and **bpm_max** restrict songs to a tempo range.

**required_song_ids** forces specific songs to be included.

**excluded_song_ids** prevents specific songs from being selected.

### Infeasibility

When constraints are impossible to satisfy simultaneously, the solver returns an "infeasible" status with an empty song list. Common causes include requesting more songs than available in the candidate pool, setting conflicting min/max values, or requiring songs that violate other constraints.

## OCR Processing

The OCR subsystem extracts performance statistics from Rock Band 4 result screen screenshots. It uses PaddleOCR, a deep learning-based OCR engine from Baidu, combined with OpenCV for image preprocessing and region detection.

### The Pipeline

OCR processing follows several stages:

1. **Preprocessing** validates the image orientation (must be landscape) and normalizes the size for consistent region detection.

2. **Region detection** identifies the stats card area of the results screen. Rock Band 4 displays results in a predictable layout, so the code uses relative positions to locate specific data fields like score, accuracy, and note counts.

3. **Star detection** counts the number of stars earned (0-5) and determines if they are gold stars using color analysis with OpenCV.

4. **Text extraction** runs PaddleOCR on specific regions to extract numerical values and text like gamertags, difficulty levels, and performance statistics.

5. **Parsing** converts raw OCR text into structured data, handling common OCR errors and validating extracted values.

### Extracted Data

For each player in the screenshot, the OCR attempts to extract:

- Gamertag (used to match with database users)
- Accuracy percentage
- Difficulty level (Easy, Medium, Hard, Expert)
- Score
- Stars earned (0-5, plus gold star detection)
- Longest note streak
- Notes hit and notes missed
- Average multiplier

Not all fields may be successfully extracted depending on image quality and screen layout variations.

### PaddleOCR

PaddleOCR is a multilingual OCR toolkit that includes text detection, recognition, and angle classification. The solver uses the English PP-OCRv3 models for detection and recognition, plus a classifier model for handling rotated text. These models are pre-downloaded in the Docker image to avoid runtime downloads.

The OCR is configured with `use_gpu=False` for compatibility, `use_angle_cls=True` to handle rotated text, and `lang='en'` for English text recognition. Model paths are set via environment variables, allowing different model versions to be swapped in if needed.

### Asynchronous Processing

OCR jobs run asynchronously via FastAPI's BackgroundTasks. When you POST to `/ocr`, the request returns immediately with a job ID. The OCR processing happens in the background, and you poll `GET /ocr/{job_id}` to check status. Status values are "pending", "processing", "completed", or "failed".

This design prevents long-running OCR operations from blocking the API and allows the frontend to show progress updates.

## Testing

Tests use pytest and are located alongside the source files:

```bash
cd apps/solver
python -m pytest app/           # Run all tests
python -m pytest app/solver_test.py    # Run solver tests only
python -m pytest app/ocr/       # Run OCR tests only
```

The solver tests verify constraint handling and objective optimization. OCR tests include both unit tests for parsing functions and integration tests that process actual screenshots.

## Dependencies

Key Python packages:

- **fastapi** and **uvicorn** provide the web framework and ASGI server
- **highspy** is the Python binding for the HiGHS solver
- **paddleocr** and **paddlepaddle** provide the OCR engine
- **opencv-python-headless** handles image processing
- **pillow** provides additional image manipulation
- **pydantic** handles request/response validation
- **numpy** is used throughout for numerical operations

The headless version of OpenCV is used to avoid GUI dependencies in the Docker container.

## Architecture Notes

The codebase is organized into:

- `main.py` - FastAPI application and endpoint definitions
- `models.py` - Pydantic models for solver requests/responses
- `solver.py` - Linear programming implementation using HiGHS
- `ocr/` - OCR processing subpackage
  - `models.py` - Pydantic models for OCR data
  - `preprocessing.py` - Image validation and normalization
  - `regions.py` - Stats card and region detection
  - `stars.py` - Star count and gold star detection
  - `paddle_extraction.py` - PaddleOCR integration and text parsing

The solver module is stateless and processes each request independently. The OCR module maintains an in-memory job store for tracking asynchronous operations. For production deployments with multiple workers, this should be replaced with Redis or a database.

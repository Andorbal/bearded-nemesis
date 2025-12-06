from fastapi import FastAPI, HTTPException, BackgroundTasks
from typing import Dict
from uuid import uuid4
from datetime import datetime

from app.models import SolveRequest, SolveResponse
from app.solver import solve_setlist
from app.ocr import extract_stats
from app.ocr.models import OcrRequest, OcrResult, OcrJobStatus

app = FastAPI(title="Bearded Nemesis Solver")

# In-memory job store for OCR tasks
# Note: For multi-worker deployments, use Redis or database instead
ocr_jobs: Dict[str, dict] = {}


def process_ocr_job(job_id: str):
    """Background task to process OCR job."""
    job = ocr_jobs.get(job_id)
    if not job:
        return

    job["status"] = "processing"
    try:
        result = extract_stats(job["image_path"])
        job["result"] = result
        job["status"] = "completed"
    except Exception as e:
        job["result"] = OcrResult(
            success=False,
            errors=[f"OCR processing failed: {str(e)}"]
        )
        job["status"] = "failed"
    job["completed_at"] = datetime.now().isoformat()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/solve", response_model=SolveResponse)
async def solve(request: SolveRequest) -> SolveResponse:
    """
    Solve for optimal setlist using Linear Programming.

    Takes candidate songs with ratings and constraints, returns
    ordered list of song IDs that maximize the objective function
    while satisfying all constraints.
    """
    try:
        result = solve_setlist(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Solver error: {str(e)}")


@app.post("/ocr")
async def submit_ocr(request: OcrRequest, background_tasks: BackgroundTasks):
    """
    Submit a screenshot for OCR processing.

    Returns immediately with a job_id. Use GET /ocr/{job_id} to check
    status and retrieve results.

    Args:
        request: OcrRequest with image_path

    Returns:
        Job ID and initial status

    Example:
        POST /ocr
        {"image_path": "/screenshots/playthrough_123_song_5.jpg"}

        Response:
        {"job_id": "abc123", "status": "pending"}
    """
    job_id = str(uuid4())
    job = {
        "job_id": job_id,
        "status": "pending",
        "image_path": request.image_path,
        "result": None,
        "created_at": datetime.now().isoformat(),
        "completed_at": None,
    }
    ocr_jobs[job_id] = job

    # Start background processing
    background_tasks.add_task(process_ocr_job, job_id)

    return {"job_id": job_id, "status": "pending"}


@app.get("/ocr/{job_id}", response_model=OcrJobStatus)
async def get_ocr_result(job_id: str):
    """
    Get the status/result of an OCR job.

    Args:
        job_id: The job ID returned from POST /ocr

    Returns:
        OcrJobStatus with status and result (if completed)

    Example:
        GET /ocr/abc123

        Response (pending):
        {"job_id": "abc123", "status": "processing", ...}

        Response (completed):
        {
            "job_id": "abc123",
            "status": "completed",
            "result": {
                "success": true,
                "players": [...],
                ...
            }
        }
    """
    if job_id not in ocr_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = ocr_jobs[job_id]
    return OcrJobStatus(
        job_id=job["job_id"],
        status=job["status"],
        image_path=job["image_path"],
        result=job["result"],
        created_at=job["created_at"],
        completed_at=job["completed_at"],
    )

from fastapi import FastAPI, HTTPException

from app.models import SolveRequest, SolveResponse
from app.solver import solve_setlist

app = FastAPI(title="Bearded Nemesis Solver")


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

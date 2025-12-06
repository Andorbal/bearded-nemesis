"""
Linear Programming solver for optimal setlist generation.

Uses HiGHS MIP solver with binary decision variables (include/exclude each song).
"""

import highspy
from typing import List, Optional
from app.models import (
    SolveRequest,
    SolveResponse,
    ObjectiveType,
    RatingAggregation,
)


def aggregate_rating(ratings: List[Optional[float]], method: RatingAggregation,
                     default: float = 3.0) -> float:
    """
    Aggregate ratings from multiple players.

    Args:
        ratings: List of ratings (may contain None)
        method: Aggregation method (average, minimum, maximum)
        default: Default value for missing ratings

    Returns:
        Aggregated rating value
    """
    # Filter out None values and use default if needed
    valid_ratings = [r if r is not None else default for r in ratings]

    if not valid_ratings:
        return default

    if method == RatingAggregation.AVERAGE:
        return sum(valid_ratings) / len(valid_ratings)
    elif method == RatingAggregation.MINIMUM:
        return min(valid_ratings)
    elif method == RatingAggregation.MAXIMUM:
        return max(valid_ratings)
    else:
        return default


def calculate_discovery_score(times_played: int, max_times: int = 20) -> float:
    """
    Calculate discovery score (higher for less-played songs).

    Score ranges from 0.0 (played max_times or more) to 5.0 (never played).
    """
    if times_played >= max_times:
        return 0.0
    return 5.0 * (1.0 - times_played / max_times)


def solve_setlist(request: SolveRequest) -> SolveResponse:
    """
    Solve for optimal setlist using Binary Integer Programming.

    Each song is a binary decision variable (0/1 for exclude/include).
    Objective is to maximize based on selected objective function.
    Constraints ensure feasibility requirements.
    """

    candidates = request.candidates
    n_songs = len(candidates)

    # Handle empty candidate pool
    if n_songs == 0:
        return SolveResponse(
            selected_song_ids=[],
            status="optimal",
            objective_value=0.0,
            message="No candidate songs provided"
        )

    # Pre-compute aggregated scores for each song
    play_ratings: List[float] = []
    song_ratings: List[float] = []
    discovery_scores: List[float] = []

    for swc in candidates:
        # Aggregate play ratings
        pr_values = [r.play_rating for r in swc.ratings]
        play_ratings.append(aggregate_rating(pr_values, request.rating_aggregation))

        # Aggregate song ratings
        sr_values = [r.song_rating for r in swc.ratings]
        song_ratings.append(aggregate_rating(sr_values, request.rating_aggregation))

        # Discovery score
        discovery_scores.append(calculate_discovery_score(swc.song.times_played))

    # Calculate objective coefficients based on objective type
    objective_coeffs: List[float] = []

    if request.objective == ObjectiveType.PLAY_RATING:
        objective_coeffs = play_ratings
    elif request.objective == ObjectiveType.SONG_RATING:
        objective_coeffs = song_ratings
    elif request.objective == ObjectiveType.DISCOVERY:
        objective_coeffs = discovery_scores
    elif request.objective == ObjectiveType.COMBINED:
        # Weighted combination
        for i in range(n_songs):
            combined = (
                request.weight_play_rating * play_ratings[i] +
                request.weight_song_rating * song_ratings[i] +
                request.weight_discovery * discovery_scores[i]
            )
            objective_coeffs.append(combined)

    # Create HiGHS model
    h = highspy.Highs()
    h.setOptionValue("log_to_console", False)

    # Decision variables: x[i] = 1 if song i is included, 0 otherwise
    var_indices: List[int] = []
    for i in range(n_songs):
        var_idx = h.addVar(lb=0.0, ub=1.0, obj=objective_coeffs[i])
        var_indices.append(var_idx)

    # Set all variables as integer (binary)
    for var_idx in var_indices:
        h.changeColIntegrality(var_idx, highspy.HighsVarType.kInteger)

    # Maximize objective
    h.changeObjectiveSense(highspy.ObjSense.kMaximize)

    constraints = request.constraints

    # === CONSTRAINT: Song count min ===
    if constraints.song_count_min is not None:
        # sum(x[i]) >= song_count_min
        h.addRow(
            lower=float(constraints.song_count_min),
            upper=highspy.kHighsInf,
            num_nz=n_songs,
            index=var_indices,
            value=[1.0] * n_songs
        )

    # === CONSTRAINT: Song count max ===
    if constraints.song_count_max is not None:
        # sum(x[i]) <= song_count_max
        h.addRow(
            lower=-highspy.kHighsInf,
            upper=float(constraints.song_count_max),
            num_nz=n_songs,
            index=var_indices,
            value=[1.0] * n_songs
        )

    # === CONSTRAINT: Max duration ===
    if constraints.max_duration_minutes is not None:
        max_duration_ms = constraints.max_duration_minutes * 60 * 1000
        durations = [
            swc.song.duration_ms if swc.song.duration_ms is not None else 0
            for swc in candidates
        ]
        # sum(duration[i] * x[i]) <= max_duration_ms
        h.addRow(
            lower=-highspy.kHighsInf,
            upper=float(max_duration_ms),
            num_nz=n_songs,
            index=var_indices,
            value=durations
        )

    # === CONSTRAINT: Difficulty range ===
    if constraints.difficulty_min is not None or constraints.difficulty_max is not None:
        for i, swc in enumerate(candidates):
            diff = swc.song.difficulty

            if constraints.difficulty_min is not None and diff < constraints.difficulty_min:
                # Force x[i] = 0
                h.changeColBounds(var_indices[i], 0.0, 0.0)

            if constraints.difficulty_max is not None and diff > constraints.difficulty_max:
                # Force x[i] = 0
                h.changeColBounds(var_indices[i], 0.0, 0.0)

    # === CONSTRAINT: Min average play rating ===
    if constraints.min_avg_play_rating is not None:
        # sum(play_rating[i] * x[i]) >= min_avg_play_rating * sum(x[i])
        # Rearrange: sum((play_rating[i] - min_avg) * x[i]) >= 0
        threshold = constraints.min_avg_play_rating
        adjusted_coeffs = [pr - threshold for pr in play_ratings]
        h.addRow(
            lower=0.0,
            upper=highspy.kHighsInf,
            num_nz=n_songs,
            index=var_indices,
            value=adjusted_coeffs
        )

    # === CONSTRAINT: Min average song rating ===
    if constraints.min_avg_song_rating is not None:
        threshold = constraints.min_avg_song_rating
        adjusted_coeffs = [sr - threshold for sr in song_ratings]
        h.addRow(
            lower=0.0,
            upper=highspy.kHighsInf,
            num_nz=n_songs,
            index=var_indices,
            value=adjusted_coeffs
        )

    # === CONSTRAINT: Minimum unplayed songs ===
    if constraints.unplayed_minimum is not None:
        unplayed_indicators = [
            1.0 if swc.song.times_played == 0 else 0.0
            for swc in candidates
        ]
        # sum(unplayed[i] * x[i]) >= unplayed_minimum
        h.addRow(
            lower=float(constraints.unplayed_minimum),
            upper=highspy.kHighsInf,
            num_nz=n_songs,
            index=var_indices,
            value=unplayed_indicators
        )

    # === CONSTRAINT: Avoid recently played songs ===
    if constraints.avoid_played_within_days is not None:
        for i, swc in enumerate(candidates):
            if swc.song.last_played_days_ago is not None:
                if swc.song.last_played_days_ago < constraints.avoid_played_within_days:
                    # Force x[i] = 0
                    h.changeColBounds(var_indices[i], 0.0, 0.0)

    # === CONSTRAINT: BPM range ===
    if constraints.bpm_min is not None or constraints.bpm_max is not None:
        for i, swc in enumerate(candidates):
            bpm = swc.song.bpm
            if bpm is not None:
                if constraints.bpm_min is not None and bpm < constraints.bpm_min:
                    h.changeColBounds(var_indices[i], 0.0, 0.0)
                if constraints.bpm_max is not None and bpm > constraints.bpm_max:
                    h.changeColBounds(var_indices[i], 0.0, 0.0)

    # === CONSTRAINT: Required songs ===
    if constraints.required_song_ids:
        for i, swc in enumerate(candidates):
            if swc.song.song_id in constraints.required_song_ids:
                # Force x[i] = 1
                h.changeColBounds(var_indices[i], 1.0, 1.0)

    # === CONSTRAINT: Excluded songs ===
    if constraints.excluded_song_ids:
        for i, swc in enumerate(candidates):
            if swc.song.song_id in constraints.excluded_song_ids:
                # Force x[i] = 0
                h.changeColBounds(var_indices[i], 0.0, 0.0)

    # Solve
    h.run()

    # Get solution
    solution = h.getSolution()
    model_status = h.getModelStatus()

    # Map HiGHS status to our status
    if model_status == highspy.HighsModelStatus.kOptimal:
        status = "optimal"
    elif model_status == highspy.HighsModelStatus.kInfeasible:
        return SolveResponse(
            selected_song_ids=[],
            status="infeasible",
            message="No feasible solution exists for given constraints"
        )
    else:
        status = "feasible"

    # Extract selected songs
    selected_indices = [
        i for i in range(n_songs)
        if solution.col_value[var_indices[i]] > 0.5  # Binary, so > 0.5 means selected
    ]

    # Sort by objective coefficient (descending) for output order
    selected_indices.sort(key=lambda i: objective_coeffs[i], reverse=True)

    selected_song_ids = [candidates[i].song.song_id for i in selected_indices]

    objective_value = h.getObjectiveValue()

    return SolveResponse(
        selected_song_ids=selected_song_ids,
        status=status,
        objective_value=objective_value,
        message=f"Selected {len(selected_song_ids)} songs"
    )

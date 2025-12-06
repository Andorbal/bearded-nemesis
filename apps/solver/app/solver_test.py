import pytest
from app.models import (
    SongCandidate,
    PlayerRating,
    SongWithRatings,
    BuilderConstraints,
    SolveRequest,
    ObjectiveType,
    RatingAggregation,
)
from app.solver import solve_setlist


def make_song(song_id: int, duration_ms: int = 180000, difficulty: int = 3,
              bpm: int = 120, times_played: int = 0, last_played_days_ago: int = None):
    """Helper to create song candidates"""
    return SongCandidate(
        song_id=song_id,
        duration_ms=duration_ms,
        bpm=bpm,
        difficulty=difficulty,
        times_played=times_played,
        last_played_days_ago=last_played_days_ago,
    )


def make_song_with_ratings(song: SongCandidate, play_ratings: list[float] = None,
                           song_ratings: list[float] = None, num_players: int = 2):
    """Helper to create songs with ratings"""
    if play_ratings is None:
        play_ratings = [3.0] * num_players
    if song_ratings is None:
        song_ratings = [3.0] * num_players

    ratings = [
        PlayerRating(user_id=i+1, play_rating=play_ratings[i], song_rating=song_ratings[i])
        for i in range(num_players)
    ]
    return SongWithRatings(song=song, ratings=ratings)


class TestBasicSolving:
    """Test basic solving without constraints"""

    def test_returns_all_songs_with_no_constraints(self):
        """Should return all songs when no constraints are specified"""
        candidates = [
            make_song_with_ratings(make_song(1), [5.0, 5.0]),
            make_song_with_ratings(make_song(2), [4.0, 4.0]),
            make_song_with_ratings(make_song(3), [3.0, 3.0]),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(),
        )

        result = solve_setlist(request)
        assert result.status == "optimal"
        assert len(result.selected_song_ids) == 3
        assert set(result.selected_song_ids) == {1, 2, 3}

    def test_orders_by_objective_play_rating(self):
        """Should order songs by play rating when that's the objective"""
        candidates = [
            make_song_with_ratings(make_song(1), [3.0, 3.0]),
            make_song_with_ratings(make_song(2), [5.0, 5.0]),
            make_song_with_ratings(make_song(3), [4.0, 4.0]),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(),
        )

        result = solve_setlist(request)
        assert result.selected_song_ids[0] == 2  # Highest rated first
        assert result.selected_song_ids[1] == 3
        assert result.selected_song_ids[2] == 1

    def test_orders_by_objective_song_rating(self):
        """Should order songs by song rating when that's the objective"""
        candidates = [
            make_song_with_ratings(make_song(1), play_ratings=[5.0, 5.0], song_ratings=[2.0, 2.0]),
            make_song_with_ratings(make_song(2), play_ratings=[2.0, 2.0], song_ratings=[5.0, 5.0]),
            make_song_with_ratings(make_song(3), play_ratings=[3.0, 3.0], song_ratings=[4.0, 4.0]),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.SONG_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(),
        )

        result = solve_setlist(request)
        assert result.selected_song_ids[0] == 2  # Highest song rating

    def test_orders_by_discovery(self):
        """Should prioritize unplayed songs for discovery objective"""
        candidates = [
            make_song_with_ratings(make_song(1, times_played=10)),
            make_song_with_ratings(make_song(2, times_played=0)),
            make_song_with_ratings(make_song(3, times_played=5)),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.DISCOVERY,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(),
        )

        result = solve_setlist(request)
        assert result.selected_song_ids[0] == 2  # Never played


class TestRatingAggregation:
    """Test different rating aggregation methods"""

    def test_average_aggregation(self):
        """Should average ratings across players"""
        candidates = [
            make_song_with_ratings(make_song(1), [5.0, 1.0]),  # Avg = 3.0
            make_song_with_ratings(make_song(2), [4.0, 4.0]),  # Avg = 4.0
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(),
        )

        result = solve_setlist(request)
        assert result.selected_song_ids[0] == 2  # Better average

    def test_minimum_aggregation(self):
        """Should use minimum rating across players"""
        candidates = [
            make_song_with_ratings(make_song(1), [5.0, 1.0]),  # Min = 1.0
            make_song_with_ratings(make_song(2), [3.0, 3.0]),  # Min = 3.0
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.MINIMUM,
            constraints=BuilderConstraints(),
        )

        result = solve_setlist(request)
        assert result.selected_song_ids[0] == 2  # Better minimum

    def test_maximum_aggregation(self):
        """Should use maximum rating across players"""
        candidates = [
            make_song_with_ratings(make_song(1), [5.0, 1.0]),  # Max = 5.0
            make_song_with_ratings(make_song(2), [4.0, 4.0]),  # Max = 4.0
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.MAXIMUM,
            constraints=BuilderConstraints(),
        )

        result = solve_setlist(request)
        assert result.selected_song_ids[0] == 1  # Better maximum


class TestConstraints:
    """Test individual constraints"""

    def test_song_count_min(self):
        """Should include at least min songs"""
        candidates = [
            make_song_with_ratings(make_song(i), [3.0, 3.0])
            for i in range(1, 6)
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(song_count_min=3),
        )

        result = solve_setlist(request)
        assert len(result.selected_song_ids) >= 3

    def test_song_count_max(self):
        """Should include at most max songs"""
        candidates = [
            make_song_with_ratings(make_song(i), [5.0, 5.0])
            for i in range(1, 11)
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(song_count_max=5),
        )

        result = solve_setlist(request)
        assert len(result.selected_song_ids) <= 5

    def test_max_duration(self):
        """Should respect total duration constraint"""
        # 3 minute songs
        candidates = [
            make_song_with_ratings(make_song(i, duration_ms=180000), [5.0, 5.0])
            for i in range(1, 11)
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(max_duration_minutes=10),  # ~3 songs
        )

        result = solve_setlist(request)
        # Should select at most 3 songs (9 minutes)
        assert len(result.selected_song_ids) <= 4

    def test_difficulty_range(self):
        """Should only include songs within difficulty range"""
        candidates = [
            make_song_with_ratings(make_song(1, difficulty=2), [5.0, 5.0]),
            make_song_with_ratings(make_song(2, difficulty=4), [5.0, 5.0]),
            make_song_with_ratings(make_song(3, difficulty=6), [5.0, 5.0]),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(difficulty_min=3, difficulty_max=5),
        )

        result = solve_setlist(request)
        assert 1 not in result.selected_song_ids  # Too easy
        assert 2 in result.selected_song_ids
        assert 3 not in result.selected_song_ids  # Too hard

    def test_min_avg_play_rating(self):
        """Should maintain minimum average play rating"""
        candidates = [
            make_song_with_ratings(make_song(1), [5.0, 5.0]),
            make_song_with_ratings(make_song(2), [4.0, 4.0]),
            make_song_with_ratings(make_song(3), [2.0, 2.0]),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(
                min_avg_play_rating=3.5,
                song_count_max=10,
            ),
        )

        result = solve_setlist(request)
        # Should exclude song 3 as it would lower average below 3.5
        assert 3 not in result.selected_song_ids

    def test_unplayed_minimum(self):
        """Should include minimum number of unplayed songs"""
        candidates = [
            make_song_with_ratings(make_song(1, times_played=0), [3.0, 3.0]),
            make_song_with_ratings(make_song(2, times_played=0), [3.0, 3.0]),
            make_song_with_ratings(make_song(3, times_played=5), [5.0, 5.0]),
            make_song_with_ratings(make_song(4, times_played=10), [5.0, 5.0]),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(
                unplayed_minimum=2,
                song_count_max=3,
            ),
        )

        result = solve_setlist(request)
        # Must include both unplayed songs
        assert 1 in result.selected_song_ids
        assert 2 in result.selected_song_ids

    def test_avoid_played_recently(self):
        """Should exclude songs played within N days"""
        candidates = [
            make_song_with_ratings(make_song(1, last_played_days_ago=1), [5.0, 5.0]),
            make_song_with_ratings(make_song(2, last_played_days_ago=5), [5.0, 5.0]),
            make_song_with_ratings(make_song(3, last_played_days_ago=10), [5.0, 5.0]),
            make_song_with_ratings(make_song(4, last_played_days_ago=None), [3.0, 3.0]),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(avoid_played_within_days=7),
        )

        result = solve_setlist(request)
        assert 1 not in result.selected_song_ids  # Too recent
        assert 2 not in result.selected_song_ids  # Too recent
        assert 3 in result.selected_song_ids
        assert 4 in result.selected_song_ids

    def test_bpm_range(self):
        """Should only include songs within BPM range"""
        candidates = [
            make_song_with_ratings(make_song(1, bpm=80), [5.0, 5.0]),
            make_song_with_ratings(make_song(2, bpm=120), [5.0, 5.0]),
            make_song_with_ratings(make_song(3, bpm=180), [5.0, 5.0]),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(bpm_min=100, bpm_max=150),
        )

        result = solve_setlist(request)
        assert 1 not in result.selected_song_ids  # Too slow
        assert 2 in result.selected_song_ids
        assert 3 not in result.selected_song_ids  # Too fast

    def test_required_songs(self):
        """Should always include required songs"""
        candidates = [
            make_song_with_ratings(make_song(1), [5.0, 5.0]),
            make_song_with_ratings(make_song(2), [1.0, 1.0]),  # Low rated
            make_song_with_ratings(make_song(3), [5.0, 5.0]),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(
                required_song_ids=[2],  # Force include low rated song
                song_count_max=2,
            ),
        )

        result = solve_setlist(request)
        assert 2 in result.selected_song_ids

    def test_excluded_songs(self):
        """Should never include excluded songs"""
        candidates = [
            make_song_with_ratings(make_song(1), [5.0, 5.0]),
            make_song_with_ratings(make_song(2), [5.0, 5.0]),
            make_song_with_ratings(make_song(3), [5.0, 5.0]),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(excluded_song_ids=[2]),
        )

        result = solve_setlist(request)
        assert 2 not in result.selected_song_ids


class TestCombinedConstraints:
    """Test multiple constraints working together"""

    def test_count_and_duration_constraints(self):
        """Should respect both count and duration limits"""
        candidates = [
            make_song_with_ratings(make_song(i, duration_ms=120000), [5.0, 5.0])
            for i in range(1, 21)
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(
                song_count_max=10,
                max_duration_minutes=15,  # Only ~7.5 songs fit
            ),
        )

        result = solve_setlist(request)
        # Duration is more restrictive than count
        assert len(result.selected_song_ids) <= 8

    def test_difficulty_and_rating_constraints(self):
        """Should satisfy both difficulty range and min rating"""
        candidates = [
            make_song_with_ratings(make_song(1, difficulty=3), [5.0, 5.0]),
            make_song_with_ratings(make_song(2, difficulty=5), [5.0, 5.0]),
            make_song_with_ratings(make_song(3, difficulty=5), [3.0, 3.0]),
            make_song_with_ratings(make_song(4, difficulty=7), [5.0, 5.0]),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(
                difficulty_min=4,
                difficulty_max=6,
                min_avg_play_rating=4.5,
            ),
        )

        result = solve_setlist(request)
        assert 1 not in result.selected_song_ids  # Too easy
        assert 2 in result.selected_song_ids
        assert 3 not in result.selected_song_ids  # Rating too low
        assert 4 not in result.selected_song_ids  # Too hard


class TestEdgeCases:
    """Test edge cases and error conditions"""

    def test_no_feasible_solution(self):
        """Should return infeasible when constraints cannot be satisfied"""
        candidates = [
            make_song_with_ratings(make_song(1, difficulty=3), [5.0, 5.0]),
            make_song_with_ratings(make_song(2, difficulty=4), [5.0, 5.0]),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(
                song_count_min=5,  # Not enough candidates
            ),
        )

        result = solve_setlist(request)
        assert result.status == "infeasible"
        assert len(result.selected_song_ids) == 0

    def test_empty_candidate_pool(self):
        """Should handle empty candidate list"""
        request = SolveRequest(
            candidates=[],
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(),
        )

        result = solve_setlist(request)
        assert result.status == "optimal"
        assert len(result.selected_song_ids) == 0

    def test_required_and_excluded_conflict(self):
        """Should handle conflicting required/excluded constraints"""
        candidates = [
            make_song_with_ratings(make_song(1), [5.0, 5.0]),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(
                required_song_ids=[1],
                excluded_song_ids=[1],
            ),
        )

        result = solve_setlist(request)
        assert result.status == "infeasible"

    def test_missing_ratings(self):
        """Should handle songs with missing ratings"""
        candidates = [
            SongWithRatings(
                song=make_song(1),
                ratings=[
                    PlayerRating(user_id=1, play_rating=None, song_rating=None),
                    PlayerRating(user_id=2, play_rating=4.0, song_rating=4.0),
                ]
            ),
            make_song_with_ratings(make_song(2), [5.0, 5.0]),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(),
        )

        result = solve_setlist(request)
        # Should treat missing as neutral (3.0) or skip
        assert result.status in ["optimal", "feasible"]

    def test_songs_with_null_duration(self):
        """Should handle songs without duration data"""
        candidates = [
            make_song_with_ratings(make_song(1, duration_ms=None), [5.0, 5.0]),
            make_song_with_ratings(make_song(2, duration_ms=180000), [5.0, 5.0]),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.PLAY_RATING,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(max_duration_minutes=10),
        )

        result = solve_setlist(request)
        # Should handle gracefully (treat as 0 or skip from duration calc)
        assert result.status in ["optimal", "feasible"]


class TestCombinedObjective:
    """Test weighted combination of objectives"""

    def test_combined_objective_with_weights(self):
        """Should combine play rating, song rating, and discovery"""
        candidates = [
            # High play, low song, played a lot
            make_song_with_ratings(
                make_song(1, times_played=20),
                play_ratings=[5.0, 5.0],
                song_ratings=[2.0, 2.0]
            ),
            # Balanced ratings, never played
            make_song_with_ratings(
                make_song(2, times_played=0),
                play_ratings=[4.0, 4.0],
                song_ratings=[4.0, 4.0]
            ),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.COMBINED,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(song_count_max=1),
            weight_play_rating=0.3,
            weight_song_rating=0.3,
            weight_discovery=0.4,  # Emphasize discovery
        )

        result = solve_setlist(request)
        # Song 2 should win due to discovery weight
        assert result.selected_song_ids[0] == 2

    def test_equal_weights_combined_objective(self):
        """Should balance all three factors equally"""
        candidates = [
            make_song_with_ratings(
                make_song(1, times_played=0),
                play_ratings=[5.0, 5.0],
                song_ratings=[3.0, 3.0]
            ),
            make_song_with_ratings(
                make_song(2, times_played=5),
                play_ratings=[4.0, 4.0],
                song_ratings=[5.0, 5.0]
            ),
        ]

        request = SolveRequest(
            candidates=candidates,
            objective=ObjectiveType.COMBINED,
            rating_aggregation=RatingAggregation.AVERAGE,
            constraints=BuilderConstraints(),
            weight_play_rating=0.333,
            weight_song_rating=0.333,
            weight_discovery=0.334,
        )

        result = solve_setlist(request)
        assert result.status in ["optimal", "feasible"]
        assert len(result.selected_song_ids) == 2

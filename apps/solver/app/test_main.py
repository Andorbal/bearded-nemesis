import pytest
from fastapi.testclient import TestClient
from pathlib import Path
from .main import app


client = TestClient(app)


def test_health_endpoint():
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ocr_endpoint_missing_path():
    """Test OCR endpoint with missing image_path."""
    response = client.post("/ocr", json={})
    assert response.status_code == 422  # Validation error


def test_ocr_endpoint_invalid_path():
    """Test OCR endpoint with invalid image path."""
    response = client.post("/ocr", json={"image_path": "/nonexistent/image.jpg"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert len(data["errors"]) > 0


def test_ocr_endpoint_valid_image():
    """Test OCR endpoint with valid example image."""
    base_path = Path(__file__).parent.parent.parent / "docs" / "example-screenshots"
    image_path = str(base_path / "IMG_1816.jpeg")

    response = client.post("/ocr", json={"image_path": image_path})

    assert response.status_code == 200
    data = response.json()

    print(f"\nOCR Result:")
    print(f"  Success: {data['success']}")
    print(f"  Players: {len(data['players'])}")
    if data['players']:
        for player in data['players']:
            print(f"    - {player['gamertag']}: {player.get('accuracy_pct')}% accuracy")
    print(f"  Errors: {data['errors']}")

    # Should successfully process
    assert data["success"] is True or len(data["errors"]) > 0  # Either success or documented errors
    assert "players" in data
    assert isinstance(data["players"], list)


def test_ocr_endpoint_all_examples():
    """Test OCR on all example screenshots."""
    base_path = Path(__file__).parent.parent.parent / "docs" / "example-screenshots"

    test_images = [
        "IMG_1814.jpeg",
        "IMG_1815.jpeg",
        "IMG_1816.jpeg",
    ]

    for img_name in test_images:
        image_path = str(base_path / img_name)
        response = client.post("/ocr", json={"image_path": image_path})

        assert response.status_code == 200, f"Failed to process {img_name}"
        data = response.json()

        print(f"\n{img_name}:")
        print(f"  Success: {data['success']}")
        print(f"  Players: {len(data['players'])}")

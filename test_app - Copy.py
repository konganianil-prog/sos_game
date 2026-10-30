import tempfile
import unittest
from pathlib import Path

from backend import create_app


class AppTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.app = create_app(
            {"TESTING": True, "DATABASE": str(Path(self.temp_dir.name) / "test.sqlite")}
        )
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_home_and_board_api(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        response = self.client.get("/api/board/8")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json["board"]), 8)
        self.assertEqual(self.client.get("/api/board/4").status_code, 400)

    def test_move_endpoint_scores_completed_sos(self):
        board = [[None] * 5 for _ in range(5)]
        board[0][0], board[0][1] = "S", "O"
        response = self.client.post(
            "/api/move", json={"board": board, "row": 0, "col": 2, "letter": "S"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json["combinations"]), 1)

    def test_ai_endpoint_returns_legal_move(self):
        response = self.client.post(
            "/api/ai-move",
            json={"board": [[None] * 5 for _ in range(5)], "difficulty": "hard"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["board"][response.json["row"]][response.json["col"]], response.json["letter"])
        self.assertIn(response.json["letter"], {"S", "O"})

    def test_history_persists_match(self):
        game = {
            "player_one": "Ada",
            "player_two": "Computer",
            "mode": "single",
            "board_size": 5,
            "score_one": 3,
            "score_two": 2,
            "winner": "Ada",
        }
        self.assertEqual(self.client.post("/api/games", json=game).status_code, 201)
        history = self.client.get("/api/history").json["games"]
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["winner"], "Ada")


if __name__ == "__main__":
    unittest.main()

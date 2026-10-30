import unittest

from backend.game_logic import choose_ai_move, empty_board, find_sos, play_move


class GameLogicTests(unittest.TestCase):
    def test_detects_sos_in_all_four_axes(self):
        cases = [
            [[0, 0], [0, 1], [0, 2]],
            [[0, 0], [1, 0], [2, 0]],
            [[0, 0], [1, 1], [2, 2]],
            [[0, 2], [1, 1], [2, 0]],
        ]
        for cells in cases:
            with self.subTest(cells=cells):
                board = empty_board(5)
                for position, letter in zip(cells, ("S", "O", "S")):
                    board[position[0]][position[1]] = letter
                self.assertEqual(len(find_sos(board, tuple(cells[1]))), 1)

    def test_one_move_can_score_multiple_patterns(self):
        board = empty_board(5)
        board[2][1] = "S"
        board[2][3] = "S"
        board[1][2] = "S"
        board[3][2] = "S"
        board[1][1] = "S"
        board[3][3] = "S"
        board[1][3] = "S"
        board[3][1] = "S"
        updated, combinations = play_move(board, 2, 2, "O")
        self.assertEqual(updated[2][2], "O")
        self.assertEqual(len(combinations), 4)

    def test_rejects_occupied_and_invalid_moves(self):
        board = empty_board(5)
        board[0][0] = "S"
        with self.assertRaises(ValueError):
            play_move(board, 0, 0, "O")
        with self.assertRaises(ValueError):
            play_move(board, 0, 1, "X")

    def test_ai_takes_a_scoring_move(self):
        board = empty_board(5)
        board[0][0] = "S"
        board[0][1] = "O"
        self.assertEqual(choose_ai_move(board, "hard"), (0, 2, "S"))

    def test_ai_blocks_an_immediate_human_scoring_cell(self):
        board = empty_board(5)
        board[0][0], board[0][1] = "S", "O"
        row, col, letter = choose_ai_move(board, "hard")
        self.assertEqual((row, col), (0, 2))
        self.assertIn(letter, {"S", "O"})

    def test_ai_move_is_legal_at_every_supported_size_and_difficulty(self):
        for size in range(5, 9):
            for difficulty in ("easy", "medium", "hard"):
                with self.subTest(size=size, difficulty=difficulty):
                    board = empty_board(size)
                    row, col, letter = choose_ai_move(board, difficulty)
                    self.assertTrue(0 <= row < size and 0 <= col < size)
                    self.assertIsNone(board[row][col])
                    self.assertIn(letter, {"S", "O"})


if __name__ == "__main__":
    unittest.main()

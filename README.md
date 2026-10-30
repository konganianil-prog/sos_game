# SOS Game

A responsive SOS strategy game built with HTML, CSS, JavaScript, Flask, and SQLite. Play a local two-player match or challenge the computer at three difficulty levels. The computer takes immediate scoring opportunities, looks for blocks, and uses a deeper board evaluation on Hard.

## Run locally

1. Install Python 3.9 or newer.
2. From this folder, create and activate a virtual environment:

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

3. Install dependencies and start Flask:

   ```powershell
   python -m pip install -r requirements.txt
   python app.py
   ```

4. Open [http://127.0.0.1:5000](http://127.0.0.1:5000).

SQLite creates `instance/sos_history.sqlite3` automatically. Match history is recorded when the board is full; matches you leave early are not stored.

## VS Code

Open this folder in VS Code, select the virtual environment Python interpreter, install `requirements.txt`, and run the **SOS Game (Flask)** launch configuration from Run and Debug. No database server or frontend build step is required.

## Project layout

```text
app.py                    Flask entry point
backend/
  database.py             SQLite setup and match history
  game_logic.py           Board rules, SOS detection, and computer AI
  routes.py               JSON API endpoints
static/
  css/style.css           Responsive game and page styling
  css/sos-arrows.css      SOS direction indicators
  js/app.js               Game UI, turns, timer, and interactions
templates/index.html      Main application shell
tests/                    Rules, API, and persistence tests
.vscode/launch.json       VS Code Flask debugger configuration
```

## Game rules

Place an S or O on an empty cell. A new S–O–S in a row, column, or diagonal scores one point per completed combination. Scoring players keep their turn; otherwise the turn passes. When the board is full, the highest score wins.

Run the test suite with:

```powershell
python -m unittest discover -s tests -v
```

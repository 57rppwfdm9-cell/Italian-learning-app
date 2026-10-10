# Parla comigo

A small Italian-learning web app with a dashboard, beginner lessons, searchable
vocabulary, sentence exercises, flashcards, scenario chat, roleplays, and Call
Mode. The searchable vocabulary and flashcard deck include everyday phrases,
colors, days of the week, food, travel, daily life, and numbers.

## Use the app

The app uses Python's standard library; no packages or API key are needed.

Start the local server:

```sh
python3 server.py
```

Then open <http://127.0.0.1:8000>.

On GitHub Pages, speaker buttons and Call Mode use an Italian voice installed
in your browser or computer. The app prefers voices named Flo, Shelley, or
Sandy when available, then tries other known Italian feminine voice names.
Available voices vary by device and browser. Call Mode also needs a browser
with speech recognition support and microphone permission.

The optional local Python server can use OpenAI's Nova voice when an active API
key with available billing quota is configured in a private `.env` file as
`OPENAI_API_KEY=your_key`. Never paste the key into chat or include it in
screenshots. The `.env` file is excluded from Git.

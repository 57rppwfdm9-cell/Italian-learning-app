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

The speaker buttons and Call Mode request a warm, friendly woman's voice with a
natural Italian accent from OpenAI first. If the provider is unavailable or its
quota is exhausted, the app prefers a feminine Italian voice installed in your
browser or computer. OpenAI speech needs an active API key and available
billing/usage quota. Voice quality for the device fallback depends on installed
Italian voices. Call Mode also needs a browser with speech recognition support
and microphone permission.

To enable OpenAI speech, put an active key in a private `.env` file in this
folder as `OPENAI_API_KEY=your_key`, then start or restart the server. Never
paste the key into chat or include it in screenshots. The `.env` file is
excluded from Git.

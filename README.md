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

The speaker buttons and Call Mode request OpenAI's Nova voice, directed to
speak warmly and expressively with a natural Italian accent. If the provider is
unavailable or its quota is exhausted, the app uses an Italian voice installed
in your browser or computer. OpenAI speech needs an active API key and available
billing/usage quota. Voice quality for the device fallback depends on installed
Italian voices. Call Mode also needs a browser with speech recognition support
and microphone permission.

To enable OpenAI speech locally, put an active key in a private `.env` file in
this folder as `OPENAI_API_KEY=your_key`, then start or restart the server.
Never paste the key into chat or include it in screenshots. The `.env` file is
excluded from Git.

## Host speech for GitHub Pages

GitHub Pages serves only static files and cannot run the speech API. The
`render.yaml` Blueprint deploys `server.py` as a Render web service, and
`app.js` calls that hosted API. Connect this repository at
<https://dashboard.render.com/blueprint/new>, create the service, and enter the
OpenAI key as the `OPENAI_API_KEY` secret when Render prompts for it. Do not
put the key in GitHub or in frontend files. The service accepts browser
requests from this site's GitHub Pages origin and limits each forwarded client
IP to 10 speech requests per minute. OpenAI billing and usage quota are still required;
Render's free service may sleep when idle, so its first request can be slow.

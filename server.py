import json
import os
import ssl
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


APP_DIR = Path(__file__).resolve().parent
OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech"
MAX_REQUEST_BYTES = 8_192
MAX_TEXT_LENGTH = 500


def create_ssl_context():
    default_paths = ssl.get_default_verify_paths()
    candidate_paths = (
        os.environ.get(default_paths.openssl_cafile_env or ""),
        default_paths.cafile,
        "/etc/ssl/cert.pem",
        "/etc/ssl/certs/ca-certificates.crt",
        "/etc/pki/tls/certs/ca-bundle.crt",
    )
    for candidate in candidate_paths:
        if candidate and Path(candidate).is_file():
            return ssl.create_default_context(cafile=candidate)
    return ssl.create_default_context()


def speech_provider_error_message(status, response_body):
    provider_error = {}
    try:
        response_data = json.loads(response_body)
        if isinstance(response_data, dict) and isinstance(response_data.get("error"), dict):
            provider_error = response_data["error"]
    except (json.JSONDecodeError, UnicodeDecodeError):
        pass

    if status == 401:
        return (
            "OpenAI rejected the API key. Replace it with an active key in "
            "the local .env file, then restart Parla."
        )
    if status == 403:
        return "OpenAI denied speech access. Check that your account and API key have access to text-to-speech."
    if status == 429:
        provider_code = str(provider_error.get("code", "")).lower()
        provider_type = str(provider_error.get("type", "")).lower()
        provider_message = str(provider_error.get("message", "")).lower()
        quota_error = (
            provider_code in {"insufficient_quota", "billing_hard_limit_reached", "billing_not_active"}
            or provider_type == "insufficient_quota"
            or "quota" in provider_message
            or "billing" in provider_message
        )
        if quota_error:
            return (
                "Your OpenAI API account has no speech quota available. Check API billing, "
                "credits, and the monthly usage limit for the organization or project that owns this key."
            )
        return "OpenAI is temporarily rate-limiting speech requests. Wait a moment, then try again."
    return f"Speech provider returned an error (HTTP {status})."


def load_local_env():
    env_file = APP_DIR / ".env"
    if not env_file.exists():
        return

    for line_number, raw_line in enumerate(env_file.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        name, separator, value = line.partition("=")
        if not separator or name.strip() != "OPENAI_API_KEY" or not value.strip():
            if separator and name.strip() == "OPENAI_API_KEY" and not value.strip():
                continue
            raise ValueError(f"Invalid .env entry on line {line_number}. Expected OPENAI_API_KEY=value.")
        value = value.strip()
        if value[:1] in {"'", '"'} and value[-1:] == value[:1]:
            value = value[1:-1]
        if not value:
            continue
        os.environ.setdefault("OPENAI_API_KEY", value)


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIR), **kwargs)

    def do_POST(self):
        if self.path != "/api/speech":
            self.send_json(404, {"error": "Endpoint not found."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "Content-Length must be a number."})
            return
        if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
            self.send_json(413, {"error": "Request body must be between 1 and 8192 bytes."})
            return

        try:
            body = json.loads(self.rfile.read(content_length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {"error": "Request body must be valid JSON."})
            return
        if not isinstance(body, dict) or not isinstance(body.get("text"), str):
            self.send_json(400, {"error": "Provide Italian text in a 'text' field."})
            return

        text = body["text"].strip()
        if not text or len(text) > MAX_TEXT_LENGTH:
            self.send_json(400, {"error": "Text must be between 1 and 500 characters."})
            return

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            self.send_json(503, {"error": "Set OPENAI_API_KEY in the server environment to enable natural speech."})
            return

        payload = json.dumps({
            "model": "gpt-4o-mini-tts",
            "voice": "coral",
            "input": text,
            "instructions": (
                "Use a warm, friendly adult woman's voice. Speak Italian with a "
                "natural native Italian accent, clear pronunciation, and a gentle, "
                "encouraging tone. Keep an unhurried conversational pace suitable "
                "for an Italian language learner."
            ),
            "response_format": "mp3",
            "speed": 0.9,
        }).encode("utf-8")
        request = Request(
            OPENAI_SPEECH_URL,
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(request, context=create_ssl_context(), timeout=60) as response:
                audio = response.read()
        except HTTPError as error:
            print(f"OpenAI speech request failed with HTTP {error.code}.", file=sys.stderr)
            message = speech_provider_error_message(error.code, error.read(8_192))
            self.send_json(502, {"error": message})
            return
        except URLError as error:
            print(f"Could not reach OpenAI speech service: {error.reason}", file=sys.stderr)
            self.send_json(502, {"error": "Could not reach the speech provider. Check the server connection and try again."})
            return

        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Content-Length", str(len(audio)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(audio)

    def do_GET(self):
        if self.path == "/api/health":
            self.send_json(200, {"speechConfigured": bool(os.environ.get("OPENAI_API_KEY"))})
            return
        super().do_GET()

    def send_json(self, status, payload):
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)


def main():
    load_local_env()
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), AppHandler)
    print(f"Parla is running at http://127.0.0.1:{port}")
    print("Natural speech is enabled." if os.environ.get("OPENAI_API_KEY") else
          "Set OPENAI_API_KEY in this environment to enable natural speech.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Parla.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

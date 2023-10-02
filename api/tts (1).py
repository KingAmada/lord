import requests
from http.server import BaseHTTPRequestHandler
from io import BytesIO
import json

class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        body = self.rfile.read(content_length)
        data = json.loads(body)

        text = data.get("text")
        
        # Make the HTTP request to ElevenLabs API
        response = your_function_to_make_http_request(text)
        audio_url = response.get('audio')  # Adapt based on the response structure

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        response = BytesIO()
        response.write(json.dumps({"audio": audio_url}).encode())
        self.wfile.write(response.getvalue())

def your_function_to_make_http_request(text):
    # This is where you'll place your existing HTTP request code to ElevenLabs
    # Use the 'text' variable to send as part of the request payload
    # Return the response from ElevenLabs
    pass

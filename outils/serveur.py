"""Serveur local de développement.

Sert le dossier du projet sur 127.0.0.1 (contexte sécurisé pour getUserMedia),
avec des types MIME fixés (les modules ES exigent text/javascript) et sans cache.

Usage : python outils/serveur.py [port]   (port 8000 par défaut)
"""
import functools
import http.server
import os
import sys

TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".txt": "text/plain; charset=utf-8",
}


class Gestionnaire(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        extension = os.path.splitext(path)[1].lower()
        return TYPES.get(extension) or super().guess_type(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    racine = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    gestionnaire = functools.partial(Gestionnaire, directory=racine)
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), gestionnaire) as serveur:
        print(f"http://127.0.0.1:{port}/", flush=True)
        serveur.serve_forever()


if __name__ == "__main__":
    main()

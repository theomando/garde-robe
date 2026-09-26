"""Serveur local de développement.

Sert le dossier du projet sur 127.0.0.1 (contexte sécurisé pour getUserMedia),
avec des types MIME fixés (les modules ES exigent text/javascript) et sans cache.
Le dossier servi est déduit de l'emplacement de ce fichier : on peut le lancer depuis n'importe où.

Usage : python outils/serveur.py [port] [--ouvrir chemin]
  port       8000 par défaut
  --ouvrir   ouvre le navigateur sur ce chemin une fois le serveur prêt (ex. outils/apercu-iphone.html)
Double-clic : outils/demarrer.cmd
"""
import argparse
import functools
import http.server
import os
import sys
import threading
import webbrowser

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


class Serveur(http.server.ThreadingHTTPServer):
    # Sous Windows, SO_REUSEADDR (activé par défaut dans http.server) laisse un second serveur écouter
    # sur un port déjà pris : on le désactive pour qu'un double lancement échoue avec un message clair.
    allow_reuse_address = sys.platform != "win32"


def main():
    arguments = argparse.ArgumentParser(description="Serveur local de Garde-robe chromatique")
    arguments.add_argument("port", nargs="?", type=int, default=8000)
    arguments.add_argument("--ouvrir", metavar="CHEMIN", help="page à ouvrir dans le navigateur")
    options = arguments.parse_args()

    racine = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    gestionnaire = functools.partial(Gestionnaire, directory=racine)
    adresse = f"http://127.0.0.1:{options.port}/"
    try:
        serveur = Serveur(("127.0.0.1", options.port), gestionnaire)
    except OSError as erreur:
        print(f"Impossible d'écouter sur le port {options.port} ({erreur}).", file=sys.stderr)
        print("Le serveur tourne peut-être déjà dans une autre fenêtre : essaie directement " + adresse, file=sys.stderr)
        sys.exit(1)

    with serveur:
        print(f"Serveur prêt : {adresse}", flush=True)
        print("Laisse cette fenêtre ouverte pendant que tu utilises l'app. Ctrl+C (ou fermer la fenêtre) l'arrête.", flush=True)
        if options.ouvrir:
            # Le port est déjà ouvert : le navigateur ne peut pas arriver avant le serveur.
            threading.Timer(0.2, webbrowser.open, [adresse + options.ouvrir.lstrip("/")]).start()
        try:
            serveur.serve_forever()
        except KeyboardInterrupt:
            print("Serveur arrêté.")


if __name__ == "__main__":
    main()

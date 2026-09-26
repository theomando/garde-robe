@echo off
rem Demarre le serveur local de Garde-robe chromatique et ouvre l'apercu iPhone dans le navigateur.
rem Laisser cette fenetre ouverte pendant l'utilisation ; la fermer (ou Ctrl+C) arrete le serveur.
python "%~dp0serveur.py" 8000 --ouvrir outils/apercu-iphone.html
pause

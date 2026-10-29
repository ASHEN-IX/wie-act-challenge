@echo off
chcp 65001 >nul
title EdNova - Lancement Automatique
color 0B

echo ========================================================
echo        🎓 EdNova - Plateforme d'Apprentissage IA
echo ========================================================
echo.

cd /d "C:\Users\user\Desktop\wie-act-challenge"

echo [1/4] Demarrage des bases de donnees Docker...
docker compose up -d

echo.
echo [2/4] Initialisation automatique des donnees demo (Seed)...
call pnpm seed

echo.
echo [3/4] Ouverture automatique de votre navigateur...
start http://localhost:3000

echo.
echo [4/4] Demarrage du serveur Web et API...
echo ========================================================
echo  Le site est pret et accessible aux adresses :
echo  👉 Web UI : http://localhost:3000
echo  👉 API    : http://localhost:3001
echo.
echo  Comptes de demonstration initialises :
echo  - Etudiant   : learner@ednova.test    (Mdp: EdNovaDemo!2026)
echo  - Professeur : instructor@ednova.test (Mdp: EdNovaDemo!2026)
echo  - Admin      : admin@ednova.test      (Mdp: EdNovaDemo!2026)
echo ========================================================
echo.

call pnpm dev
pause

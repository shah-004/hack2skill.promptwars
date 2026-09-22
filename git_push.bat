@echo off
set PATH=%PATH%;C:\Program Files\Git\cmd
git init
git config user.email "shah-004@github.com"
git config user.name "shah-004"
git add .
git commit -m "Initial commit of Shield UI from local"
git branch -M main
git remote add origin https://github.com/shah-004/hack2skill.promptwars.git
echo "Attempting to push to GitHub! Please check your screen for a GitHub login popup if asked..."
git push -u origin main -f

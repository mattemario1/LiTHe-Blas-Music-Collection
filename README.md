To Build:

docker build -t band-site .
docker run -it -p 3000:3000 -p 5000:5000 -v /c/Users/User/BARAKOD/song-app-uploads:/app/server/uploads -v /c/Users/User/BARAKOD/song-app-data:/app/server/data -e UPLOADS_DIR=/app/server/uploads -e DB_PATH=/app/server/data/songs.db band-site
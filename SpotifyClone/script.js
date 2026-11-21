const songs = [
    { songName: "Sorath", filePath: "songs/Sorath.mp3", coverPath: "covers/Sorath.jpg", mood: "bhakti" },
    { songName: "Tere Sang Ishq Hua", filePath: "songs/Tere Sang Ishq Hua.mp3", coverPath: "covers/Tere Sang Ishq Huva.jpg", mood: "love" },
    { songName: "Tu Hai", filePath: "songs/Tu Hai.mp3", coverPath: "covers/Tu Hai.jpg", mood: "love" },
    { songName: "Tere Hawaale", filePath: "songs/Tere Hawaale.mp3", coverPath: "covers/Tere Hawaale.jpg", mood: "love" },
    { songName: "Tera Yaar Hoon Main", filePath: "songs/Tera Yaar Hoon Main.mp3", coverPath: "covers/Tera Yaar Hoon Main.jpg", mood: "friends" },
    { songName: "Sajni", filePath: "songs/Sajni.mp3", coverPath: "covers/Sajni.jpg", mood: "love" },
    { songName: "Raghunandan", filePath: "songs/Raghunandan.mp3", coverPath: "covers/Raghunandan.jpg", mood: "bhakti" },
    { songName: "Raataan Lambiyan", filePath: "songs/Raataan Lambiyan.mp3", coverPath: "covers/Raataan Lambiyan.jpg", mood: "love" },
    { songName: "Qaafirana", filePath: "songs/Qaafirana.mp3", coverPath: "covers/Qaafirana.jpg", mood: "love" },
    { songName: "Paisa Hai Toh", filePath: "songs/Paisa Hai Toh.mp3", coverPath: "covers/Paisa Hai Toh.jpg", mood: "energy" },
    { songName: "Neki Ki Raah", filePath: "songs/Neki Ki Raah.mp3", coverPath: "covers/Neki Ki Raah.jpg", mood: "bhakti" },
    { songName: "Morya Re", filePath: "songs/Morya Re.mp3", coverPath: "covers/Morya Re.jpg", mood: "bhakti" },
    { songName: "Malang Sajna", filePath: "songs/Malang Sajna.mp3", coverPath: "covers/Malang Sajna.jpg", mood: "love" },
    { songName: "Kyu Dikhe Muje Tu Sir Hane Mere", filePath: "songs/Kyu Dikhe Muje Tu Sir Hane Mere.mp3", coverPath: "covers/Kyu Dikhe Muje Tu Sir Hane Mere.jpg", mood: "love" },
    { songName: "Jiya", filePath: "songs/Jiya.mp3", coverPath: "covers/Jiya.jpg", mood: "love" },
    { songName: "Gair Sa Hua Khud Se Bhi", filePath: "songs/Gair Sa Hua Khud Se Bhi.mp3", coverPath: "covers/Gair Sa Hua Khud Se Bhi.jpg", mood: "energy" },
    { songName: "Dil Meri Na Sune", filePath: "songs/Dil Meri Na Sune.mp3", coverPath: "covers/Dil Meri Na Sune.jpg", mood: "love" },
];

const playlists = [
    { id: "all", name: "All songs", desc: "Every track in the library", color: "#1db954", cover: songs[8].coverPath, indexes: songs.map((_, i) => i) },
    { id: "love", name: "Late night love", desc: "Slow, warm, and a little reckless", color: "#e85d75", cover: songs[5].coverPath, indexes: songs.map((s, i) => s.mood === "love" ? i : -1).filter((i) => i >= 0) },
    { id: "bhakti", name: "Bhakti hits", desc: "Sorath, Morya, and the rest", color: "#f5a524", cover: songs[0].coverPath, indexes: songs.map((s, i) => s.mood === "bhakti" ? i : -1).filter((i) => i >= 0) },
    { id: "friends", name: "Yaari", desc: "The one you play with the group", color: "#4c8dff", cover: songs[4].coverPath, indexes: songs.map((s, i) => s.mood === "friends" ? i : -1).filter((i) => i >= 0) },
    { id: "energy", name: "High energy", desc: "Turn it up", color: "#b56bff", cover: songs[9].coverPath, indexes: songs.map((s, i) => s.mood === "energy" ? i : -1).filter((i) => i >= 0) },
];

const audio = new Audio();
audio.volume = 0.8;
const durations = {};

let songIndex = 0;
let queue = playlists[0].indexes.slice();
let activePlaylistId = "all";
let shuffleOn = false;
let repeatOn = false;
let history = [];

const songList = document.getElementById("songList");
const albumGrid = document.getElementById("albumGrid");
const sidePlaylists = document.getElementById("sidePlaylists");
const homeView = document.getElementById("homeView");
const libraryView = document.getElementById("libraryView");
const masterPlay = document.getElementById("masterPlay");
const masterSongName = document.getElementById("masterSongName");
const nowCover = document.getElementById("nowCover");
const nowPlaylist = document.getElementById("nowPlaylist");
const progressBar = document.getElementById("myProgressBar");
const currentTimeEl = document.getElementById("currentTime");
const totalDurationEl = document.getElementById("totalDuration");
const searchSong = document.getElementById("searchSong");
const playlistTitle = document.getElementById("playlistTitle");
const playlistMeta = document.getElementById("playlistMeta");
const playlistKicker = document.getElementById("playlistKicker");

const playSvg = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>`;
const pauseSvg = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`;
const speakerSvg = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9zm11.5 3a3.5 3.5 0 0 0-1.8-3.06v6.12A3.5 3.5 0 0 0 15.5 12"/></svg>`;
const muteSvg = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9zm13.6.4 1.4 1.4-2.2 2.2 2.2 2.2-1.4 1.4-2.2-2.2-2.2 2.2-1.4-1.4 2.2-2.2-2.2-2.2 1.4-1.4 2.2 2.2z"/></svg>`;

function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
}

function playlistById(id) {
    return playlists.find((p) => p.id === id) || playlists[0];
}

function setView(view) {
    const home = view === "home";
    homeView.classList.toggle("hidden", !home);
    libraryView.classList.toggle("hidden", home);
    document.querySelectorAll("[data-view]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.view === view);
    });
}

function paintNowPlaying() {
    const song = songs[songIndex];
    const playlist = playlistById(activePlaylistId);
    masterSongName.textContent = song.songName;
    nowCover.src = song.coverPath;
    nowCover.alt = song.songName;
    nowPlaylist.textContent = playlist.name;
    masterPlay.innerHTML = audio.paused ? playSvg : pauseSvg;
    document.querySelectorAll(".song-row").forEach((row) => {
        row.classList.toggle("active", Number(row.dataset.index) === songIndex);
    });
}

function loadSong(index, autoplay) {
    songIndex = index;
    audio.src = songs[index].filePath;
    paintNowPlaying();
    if (autoplay) audio.play().catch(() => {});
}

function playIndex(index, fromPlaylist) {
    if (fromPlaylist) {
        queue = fromPlaylist.indexes.slice();
        activePlaylistId = fromPlaylist.id;
        openPlaylist(fromPlaylist.id, false);
    }
    if (!queue.includes(index)) queue = [index, ...queue.filter((i) => i !== index)];
    history.push(songIndex);
    loadSong(index, true);
}

function nextSong() {
    if (repeatOn) {
        audio.currentTime = 0;
        audio.play();
        return;
    }
    let next;
    if (shuffleOn && queue.length > 1) {
        do {
            next = queue[Math.floor(Math.random() * queue.length)];
        } while (next === songIndex);
    } else {
        const pos = queue.indexOf(songIndex);
        next = queue[(pos + 1 + queue.length) % queue.length];
    }
    history.push(songIndex);
    loadSong(next, true);
}

function previousSong() {
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
    }
    const prev = history.pop();
    if (prev !== undefined) {
        loadSong(prev, true);
        return;
    }
    const pos = queue.indexOf(songIndex);
    const next = queue[(pos - 1 + queue.length) % queue.length];
    loadSong(next, true);
}

function renderSongs(indexes) {
    const query = searchSong.value.trim().toLowerCase();
    const visible = indexes.filter((i) => songs[i].songName.toLowerCase().includes(query));
    if (!visible.length) {
        songList.innerHTML = `<div class="empty">No songs match “${searchSong.value.trim()}”.</div>`;
        return;
    }
    songList.innerHTML = visible.map((index, order) => {
        const song = songs[index];
        return `
            <button class="song-row ${index === songIndex ? "active" : ""}" data-index="${index}">
                <span class="index">${order + 1}</span>
                <span class="song-main">
                    <img src="${song.coverPath}" alt="">
                    <span class="title">${song.songName}</span>
                </span>
                <span class="time" data-duration="${index}">${durations[index] || "–:––"}</span>
            </button>`;
    }).join("");
    songList.querySelectorAll(".song-row").forEach((row) => {
        row.addEventListener("click", () => playIndex(Number(row.dataset.index)));
    });
}

function openPlaylist(id, showLibrary = true) {
    const playlist = playlistById(id);
    activePlaylistId = id;
    queue = playlist.indexes.slice();
    playlistTitle.textContent = playlist.name;
    playlistKicker.textContent = "Playlist";
    playlistMeta.textContent = `${playlist.indexes.length} songs · ${playlist.desc}`;
    renderSongs(playlist.indexes);
    document.querySelectorAll(".side-pl").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.id === id);
    });
    if (showLibrary) setView("library");
}

function renderAlbums() {
    const playSvgMini = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>`;
    albumGrid.innerHTML = playlists.map((p) => `
        <button class="album" data-id="${p.id}">
            <img src="${p.cover}" alt="">
            <strong>${p.name}</strong>
            <span>${p.desc}</span>
            <span class="mini-play" data-play="${p.id}">${playSvgMini}</span>
        </button>
    `).join("");
    albumGrid.querySelectorAll(".album").forEach((card) => {
        card.addEventListener("click", (e) => {
            const playlist = playlistById(card.dataset.id);
            if (e.target.closest(".mini-play")) {
                playIndex(playlist.indexes[0], playlist);
                setView("library");
                return;
            }
            openPlaylist(playlist.id);
        });
    });
}

function renderSidebar() {
    sidePlaylists.innerHTML = playlists.map((p) => `
        <button class="side-pl ${p.id === activePlaylistId ? "active" : ""}" data-id="${p.id}">
            <span class="dot" style="background:${p.color}"></span>
            ${p.name}
        </button>
    `).join("");
    sidePlaylists.querySelectorAll(".side-pl").forEach((btn) => {
        btn.addEventListener("click", () => openPlaylist(btn.dataset.id));
    });
}

function preloadDurations() {
    songs.forEach((song, index) => {
        const probe = new Audio();
        probe.preload = "metadata";
        probe.src = song.filePath;
        probe.addEventListener("loadedmetadata", () => {
            durations[index] = formatTime(probe.duration);
            const cell = songList.querySelector(`[data-duration="${index}"]`);
            if (cell) cell.textContent = durations[index];
        });
    });
}

const hour = new Date().getHours();
document.getElementById("greeting").textContent =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
        if (btn.dataset.view === "library") openPlaylist(activePlaylistId);
        else setView("home");
    });
});

document.getElementById("heroPlay").addEventListener("click", () => {
    const playlist = playlistById("all");
    playIndex(playlist.indexes[0], playlist);
    setView("library");
});
document.getElementById("playlistPlay").addEventListener("click", () => {
    const playlist = playlistById(activePlaylistId);
    const start = playlist.indexes.includes(songIndex) ? songIndex : playlist.indexes[0];
    if (!audio.paused && playlist.indexes.includes(songIndex)) {
        audio.pause();
        paintNowPlaying();
        return;
    }
    playIndex(start, playlist);
});

masterPlay.addEventListener("click", () => {
    if (!audio.src) loadSong(queue[0], true);
    else if (audio.paused) audio.play();
    else audio.pause();
});
document.getElementById("next").addEventListener("click", nextSong);
document.getElementById("previous").addEventListener("click", previousSong);
document.getElementById("shuffleBtn").addEventListener("click", (e) => {
    shuffleOn = !shuffleOn;
    e.currentTarget.classList.toggle("on", shuffleOn);
});
document.getElementById("repeatBtn").addEventListener("click", (e) => {
    repeatOn = !repeatOn;
    e.currentTarget.classList.toggle("on", repeatOn);
});

audio.addEventListener("play", paintNowPlaying);
audio.addEventListener("pause", paintNowPlaying);
audio.addEventListener("timeupdate", () => {
    if (!Number.isFinite(audio.duration)) return;
    progressBar.value = (audio.currentTime / audio.duration) * 100;
    currentTimeEl.textContent = formatTime(audio.currentTime);
    totalDurationEl.textContent = formatTime(audio.duration);
});
audio.addEventListener("ended", nextSong);
progressBar.addEventListener("input", () => {
    if (Number.isFinite(audio.duration)) {
        audio.currentTime = (progressBar.value / 100) * audio.duration;
    }
});

const volumeBar = document.getElementById("volumeBar");
const volumeIcon = document.getElementById("volumeIcon");
let lastVolume = 0.8;
volumeBar.addEventListener("input", () => {
    audio.volume = volumeBar.value / 100;
    volumeIcon.innerHTML = audio.volume === 0 ? muteSvg : speakerSvg;
});
volumeIcon.addEventListener("click", () => {
    if (audio.volume > 0) {
        lastVolume = audio.volume;
        audio.volume = 0;
        volumeBar.value = 0;
        volumeIcon.innerHTML = muteSvg;
    } else {
        audio.volume = lastVolume || 0.8;
        volumeBar.value = Math.round(audio.volume * 100);
        volumeIcon.innerHTML = speakerSvg;
    }
});

searchSong.addEventListener("input", () => {
    const playlist = playlistById(activePlaylistId);
    if (searchSong.value.trim()) {
        setView("library");
        playlistKicker.textContent = "Search";
        playlistTitle.textContent = searchSong.value.trim();
        renderSongs(songs.map((_, i) => i));
        playlistMeta.textContent = "Matching the full library";
    } else {
        openPlaylist(playlist.id);
    }
});

document.addEventListener("keydown", (e) => {
    const typing = document.activeElement === searchSong;
    if (e.code === "Space" && !typing) {
        e.preventDefault();
        masterPlay.click();
    } else if (e.code === "ArrowRight" && !typing) {
        e.preventDefault();
        nextSong();
    } else if (e.code === "ArrowLeft" && !typing) {
        e.preventDefault();
        previousSong();
    }
});

renderAlbums();
renderSidebar();
openPlaylist("all", false);
setView("home");
loadSong(0, false);
preloadDurations();
volumeBar.value = 80;

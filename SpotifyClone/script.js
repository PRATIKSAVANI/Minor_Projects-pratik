const songs = [
    { songName: "Sorath", filePath: "songs/Sorath.mp3", coverPath: "covers/Sorath.jpg" },
    { songName: "Tere Sang Ishq Hua", filePath: "songs/Tere Sang Ishq Hua.mp3", coverPath: "covers/Tere Sang Ishq Huva.jpg" },
    { songName: "Tu Hai", filePath: "songs/Tu Hai.mp3", coverPath: "covers/Tu Hai.jpg" },
    { songName: "Tere Hawaale", filePath: "songs/Tere Hawaale.mp3", coverPath: "covers/Tere Hawaale.jpg" },
    { songName: "Tera Yaar Hoon Main", filePath: "songs/Tera Yaar Hoon Main.mp3", coverPath: "covers/Tera Yaar Hoon Main.jpg" },
    { songName: "Sajni", filePath: "songs/Sajni.mp3", coverPath: "covers/Sajni.jpg" },
    { songName: "Raghunandan", filePath: "songs/Raghunandan.mp3", coverPath: "covers/Raghunandan.jpg" },
    { songName: "Raataan Lambiyan", filePath: "songs/Raataan Lambiyan.mp3", coverPath: "covers/Raataan Lambiyan.jpg" },
    { songName: "Qaafirana", filePath: "songs/Qaafirana.mp3", coverPath: "covers/Qaafirana.jpg" },
    { songName: "Paisa Hai Toh", filePath: "songs/Paisa Hai Toh.mp3", coverPath: "covers/Paisa Hai Toh.jpg" },
    { songName: "Neki Ki Raah", filePath: "songs/Neki Ki Raah.mp3", coverPath: "covers/Neki Ki Raah.jpg" },
    { songName: "Morya Re", filePath: "songs/Morya Re.mp3", coverPath: "covers/Morya Re.jpg" },
    { songName: "Malang Sajna", filePath: "songs/Malang Sajna.mp3", coverPath: "covers/Malang Sajna.jpg" },
    { songName: "Kyu Dikhe Muje Tu Sir Hane Mere", filePath: "songs/Kyu Dikhe Muje Tu Sir Hane Mere.mp3", coverPath: "covers/Kyu Dikhe Muje Tu Sir Hane Mere.jpg" },
    { songName: "Jiya", filePath: "songs/Jiya.mp3", coverPath: "covers/Jiya.jpg" },
    { songName: "Gair Sa Hua Khud Se Bhi", filePath: "songs/Gair Sa Hua Khud Se Bhi.mp3", coverPath: "covers/Gair Sa Hua Khud Se Bhi.jpg" },
    { songName: "Dil Meri Na Sune", filePath: "songs/Dil Meri Na Sune.mp3", coverPath: "covers/Dil Meri Na Sune.jpg" },
];

const STORE_KEY = "pn-spotify-playlists-v1";
const audio = new Audio();
audio.volume = 0.8;
const durations = {};

let customPlaylists = loadPlaylists();
let songIndex = 0;
let queue = songs.map((_, i) => i);
let activePlaylistId = "liked";
let searching = false;
let shuffleOn = false;
let repeatOn = false;
let history = [];
let pendingSongPath = null;

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
const deletePlaylistBtn = document.getElementById("deletePlaylistBtn");
const songMenu = document.getElementById("songMenu");
const playlistModal = document.getElementById("playlistModal");
const playlistForm = document.getElementById("playlistForm");
const playlistNameInput = document.getElementById("playlistNameInput");

const playSvg = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>`;
const pauseSvg = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`;
const speakerSvg = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9zm11.5 3a3.5 3.5 0 0 0-1.8-3.06v6.12A3.5 3.5 0 0 0 15.5 12"/></svg>`;
const muteSvg = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9zm13.6.4 1.4 1.4-2.2 2.2 2.2 2.2-1.4 1.4-2.2-2.2-2.2 2.2-1.4-1.4 2.2-2.2-2.2-2.2 1.4-1.4 2.2 2.2z"/></svg>`;
const heartSvg = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 20s-7-4.4-7-9.1C5 8 6.8 6.2 9 6.2c1.3 0 2.4.6 3 1.6.6-1 1.7-1.6 3-1.6 2.2 0 4 1.8 4 4.7C19 15.6 12 20 12 20z"/></svg>`;

function loadPlaylists() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
        return Array.isArray(saved) ? saved.filter((p) => p && p.id && p.name) : [];
    } catch {
        return [];
    }
}

function savePlaylists() {
    localStorage.setItem(STORE_KEY, JSON.stringify(customPlaylists));
}

function allIndexes() {
    return songs.map((_, i) => i);
}

function indexesFromPaths(paths) {
    return (paths || [])
        .map((path) => songs.findIndex((song) => song.filePath === path))
        .filter((index) => index >= 0);
}

function playlistById(id) {
    if (id === "liked") {
        return {
            id: "liked",
            name: "Liked Songs",
            desc: "All your songs",
            indexes: allIndexes(),
            pinned: true,
        };
    }
    const found = customPlaylists.find((playlist) => playlist.id === id);
    if (!found) return playlistById("liked");
    return {
        id: found.id,
        name: found.name,
        desc: "Playlist you made",
        indexes: indexesFromPaths(found.paths),
        pinned: false,
    };
}

function libraryItems() {
    return [playlistById("liked"), ...customPlaylists.map((playlist) => playlistById(playlist.id))];
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
}

function compact(text) {
    return String(text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function songMatches(song, query) {
    const raw = query.trim().toLowerCase();
    if (!raw) return true;
    const name = song.songName.toLowerCase();
    return name.includes(raw) || compact(name).includes(compact(raw));
}

function setView(view) {
    homeView.classList.toggle("hidden", view !== "home");
    libraryView.classList.toggle("hidden", view === "home");
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
    nowPlaylist.textContent = searching ? "Search" : playlist.name;
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

function playIndex(index, playlist) {
    if (playlist && playlist.id !== "search") {
        searching = false;
        searchSong.value = "";
        queue = playlist.indexes.slice();
        activePlaylistId = playlist.id;
        openPlaylist(playlist.id, false);
    } else if (playlist) {
        queue = playlist.indexes.slice();
    } else if (!queue.includes(index)) {
        queue = [index, ...queue];
    }
    history.push(songIndex);
    loadSong(index, true);
}

function nextSong() {
    if (!queue.length) return;
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
        const pos = Math.max(0, queue.indexOf(songIndex));
        next = queue[(pos + 1) % queue.length];
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
    const pos = Math.max(0, queue.indexOf(songIndex));
    loadSong(queue[(pos - 1 + queue.length) % queue.length], true);
}

function closeMenu() {
    songMenu.classList.add("hidden");
    songMenu.innerHTML = "";
}

function openMenu(index, anchor) {
    const song = songs[index];
    const current = playlistById(activePlaylistId);
    const inCurrent = !current.pinned && current.indexes.includes(index);
    const playlistButtons = customPlaylists.map((playlist) => {
        const already = (playlist.paths || []).includes(song.filePath);
        return `<button data-add="${playlist.id}" ${already ? "disabled" : ""}>${already ? "Already in" : "Add to"} ${playlist.name}</button>`;
    }).join("");
    songMenu.innerHTML = `
        <div class="menu-label">${song.songName}</div>
        ${playlistButtons || `<button data-create="1">Create a playlist</button>`}
        ${customPlaylists.length ? `<button data-create="1">New playlist with this song</button>` : ""}
        ${inCurrent && !searching ? `<button data-remove="1">Remove from ${current.name}</button>` : ""}
    `;
    songMenu.classList.remove("hidden");
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 230;
    songMenu.style.left = `${Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))}px`;
    songMenu.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - songMenu.offsetHeight - 12)}px`;
    songMenu.querySelectorAll("[data-add]").forEach((btn) => {
        btn.addEventListener("click", () => {
            addSongToPlaylist(btn.dataset.add, song.filePath);
            closeMenu();
        });
    });
    songMenu.querySelectorAll("[data-create]").forEach((btn) => {
        btn.addEventListener("click", () => {
            pendingSongPath = song.filePath;
            closeMenu();
            openCreateModal();
        });
    });
    const removeBtn = songMenu.querySelector("[data-remove]");
    if (removeBtn) {
        removeBtn.addEventListener("click", () => {
            removeSongFromPlaylist(current.id, song.filePath);
            closeMenu();
        });
    }
}

function songRow(index, order) {
    const song = songs[index];
    return `
        <div class="song-row ${index === songIndex ? "active" : ""}" data-index="${index}">
            <span class="index">${order + 1}</span>
            <span class="song-main">
                <img src="${song.coverPath}" alt="">
                <span class="title">${song.songName}</span>
            </span>
            <span class="time" data-duration="${index}">${durations[index] || "–:––"}</span>
            <button class="more-btn" data-menu="${index}" aria-label="Song options">+</button>
        </div>`;
}

function bindRows(root) {
    root.querySelectorAll(".song-row").forEach((row) => {
        row.addEventListener("click", (event) => {
            if (event.target.closest(".more-btn")) return;
            const index = Number(row.dataset.index);
            if (searching) playIndex(index, { id: "search", name: "Search", indexes: queue });
            else playIndex(index);
        });
    });
    root.querySelectorAll(".more-btn").forEach((btn) => {
        btn.addEventListener("click", (event) => {
            event.stopPropagation();
            openMenu(Number(btn.dataset.menu), btn);
        });
    });
}

function renderSongs(indexes, { filter = true, emptyText } = {}) {
    const query = filter ? searchSong.value : "";
    const visible = indexes.filter((index) => songMatches(songs[index], query));
    if (!visible.length) {
        const typed = searchSong.value.trim();
        songList.innerHTML = `<div class="empty">${emptyText || (typed
            ? `No song named “${typed}” in your library. Search uses the tracks already in Liked Songs.`
            : "This playlist is empty. Use + on a song in Liked Songs, or search and add it.")}</div>`;
        return;
    }
    songList.innerHTML = visible.map((index, order) => songRow(index, order)).join("");
    bindRows(songList);
}

function renderAddList(playlist) {
    const missing = allIndexes().filter((index) => !playlist.indexes.includes(index));
    const query = searchSong.value;
    const visible = missing.filter((index) => songMatches(songs[index], query));
    if (!visible.length) return "";
    return `
        <div class="add-label">Add from your songs</div>
        ${visible.map((index, order) => songRow(index, order)).join("")}
    `;
}

function showSearch() {
    const query = searchSong.value.trim();
    searching = true;
    const hits = allIndexes().filter((index) => songMatches(songs[index], query));
    queue = hits.length ? hits : allIndexes();
    setView("library");
    playlistKicker.textContent = "Search";
    playlistTitle.textContent = query;
    playlistMeta.textContent = hits.length
        ? `${hits.length} match${hits.length === 1 ? "" : "es"} in Liked Songs`
        : "Nothing in your library";
    deletePlaylistBtn.classList.add("hidden");
    renderSongs(allIndexes());
    document.querySelectorAll(".side-pl").forEach((btn) => btn.classList.remove("active"));
}

function openPlaylist(id, showLibrary = true) {
    searching = false;
    searchSong.value = "";
    const playlist = playlistById(id);
    activePlaylistId = playlist.id;
    queue = playlist.indexes.slice();
    playlistTitle.textContent = playlist.name;
    playlistKicker.textContent = playlist.pinned ? "Liked Songs" : "Playlist";
    playlistMeta.textContent = `${playlist.indexes.length} song${playlist.indexes.length === 1 ? "" : "s"}`;
    deletePlaylistBtn.classList.toggle("hidden", playlist.pinned);
    songList.innerHTML = "";
    if (!playlist.indexes.length) {
        songList.insertAdjacentHTML("beforeend", `<div class="empty">No songs yet. Add any track from the list below.</div>`);
    } else {
        songList.insertAdjacentHTML("beforeend", playlist.indexes.map((index, order) => songRow(index, order)).join(""));
    }
    if (!playlist.pinned) songList.insertAdjacentHTML("beforeend", renderAddList(playlist));
    bindRows(songList);
    document.querySelectorAll(".side-pl").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.id === playlist.id);
    });
    if (showLibrary) setView("library");
    paintNowPlaying();
}

function coverMarkup(playlist) {
    if (playlist.pinned) return `<div class="liked-art">${heartSvg}</div>`;
    const cover = songs[playlist.indexes[0]]?.coverPath || songs[0].coverPath;
    return `<img src="${cover}" alt="">`;
}

function renderAlbums() {
    albumGrid.innerHTML = libraryItems().map((playlist) => `
        <button class="album" data-id="${playlist.id}">
            ${coverMarkup(playlist)}
            <strong>${playlist.name}</strong>
            <span>${playlist.pinned ? `${songs.length} songs` : `${playlist.indexes.length} songs`}</span>
            <span class="mini-play" data-play="${playlist.id}">${playSvg}</span>
        </button>
    `).join("");
    albumGrid.querySelectorAll(".album").forEach((card) => {
        card.addEventListener("click", (event) => {
            const playlist = playlistById(card.dataset.id);
            if (event.target.closest(".mini-play") && playlist.indexes.length) {
                playIndex(playlist.indexes[0], playlist);
                setView("library");
                return;
            }
            openPlaylist(playlist.id);
        });
    });
}

function renderSidebar() {
    sidePlaylists.innerHTML = libraryItems().map((playlist) => `
        <button class="side-pl ${playlist.id === activePlaylistId && !searching ? "active" : ""}" data-id="${playlist.id}">
            ${playlist.pinned
                ? `<span class="heart">${heartSvg}</span>`
                : `<span class="dot" style="background:#b3b3b3"></span>`}
            ${playlist.name}
        </button>
    `).join("");
    sidePlaylists.querySelectorAll(".side-pl").forEach((btn) => {
        btn.addEventListener("click", () => openPlaylist(btn.dataset.id));
    });
}

function refreshLibrary(openId) {
    renderSidebar();
    renderAlbums();
    if (openId) openPlaylist(openId);
    else if (!searching && !homeView.classList.contains("hidden")) return;
    else if (!searching) openPlaylist(activePlaylistId, false);
}

function addSongToPlaylist(id, filePath) {
    const playlist = customPlaylists.find((item) => item.id === id);
    if (!playlist) return;
    playlist.paths = playlist.paths || [];
    if (!playlist.paths.includes(filePath)) playlist.paths.push(filePath);
    savePlaylists();
    refreshLibrary(searching ? null : id);
    if (searching) showSearch();
}

function removeSongFromPlaylist(id, filePath) {
    const playlist = customPlaylists.find((item) => item.id === id);
    if (!playlist) return;
    playlist.paths = (playlist.paths || []).filter((path) => path !== filePath);
    savePlaylists();
    if (queue.includes(songs.findIndex((song) => song.filePath === filePath))) {
        queue = indexesFromPaths(playlist.paths);
    }
    refreshLibrary(id);
}

function openCreateModal() {
    playlistNameInput.value = "";
    playlistModal.classList.remove("hidden");
    playlistNameInput.focus();
}

function closeCreateModal() {
    playlistModal.classList.add("hidden");
    pendingSongPath = null;
}

document.getElementById("createPlaylistBtn").addEventListener("click", () => {
    pendingSongPath = null;
    openCreateModal();
});
document.getElementById("cancelPlaylist").addEventListener("click", closeCreateModal);
playlistModal.addEventListener("click", (event) => {
    if (event.target === playlistModal) closeCreateModal();
});
playlistForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = playlistNameInput.value.trim();
    if (!name) return;
    const playlist = {
        id: `pl_${Date.now()}`,
        name,
        paths: pendingSongPath ? [pendingSongPath] : [],
    };
    customPlaylists.push(playlist);
    savePlaylists();
    closeCreateModal();
    refreshLibrary(playlist.id);
});

deletePlaylistBtn.addEventListener("click", () => {
    const current = playlistById(activePlaylistId);
    if (current.pinned) return;
    customPlaylists = customPlaylists.filter((playlist) => playlist.id !== current.id);
    savePlaylists();
    activePlaylistId = "liked";
    refreshLibrary("liked");
});

function preloadDurations() {
    songs.forEach((song, index) => {
        const probe = new Audio();
        probe.preload = "metadata";
        probe.src = song.filePath;
        probe.addEventListener("loadedmetadata", () => {
            durations[index] = formatTime(probe.duration);
            document.querySelectorAll(`[data-duration="${index}"]`).forEach((cell) => {
                cell.textContent = durations[index];
            });
        });
    });
}

const hour = new Date().getHours();
document.getElementById("greeting").textContent =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
        if (btn.dataset.view === "library") openPlaylist(activePlaylistId === "search" ? "liked" : activePlaylistId);
        else {
            searching = false;
            searchSong.value = "";
            setView("home");
            renderSidebar();
        }
    });
});

document.getElementById("heroPlay").addEventListener("click", () => {
    const playlist = playlistById("liked");
    playIndex(playlist.indexes[0], playlist);
    setView("library");
});
document.getElementById("playlistPlay").addEventListener("click", () => {
    const source = searching
        ? { id: "search", name: "Search", indexes: queue }
        : playlistById(activePlaylistId);
    if (!source.indexes.length) return;
    const start = source.indexes.includes(songIndex) ? songIndex : source.indexes[0];
    if (!audio.paused && source.indexes.includes(songIndex) && activePlaylistId === source.id) {
        audio.pause();
        paintNowPlaying();
        return;
    }
    playIndex(start, source);
});

masterPlay.addEventListener("click", () => {
    if (!audio.src) loadSong(queue[0] ?? 0, true);
    else if (audio.paused) audio.play();
    else audio.pause();
});
document.getElementById("next").addEventListener("click", nextSong);
document.getElementById("previous").addEventListener("click", previousSong);
document.getElementById("shuffleBtn").addEventListener("click", (event) => {
    shuffleOn = !shuffleOn;
    event.currentTarget.classList.toggle("on", shuffleOn);
});
document.getElementById("repeatBtn").addEventListener("click", (event) => {
    repeatOn = !repeatOn;
    event.currentTarget.classList.toggle("on", repeatOn);
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
    if (searchSong.value.trim()) showSearch();
    else openPlaylist(activePlaylistId === "search" ? "liked" : activePlaylistId);
});

document.addEventListener("click", (event) => {
    if (!event.target.closest(".song-menu") && !event.target.closest(".more-btn")) closeMenu();
});
document.addEventListener("keydown", (event) => {
    const typing = document.activeElement === searchSong || document.activeElement === playlistNameInput;
    if (event.code === "Escape") closeMenu();
    if (event.code === "Space" && !typing) {
        event.preventDefault();
        masterPlay.click();
    } else if (event.code === "ArrowRight" && !typing) {
        event.preventDefault();
        nextSong();
    } else if (event.code === "ArrowLeft" && !typing) {
        event.preventDefault();
        previousSong();
    }
});

renderAlbums();
renderSidebar();
openPlaylist("liked", false);
setView("home");
loadSong(0, false);
preloadDurations();
volumeBar.value = 80;

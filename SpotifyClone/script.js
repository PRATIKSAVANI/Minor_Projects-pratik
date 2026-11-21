const songs = [
  {
    songName: "Sorath",
    filePath: "songs/Sorath.mp3",
    coverPath: "covers/Sorath.jpg",
    mood: "bhakti",
    duration: "2:04",
  },
  {
    songName: "Tere Sang Ishq Hua",
    filePath: "songs/Tere Sang Ishq Hua.mp3",
    coverPath: "covers/Tere Sang Ishq Huva.jpg",
    mood: "love",
    duration: "1:55",
  },
  {
    songName: "Tu Hai",
    filePath: "songs/Tu Hai.mp3",
    coverPath: "covers/Tu Hai.jpg",
    mood: "love",
    duration: "1:34",
  },
  {
    songName: "Tere Hawaale",
    filePath: "songs/Tere Hawaale.mp3",
    coverPath: "covers/Tere Hawaale.jpg",
    mood: "love",
    duration: "2:55",
  },
  {
    songName: "Tera Yaar Hoon Main",
    filePath: "songs/Tera Yaar Hoon Main.mp3",
    coverPath: "covers/Tera Yaar Hoon Main.jpg",
    mood: "friends",
    duration: "2:14",
  },
  {
    songName: "Sajni",
    filePath: "songs/Sajni.mp3",
    coverPath: "covers/Sajni.jpg",
    mood: "love",
    duration: "1:13",
  },
  {
    songName: "Raghunandan",
    filePath: "songs/Raghunandan.mp3",
    coverPath: "covers/Raghunandan.jpg",
    mood: "bhakti",
    duration: "1:18",
  },
  {
    songName: "Raataan Lambiyan",
    filePath: "songs/Raataan Lambiyan.mp3",
    coverPath: "covers/Raataan Lambiyan.jpg",
    mood: "love",
    duration: "1:26",
  },
  {
    songName: "Qaafirana",
    filePath: "songs/Qaafirana.mp3",
    coverPath: "covers/Qaafirana.jpg",
    mood: "love",
    duration: "2:56",
  },
  {
    songName: "Paisa Hai Toh",
    filePath: "songs/Paisa Hai Toh.mp3",
    coverPath: "covers/Paisa Hai Toh.jpg",
    mood: "energy",
    duration: "1:35",
  },
  {
    songName: "Neki Ki Raah",
    filePath: "songs/Neki Ki Raah.mp3",
    coverPath: "covers/Neki Ki Raah.jpg",
    mood: "bhakti",
    duration: "2:30",
  },
  {
    songName: "Morya Re",
    filePath: "songs/Morya Re.mp3",
    coverPath: "covers/Morya Re.jpg",
    mood: "bhakti",
    duration: "2:53",
  },
  {
    songName: "Malang Sajna",
    filePath: "songs/Malang Sajna.mp3",
    coverPath: "covers/Malang Sajna.jpg",
    mood: "love",
    duration: "1:16",
  },
  {
    songName: "Kyu Dikhe Muje Tu Sir Hane Mere",
    filePath: "songs/Kyu Dikhe Muje Tu Sir Hane Mere.mp3",
    coverPath: "covers/Kyu Dikhe Muje Tu Sir Hane Mere.jpg",
    mood: "love",
    duration: "0:22",
  },
  {
    songName: "Jiya",
    filePath: "songs/Jiya.mp3",
    coverPath: "covers/Jiya.jpg",
    mood: "love",
    duration: "2:23",
  },
  {
    songName: "Gair Sa Hua Khud Se Bhi",
    filePath: "songs/Gair Sa Hua Khud Se Bhi.mp3",
    coverPath: "covers/Gair Sa Hua Khud Se Bhi.jpg",
    mood: "energy",
    duration: "1:44",
  },
  {
    songName: "Dil Meri Na Sune",
    filePath: "songs/Dil Meri Na Sune.mp3",
    coverPath: "covers/Dil Meri Na Sune.jpg",
    mood: "love",
    duration: "1:58",
  },
];

// Initialize durations immediately so no song ever shows --:--
const durations = {};
songs.forEach((song, i) => {
  durations[i] = song.duration;
});

// Liked Songs storage
const LIKED_KEY = "spotify_clone_liked_v2";
function getLikedIndexes() {
  try {
    const saved = JSON.parse(localStorage.getItem(LIKED_KEY));
    if (Array.isArray(saved)) return saved;
  } catch {}
  return [0, 1, 3, 5, 7, 8]; // default popular liked songs
}
function saveLikedIndexes(indexes) {
  localStorage.setItem(LIKED_KEY, JSON.stringify(indexes));
}

function isSongLiked(index) {
  return getLikedIndexes().includes(index);
}

// Built-in mood and main playlists
const defaultPlaylists = [
  {
    id: "all",
    name: "All songs",
    desc: "Every track in the library",
    color: "#1db954",
    cover: songs[8].coverPath,
    indexes: songs.map((_, i) => i),
    pinned: true,
  },
  {
    id: "liked-songs",
    name: "Liked Songs",
    desc: "Your favorite saved tracks",
    color: "#e85d75",
    cover: songs[3].coverPath,
    indexes: getLikedIndexes(),
    pinned: true,
  },
  {
    id: "love",
    name: "Late night love",
    desc: "Slow, warm, and romantic",
    color: "#e85d75",
    cover: songs[5].coverPath,
    indexes: songs
      .map((s, i) => (s.mood === "love" ? i : -1))
      .filter((i) => i >= 0),
    pinned: true,
  },
  {
    id: "bhakti",
    name: "Bhakti hits",
    desc: "Sorath, Morya, and divine tracks",
    color: "#f5a524",
    cover: songs[0].coverPath,
    indexes: songs
      .map((s, i) => (s.mood === "bhakti" ? i : -1))
      .filter((i) => i >= 0),
    pinned: true,
  },
  {
    id: "friends",
    name: "Yaari",
    desc: "The tracks you play with friends",
    color: "#4c8dff",
    cover: songs[4].coverPath,
    indexes: songs
      .map((s, i) => (s.mood === "friends" ? i : -1))
      .filter((i) => i >= 0),
    pinned: true,
  },
  {
    id: "energy",
    name: "High energy",
    desc: "Turn the volume up",
    color: "#b56bff",
    cover: songs[9].coverPath,
    indexes: songs
      .map((s, i) => (s.mood === "energy" ? i : -1))
      .filter((i) => i >= 0),
    pinned: true,
  },
];

const PLAYLISTS_KEY = "spotify_clone_custom_playlists_v2";
function loadPlaylists() {
  const base = defaultPlaylists.map((p) => {
    if (p.id === "liked-songs") {
      return { ...p, indexes: getLikedIndexes() };
    }
    return { ...p };
  });

  try {
    const custom = JSON.parse(localStorage.getItem(PLAYLISTS_KEY));
    if (Array.isArray(custom)) {
      custom.forEach((cp) => {
        if (cp && cp.id && cp.name && !base.some((b) => b.id === cp.id)) {
          base.push({
            ...cp,
            indexes: Array.isArray(cp.indexes) ? cp.indexes : [],
            pinned: false,
          });
        }
      });
    }
  } catch {}
  return base;
}

function saveCustomPlaylists() {
  const custom = playlists.filter((p) => !p.pinned);
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(custom));
}

let playlists = loadPlaylists();

// Audio element
const audio = new Audio();
audio.volume = 0.8;

let songIndex = 0;
let queue = playlists[0].indexes.slice();
let activePlaylistId = "all";
let shuffleOn = false;
let repeatOn = false;
let history = [];

// DOM References
const songList = document.getElementById("songList");
const albumGrid = document.getElementById("albumGrid");
const sidePlaylists = document.getElementById("sidePlaylists");
const homeView = document.getElementById("homeView");
const libraryView = document.getElementById("libraryView");
const masterPlay = document.getElementById("masterPlay");
const masterSongName = document.getElementById("masterSongName");
const nowCover = document.getElementById("nowCover");
const nowPlaylist = document.getElementById("nowPlaylist");
const likeBtn = document.getElementById("likeBtn");
const progressBar = document.getElementById("myProgressBar");
const currentTimeEl = document.getElementById("currentTime");
const totalDurationEl = document.getElementById("totalDuration");
const searchSong = document.getElementById("searchSong");
const playlistTitle = document.getElementById("playlistTitle");
const playlistMeta = document.getElementById("playlistMeta");
const playlistKicker = document.getElementById("playlistKicker");
const deletePlaylistBtn = document.getElementById("deletePlaylistBtn");
const createPlaylistBtn = document.getElementById("createPlaylistBtn");
const playlistModal = document.getElementById("playlistModal");
const playlistForm = document.getElementById("playlistForm");
const playlistNameInput = document.getElementById("playlistName");
const playlistDescInput = document.getElementById("playlistDesc");
const closePlaylistModalBtn = document.getElementById("closePlaylistModal");
const volumeBar = document.getElementById("volumeBar");
const volumeIcon = document.getElementById("volumeIcon");

// SVGs
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
  if (masterSongName) masterSongName.textContent = song.songName;
  if (nowCover) {
    nowCover.src = song.coverPath;
    nowCover.alt = song.songName;
  }
  if (nowPlaylist) nowPlaylist.textContent = playlist.name;
  if (masterPlay) masterPlay.innerHTML = audio.paused ? playSvg : pauseSvg;
  
  if (likeBtn) {
    const isLiked = isSongLiked(songIndex);
    likeBtn.classList.toggle("liked", isLiked);
    likeBtn.title = isLiked ? "Remove from Liked Songs" : "Save to Liked Songs";
  }

  document.querySelectorAll(".song-row").forEach((row) => {
    row.classList.toggle("active", Number(row.dataset.index) === songIndex);
  });
}

function loadSong(index, autoplay) {
  songIndex = index;
  audio.src = songs[index].filePath;
  paintNowPlaying();
  if (autoplay) {
    audio.play().catch(() => {});
  }
}

function playIndex(index, fromPlaylist) {
  if (fromPlaylist) {
    queue = fromPlaylist.indexes.slice();
    activePlaylistId = fromPlaylist.id;
    openPlaylist(fromPlaylist.id, false);
  }
  if (!queue.includes(index)) {
    queue = [index, ...queue.filter((i) => i !== index)];
  }
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

function toggleLike(index) {
  const currentLiked = getLikedIndexes();
  const pos = currentLiked.indexOf(index);
  if (pos >= 0) {
    currentLiked.splice(pos, 1);
  } else {
    currentLiked.push(index);
  }
  saveLikedIndexes(currentLiked);

  // Sync to liked-songs playlist
  const likedPl = playlists.find((p) => p.id === "liked-songs");
  if (likedPl) {
    likedPl.indexes = currentLiked.slice();
  }

  paintNowPlaying();

  if (activePlaylistId === "liked-songs") {
    openPlaylist("liked-songs", false);
  } else {
    document.querySelectorAll(`[data-like="${index}"]`).forEach((btn) => {
      const liked = isSongLiked(index);
      btn.classList.toggle("liked", liked);
      btn.title = liked ? "Unlike" : "Like";
    });
  }
}

function addSongToCustomPlaylist(playlistId, songIdx) {
  const pl = playlistById(playlistId);
  if (!pl || pl.pinned) return;
  if (!pl.indexes.includes(songIdx)) {
    pl.indexes.push(songIdx);
    saveCustomPlaylists();
    openPlaylist(playlistId, false);
  }
}

function removeSongFromCustomPlaylist(playlistId, songIdx) {
  const pl = playlistById(playlistId);
  if (!pl || pl.pinned) return;
  pl.indexes = pl.indexes.filter((i) => i !== songIdx);
  saveCustomPlaylists();
  openPlaylist(playlistId, false);
}

function renderSongs(indexes) {
  const query = searchSong.value.trim().toLowerCase();
  const visible = indexes.filter((i) =>
    songs[i].songName.toLowerCase().includes(query)
  );

  const currentPl = playlistById(activePlaylistId);
  const isCustom = !currentPl.pinned;

  if (!visible.length) {
    songList.innerHTML = `<div class="empty">No songs match “${searchSong.value.trim()}”.</div>`;
  } else {
    songList.innerHTML = visible
      .map((index, order) => {
        const song = songs[index];
        const isLiked = isSongLiked(index);
        const timeText = durations[index] || song.duration || "2:00";
        return `
          <div class="song-row ${index === songIndex ? "active" : ""}" data-index="${index}">
            <span class="index">${order + 1}</span>
            <span class="song-main" tabindex="0">
              <img src="${song.coverPath}" alt="">
              <span class="title">${song.songName}</span>
            </span>
            <span class="time" data-duration="${index}">${timeText}</span>
            <button class="heart-btn ${isLiked ? "liked" : ""}" data-like="${index}" title="${isLiked ? "Unlike" : "Like"}">
              <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c2.54 0 4.91 1.28 6.5 3.22C16.59 4.28 18.96 3 21.5 3 24.58 3 27 5.42 27 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </button>
          </div>`;
      })
      .join("");
  }

  // If in custom playlist, show list of other songs to add
  if (isCustom && !query) {
    const missing = songs.map((_, i) => i).filter((i) => !currentPl.indexes.includes(i));
    if (missing.length > 0) {
      const addSection = document.createElement("div");
      addSection.innerHTML = `
        <div style="margin-top: 28px; padding: 12px 12px 8px; border-bottom: 1px solid var(--line); color: var(--muted); font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">
          Add songs to this playlist
        </div>
        ${missing.map((index) => {
          const song = songs[index];
          return `
            <div class="song-row" data-index="${index}">
              <span class="index" style="color:var(--green); font-size:16px;">+</span>
              <span class="song-main">
                <img src="${song.coverPath}" alt="">
                <span class="title">${song.songName}</span>
              </span>
              <span class="time">${durations[index] || song.duration}</span>
              <button class="icon-btn add-to-pl-btn" data-add-song="${index}" title="Add to playlist" style="color:var(--green); font-size:18px; font-weight:bold;">
                +
              </button>
            </div>
          `;
        }).join("")}
      `;
      songList.appendChild(addSection);

      addSection.querySelectorAll("[data-add-song]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          addSongToCustomPlaylist(activePlaylistId, Number(btn.dataset.addSong));
        });
      });
    }
  }

  // Row click to play
  songList.querySelectorAll(".song-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".heart-btn") || e.target.closest(".add-to-pl-btn")) return;
      playIndex(Number(row.dataset.index));
    });
  });

  // Heart click to like
  songList.querySelectorAll("[data-like]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleLike(Number(btn.dataset.like));
    });
  });
}

function openPlaylist(id, showLibrary = true) {
  const playlist = playlistById(id);
  activePlaylistId = id;
  queue = playlist.indexes.slice();
  playlistTitle.textContent = playlist.name;
  playlistKicker.textContent = playlist.pinned ? "Playlist" : "Custom Playlist";
  playlistMeta.textContent = `${playlist.indexes.length} songs · ${playlist.desc}`;
  
  if (deletePlaylistBtn) {
    deletePlaylistBtn.classList.toggle("hidden", !!playlist.pinned);
  }

  renderSongs(playlist.indexes);

  document.querySelectorAll(".side-pl").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.id === id);
  });
  if (showLibrary) setView("library");
}

function renderAlbums() {
  const playSvgMini = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>`;
  albumGrid.innerHTML = playlists
    .map(
      (p) => `
        <button class="album" data-id="${p.id}">
            <img src="${p.cover}" alt="">
            <strong>${p.name}</strong>
            <span>${p.desc}</span>
            <span class="mini-play" data-play="${p.id}">${playSvgMini}</span>
        </button>
    `
    )
    .join("");

  albumGrid.querySelectorAll(".album").forEach((card) => {
    card.addEventListener("click", (e) => {
      const playlist = playlistById(card.dataset.id);
      if (e.target.closest(".mini-play")) {
        if (playlist.indexes.length > 0) {
          playIndex(playlist.indexes[0], playlist);
          setView("library");
        }
        return;
      }
      openPlaylist(playlist.id);
    });
  });
}

function renderSidebar() {
  sidePlaylists.innerHTML = playlists
    .map(
      (p) => `
        <button class="side-pl ${p.id === activePlaylistId ? "active" : ""}" data-id="${p.id}">
            <span class="dot" style="background:${p.color}"></span>
            ${p.name}
        </button>
    `
    )
    .join("");

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
      if (Number.isFinite(probe.duration) && probe.duration > 0) {
        durations[index] = formatTime(probe.duration);
        document.querySelectorAll(`[data-duration="${index}"]`).forEach((cell) => {
          cell.textContent = durations[index];
        });
      }
    });
  });
}

// Greeting
const hour = new Date().getHours();
const greetingEl = document.getElementById("greeting");
if (greetingEl) {
  greetingEl.textContent =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

// Navigation
document.querySelectorAll("[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.view === "library") openPlaylist(activePlaylistId);
    else setView("home");
  });
});

const heroPlay = document.getElementById("heroPlay");
if (heroPlay) {
  heroPlay.addEventListener("click", () => {
    const playlist = playlistById("all");
    playIndex(playlist.indexes[0], playlist);
    setView("library");
  });
}

const playlistPlay = document.getElementById("playlistPlay");
if (playlistPlay) {
  playlistPlay.addEventListener("click", () => {
    const playlist = playlistById(activePlaylistId);
    if (!playlist.indexes.length) return;
    const start = playlist.indexes.includes(songIndex)
      ? songIndex
      : playlist.indexes[0];
    if (!audio.paused && playlist.indexes.includes(songIndex)) {
      audio.pause();
      paintNowPlaying();
      return;
    }
    playIndex(start, playlist);
  });
}

// Player controls
if (masterPlay) {
  masterPlay.addEventListener("click", () => {
    if (!audio.src) loadSong(queue[0] || 0, true);
    else if (audio.paused) audio.play();
    else audio.pause();
  });
}

const nextBtn = document.getElementById("next");
if (nextBtn) nextBtn.addEventListener("click", nextSong);

const prevBtn = document.getElementById("previous");
if (prevBtn) prevBtn.addEventListener("click", previousSong);

const shuffleBtn = document.getElementById("shuffleBtn");
if (shuffleBtn) {
  shuffleBtn.addEventListener("click", (e) => {
    shuffleOn = !shuffleOn;
    e.currentTarget.classList.toggle("on", shuffleOn);
  });
}

const repeatBtn = document.getElementById("repeatBtn");
if (repeatBtn) {
  repeatBtn.addEventListener("click", (e) => {
    repeatOn = !repeatOn;
    e.currentTarget.classList.toggle("on", repeatOn);
  });
}

// Player Heart Button
if (likeBtn) {
  likeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleLike(songIndex);
  });
}

audio.addEventListener("play", paintNowPlaying);
audio.addEventListener("pause", paintNowPlaying);
audio.addEventListener("timeupdate", () => {
  if (!Number.isFinite(audio.duration)) return;
  if (progressBar) progressBar.value = (audio.currentTime / audio.duration) * 100;
  if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
  if (totalDurationEl) totalDurationEl.textContent = formatTime(audio.duration);
});
audio.addEventListener("ended", nextSong);

if (progressBar) {
  progressBar.addEventListener("input", () => {
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = (progressBar.value / 100) * audio.duration;
    }
  });
}

// Volume Controls
let lastVolume = 0.8;
if (volumeBar) {
  volumeBar.addEventListener("input", () => {
    audio.volume = volumeBar.value / 100;
    if (volumeIcon) {
      volumeIcon.innerHTML = audio.volume === 0 ? muteSvg : speakerSvg;
    }
  });
}

if (volumeIcon) {
  volumeIcon.addEventListener("click", () => {
    if (audio.volume > 0) {
      lastVolume = audio.volume;
      audio.volume = 0;
      if (volumeBar) volumeBar.value = 0;
      volumeIcon.innerHTML = muteSvg;
    } else {
      audio.volume = lastVolume || 0.8;
      if (volumeBar) volumeBar.value = Math.round(audio.volume * 100);
      volumeIcon.innerHTML = speakerSvg;
    }
  });
}

// Search
if (searchSong) {
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
}

// Keyboard navigation
document.addEventListener("keydown", (e) => {
  const typing = document.activeElement === searchSong || document.activeElement === playlistNameInput || document.activeElement === playlistDescInput;
  if (e.code === "Space" && !typing) {
    e.preventDefault();
    masterPlay?.click();
  } else if (e.code === "ArrowRight" && !typing) {
    e.preventDefault();
    nextSong();
  } else if (e.code === "ArrowLeft" && !typing) {
    e.preventDefault();
    previousSong();
  } else if (e.code === "Escape") {
    closeCreateModal();
  }
});

// Create Playlist Modal Handlers
function openCreateModal() {
  if (playlistNameInput) playlistNameInput.value = "";
  if (playlistDescInput) playlistDescInput.value = "";
  if (playlistModal) playlistModal.classList.remove("hidden");
  setTimeout(() => {
    if (playlistNameInput) playlistNameInput.focus();
  }, 50);
}

function closeCreateModal() {
  if (playlistModal) playlistModal.classList.add("hidden");
}

if (createPlaylistBtn) {
  createPlaylistBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openCreateModal();
  });
}

if (closePlaylistModalBtn) {
  closePlaylistModalBtn.addEventListener("click", closeCreateModal);
}

if (playlistModal) {
  playlistModal.addEventListener("click", (e) => {
    if (e.target === playlistModal) closeCreateModal();
  });
}

if (playlistForm) {
  playlistForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = (playlistNameInput?.value || "").trim();
    if (!name) return;
    const desc = (playlistDescInput?.value || "").trim() || "Created by you";
    const colors = ["#1db954", "#e85d75", "#4c8dff", "#b56bff", "#f5a524", "#00d2d3", "#ff6b6b"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const randomCover = songs[Math.floor(Math.random() * songs.length)].coverPath;

    const newPlaylist = {
      id: `pl-${Date.now()}`,
      name,
      desc,
      color: randomColor,
      cover: randomCover,
      indexes: [],
      pinned: false,
    };

    playlists.push(newPlaylist);
    saveCustomPlaylists();
    renderSidebar();
    renderAlbums();
    closeCreateModal();
    openPlaylist(newPlaylist.id);
  });
}

// Delete Playlist
if (deletePlaylistBtn) {
  deletePlaylistBtn.addEventListener("click", () => {
    const current = playlistById(activePlaylistId);
    if (current.pinned) return;
    if (confirm(`Delete playlist "${current.name}"?`)) {
      playlists = playlists.filter((p) => p.id !== current.id);
      saveCustomPlaylists();
      renderSidebar();
      renderAlbums();
      openPlaylist("all");
    }
  });
}

// Initial Render
renderAlbums();
renderSidebar();
openPlaylist("all", false);
setView("home");
loadSong(0, false);
preloadDurations();
if (volumeBar) volumeBar.value = 80;

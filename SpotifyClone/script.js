console.log("Welcome To Spotify");

let songIndex = 0;
let audioElement = new Audio('');
let masterPlay = document.getElementById("masterPlay");
let myProgressBar = document.getElementById("myProgressBar");
let gif = document.getElementById("gif");
let masterSongName = document.getElementById("masterSongName");
let next = document.getElementById("next");
let previous = document.getElementById("previous");
let songs = [
    
    {
        songName: "Sorath",
        filePath: "songs/Sorath.mp3",
        coverPath: "cover/Sorath.jpg",
    },
    {
        songName: "Dil Meri Na Sune",
        filePath: "songs/Dil Meri Na Sune.mp3",
        coverPath: "cover/Dil Meri Na Sune.jpg",
    },
    {
        songName: "Gair Sa Hua Khud Se Bhi",
        filePath: "songs/Gair Sa Hua Khud Se Bhi.mp3",
        coverPath: "cover/Gair Sa Hua Khud Se Bhi.jpg",
    },
    {
        songName: "Jiya",
        filePath: "songs/Jiya.mp3",
        coverPath: "cover/Jiya.jpg",
    },
    {
        songName: "Kyu Dikhe Muje Tu Sir Hane Mere",
        filePath: "songs/Kyu Dikhe Muje Tu Sir Hane Mere.mp3",
        coverPath: "cover/Kyu Dikhe Muje Tu Sir Hane Mere.jpg",
    },
    {
        songName: "Malang Sajna",
        filePath: "songs/Malang Sajna.mp3",
        coverPath: "cover/Malang Sajna.jpg",
    },
    {
        songName: "Morya Re",
        filePath: "songs/Morya Re.mp3",
        coverPath: "cover/Morya Re.jpg",
    },
    {
        songName: "Raataan Lambiyan",
        filePath: "songs/Raataan Lambiyan.mp3",
        coverPath: "cover/Raataan Lambiyan.jpg",
    },
    {
        songName: "Paisa Hai Toh",
        filePath: "songs/Paisa Hai Toh.mp3",
        coverPath: "cover/Paisa Hai Toh.jpg",
    },
    {
        songName: "Qaafirana",
        filePath: "songs/Qaafirana.mp3",
        coverPath: "cover/Qaafirana.jpg",
    },
    {
        songName: "Neki Ki Raah",
        filePath: "songs/Neki Ki Raah.mp3",
        coverPath: "cover/Neki Ki Raah.jpg",
    },
    {
        songName: "Raghunandan",
        filePath: "songs/Raghunandan.mp3",
        coverPath: "cover/Raghunandan.jpg",
    },
    {
        songName: "Sajni",
        filePath: "songs/Sajni.mp3",
        coverPath: "cover/Sajni.jpg",
    },
    {
        songName: "Tera Yaar Hoon Main",
        filePath: "songs/Tera Yaar Hoon Main.mp3",
        coverPath: "cover/Tera Yaar Hoon Main.jpg",
    },
    {
        songName: "Tere Hawaale",
        filePath: "songs/Tere Hawaale.mp3",
        coverPath: "cover/Tere Hawaale.jpg",
    },
    {
        songName: "Tere Sang Ishq Hua",
        filePath: "songs/Tere Sang Ishq Hua.mp3",
        coverPath: "cover/Tere Sang Ishq Huva.jpg",
    },
    {
        songName: "Tu Hai",
        filePath: "songs/Tu Hai.mp3",
        coverPath: "cover/Tu Hai.jpg",  
    },
];

let durationElements = document.querySelectorAll(".duration");

songs.forEach((song, index) => {

    let tempAudio = new Audio(song.filePath);

    tempAudio.addEventListener("loadedmetadata", () => {

        let min = Math.floor(tempAudio.duration / 60);
        let sec = Math.floor(tempAudio.duration % 60);

        if (sec < 10) {
            sec = "0" + sec;
        }

        durationElements[index].innerText = `${min}:${sec}`;

    });

});

audioElement.src = songs[songIndex].filePath;
masterSongName.innerText = songs[songIndex].songName;  

function formatTime(seconds) {

    if (isNaN(seconds)) return "0:00";

    let min = Math.floor(seconds / 60);
    let sec = Math.floor(seconds % 60);

    if (sec < 10) {
        sec = "0" + sec;
    }

    return `${min}:${sec}`;
}

// Handle Play and Pause

const playIcon = `
<path d="M0 0h24v24H0z" fill="none"/>
<path fill="lightgray"
d="M19.266 13.516a1.917 1.917 0 0 0 0-3.032A35.8 35.8 0 0 0 9.35 5.068l-.653-.232c-1.248-.443-2.567.401-2.736 1.69a42.5 42.5 0 0 0 0 10.948c.17 1.289 1.488 2.133 2.736 1.69l.653-.232a35.8 35.8 0 0 0 9.916-5.416"/>
`;

const pauseIcon = `
<path d="M0 0h24v24H0z" fill="none"/>
<path fill="lightgray"
d="M6 5h4v14H6zm8 0h4v14h-4z"/>
`;

let songPlayIcons = document.querySelectorAll(".songPlayIcon");

function updateSongIcons() {

    songPlayIcons.forEach((icon) => {
        icon.innerHTML = playIcon;
    });

    songPlayIcons[songIndex].innerHTML = pauseIcon;

}

masterPlay.addEventListener("click", () => {

    if (audioElement.paused || audioElement.currentTime <= 0) {

        audioElement.play();
        masterPlay.innerHTML = pauseIcon;
        gif.style.opacity = 1;

    } else {

        audioElement.pause();
        masterPlay.innerHTML = playIcon;
        gif.style.opacity = 0;

    }

});


next.addEventListener("click", () => {

    songIndex++;

    if (songIndex >= songs.length) {
        songIndex = 0;
    }

    audioElement.src = songs[songIndex].filePath;
    masterSongName.innerText = songs[songIndex].songName;
    audioElement.currentTime = 0;

    audioElement.play();
    removeActive();
    updateSongIcons();
    songItem[songIndex].classList.add("active");

    masterPlay.innerHTML = pauseIcon;
    gif.style.opacity = 1;

});

previous.addEventListener("click", () => {

    songIndex--;

    if (songIndex < 0) {
        songIndex = songs.length - 1;
    }

    audioElement.src = songs[songIndex].filePath;
    masterSongName.innerText = songs[songIndex].songName;
    audioElement.currentTime = 0;

    audioElement.play();
    removeActive();
    updateSongIcons();
    songItem[songIndex].classList.add("active");

    masterPlay.innerHTML = pauseIcon;
    gif.style.opacity = 1;

});


// Update Progress Bar and TimeUpdate 
audioElement.addEventListener("timeupdate", () => {
    let progress = 0;

    if (!isNaN(audioElement.duration)) {
        progress = parseInt((audioElement.currentTime / audioElement.duration) * 100);
    }

    myProgressBar.value = progress;

    document.getElementById("currentTime").innerText =
        formatTime(audioElement.currentTime);

    document.getElementById("totalDuration").innerText =
        formatTime(audioElement.duration);

});

// Seek Song
myProgressBar.addEventListener("input", () => {

    audioElement.currentTime = (myProgressBar.value * audioElement.duration) / 100;

});

// Song End
audioElement.addEventListener("ended", () => {

    songIndex++;

    if (songIndex >= songs.length) {
        songIndex = 0;
    }

    audioElement.src = songs[songIndex].filePath;
    masterSongName.innerText = songs[songIndex].songName;
    audioElement.currentTime = 0;

    audioElement.play();
    removeActive(); 
    updateSongIcons();
    songItem[songIndex].classList.add("active");

    masterPlay.innerHTML = pauseIcon;
    gif.style.opacity = 1;

});

document.addEventListener("keydown", (e) => {

    if (e.code === "Space") {

        e.preventDefault();

        if (audioElement.paused) {
            audioElement.play();
            removeActive();
            updateSongIcons();
            masterPlay.innerHTML = pauseIcon;
            gif.style.opacity = 1;
        } else {
            audioElement.pause();
            masterPlay.innerHTML = playIcon;
            gif.style.opacity = 0;
        }

    }
    
    else if (e.code === "ArrowRight") {

        e.preventDefault();
    
        songIndex++;
    
        if (songIndex >= songs.length) {
            songIndex = 0;
        }
    
        audioElement.src = songs[songIndex].filePath;
        masterSongName.innerText = songs[songIndex].songName;
        audioElement.currentTime = 0;
        audioElement.play();
    
        removeActive();
        updateSongIcons();
        songItem[songIndex].classList.add("active");
    
        masterPlay.innerHTML = pauseIcon;
        gif.style.opacity = 1;
    }
    
    else if (e.code === "ArrowLeft") {

        e.preventDefault();
    
        songIndex--;
    
        if (songIndex < 0) {
            songIndex = songs.length - 1;
        }
    
        audioElement.src = songs[songIndex].filePath;
        masterSongName.innerText = songs[songIndex].songName;
        audioElement.currentTime = 0;
        audioElement.play();
    
        removeActive();
        updateSongIcons();
        songItem[songIndex].classList.add("active");
    
        masterPlay.innerHTML = pauseIcon;
        gif.style.opacity = 1;
    }
    
    });
    
    let songItem = document.querySelectorAll(".songItem");

function removeActive(){

    songItem.forEach((item)=>{
        item.classList.remove("active");
    });

}

songItem.forEach((element) => {

    element.addEventListener("click", () => {

        songIndex = parseInt(element.id);
        removeActive();

        element.classList.add("active");

        audioElement.src = songs[songIndex].filePath;
        masterSongName.innerText = songs[songIndex].songName;
        audioElement.currentTime = 0;
        audioElement.play();
        updateSongIcons();

        masterPlay.innerHTML = pauseIcon;
        gif.style.opacity = 1;

    });

});

let searchSong = document.getElementById("searchSong");
let songItems = document.querySelectorAll(".songItem");

searchSong.addEventListener("keyup", ()=>{

    let value = searchSong.value.toLowerCase();

    songItems.forEach((item)=>{

        let text = item.innerText.toLowerCase();

        if(text.includes(value)){
            item.style.display = "flex";
        }else{
            item.style.display = "none";
        }

    });

});

let volumeBar = document.getElementById("volumeBar");
let volumeIcon = document.getElementById("volumeIcon");

volumeBar.addEventListener("input", () => {

    audioElement.volume = volumeBar.value / 100;

});

const speakerIcon = `
<path d="M0 0h24v24H0z" fill="none"/>
<path fill="white"
d="M14 3.23v17.54a1 1 0 0 1-1.64.77L7.82 18H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3.82l4.54-3.54A1 1 0 0 1 14 3.23"/>
<path fill="white"
d="M16.5 8.5a1 1 0 0 1 1.41 0A5 5 0 0 1 19.5 12a5 5 0 0 1-1.59 3.5a1 1 0 1 1-1.41-1.41A3 3 0 0 0 17.5 12a3 3 0 0 0-1-2.09a1 1 0 0 1 0-1.41"/>
`;

const muteIcon = `
<path d="M0 0h24v24H0z" fill="none"/>
<path fill="white"
d="M14 3.23v17.54a1 1 0 0 1-1.64.77L7.82 18H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3.82l4.54-3.54A1 1 0 0 1 14 3.23"/>
<path fill="white"
d="M16 8l6 6m0-6l-6 6" stroke="white" stroke-width="2" stroke-linecap="round"/>
`;

volumeIcon.addEventListener("click", () => {

    if (audioElement.volume > 0) {

        audioElement.volume = 0;
        volumeBar.value = 0;

        volumeIcon.innerHTML = muteIcon;

    } else {

        audioElement.volume = 1;
        volumeBar.value = 100;

        volumeIcon.innerHTML = speakerIcon;

    }

});

document.addEventListener("keydown", (e) => {
    console.log(e.code);
});











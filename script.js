const music=
document.getElementById("music")

const button=
document.getElementById("play")

const progress=
document.getElementById("progress")

button.onclick=()=>{

music.play()

button.innerText=
"♫ playing"

}

setInterval(()=>{

if(music.duration){

progress.style.width=
(music.currentTime/
music.duration)*100+"%"

}

},100)
const music=
document.getElementById("music")

const enter=
document.getElementById("enter")

const fill=
document.getElementById("fill")

const card=
document.querySelector(".card")

enter.onclick=()=>{

music.play()

enter.innerHTML=
"♫ PLAYING"

}

setInterval(()=>{

if(music.duration){

fill.style.width=
music.currentTime/
music.duration*
100+"%"

}

},100)

document.addEventListener(
"mousemove",
e=>{

document.querySelector(
".cursor"
).style.left=
e.clientX+"px"

document.querySelector(
".cursor"
).style.top=
e.clientY+"px"

let x=
(
e.clientX/
window.innerWidth-.5
)*15

let y=
(
e.clientY/
window.innerHeight-.5
)*15

card.style.transform=
`translate(-50%,-50%)
rotateY(${x}deg)
rotateX(${-y}deg)`

}
)

document.addEventListener(
"keydown",
e=>{

if(
e.key==="m"
){

music.muted=
!music.muted

}

}
)

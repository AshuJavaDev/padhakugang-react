import {useState, useEffect} from 'react'

function StudyRoom(props) {
  
  useEffect( () =>  {
    console.log(props.name + " loaded!")
  }, [])
  
  return (
    <div>
      <h2>{props.name}</h2>
      <p>{props.count} students studying now</p>
      {props.count>=30 ? <p>Room Full</p> : <button onClick = {props.onJoin}>Join Room</button>}
    </div>
  )
}



function App()  {
 const [rooms, setRooms] = useState([
  {name: "UPSC Room", count: 25},
  {name: "NEET Room", count: 25},
  {name: "JEE Room", count: 25},
  {name: "CA Room", count: 25}
 ])

 const[nickname, setNickname] = useState("")
 const[isSubmitted, setIsSubmitted] = useState(false)
 const[exam, setExam] = useState("") 
 const[topic, setTopic] = useState("")


function increaseCount(index)  {
  const newRooms = [...rooms]
  newRooms[index].count = newRooms[index].count + 1
  setRooms(newRooms)
}

return (
  <div>
    <h1>PadhakuGang</h1>
    <p>Total students: {rooms.reduce((sum,room) => sum + room.count, 0)}</p>
    {rooms.map((room,index) => (
      <StudyRoom
        key = {room.name}
        name ={room.name}
        count = {room.count}
        onJoin = {() => increaseCount(index)}
        />      
    ))}

    <input type = "text"      
    placeholder = "Enter your nickname"    
    value = {nickname} 
    onChange = {(e) => setNickname(e.target.value)} 
    />

    {isSubmitted && <p>Your nickname: {nickname}</p> }



<input type = "text"
 placeholder = "Preparing for? (UPSC, NEET....)"
 value = {exam}
 onChange = {(e) => setExam(e.target.value)}
 />
 {isSubmitted && <p>Preparing for: {exam}</p>}

  <input type = "text"
  placeholder = "Today's topic?"
  value = {topic}
  onChange = {(e) => setTopic(e.target.value)}
  />
  {isSubmitted && <p>Today's topic: {topic}</p>}

  <button onClick = {() => setIsSubmitted(true)}>Join</button>
{isSubmitted ? <p>Welcome, {nickname} | {exam} |  {topic}</p> : null}


  </div>
  )
}

export default App


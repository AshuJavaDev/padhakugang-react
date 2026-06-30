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
  const rooms = ["UPSC Room", "NEET Room", "JEE Room", "CA Room"]
  const[counts,setCounts] = useState([25,25,25,25])

function increaseCount(index)  {
  const newCounts = [...counts]
  newCounts[index] = newCounts[index]+1
  setCounts(newCounts)
}

return (
  <div>
    <h1>PadhakuGang</h1>
    <p>Total students: {counts.reduce((a,b) => a+b, 0)}</p>
    {rooms.map((room,index) => (
      <StudyRoom
        key = {room}
        name ={room}
        count = {counts[index]}
        onJoin = {() => increaseCount(index)}
        />      
    ))}
  </div>
  )
}

export default App


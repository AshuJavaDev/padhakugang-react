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
  </div>
  )
}

export default App


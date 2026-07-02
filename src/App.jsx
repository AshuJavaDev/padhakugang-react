import {Routes, Route, Link} from 'react-router-dom'
import Home from './Home.jsx'
import Notes from './Notes.jsx'
import { UserContext } from './UserContext.jsx'
import Nav from './Nav.jsx'

function App() {

  return (
    <UserContext.Provider value = {{ nickname : "guest"}}> 
    <div>
      <Nav />

      <Routes>
        <Route path = "/" element = {<Home />} />
        <Route path = "/notes" element = {<Notes />} />
        </Routes>
    </div>
    </UserContext.Provider>
  )
}

export default App

import {Routes, Route, Link} from 'react-router-dom'
import Home from './Home.jsx'
import Notes from './Notes.jsx'
import { UserContext } from './UserContext.jsx'
import Nav from './Nav.jsx'
import StudyRoom from './StudyRoom.jsx'
import TributeSection from './TributeSection.jsx'
import CheckCode from './CheckCode.jsx'


function App() {

  return (
    <UserContext.Provider value = {{ nickname : "guest"}}> 
    <div>
      <Nav />

      <Routes>
        <Route path = "/" element = {<Home />} />
        <Route path = "/notes" element = {<Notes />} />
        <Route path = "/studyroom" element = {<StudyRoom />} />
        <Route path = "/tribute" element = {<TributeSection />} />
        <Route path = "/check" element = {<CheckCode />} />
      </Routes>
    </div>
    </UserContext.Provider>
  )
}

export default App

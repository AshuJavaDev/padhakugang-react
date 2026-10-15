import {Routes, Route, Link} from 'react-router-dom'
import Home from './Home.jsx'
import Notes from './Notes.jsx'
import { UserContext } from './UserContext.jsx'
import Nav from './Nav.jsx'
import StudyRoom from './StudyRoom.jsx'
import TributeSection from './TributeSection.jsx'
import CheckCode from './CheckCode.jsx'
import AdminLogin from './AdminLogin.jsx'
import AdminDashboard from './AdminDashboard.jsx'

 
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
        <Route path = "/admin/login" element = {<AdminLogin />} />
        <Route path = "/admin" element = {<AdminDashboard />} />
      </Routes>
    </div>
    </UserContext.Provider>
  )
}

export default App

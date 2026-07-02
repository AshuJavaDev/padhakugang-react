import {Routes, Route, Link} from 'react-router-dom'
import Home from './Home.jsx'
import Notes from './Notes.jsx'

function App() {
  return (
    <div>
      <nav>
        <Link to="/">Home</Link>  |
        <Link to ="/notes">Notes</Link>
      </nav>

      <Routes>
        <Route path = "/" element = {<Home />} />
        <Route path = "/notes" element = {<Notes />} />
        </Routes>
    </div>
  )
}

export default App

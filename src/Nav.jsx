import {Link} from 'react-router-dom'
import {useContext} from 'react'
import {UserContext} from './UserContext.jsx'

function Nav() {
    const {nickname} = useContext(UserContext);
    return (
        <nav style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", padding: "8px 0" }}>
            <Link to="/">Home</Link>
            <Link to="/studyroom">Study Room</Link>
            <Link to="/notes">Notes</Link>
            <Link to="/tribute">Tribute</Link>
            <Link to="/check">🔑 Check your code</Link>
            <span>Logged in as: {nickname}</span>
        </nav>
    )
}

export default Nav
import {Link} from 'react-router-dom'
import {useContext} from 'react'
import {UserContext} from './UserContext.jsx'

function Nav() {
    const {nickname} = useContext(UserContext);
    return (
        <nav>
            <Link to ="/">Home</Link>
            <Link to="/notes">Notes</Link>
            <span>-Logged in as: {nickname} </span>
        </nav> 
    )
}

export default Nav
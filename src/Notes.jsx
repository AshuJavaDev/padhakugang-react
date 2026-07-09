
import { useState, useEffect } from 'react'

function Notes() {
    const [notes, setNotes] = useState([]);

    useEffect(() => {
        fetch('http://localhost:8080/notes')
        .then(response => response.json())
        .then(data => setNotes(data))
        .catch(error => console.error('Error fetching notes: ', error));
    }, []);

    return (
        <div>
            <h2>Notes </h2>
            <ul>
                {notes.map(note => (
                    <li key ={note.id}>{note.title} - {note.examType}</li>
                ))}
            </ul>
        </div>
    )
}


export default Notes
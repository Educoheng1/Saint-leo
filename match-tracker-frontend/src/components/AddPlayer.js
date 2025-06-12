import { useState } from "react";

function AddPlayer({ onPlayerAdded }) {
  const [name, setName] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch("http://127.0.0.1:8000/players", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (res.ok) {
      setName("");
      onPlayerAdded();  // Refresh player list
    } else {
      alert("Failed to add player");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Add New Player</h3>
      <input
        type="text"
        placeholder="Player name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <button type="submit">Add Player</button>
    </form>
  );
}

export default AddPlayer;

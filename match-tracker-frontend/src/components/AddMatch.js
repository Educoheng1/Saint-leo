import { useEffect, useState } from "react";
import MatchList from "./Schedule";


export default function AddMatch({ onAdd }) {
    const handleSubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {
        date: form.date.value,
        opponent: form.opponent.value,
        location: form.location.value,
      };
      await fetch("http://127.0.0.1:8000/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      form.reset();
      onAdd();
    };
  
    return (
      <form onSubmit={handleSubmit}>
        <h2>Add Match</h2>
        <input name="date" type="date" required />
        <input name="opponent" placeholder="Opponent" required />
        <input name="location" placeholder="Location" required />
        <button type="submit">Add</button>
      </form>
    );
  }

  
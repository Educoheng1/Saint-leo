const API_BASE =
  process.env.NODE_ENV === "production"
    ? "https://saint-leo-live-score.onrender.com"
    : "http://127.0.0.1:8000";

export default API_BASE;

import React from "react";

function Footer() {
  return (
    <footer className="app-footer">
      <span className="footer-dot" />
      <span>
        Made by <strong>Eduardo Cohen</strong> · © {new Date().getFullYear()}
      </span>
    </footer>
  );
}

export default Footer;

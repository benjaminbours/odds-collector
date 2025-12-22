import "@/styles/footer.css";
import packageJson from "../../package.json";

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__content">
        <p className="footer__text">
          Built with passion for football and data by{" "}
          <a
            href="https://benjaminbours.github.io/portfolio"
            className="footer__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Benjamin Bours
          </a>
        </p>
        <div className="footer__links">
          <a
            href="https://github.com/benjaminbours"
            className="footer__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <a
            href="https://discord.gg/wCkkH8XKwD"
            className="footer__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Discord
          </a>
          <a
            href="https://ko-fi.com/oddslab"
            className="footer__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Support on Ko-fi
          </a>
          <a
            href="https://buymeacoffee.com/oddslab"
            className="footer__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Buy Me a Coffee
          </a>
          <a
            href="https://x.com/oddslabgg"
            className="footer__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Twitter
          </a>
        </div>
        <p className="footer__data-source">
          Odds data provided by{" "}
          <a
            href="https://the-odds-api.com"
            className="footer__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            The Odds API
          </a>
        </p>
        <p className="footer__copyright">
          © 2025 OddsLab. All rights reserved. | v{packageJson.version}
        </p>
      </div>
    </footer>
  );
}

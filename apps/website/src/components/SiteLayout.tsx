import { Link } from "react-router-dom";
import "./SiteLayout.css";

interface SiteLayoutProps {
  children: React.ReactNode;
}

export function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <div className="site">
      <header className="site__header">
        <Link to="/" className="site__logo">
          RelayBooking SOLO
        </Link>
        <nav className="site__nav">
          <Link to="/solo">Account</Link>
        </nav>
      </header>
      <main className="site__main">{children}</main>
    </div>
  );
}

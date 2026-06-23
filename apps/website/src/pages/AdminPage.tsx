import { Card } from "../components/ui/Card";
import "../components/ui/Card.css";
import { SiteLayout } from "../components/SiteLayout";

export function AdminPage() {
  return (
    <SiteLayout>
      <Card title="Admin dashboard">
        <p>Product Admin control room — customer list and environment detail (Track 1 A1).</p>
      </Card>
    </SiteLayout>
  );
}

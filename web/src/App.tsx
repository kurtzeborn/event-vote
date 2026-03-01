import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import CreateEventPage from './pages/CreateEventPage.tsx';
import ManageEventPage from './pages/ManageEventPage.tsx';
import VoterPage from './pages/VoterPage.tsx';
import ResultsPage from './pages/ResultsPage.tsx';
import NotFoundPage from './pages/NotFoundPage.tsx';
import { MockAuthPage, MockLogoutPage } from './pages/MockAuthPage.tsx';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Routes>
        {/* Mock auth routes for local development */}
        <Route path="/.auth/login/aad" element={<MockAuthPage />} />
        <Route path="/.auth/logout" element={<MockLogoutPage />} />

        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/join/:eventId" element={<VoterPage />} />
        <Route path="/results/:eventId" element={<ResultsPage />} />

        {/* Votekeeper routes */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/create" element={<CreateEventPage />} />
        <Route path="/manage/:eventId" element={<ManageEventPage />} />

        {/* Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}

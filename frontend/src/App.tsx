import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Sidebar, ViewTab } from './components/Sidebar';
import { LoginView } from './components/views/LoginView';
import { DashboardView } from './components/views/DashboardView';
import { CasesView } from './components/views/CasesView';
import { CaseDetailView } from './components/views/CaseDetailView';
import { DocumentDetailView } from './components/views/DocumentDetailView';
import { SearchFilterView } from './components/views/SearchFilterView';
import { ApprovalsView } from './components/views/ApprovalsView';
import { IncidentsView } from './components/views/IncidentsView';
import { AuditTrailView } from './components/views/AuditTrailView';

const MainLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<ViewTab>('dashboard');

  // Sub-view drilldown state
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans text-xs">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span>Verifying Authentic Session Credentials...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const handleTabChange = (tab: ViewTab) => {
    setCurrentTab(tab);
    setSelectedCaseId(null);
    setSelectedDocId(null);
  };

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setSelectedDocId(null);
  };

  const handleSelectDocument = (docId: string) => {
    setSelectedDocId(docId);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950 font-sans">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          onTabChange={handleTabChange}
        />

        <main className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto">
          {/* Sub-view drilldowns priority over main tab */}
          {selectedDocId ? (
            <DocumentDetailView
              documentId={selectedDocId}
              onBack={() => setSelectedDocId(null)}
            />
          ) : selectedCaseId ? (
            <CaseDetailView
              caseId={selectedCaseId}
              onBack={() => setSelectedCaseId(null)}
              onSelectDocument={handleSelectDocument}
            />
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <DashboardView onNavigate={handleTabChange} />
              )}
              {currentTab === 'cases' && (
                <CasesView onSelectCase={handleSelectCase} />
              )}
              {currentTab === 'search' && (
                <SearchFilterView onSelectDocument={handleSelectDocument} />
              )}
              {currentTab === 'approvals' && (
                <ApprovalsView onSelectDocument={handleSelectDocument} />
              )}
              {currentTab === 'incidents' && <IncidentsView />}
              {currentTab === 'audit' && <AuditTrailView />}
            </>
          )}
        </main>
      </div>

      <footer className="border-t border-slate-800/80 bg-slate-950 py-3 px-6 text-center text-xs text-slate-500">
        NyayaVault &copy; 2026 — Secure Digital Document Management System &bull; Tagline: "Secure Evidence. Trusted Justice."
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}

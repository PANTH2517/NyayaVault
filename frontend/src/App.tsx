import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Sidebar, ViewTab } from './components/Sidebar';
import { LoginView } from './components/views/LoginView';
import { ResetPasswordView } from './components/views/ResetPasswordView';
import { DashboardView } from './components/views/DashboardView';
import { CasesView } from './components/views/CasesView';
import { CaseDetailView } from './components/views/CaseDetailView';
import { DocumentDetailView } from './components/views/DocumentDetailView';
import { SearchFilterView } from './components/views/SearchFilterView';
import { ApprovalsView } from './components/views/ApprovalsView';
import { IncidentsView } from './components/views/IncidentsView';
import { AuditTrailView } from './components/views/AuditTrailView';
import { AboutView } from './components/views/AboutView';
import { UserManagementView } from './components/views/UserManagementView';
import { SecurityControlsView } from './components/views/SecurityControlsView';
import { BlockchainObservabilityView } from './components/views/BlockchainObservabilityView';
import { SharedEvidenceRedemptionView } from './components/views/SharedEvidenceRedemptionView';
import { MotionPage } from './components/motion/MotionPage';
import { CinematicBackground } from './components/motion/CinematicBackground';

const MainLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<ViewTab>('dashboard');
  const [isResetRoute, setIsResetRoute] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sub-view drilldown state
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  useEffect(() => {
    if (window.location.pathname === '/reset-password') {
      setIsResetRoute(true);
    }

    const checkHashToken = () => {
      if (window.location.hash.includes('token=')) {
        const match = window.location.hash.match(/token=([a-fA-F0-9]{64})/);
        if (match && match[1]) {
          setShareToken(match[1]);
        }
      }
    };

    checkHashToken();
    window.addEventListener('hashchange', checkHashToken);
    return () => window.removeEventListener('hashchange', checkHashToken);
  }, []);

  if (isResetRoute) {
    return (
      <ResetPasswordView
        onReturnToLogin={() => {
          window.history.pushState({}, '', '/');
          setIsResetRoute(false);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060911] text-slate-100 flex items-center justify-center font-sans text-xs relative">
        <CinematicBackground />
        <div className="flex items-center gap-3 z-10 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl shadow-2xl">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-slate-200">Verifying Security Session Credentials...</span>
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
    setIsMobileMenuOpen(false);
  };

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setSelectedDocId(null);
    setIsMobileMenuOpen(false);
  };

  const handleSelectDocument = (docId: string) => {
    setSelectedDocId(docId);
    setIsMobileMenuOpen(false);
  };

  const renderContent = () => {
    if (selectedDocId) {
      return (
        <DocumentDetailView
          documentId={selectedDocId}
          onBack={() => setSelectedDocId(null)}
        />
      );
    }

    if (selectedCaseId) {
      return (
        <CaseDetailView
          caseId={selectedCaseId}
          onBack={() => setSelectedCaseId(null)}
          onSelectDocument={handleSelectDocument}
        />
      );
    }

    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardView
            onNavigate={(tab, param) => {
              if (param) {
                if (tab === 'cases') setSelectedCaseId(param);
                else if (tab === 'search') setSelectedDocId(param);
              } else {
                handleTabChange(tab);
              }
            }}
          />
        );
      case 'cases':
        return <CasesView onSelectCase={handleSelectCase} />;
      case 'search':
        return <SearchFilterView onSelectDocument={handleSelectDocument} />;
      case 'approvals':
        return <ApprovalsView onSelectDocument={handleSelectDocument} />;
      case 'incidents':
        return <IncidentsView />;
      case 'audit':
        return <AuditTrailView />;
      case 'about':
        return <AboutView />;
      case 'users':
        return <UserManagementView />;
      case 'security-controls':
        return <SecurityControlsView />;
      case 'blockchain-network':
        return <BlockchainObservabilityView />;
      default:
        return (
          <DashboardView
            onNavigate={(tab) => handleTabChange(tab)}
          />
        );
    }
  };

  const viewKeys = selectedDocId
    ? `doc-${selectedDocId}`
    : selectedCaseId
    ? `case-${selectedCaseId}`
    : currentTab;

  return (
    <div className="min-h-screen bg-[#060911] text-slate-100 flex flex-col font-sans relative">
      <CinematicBackground />

      <Header
        onSelectCase={handleSelectCase}
        onSelectDocument={handleSelectDocument}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="flex-1 flex overflow-hidden z-10 relative">
        {/* Desktop Permanent Sidebar */}
        <div className="hidden md:block w-64 shrink-0">
          <Sidebar currentTab={currentTab} onTabChange={handleTabChange} />
        </div>

        {/* Mobile Slide-Over Navigation Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <div className="md:hidden fixed inset-0 z-50 flex">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative w-72 max-w-[80vw] h-full z-10"
              >
                <Sidebar
                  currentTab={currentTab}
                  onTabChange={handleTabChange}
                  onCloseMobile={() => setIsMobileMenuOpen(false)}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scrollbar-thin">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <MotionPage key={viewKeys}>{renderContent()}</MotionPage>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {shareToken && (
        <SharedEvidenceRedemptionView
          initialToken={shareToken}
          onClose={() => setShareToken(null)}
        />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
};

export default App;

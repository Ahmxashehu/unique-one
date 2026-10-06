/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import AdminLayout from "./layouts/AdminLayout";
import PublicLayout from "./layouts/PublicLayout";
import { AuthProvider } from "./contexts/AuthContext";
import AuthGuard from "./components/auth/AuthGuard";
import RoleGuard from "./components/auth/RoleGuard";
import InstallPrompt from "./components/InstallPrompt";
import GlobalLanguageLayer from "./components/GlobalLanguageLayer";
import OfflineIndicator from "./components/OfflineIndicator";
import { OfflineQueueProvider } from "./contexts/OfflineQueueContext";
import SyncOverlay from "./components/SyncOverlay";
import U1Loader from "./components/U1Loader";
import DashboardPage from "./pages/DashboardPage";
import WorkspaceDashboardPage from "./pages/WorkspaceDashboardPage";
import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";

const ConferencePage = lazy(() => import("./pages/ConferencePage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const DiscoverPage = lazy(() => import("./pages/public/DiscoverPage"));
const SearchPage = lazy(() => import("./pages/public/SearchPage"));
const CategoriesPage = lazy(() => import("./pages/public/CategoriesPage"));
const RestaurantPage = lazy(() => import("./pages/public/RestaurantPage"));
const HotelsEventsPage = lazy(() => import("./pages/public/HotelsEventsPage"));
const NearMePage = lazy(() => import("./pages/public/NearMePage"));
const AboutPage = lazy(() => import("./pages/public/AboutPage"));
const SupportPage = lazy(() => import("./pages/public/SupportPage"));
const FlightsPage = lazy(() => import("./pages/public/FlightsPage"));
const LoginPage = lazy(() => import("./pages/public/LoginPage"));
const RegisterPage = lazy(() => import("./pages/public/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/public/ForgotPasswordPage"));

const PayPage = lazy(() => import("./pages/PayPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const BookingsPage = lazy(() => import("./pages/BookingsPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const PaymentRequestsPage = lazy(() => import("./pages/PaymentRequestsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const MessagesPage = lazy(() => import("./pages/messages/MessagesPage"));
const WishlistPage = lazy(() => import("./pages/WishlistPage"));
const UserRequestsPage = lazy(() => import("./pages/UserRequestsPage"));
const LanguagePage = lazy(() => import("./pages/LanguagePage"));
const SecurityPage = lazy(() => import("./pages/SecurityPage"));
const BusinessRegisterPage = lazy(() => import("./pages/business/BusinessRegisterPage"));
const BusinessProfilePage = lazy(() => import("./pages/business/BusinessProfilePage"));
const SellerDashboardPage = lazy(() => import("./pages/business/SellerDashboardPage"));
const BusinessSettingsPage = lazy(() => import("./pages/business/BusinessSettingsPage"));
const StaffPage = lazy(() => import("./pages/business/StaffPage"));
const BranchesPage = lazy(() => import("./pages/business/BranchesPage"));
const CatalogPage = lazy(() => import("./pages/business/CatalogPage"));
const InventoryPage = lazy(() => import("./pages/business/InventoryPage"));
const BusinessCustomersPage = lazy(() => import("./pages/business/BusinessCustomersPage"));
const SuppliersPage = lazy(() => import("./pages/business/SuppliersPage"));
const BusinessOrdersPage = lazy(() => import("./pages/business/BusinessOrdersPage"));
const FinancePage = lazy(() => import("./pages/business/FinancePage"));
const ReportsPage = lazy(() => import("./pages/business/ReportsPage"));
const ActivityPage = lazy(() => import("./pages/business/ActivityPage"));
const OrganizationMembersPage = lazy(() => import("./pages/business/OrganizationMembersPage"));
const AddProductPage = lazy(() => import("./pages/business/AddProductPage"));
const AddServicePage = lazy(() => import("./pages/business/AddServicePage"));
const AdminLoginPage = lazy(() => import("./pages/admin/AdminLoginPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminBusinessesPage = lazy(() => import("./pages/admin/AdminBusinessesPage"));
const AdminProductsPage = lazy(() => import("./pages/admin/AdminProductsPage"));
const AdminRequestsPage = lazy(() => import("./pages/admin/AdminRequestsPage"));
const AdminReportsPage = lazy(() => import("./pages/admin/AdminReportsPage"));
const AdminVerificationPage = lazy(() => import("./pages/admin/AdminVerificationPage"));
const AdminTransactionsPage = lazy(() => import("./pages/admin/AdminTransactionsPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminControlTowerPage = lazy(() => import("./pages/admin/AdminControlTowerPage"));
const SuperAdminDashboardPage = lazy(() => import("./pages/admin/SuperAdminDashboardPage"));
const StoreDiscoverPage = lazy(() => import("./pages/store/StoreDiscoverPage"));
const StorePage = lazy(() => import("./pages/StorePage"));
const StoreCategoriesPage = lazy(() => import("./pages/store/StoreCategoriesPage"));
const StoreProductPage = lazy(() => import("./pages/store/StoreProductPage"));
const StoreSellerProfilePage = lazy(() => import("./pages/store/StoreSellerProfilePage"));
const StoreSearchPage = lazy(() => import("./pages/store/StoreSearchPage"));
const StoreWishlistPage = lazy(() => import("./pages/store/StoreWishlistPage"));
const StoreCartPage = lazy(() => import("./pages/store/StoreCartPage"));
const StoreOrdersPage = lazy(() => import("./pages/store/StoreOrdersPage"));
const StoreProductRequestPage = lazy(() => import("./pages/store/StoreProductRequestPage"));
const StoreQuoteRequestPage = lazy(() => import("./pages/store/StoreQuoteRequestPage"));
const StoreCommandCentrePage = lazy(() => import("./pages/store/StoreCommandCentrePage"));
const CreatePaymentRequestPage = lazy(() => import("./pages/pay/CreatePaymentRequestPage"));
const CreateInvoicePage = lazy(() => import("./pages/pay/CreateInvoicePage"));
const ReceiptPage = lazy(() => import("./pages/pay/ReceiptPage"));
const SchoolPaymentDashboard = lazy(() => import("./pages/pay/SchoolPaymentDashboard"));
const TransactionHistoryPage = lazy(() => import("./pages/pay/TransactionHistoryPage"));
const SendMoneyPage = lazy(() => import("./pages/pay/SendMoneyPage"));
const ReceiveMoneyPage = lazy(() => import("./pages/pay/ReceiveMoneyPage"));
const BeneficiariesPage = lazy(() => import("./pages/pay/BeneficiariesPage"));
const PaySettingsPage = lazy(() => import("./pages/pay/PaySettingsPage"));
const PaySecurityPage = lazy(() => import("./pages/pay/PaySecurityPage"));
const UniqueAiPage = lazy(() => import("./pages/UniqueAiPage"));
const UniqueAiSubscriptionPage = lazy(() => import("./pages/UniqueAiSubscriptionPage"));
const JobsPage = lazy(() => import("./pages/JobsPage"));
const ContributionNetworkPage = lazy(() => import("./pages/ContributionNetworkPage"));
const EducationPage = lazy(() => import("./pages/EducationPage"));
const EducationHubPage = lazy(() => import("./pages/EducationHubPage"));
const TravelPage = lazy(() => import("./pages/TravelPage"));
const HealthWellnessPage = lazy(() => import("./pages/HealthWellnessPage"));
const CycleAjoPage = lazy(() => import("./pages/pay/CycleAjoPage"));
const VerificationCenterPage = lazy(() => import("./pages/pay/VerificationCenterPage"));
const MasterVisionPage = lazy(() => import("./pages/MasterVisionPage"));
const UniqueMediaPage = lazy(() => import("./pages/UniqueMediaPage"));
const UniqueSharePage = lazy(() => import("./pages/UniqueSharePage"));
const ObservationModePage = lazy(() => import("./pages/ObservationModePage"));

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  componentDidCatch() {
    try {
      const key = "unique-platform-runtime-recovery-v1";
      if (sessionStorage.getItem(key) !== "done") {
        sessionStorage.setItem(key, "done");
        window.location.reload();
        return;
      }
    } catch {
      // Continue to the visible fallback if storage is unavailable.
    }
    this.setState({ hasError: true });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center">
          <div className="max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="text-lg font-black text-slate-900">UniquePlatform</div>
            <p className="mt-2 text-sm text-slate-500">The app encountered a temporary loading problem.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white"
            >
              Reload UniquePlatform
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [u1Booting, setU1Booting] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setU1Booting(false), 350);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AuthProvider>
      <OfflineQueueProvider>
        <BrowserRouter>
          <div className="flex flex-col h-screen overflow-hidden w-full max-w-[100vw]">
            <GlobalLanguageLayer />
            <OfflineIndicator />
            <InstallPrompt />
            <SyncOverlay />
            <U1Loader visible={u1Booting} />
            <div className="flex-1 relative overflow-hidden">
              <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center bg-slate-50 text-sm font-semibold text-emerald-700" role="status">Loading Unique One…</div>}>
                <Routes>
                  <Route element={<PublicLayout />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/test/observe" element={<ObservationModePage />} />
                    <Route path="/discover" element={<DiscoverPage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/categories" element={<CategoriesPage />} />
                    <Route path="/restaurant" element={<RestaurantPage />} />
                    <Route path="/hotels-events" element={<HotelsEventsPage />} />
                    <Route path="/health-wellness" element={<HealthWellnessPage />} />
                    <Route path="/near-me" element={<NearMePage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/support" element={<SupportPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/education-hub" element={<EducationHubPage />} />
      <Route path="/flights" element={<FlightsPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/ai" element={<UniqueAiPage />} />
                    <Route path="/ai/premium" element={<UniqueAiSubscriptionPage />} />
                    <Route path="/media" element={<UniqueMediaPage />} />
                    <Route path="/unique-media" element={<UniqueMediaPage />} />
                    <Route path="/jobs" element={<JobsPage />} />
                    <Route path="/store" element={<StorePage />} />
                    <Route path="/store/categories" element={<StoreCategoriesPage />} />
                    <Route path="/store/product/:id" element={<StoreProductPage />} />
                    <Route path="/store/seller/:id" element={<StoreSellerProfilePage />} />
                    <Route path="/store/search" element={<StoreSearchPage />} />
                    <Route path="/store/wishlist" element={<StoreWishlistPage />} />
                    <Route path="/store/cart" element={<StoreCartPage />} />
                    <Route path="/store/orders" element={<StoreOrdersPage />} />
                    <Route path="/store/product-request" element={<StoreProductRequestPage />} />
                    <Route path="/store/quote-request" element={<StoreQuoteRequestPage />} />
                    <Route path="/store/command-centre" element={<StoreCommandCentrePage />} />
                  </Route>

                  <Route path="/conference" element={<Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm font-bold text-emerald-300">Loading Unique Conference…</div>}><ConferencePage /></Suspense>} />
                  <Route path="/conference/:roomId" element={<Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm font-bold text-emerald-300">Loading Unique Conference…</div>}><ConferencePage /></Suspense>} />

                  <Route path="/os" element={<AuthGuard><AppLayout /></AuthGuard>}>
                    <Route index element={<Navigate to="/os/dashboard" replace />} />
                    <Route path="dashboard" element={<HomePage />} />
                    <Route path="workspace/personal" element={<WorkspaceDashboardPage dashboard="personal" />} />
                    <Route path="workspace/pay" element={<RoleGuard dashboard="uniquepay"><WorkspaceDashboardPage dashboard="uniquepay" /></RoleGuard>} />
                    <Route path="workspace/store" element={<RoleGuard dashboard="store_seller"><WorkspaceDashboardPage dashboard="store_seller" /></RoleGuard>} />
                    <Route path="workspace/business" element={<RoleGuard dashboard="business"><WorkspaceDashboardPage dashboard="business" /></RoleGuard>} />
                    <Route path="workspace/institution" element={<RoleGuard dashboard="institution"><WorkspaceDashboardPage dashboard="institution" /></RoleGuard>} />
                    <Route path="workspace/operations" element={<RoleGuard dashboard="operations"><WorkspaceDashboardPage dashboard="operations" /></RoleGuard>} />
                    <Route path="workspace/active-edge" element={<RoleGuard dashboard="active_edge"><WorkspaceDashboardPage dashboard="active_edge" /></RoleGuard>} />
                    <Route path="workspace/ai" element={<RoleGuard dashboard="unique_ai"><WorkspaceDashboardPage dashboard="unique_ai" /></RoleGuard>} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="messages/*" element={<MessagesPage />} />
                    <Route path="orders" element={<OrdersPage />} />
                    <Route path="bookings" element={<BookingsPage />} />
                    <Route path="wishlist" element={<WishlistPage />} />
                    <Route path="requests" element={<UserRequestsPage />} />
                    <Route path="pay" element={<RoleGuard dashboard="uniquepay"><PayPage /></RoleGuard>} />
                    <Route path="store" element={<StorePage />} />
                    <Route path="ai" element={<RoleGuard dashboard="unique_ai"><UniqueAiPage /></RoleGuard>} />
                    <Route path="ai/premium" element={<UniqueAiSubscriptionPage />} />
                    <Route path="master-vision" element={<MasterVisionPage />} />
                    <Route path="unique-share" element={<UniqueSharePage />} />
                    <Route path="jobs" element={<Navigate to="/jobs" replace />} />
                    <Route path="contributions" element={<ContributionNetworkPage />} />
                    <Route path="education" element={<EducationPage />} />
                    <Route path="travel" element={<TravelPage />} />
                    <Route path="business/register" element={<BusinessRegisterPage />} />
                    <Route path="business/dashboard" element={<RoleGuard dashboard="business" fallback={<BusinessRegisterPage />}><WorkspaceDashboardPage dashboard="business" /></RoleGuard>} />
                    <Route path="business/settings" element={<RoleGuard dashboard="business"><BusinessSettingsPage /></RoleGuard>} />
                    <Route path="business/staff" element={<RoleGuard dashboard="business"><StaffPage /></RoleGuard>} />
                    <Route path="business/branches" element={<RoleGuard dashboard="business"><BranchesPage /></RoleGuard>} />
                    <Route path="business/catalog" element={<RoleGuard dashboard="business"><CatalogPage /></RoleGuard>} />
                    <Route path="business/catalog/new-product" element={<RoleGuard dashboard="business"><AddProductPage /></RoleGuard>} />
                    <Route path="business/catalog/new-service" element={<RoleGuard dashboard="business"><AddServicePage /></RoleGuard>} />
                    <Route path="business/inventory" element={<RoleGuard dashboard="business"><InventoryPage /></RoleGuard>} />
                    <Route path="business/customers" element={<RoleGuard dashboard="business"><BusinessCustomersPage /></RoleGuard>} />
                    <Route path="business/suppliers" element={<RoleGuard dashboard="business"><SuppliersPage /></RoleGuard>} />
                    <Route path="business/orders" element={<RoleGuard dashboard="business"><BusinessOrdersPage /></RoleGuard>} />
                    <Route path="business/invoices" element={<RoleGuard dashboard="business"><InvoicesPage /></RoleGuard>} />
                    <Route path="business/finance" element={<RoleGuard dashboard="business"><FinancePage /></RoleGuard>} />
                    <Route path="business/reports" element={<RoleGuard dashboard="business"><ReportsPage /></RoleGuard>} />
                    <Route path="business/activity" element={<RoleGuard dashboard="business"><ActivityPage /></RoleGuard>} />
                    <Route path="business/profile" element={<RoleGuard dashboard="business"><BusinessProfilePage /></RoleGuard>} />
                    <Route path="business/members" element={<RoleGuard dashboard="institution"><OrganizationMembersPage /></RoleGuard>} />
                    <Route path="services" element={<RoleGuard dashboard="operations"><ServicesPage /></RoleGuard>} />
                    <Route path="customers" element={<RoleGuard dashboard="business"><CustomersPage /></RoleGuard>} />
                    <Route path="invoices" element={<RoleGuard dashboard="business"><InvoicesPage /></RoleGuard>} />
                    <Route path="payment-requests" element={<RoleGuard dashboard="business"><PaymentRequestsPage /></RoleGuard>} />
                    <Route path="payment-requests/new" element={<RoleGuard dashboard="business"><CreatePaymentRequestPage /></RoleGuard>} />
                    <Route path="invoices/new" element={<RoleGuard dashboard="business"><CreateInvoicePage /></RoleGuard>} />
                    <Route path="pay/receipts/:id" element={<RoleGuard dashboard="uniquepay"><ReceiptPage /></RoleGuard>} />
                    <Route path="pay/school-payments" element={<RoleGuard dashboard="uniquepay"><SchoolPaymentDashboard /></RoleGuard>} />
                    <Route path="pay/history" element={<RoleGuard dashboard="uniquepay"><TransactionHistoryPage /></RoleGuard>} />
                    <Route path="pay/send" element={<RoleGuard dashboard="uniquepay"><SendMoneyPage /></RoleGuard>} />
                    <Route path="pay/receive" element={<RoleGuard dashboard="uniquepay"><ReceiveMoneyPage /></RoleGuard>} />
                    <Route path="pay/ajo" element={<RoleGuard dashboard="uniquepay"><CycleAjoPage /></RoleGuard>} />
                    <Route path="pay/verification" element={<RoleGuard dashboard="uniquepay"><VerificationCenterPage /></RoleGuard>} />
                    <Route path="pay/beneficiaries" element={<RoleGuard dashboard="uniquepay"><BeneficiariesPage /></RoleGuard>} />
                    <Route path="pay/settings" element={<RoleGuard dashboard="uniquepay"><PaySettingsPage /></RoleGuard>} />
                    <Route path="pay/security" element={<RoleGuard dashboard="uniquepay"><PaySecurityPage /></RoleGuard>} />
                    <Route path="notifications" element={<NotificationsPage />} />
                    <Route path="language" element={<LanguagePage />} />
                    <Route path="security" element={<SecurityPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Route>

                  <Route path="/admin/login" element={<AdminLoginPage />} />
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<Navigate to="/admin/workspace/super" replace />} />
                    <Route path="control-tower" element={<RoleGuard dashboard="super_admin"><AdminControlTowerPage /></RoleGuard>} />
                    <Route path="workspace/finance" element={<RoleGuard dashboard="finance_settlement"><WorkspaceDashboardPage dashboard="finance_settlement" /></RoleGuard>} />
                    <Route path="workspace/risk" element={<RoleGuard dashboard="security_risk"><WorkspaceDashboardPage dashboard="security_risk" /></RoleGuard>} />
                    <Route path="workspace/platform" element={<RoleGuard dashboard="platform_admin"><WorkspaceDashboardPage dashboard="platform_admin" /></RoleGuard>} />
                    <Route path="workspace/super" element={<RoleGuard dashboard="super_admin"><SuperAdminDashboardPage /></RoleGuard>} />
                    <Route path="users" element={<RoleGuard dashboard="platform_admin"><AdminUsersPage /></RoleGuard>} />
                    <Route path="businesses" element={<RoleGuard dashboard="platform_admin"><AdminBusinessesPage /></RoleGuard>} />
                    <Route path="products" element={<RoleGuard dashboard="platform_admin"><AdminProductsPage /></RoleGuard>} />
                    <Route path="requests" element={<RoleGuard dashboard="platform_admin"><AdminRequestsPage /></RoleGuard>} />
                    <Route path="reports" element={<RoleGuard dashboard="platform_admin"><AdminReportsPage /></RoleGuard>} />
                    <Route path="verification" element={<RoleGuard dashboard="security_risk"><AdminVerificationPage /></RoleGuard>} />
                    <Route path="transactions" element={<RoleGuard dashboard="finance_settlement"><AdminTransactionsPage /></RoleGuard>} />
                    <Route path="settings" element={<RoleGuard dashboard="platform_admin"><AdminSettingsPage /></RoleGuard>} />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </div>
          </div>
        </BrowserRouter>
      </OfflineQueueProvider>
    </AuthProvider>
  );
}

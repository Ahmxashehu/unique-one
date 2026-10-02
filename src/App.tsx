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
import { lazy, Suspense, useEffect, useState } from "react";



















const ConferencePage = lazy(() => import("./pages/ConferencePage"));



const HomePage = lazy(() => import("./pages/HomePage"));
const DiscoverPage = lazy(() => import("./pages/public/DiscoverPage"));
const SearchPage = lazy(() => import("./pages/public/SearchPage"));
const CategoriesPage = lazy(() => import("./pages/public/CategoriesPage"));
const NearMePage = lazy(() => import("./pages/public/NearMePage"));
const AboutPage = lazy(() => import("./pages/public/AboutPage"));
const SupportPage = lazy(() => import("./pages/public/SupportPage"));
const LoginPage = lazy(() => import("./pages/public/LoginPage"));
const RegisterPage = lazy(() => import("./pages/public/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/public/ForgotPasswordPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const StorePage = lazy(() => import("./pages/StorePage"));
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
const StoreDiscoverPage = lazy(() => import("./pages/store/StoreDiscoverPage"));
const StoreCategoriesPage = lazy(() => import("./pages/store/StoreCategoriesPage"));
const StoreProductPage = lazy(() => import("./pages/store/StoreProductPage"));
const StoreSellerProfilePage = lazy(() => import("./pages/store/StoreSellerProfilePage"));
const StoreSearchPage = lazy(() => import("./pages/store/StoreSearchPage"));
const StoreWishlistPage = lazy(() => import("./pages/store/StoreWishlistPage"));
const StoreCartPage = lazy(() => import("./pages/store/StoreCartPage"));
const StoreOrdersPage = lazy(() => import("./pages/store/StoreOrdersPage"));
const StoreProductRequestPage = lazy(() => import("./pages/store/StoreProductRequestPage"));
const StoreQuoteRequestPage = lazy(() => import("./pages/store/StoreQuoteRequestPage"));
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
const JobsPage = lazy(() => import("./pages/JobsPage"));
const ContributionNetworkPage = lazy(() => import("./pages/ContributionNetworkPage"));
const EducationPage = lazy(() => import("./pages/EducationPage"));
const TravelPage = lazy(() => import("./pages/TravelPage"));
const CycleAjoPage = lazy(() => import("./pages/pay/CycleAjoPage"));
const VerificationCenterPage = lazy(() => import("./pages/pay/VerificationCenterPage"));
const MasterVisionPage = lazy(() => import("./pages/MasterVisionPage"));
const UniqueMediaPage = lazy(() => import("./pages/UniqueMediaPage"));
const UniqueSharePage = lazy(() => import("./pages/UniqueSharePage"));

export default function App() {
  const [u1Booting, setU1Booting] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setU1Booting(false), 900);
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
              {/* Public Ecosystem Routes */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/discover" element={<DiscoverPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/near-me" element={<NearMePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/support" element={<SupportPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/ai" element={<UniqueAiPage />} />
                <Route path="/media" element={<UniqueMediaPage />} />
                <Route path="/unique-media" element={<UniqueMediaPage />} />
                
                {/* Unique Store Public Routes */}
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
              </Route>
              
              <Route path="/conference" element={<Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm font-bold text-emerald-300">Loading Unique Conference…</div>}><ConferencePage /></Suspense>} />
              <Route path="/conference/:roomId" element={<Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm font-bold text-emerald-300">Loading Unique Conference…</div>}><ConferencePage /></Suspense>} />
              
              {/* UniqueOS Internal Routes */}
              <Route path="/os" element={<AuthGuard><AppLayout /></AuthGuard>}>
              <Route index element={<Navigate to="/os/dashboard" replace />} />
              {/* User Account */}
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="messages/*" element={<MessagesPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="bookings" element={<BookingsPage />} />
              <Route path="wishlist" element={<WishlistPage />} />
              <Route path="requests" element={<UserRequestsPage />} />
              <Route path="pay" element={<PayPage />} />
              <Route path="store" element={<StorePage />} />
              <Route path="ai" element={<UniqueAiPage />} />
              <Route path="master-vision" element={<MasterVisionPage />} />
              <Route path="unique-share" element={<UniqueSharePage />} />
              <Route path="jobs" element={<JobsPage />} />
              <Route path="contributions" element={<ContributionNetworkPage />} />
              <Route path="education" element={<EducationPage />} />
              <Route path="travel" element={<TravelPage />} />

              {/* Business Tools */}
              <Route path="business/register" element={<BusinessRegisterPage />} />
              {/* BOS Routes */}
              <Route path="business/dashboard" element={<SellerDashboardPage />} />
              <Route path="business/settings" element={<BusinessSettingsPage />} />
              <Route path="business/staff" element={<StaffPage />} />
              <Route path="business/branches" element={<BranchesPage />} />
              <Route path="business/catalog" element={<CatalogPage />} />
              <Route path="business/catalog/new-product" element={<AddProductPage />} />
              <Route path="business/catalog/new-service" element={<AddServicePage />} />
              <Route path="business/inventory" element={<InventoryPage />} />
              <Route path="business/customers" element={<BusinessCustomersPage />} />
              <Route path="business/suppliers" element={<SuppliersPage />} />
              <Route path="business/orders" element={<BusinessOrdersPage />} />
              <Route path="business/invoices" element={<InvoicesPage />} />
              <Route path="business/finance" element={<FinancePage />} />
              <Route path="business/reports" element={<ReportsPage />} />
              <Route path="business/activity" element={<ActivityPage />} />
              
              {/* Legacy fallback if needed */}
              <Route path="business/profile" element={<BusinessProfilePage />} />
              <Route path="business/members" element={<OrganizationMembersPage />} />
              <Route path="services" element={<ServicesPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="invoices" element={<InvoicesPage />} />
              <Route path="payment-requests" element={<PaymentRequestsPage />} />
              <Route path="payment-requests/new" element={<CreatePaymentRequestPage />} />
              <Route path="invoices/new" element={<CreateInvoicePage />} />
              <Route path="pay/receipts/:id" element={<ReceiptPage />} />
              <Route path="pay/school-payments" element={<SchoolPaymentDashboard />} />
              <Route path="pay/history" element={<TransactionHistoryPage />} />
              <Route path="pay/send" element={<SendMoneyPage />} />
              <Route path="pay/receive" element={<ReceiveMoneyPage />} />
              <Route path="pay/ajo" element={<CycleAjoPage />} />
              <Route path="pay/verification" element={<VerificationCenterPage />} />
              <Route path="pay/beneficiaries" element={<BeneficiariesPage />} />
              <Route path="pay/settings" element={<PaySettingsPage />} />
              <Route path="pay/security" element={<PaySecurityPage />} />


              
              {/* System */}
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="language" element={<LanguagePage />} />
              <Route path="security" element={<SecurityPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<RoleGuard requiredRole="administrator"><AdminLayout /></RoleGuard>}>
              <Route index element={<Navigate to="/admin/users" replace />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="businesses" element={<AdminBusinessesPage />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route path="requests" element={<AdminRequestsPage />} />
              <Route path="reports" element={<AdminReportsPage />} />
              <Route path="verification" element={<AdminVerificationPage />} />
              <Route path="transactions" element={<AdminTransactionsPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
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

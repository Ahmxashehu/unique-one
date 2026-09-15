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

import HomePage from "./pages/HomePage";
import DiscoverPage from "./pages/public/DiscoverPage";
import SearchPage from "./pages/public/SearchPage";
import CategoriesPage from "./pages/public/CategoriesPage";
import NearMePage from "./pages/public/NearMePage";
import AboutPage from "./pages/public/AboutPage";
import SupportPage from "./pages/public/SupportPage";
import LoginPage from "./pages/public/LoginPage";
import RegisterPage from "./pages/public/RegisterPage";
import ForgotPasswordPage from "./pages/public/ForgotPasswordPage";

import DashboardPage from "./pages/DashboardPage";
import StorePage from "./pages/StorePage";
import PayPage from "./pages/PayPage";
import SettingsPage from "./pages/SettingsPage";
import NotificationsPage from "./pages/NotificationsPage";
import BookingsPage from "./pages/BookingsPage";
import ServicesPage from "./pages/ServicesPage";
import OrdersPage from "./pages/OrdersPage";
import CustomersPage from "./pages/CustomersPage";
import InvoicesPage from "./pages/InvoicesPage";
import PaymentRequestsPage from "./pages/PaymentRequestsPage";

import ProfilePage from "./pages/ProfilePage";
import MessagesPage from "./pages/messages/MessagesPage";
import WishlistPage from "./pages/WishlistPage";
import UserRequestsPage from "./pages/UserRequestsPage";
import LanguagePage from "./pages/LanguagePage";
import SecurityPage from "./pages/SecurityPage";

import BusinessRegisterPage from "./pages/business/BusinessRegisterPage";
import BusinessProfilePage from "./pages/business/BusinessProfilePage";
import SellerDashboardPage from "./pages/business/SellerDashboardPage";
import BusinessSettingsPage from "./pages/business/BusinessSettingsPage";
import StaffPage from "./pages/business/StaffPage";
import BranchesPage from "./pages/business/BranchesPage";
import CatalogPage from "./pages/business/CatalogPage";
import InventoryPage from "./pages/business/InventoryPage";
import BusinessCustomersPage from "./pages/business/BusinessCustomersPage";
import SuppliersPage from "./pages/business/SuppliersPage";
import BusinessOrdersPage from "./pages/business/BusinessOrdersPage";
import FinancePage from "./pages/business/FinancePage";
import ReportsPage from "./pages/business/ReportsPage";
import ActivityPage from "./pages/business/ActivityPage";

import OrganizationMembersPage from "./pages/business/OrganizationMembersPage";
import AddProductPage from "./pages/business/AddProductPage";
import AddServicePage from "./pages/business/AddServicePage";

import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminBusinessesPage from "./pages/admin/AdminBusinessesPage";
import AdminProductsPage from "./pages/admin/AdminProductsPage";
import AdminRequestsPage from "./pages/admin/AdminRequestsPage";
import AdminReportsPage from "./pages/admin/AdminReportsPage";
import AdminVerificationPage from "./pages/admin/AdminVerificationPage";
import AdminTransactionsPage from "./pages/admin/AdminTransactionsPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";

import InstallPrompt from "./components/InstallPrompt";
import OfflineIndicator from "./components/OfflineIndicator";

import StoreDiscoverPage from "./pages/store/StoreDiscoverPage";
import StoreCategoriesPage from "./pages/store/StoreCategoriesPage";
import StoreProductPage from "./pages/store/StoreProductPage";
import StoreSellerProfilePage from "./pages/store/StoreSellerProfilePage";
import StoreSearchPage from "./pages/store/StoreSearchPage";
import StoreWishlistPage from "./pages/store/StoreWishlistPage";
import StoreCartPage from "./pages/store/StoreCartPage";
import StoreOrdersPage from "./pages/store/StoreOrdersPage";
import StoreProductRequestPage from "./pages/store/StoreProductRequestPage";
import StoreQuoteRequestPage from "./pages/store/StoreQuoteRequestPage";

import { OfflineQueueProvider } from "./contexts/OfflineQueueContext";
import SyncOverlay from "./components/SyncOverlay";

import CreatePaymentRequestPage from "./pages/pay/CreatePaymentRequestPage";
import CreateInvoicePage from "./pages/pay/CreateInvoicePage";
import ReceiptPage from "./pages/pay/ReceiptPage";
import SchoolPaymentDashboard from "./pages/pay/SchoolPaymentDashboard";
import TransactionHistoryPage from "./pages/pay/TransactionHistoryPage";
import SendMoneyPage from "./pages/pay/SendMoneyPage";
import ReceiveMoneyPage from "./pages/pay/ReceiveMoneyPage";
import BeneficiariesPage from "./pages/pay/BeneficiariesPage";
import PaySettingsPage from "./pages/pay/PaySettingsPage";
import PaySecurityPage from "./pages/pay/PaySecurityPage";



export default function App() {
  return (
    <AuthProvider>
      <OfflineQueueProvider>
        <BrowserRouter>
          <div className="flex flex-col h-screen overflow-hidden w-full max-w-[100vw]">
            <OfflineIndicator />
          <InstallPrompt />
          <SyncOverlay />
          <div className="flex-1 relative overflow-hidden">
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
                
                {/* Unique Store Public Routes */}
                <Route path="/store" element={<StoreDiscoverPage />} />
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
            <Route path="/admin" element={<AdminLayout />}>
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
          </div>
        </div>
      </BrowserRouter>
      </OfflineQueueProvider>
    </AuthProvider>
  );
}

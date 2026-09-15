const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add imports
const newImports = `
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
`;

if (!code.includes('BusinessSettingsPage')) {
  code = code.replace('import SellerDashboardPage from "./pages/business/SellerDashboardPage";', 'import SellerDashboardPage from "./pages/business/SellerDashboardPage";' + newImports);
}

const oldRoutes = `
              <Route path="business/dashboard" element={<SellerDashboardPage />} />
              <Route path="business/profile" element={<BusinessProfilePage />} />
              <Route path="business/members" element={<OrganizationMembersPage />} />
              <Route path="business/add-product" element={<AddProductPage />} />
              <Route path="business/add-service" element={<AddServicePage />} />
`;

const newRoutes = `
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
              <Route path="business/finance" element={<FinancePage />} />
              <Route path="business/reports" element={<ReportsPage />} />
              <Route path="business/activity" element={<ActivityPage />} />
              
              {/* Legacy fallback if needed */}
              <Route path="business/profile" element={<BusinessProfilePage />} />
              <Route path="business/members" element={<OrganizationMembersPage />} />
`;

code = code.replace(oldRoutes, newRoutes);

fs.writeFileSync('src/App.tsx', code);

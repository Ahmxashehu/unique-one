const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldRoutes = `              <Route path="business/orders" element={<BusinessOrdersPage />} />
              <Route path="business/finance" element={<FinancePage />} />`;

const newRoutes = `              <Route path="business/orders" element={<BusinessOrdersPage />} />
              <Route path="business/invoices" element={<InvoicesPage />} />
              <Route path="business/finance" element={<FinancePage />} />`;

if (!code.includes('path="business/invoices"')) {
  code = code.replace(oldRoutes, newRoutes);
}

fs.writeFileSync('src/App.tsx', code);

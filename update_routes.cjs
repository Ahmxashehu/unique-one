const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Ensure imports for new pages
const newImports = `
import SendMoneyPage from "./pages/pay/SendMoneyPage";
import ReceiveMoneyPage from "./pages/pay/ReceiveMoneyPage";
import BeneficiariesPage from "./pages/pay/BeneficiariesPage";
import PaySettingsPage from "./pages/pay/PaySettingsPage";
import PaySecurityPage from "./pages/pay/PaySecurityPage";
`;

if (!code.includes('SendMoneyPage')) {
  code = code.replace('import TransactionHistoryPage from "./pages/pay/TransactionHistoryPage";', 'import TransactionHistoryPage from "./pages/pay/TransactionHistoryPage";' + newImports);
}

// Add new routes
const newRoutes = `
              <Route path="pay/send" element={<SendMoneyPage />} />
              <Route path="pay/receive" element={<ReceiveMoneyPage />} />
              <Route path="pay/beneficiaries" element={<BeneficiariesPage />} />
              <Route path="pay/settings" element={<PaySettingsPage />} />
              <Route path="pay/security" element={<PaySecurityPage />} />
`;
if (!code.includes('path="pay/send"')) {
  code = code.replace('<Route path="pay/history" element={<TransactionHistoryPage />} />', '<Route path="pay/history" element={<TransactionHistoryPage />} />' + newRoutes);
}

fs.writeFileSync('src/App.tsx', code);

const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add imports
const importsToAdd = `
import CreatePaymentRequestPage from "./pages/pay/CreatePaymentRequestPage";
import CreateInvoicePage from "./pages/pay/CreateInvoicePage";
import ReceiptPage from "./pages/pay/ReceiptPage";
import SchoolPaymentDashboard from "./pages/pay/SchoolPaymentDashboard";
import TransactionHistoryPage from "./pages/pay/TransactionHistoryPage";
`;
code = code.replace('import SyncOverlay from "./components/SyncOverlay";', 'import SyncOverlay from "./components/SyncOverlay";\n' + importsToAdd);

// Add routes
const routesToAdd = `
              <Route path="payment-requests/new" element={<CreatePaymentRequestPage />} />
              <Route path="invoices/new" element={<CreateInvoicePage />} />
              <Route path="pay/receipts/:id" element={<ReceiptPage />} />
              <Route path="pay/school-payments" element={<SchoolPaymentDashboard />} />
              <Route path="pay/history" element={<TransactionHistoryPage />} />
`;
code = code.replace('<Route path="payment-requests" element={<PaymentRequestsPage />} />', '<Route path="payment-requests" element={<PaymentRequestsPage />} />' + routesToAdd);

fs.writeFileSync('src/App.tsx', code);

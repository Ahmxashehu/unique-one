const fs = require('fs');
let code = fs.readFileSync('src/layouts/AppLayout.tsx', 'utf8');

const oldBusinessNav = `  const businessNav = [
    { name: 'Register Business', path: '/os/business/register', icon: Building2 },
    { name: 'Seller Dashboard', path: '/os/business/dashboard', icon: Activity },
    { name: 'Business Profile', path: '/os/business/profile', icon: StoreIcon },
    { name: 'Staff & Members', path: '/os/business/members', icon: Users },
    { name: 'Add Product', path: '/os/business/add-product', icon: PlusCircle },
    { name: 'Add Service', path: '/os/business/add-service', icon: PlusCircle },
    { name: 'Customers', path: '/os/customers', icon: Users },
    { name: 'Invoices', path: '/os/invoices', icon: FileText },
    { name: 'Payment Requests', path: '/os/payment-requests', icon: Receipt },
  ];`;

const newBusinessNav = `  const businessNav = [
    { name: 'Dashboard', path: '/os/business/dashboard', icon: LayoutDashboard },
    { name: 'Catalog', path: '/os/business/catalog', icon: PlusCircle },
    { name: 'Orders', path: '/os/business/orders', icon: ShoppingCart },
    { name: 'Inventory', path: '/os/business/inventory', icon: Briefcase },
    { name: 'Customers', path: '/os/business/customers', icon: Users },
    { name: 'Suppliers', path: '/os/business/suppliers', icon: Users },
    { name: 'Invoices', path: '/os/business/invoices', icon: FileText },
    { name: 'Finance', path: '/os/business/finance', icon: Wallet },
    { name: 'Reports', path: '/os/business/reports', icon: Activity },
    { name: 'Staff & Teams', path: '/os/business/staff', icon: Users },
    { name: 'Branches', path: '/os/business/branches', icon: Building2 },
    { name: 'Activity Logs', path: '/os/business/activity', icon: ClipboardList },
    { name: 'Settings', path: '/os/business/settings', icon: Settings },
  ];`;

code = code.replace(oldBusinessNav, newBusinessNav);

// Since `InvoicesPage` was at `/os/invoices` and `PaymentRequestsPage` at `/os/payment-requests`, 
// they are now integrated. Let's make sure `/os/business/invoices` points to something valid in App.tsx or use `/os/invoices`.
// Actually, the user asked to create `/os/business/invoices`. 
fs.writeFileSync('src/layouts/AppLayout.tsx', code);

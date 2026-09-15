const fs = require('fs');
let code = fs.readFileSync('src/pages/ProfilePage.tsx', 'utf8');

if (!code.includes("MessageSquare")) {
  code = code.replace("import { User, Mail, Phone, MapPin, BadgeCheck, Clock, Save, Loader2, ShieldCheck, Hash } from 'lucide-react';", "import { User, Mail, Phone, MapPin, BadgeCheck, Clock, Save, Loader2, ShieldCheck, Hash, MessageSquare } from 'lucide-react';");
} else if (code.includes("import { User, Mail, Phone, MapPin, BadgeCheck, Clock, Save, Loader2, ShieldCheck, Hash } from 'lucide-react';")) {
  code = code.replace("import { User, Mail, Phone, MapPin, BadgeCheck, Clock, Save, Loader2, ShieldCheck, Hash } from 'lucide-react';", "import { User, Mail, Phone, MapPin, BadgeCheck, Clock, Save, Loader2, ShieldCheck, Hash, MessageSquare } from 'lucide-react';");
}

fs.writeFileSync('src/pages/ProfilePage.tsx', code);

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UniqueUser, Role, Permission } from '../lib/os/types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: UniqueUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  hasRole: (role: Role) => boolean;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UniqueUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubsribeSnapshot: (() => void) | null = null;
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          unsubsribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
             if (docSnap.exists()) {
               setUserData(docSnap.data() as UniqueUser);
             } else {
               console.warn("User document not found in Firestore.");
             }
          });
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        if (unsubsribeSnapshot) {
           unsubsribeSnapshot();
        }
        setUserData(null);
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubsribeSnapshot) unsubsribeSnapshot();
    };
  }, []);

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  const hasRole = (role: Role) => {
    if (!userData) return false;
    return userData.roles.includes(role) || userData.roles.includes('administrator');
  };

  const hasPermission = (permission: Permission) => {
    if (!userData) return false;
    // Admins have all permissions
    if (userData.roles.includes('administrator')) return true;
    return userData.permissions?.includes(permission) || false;
  };

  return (
    <AuthContext.Provider value={{ currentUser, userData, loading, logout, hasRole, hasPermission }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

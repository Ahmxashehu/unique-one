import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UniqueUser, Role, Permission } from '../lib/os/types';
import { hasRolePermission } from '../lib/auth/rbac';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: UniqueUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isVerified: boolean;
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
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      setCurrentUser(user);
      setUserData(null);

      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const userDocRef = doc(db, 'users', user.uid);

      unsubscribeSnapshot = onSnapshot(
        userDocRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const nextUser = docSnap.data() as UniqueUser;
            if (nextUser.status === 'banned' || nextUser.status === 'suspended') {
              setUserData(nextUser);
              void firebaseSignOut(auth);
              setLoading(false);
              return;
            }
            setUserData(nextUser);
          } else {
            console.warn('User document not found in Firestore.');
            setUserData(null);
          }
          setLoading(false);
        },
        (error) => {
          console.error('Error listening to user data:', error);
          setUserData(null);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  const logout = async () => {
    await firebaseSignOut(auth);
    setCurrentUser(null);
    setUserData(null);
  };

  const hasRole = (role: Role) => {
    if (!userData) return false;
    // Role checks must be exact. "administrator" is not a substitute for
    // higher-privilege roles such as platform_admin or super_admin.
    return userData.roles.includes(role);
  };

  const hasPermission = (permission: Permission) => {
    if (!userData) return false;
    return hasRolePermission(userData.roles, userData.permissions ?? [], permission);
  };

  const isAuthenticated = Boolean(currentUser);
  const isVerified = Boolean(
    userData &&
      userData.status === 'active' &&
      (userData.verificationStatus === 'phone_verified' || userData.verificationStatus === 'fully_verified'),
  );

  return (
    <AuthContext.Provider value={{ currentUser, userData, loading, isAuthenticated, isVerified, logout, hasRole, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

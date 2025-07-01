import { createContext, useContext, useEffect, useState, useCallback } from 'react';

import { 
    User, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
  } from 'firebase/auth';

import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface UserData {
    uid: string;
    name: string;
    email: string;
    createdAt: Date;
    technicalTicketCount?: number;
    serviceTicketCount?: number;
  }

interface AuthContextType {
    user: User | null;
    userData: UserData | null;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, name: string) => Promise<void>;
    logout: () => Promise<void>;
    loading: boolean;
    isLoggingOut: boolean;
  }
  

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
      throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
  }

  export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
  
    const fetchUserData = useCallback(async (user: User) => {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData({
            uid: user.uid,
            name: data.name,
            email: data.email,
            createdAt: data.createdAt?.toDate() || new Date(),
            technicalTicketCount: data.technicalTicketCount || 0,
            serviceTicketCount: data.serviceTicketCount || 0,
          });
        } else {
          // Fallback for users without Firestore data
          setUserData({
            uid: user.uid,
            name: user.displayName || '',
            email: user.email || '',
            createdAt: new Date(),
            technicalTicketCount: 0,
            serviceTicketCount: 0,
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        // Fallback to auth data
        setUserData({
          uid: user.uid,
          name: user.displayName || '',
          email: user.email || '',
          createdAt: new Date(),
          technicalTicketCount: 0,
          serviceTicketCount: 0,
        });
      }
    }, []);
  
    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        console.log('🔄 Auth state changed:', user ? `User logged in (${user.uid})` : 'User logged out');
        
        if (user) {
          // User is logged in
          console.log('✅ Setting user and fetching data...');
          setUser(user);
          await fetchUserData(user);
          
          // Clear logout state if it was set
          if (isLoggingOut) {
            console.log('🔄 Clearing logout state after successful login');
            setIsLoggingOut(false);
          }
        } else {
          // User is logged out
          console.log('❌ Clearing user data...');
          setUser(null);
          setUserData(null);
          
          // Clear logout state
          if (isLoggingOut) {
            console.log('🚪 Logout process completed');
            setIsLoggingOut(false);
          }
        }
        
        // Always set loading to false after auth state is determined
        setLoading(false);
      });
  
      return unsubscribe;
    }, [fetchUserData, isLoggingOut]);
  
    /**
     * Check if a user exists in Firestore by email
     * This is more reliable than using Firebase Auth methods
     */
    const checkUserExistsInFirestore = async (email: string): Promise<boolean> => {
      try {
        console.log('🔍 Checking Firestore for user with email:', email);
        
        // Query the users collection for a document with the given email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);
        
        const userExists = !querySnapshot.empty;
        
        console.log('📧 Firestore user existence check result:', {
          email,
          userExists,
          documentsFound: querySnapshot.size
        });
        
        return userExists;
      } catch (error: any) {
        console.error('❌ Error checking user existence in Firestore:', error);
        
        // If we can't check Firestore, we'll have to rely on Firebase Auth error
        throw new Error('Unable to verify user account. Please try again.');
      }
    };
  
    const login = async (email: string, password: string) => {
      try {
        console.log('🔐 Starting login process for:', email);
        
        // First, check if user exists in Firestore
        const userExists = await checkUserExistsInFirestore(email);
        
        if (!userExists) {
          console.log('❌ No user found in Firestore for:', email);
          throw new Error('No account found with this email address. Please sign up first.');
        }
        
        console.log('✅ User found in Firestore, attempting Firebase Auth login...');
        
        // User exists in Firestore, now try to authenticate with Firebase Auth
        const result = await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Login successful for user:', result.user.uid);
        
        // Login successful - Firebase Auth handled the password validation
        // The onAuthStateChanged listener will handle setting the user state
        
      } catch (error: any) {
        console.log('❌ Login error:', error.code || 'No code', error.message);
        
        // If it's our custom error from Firestore check, re-throw it
        if (error.message && error.message.includes('No account found with this email address')) {
          throw error;
        }
        
        // Handle Firebase Auth specific errors
        switch (error.code) {
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            // User exists in Firestore but password is wrong
            console.log('❌ Invalid password for existing user:', email);
            throw new Error('Invalid password. Please try again.');
            
          case 'auth/invalid-email':
            throw new Error('Invalid email address format.');
            
          case 'auth/user-disabled':
            throw new Error('This account has been disabled. Please contact support.');
            
          case 'auth/too-many-requests':
            throw new Error('Too many failed login attempts. Please try again later.');
            
          case 'auth/network-request-failed':
            throw new Error('Network error. Please check your internet connection and try again.');
            
          case 'auth/operation-not-allowed':
            throw new Error('Email/password sign-in is not enabled. Please contact support.');
            
          case 'auth/user-not-found':
            // This shouldn't happen since we checked Firestore first, but just in case
            throw new Error('No account found with this email address. Please sign up first.');
            
          default:
            // For any other errors, provide a generic message
            console.log('🔄 Unhandled error code:', error.code);
            throw new Error('Login failed. Please check your email and password and try again.');
        }
      }
    };
  
    const signup = async (email: string, password: string, name: string) => {
      try {
        console.log('📝 Attempting signup for:', email);
        
        // Check if user already exists in Firestore
        const userExists = await checkUserExistsInFirestore(email);
        
        if (userExists) {
          console.log('❌ User already exists in Firestore:', email);
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        
        console.log('✅ Email is available, creating Firebase Auth account...');
        
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        console.log('✅ Signup successful for user:', user.uid);
        
        // Update the user's display name in Firebase Auth
        await updateProfile(user, { displayName: name });
        
        // Save user data to Firestore with initialized counters
        const userDocRef = doc(db, 'users', user.uid);
        const userData = {
          uid: user.uid,
          name: name,
          email: email,
          createdAt: new Date(),
          technicalTicketCount: 0, // Initialize technical ticket counter
          serviceTicketCount: 0,   // Initialize service ticket counter
        };
        
        await setDoc(userDocRef, userData);
        console.log('✅ User data saved to Firestore');
        
      } catch (error: any) {
        console.log('❌ Signup error:', error.code || 'No code', error.message);
        
        // If it's our custom error from Firestore check, re-throw it
        if (error.message && error.message.includes('An account with this email already exists')) {
          throw error;
        }
        
        switch (error.code) {
          case 'auth/email-already-in-use':
            // This shouldn't happen since we checked Firestore first, but just in case
            throw new Error('An account with this email already exists. Please sign in instead.');
            
          case 'auth/weak-password':
            throw new Error('Password is too weak. Please choose a stronger password (at least 6 characters).');
            
          case 'auth/invalid-email':
            throw new Error('Invalid email address. Please check and try again.');
            
          case 'auth/operation-not-allowed':
            throw new Error('Email/password accounts are not enabled. Please contact support.');
            
          case 'auth/network-request-failed':
            throw new Error('Network error. Please check your internet connection and try again.');
            
          default:
            throw new Error('Signup failed. Please try again.');
        }
      }
    };
  
    const logout = async () => {
      try {
        console.log('🚪 Starting logout process...');
        setIsLoggingOut(true);
        
        // Clear user data immediately to prevent UI conflicts
        console.log('🧹 Clearing user data immediately...');
        setUser(null);
        setUserData(null);
        
        // Sign out from Firebase
        await signOut(auth);
        console.log('✅ Firebase signOut completed');
        
        // The onAuthStateChanged listener will handle final cleanup
        
      } catch (error: any) {
        console.error('❌ Logout error:', error);
        setIsLoggingOut(false); // Reset logout state on error
        throw new Error('Logout failed. Please try again.');
      }
    };
  
    const value = {
      user,
      userData,
      login,
      signup,
      logout,
      loading,
      isLoggingOut
    };
  
    return (
      <AuthContext.Provider value={value}>
        {children}
      </AuthContext.Provider>
    );
  }
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { LogOut, Plus, Search } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface Ticket {
  id: string;
  ticketId?: string;
  name: string;
  phone: string;
  email: string;
  ccEmail: string;
  title: string;
  details: string;
  category: string;
  status: string;
  createdAt: any;
  modifiedAt?: any;
  history?: HistoryEntry[];
}

interface HistoryEntry {
  id: string;
  author: string;
  timestamp: any;
  notes: string;
  type: 'note' | 'edit';
}

const { width: screenWidth } = Dimensions.get('window');
const isMobile = screenWidth < 768;

// Custom logout confirmation dialog component
const LogoutConfirmationDialog = ({ 
  visible, 
  onConfirm, 
  onCancel 
}: {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={logoutDialogStyles.overlay}>
        <View style={logoutDialogStyles.dialog}>
          <Text style={logoutDialogStyles.title}>Confirm Logout</Text>
          <Text style={logoutDialogStyles.message}>
            Are you sure you want to log out?
          </Text>
          
          <View style={logoutDialogStyles.buttonContainer}>
            <TouchableOpacity
              style={[logoutDialogStyles.button, logoutDialogStyles.cancelButton]}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={logoutDialogStyles.cancelButtonText}>No</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[logoutDialogStyles.button, logoutDialogStyles.confirmButton]}
              onPress={onConfirm}
              activeOpacity={0.7}
            >
              <Text style={logoutDialogStyles.confirmButtonText}>Yes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const logoutDialogStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    minWidth: 300,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  confirmButton: {
    backgroundColor: '#3B4C80',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
});

export default function DashboardScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { user, userData, logout, isLoggingOut } = useAuth();
  const router = useRouter();

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (!loading && !user && !isLoggingOut) {
      console.log('Dashboard: No user found, redirecting to login');
      router.replace('/login');
    }
  }, [user, loading, isLoggingOut, router]);

  // Listen to tickets in real-time
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const ticketsRef = collection(db, 'users', user.uid, 'tickets');
    const q = query(ticketsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ticketData: Ticket[] = [];
      snapshot.forEach((doc) => {
        ticketData.push({
          id: doc.id,
          ...doc.data(),
        } as Ticket);
      });
      setTickets(ticketData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching tickets:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Calculate status counts
  const statusCounts = {
    new: tickets.filter(t => t.status === 'New').length,
    inReview: tickets.filter(t => t.status === 'In Review').length,
    workInProgress: tickets.filter(t => t.status === 'Work In Progress').length,
    resolved: tickets.filter(t => t.status === 'Resolved').length,
    closed: tickets.filter(t => t.status === 'Closed').length,
  };

  // Filter tickets based on search query
  const filteredTickets = tickets.filter(ticket =>
    ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ticket.ticketId && ticket.ticketId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new':
        return { backgroundColor: '#dbeafe', color: '#1e40af' };
      case 'in review':
        return { backgroundColor: '#fef3c7', color: '#92400e' };
      case 'work in progress':
        return { backgroundColor: '#ecfdf5', color: '#065f46' };
      case 'resolved':
        return { backgroundColor: '#f3e8ff', color: '#7c3aed' };
      case 'closed':
        return { backgroundColor: '#f3f4f6', color: '#374151' };
      default:
        return { backgroundColor: '#f3f4f6', color: '#374151' };
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const getDisplayTicketId = (ticket: Ticket) => {
    if (ticket.ticketId) {
      return ticket.ticketId;
    }
    return ticket.id.substring(0, 8).toUpperCase();
  };

  const handleLogoutPress = () => {
    console.log('🚪 Logout button pressed - showing confirmation dialog');
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = async () => {
    console.log('✅ User confirmed logout');
    setShowLogoutConfirm(false);
    
    try {
      console.log('🚪 Dashboard: Starting logout process');
      await logout();
      console.log('✅ Dashboard: Logout completed successfully');
      
    } catch (error: any) {
      console.error('❌ Dashboard: Logout failed:', error);
      
      Alert.alert(
        'Logout Failed', 
        error.message || 'Unable to logout. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleCancelLogout = () => {
    console.log('❌ User cancelled logout');
    setShowLogoutConfirm(false);
  };

  const handleNewRequest = () => {
    router.push('/new-request');
  };

  const handleTicketPress = (ticket: Ticket) => {
    router.push(`/edit-ticket?id=${ticket.id}`);
  };

  // Don't render dashboard if user is not authenticated
  if (!user && !loading) {
    return null;
  }

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B4C80" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.appTitle}>Front Desk</Text>  
           </View>
           <View style={styles.headerRight}>
             <View style={styles.userInfo}>
               <View style={styles.avatar}>
                 <Text style={styles.avatarText}>
                   {userData?.name?.substring(0, 2).toUpperCase() || 'CS'}
                 </Text>
               </View>
               {!isMobile && (
              <Text style={styles.userName}>
                {userData?.name || user?.displayName || 'Chezhiyan Siva'}
              </Text>
            )}
          </View>
          <TouchableOpacity 
            onPress={handleLogoutPress} 
            style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
            disabled={isLoggingOut}
            activeOpacity={0.7}
          >
            {isLoggingOut ? (
              <ActivityIndicator size={16} color="#6b7280" />
            ) : (
              <LogOut size={20} color="#6b7280" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Page Title */}
        <Text style={styles.pageTitle}>My Requests</Text>

        {/* Status Cards Container */}
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <View style={styles.statusCard}>
              <View style={styles.statusLabelContainer}>
                <Text style={styles.statusLabel}>New</Text>
              </View>
              <Text style={styles.statusCount}>{statusCounts.new}</Text>
            </View>
            <View style={styles.statusCard}>
              <View style={styles.statusLabelContainer}>
                <Text style={styles.statusLabel}>In Review</Text>
              </View>
              <Text style={styles.statusCount}>{statusCounts.inReview}</Text>
            </View>
            <View style={styles.statusCard}>
              <View style={styles.statusLabelContainer}>
                <Text style={styles.statusLabel}>Work In{'\n'}Progress</Text>
              </View>
              <Text style={styles.statusCount}>{statusCounts.workInProgress}</Text>
            </View>
            <View style={styles.statusCard}>
              <View style={styles.statusLabelContainer}>
                <Text style={styles.statusLabel}>Resolved</Text>
              </View>
              <Text style={styles.statusCount}>{statusCounts.resolved}</Text>
            </View>
            <View style={styles.statusCard}>
              <View style={styles.statusLabelContainer}>
                <Text style={styles.statusLabel}>Closed</Text>
              </View>
              <Text style={styles.statusCount}>{statusCounts.closed}</Text>
            </View>
          </View>
        </View>

        {/* New Request Button */}
        <TouchableOpacity style={styles.newRequestButton} onPress={handleNewRequest}>
          <Plus size={16} color="#fff" />
          <Text style={styles.newRequestText}>NEW REQUEST</Text>
        </TouchableOpacity>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Search size={16} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title, category, status, submitter, or ticket ID"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Tickets List */}
        <View style={styles.ticketsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B4C80" />
              <Text style={styles.loadingText}>Loading your requests...</Text>
            </View>
          ) : filteredTickets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery ? 'No requests match your search.' : 'No requests found. Create your first request!'}
              </Text>
            </View>
          ) : (
            <View style={styles.ticketsList}>
              {filteredTickets.map((ticket, index) => (
                <TouchableOpacity 
                  key={ticket.id} 
                  style={styles.ticketCard}
                  onPress={() => handleTicketPress(ticket)}
                  activeOpacity={0.7}
                >
                  <View style={styles.ticketHeader}>
                    <View style={styles.ticketIdContainer}>
                      <Text style={styles.ticketIdText}>
                        {getDisplayTicketId(ticket)}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, getStatusBadgeStyle(ticket.status)]}>
                      <Text style={[styles.statusBadgeText, { color: getStatusBadgeStyle(ticket.status).color }]}>
                        {ticket.status}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.ticketTitle} numberOfLines={2}>
                    {ticket.title}
                  </Text>
                  
                  <View style={styles.ticketMeta}>
                    <Text style={styles.ticketCategory}>{ticket.category}</Text>
                    <Text style={styles.ticketDate}>
                      {formatDate(ticket.createdAt)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Logout Confirmation Dialog */}
      <LogoutConfirmationDialog
        visible={showLogoutConfirm}
        onConfirm={handleConfirmLogout}
        onCancel={handleCancelLogout}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 20, // Extra padding for notched devices
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerLeft: {
    flex: 1,
  },
  appTitle: {
    fontSize: isMobile ? 20 : 24,
    fontWeight: '700',
    color: '#3B4C80',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isMobile ? 8 : 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    backgroundColor: '#6366f1',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isMobile ? 0 : 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  logoutButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  content: {
    flex: 1,
    padding: isMobile ? 16 : 20,
  },
  pageTitle: {
    fontSize: isMobile ? 24 : 28,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 24,
  },
  statusContainer: {
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: isMobile ? 8 : 12,
  },
  statusCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: isMobile ? 12 : 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: isMobile ? 80 : 90,
  },
  statusLabelContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: isMobile ? 32 : 36,
  },
  statusLabel: {
    fontSize: isMobile ? 10 : 11,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: isMobile ? 12 : 14,
  },
  statusCount: {
    fontSize: isMobile ? 20 : 24,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
    lineHeight: isMobile ? 24 : 28,
    marginTop: 4,
  },
  newRequestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B4C80',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  newRequestText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    color: '#374151',
  },
  ticketsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  ticketsList: {
    padding: 16,
  },
  ticketCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketIdContainer: {
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  ticketIdText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B4C80',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    lineHeight: 20,
  },
  ticketMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketCategory: {
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ticketDate: {
    fontSize: 12,
    color: '#6b7280',
  },
});
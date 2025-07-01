import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { arrayUnion, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Plus } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
  category: 'Service' | 'Technical';
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

interface FormData {
  name: string;
  phone: string;
  email: string;
  ccEmail: string;
  title: string;
  details: string;
  category: 'Service' | 'Technical';
  status: string;
}

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
  ccEmail?: string;
  title?: string;
  details?: string;
}

// Custom confirmation dialog component
const ConfirmationDialog = ({ 
  visible, 
  title, 
  message, 
  onConfirm, 
  onCancel 
}: {
  visible: boolean;
  title: string;
  message: string;
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
      <View style={confirmStyles.overlay}>
        <View style={confirmStyles.dialog}>
          <Text style={confirmStyles.title}>{title}</Text>
          <Text style={confirmStyles.message}>{message}</Text>
          
          <View style={confirmStyles.buttonContainer}>
            <TouchableOpacity
              style={[confirmStyles.button, confirmStyles.cancelButton]}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={confirmStyles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[confirmStyles.button, confirmStyles.confirmButton]}
              onPress={onConfirm}
              activeOpacity={0.7}
            >
              <Text style={confirmStyles.confirmButtonText}>Leave</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const confirmStyles = StyleSheet.create({
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
    backgroundColor: '#ef4444',
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

export default function EditTicketScreen() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [showAddDetails, setShowAddDetails] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [originalFormData, setOriginalFormData] = useState<FormData | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    phone: '',
    email: '',
    ccEmail: '',
    title: '',
    details: '',
    category: 'Service',
    status: 'New',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Load ticket data
  useEffect(() => {
    const loadTicket = async () => {
      if (!user || !id) return;

      try {
        const ticketRef = doc(db, 'users', user.uid, 'tickets', id);
        const ticketDoc = await getDoc(ticketRef);

        if (ticketDoc.exists()) {
          const ticketData = { id: ticketDoc.id, ...ticketDoc.data() } as Ticket;
          setTicket(ticketData);
          
          const initialFormData = {
            name: ticketData.name,
            phone: ticketData.phone,
            email: ticketData.email,
            ccEmail: ticketData.ccEmail,
            title: ticketData.title,
            details: ticketData.details,
            category: ticketData.category,
            status: ticketData.status,
          };
          
          setFormData(initialFormData);
          setOriginalFormData(initialFormData);
          
          console.log('Ticket loaded successfully:', {
            ticketId: ticketData.ticketId || ticketData.id.substring(0, 8),
            title: ticketData.title,
            originalData: initialFormData
          });
        } else {
          Alert.alert('Error', 'Ticket not found');
          router.back();
        }
      } catch (error) {
        console.error('Error loading ticket:', error);
        Alert.alert('Error', 'Failed to load ticket');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadTicket();
  }, [user, id, router]);

  // Check if form has changes
  const hasFormChanges = () => {
    if (!originalFormData) {
      console.log('❌ No original form data available');
      return false;
    }
    
    const changes = {
      name: formData.name !== originalFormData.name,
      phone: formData.phone !== originalFormData.phone,
      email: formData.email !== originalFormData.email,
      ccEmail: formData.ccEmail !== originalFormData.ccEmail,
      title: formData.title !== originalFormData.title,
      details: formData.details !== originalFormData.details,
      category: formData.category !== originalFormData.category,
    };
    
    const hasChanges = Object.values(changes).some(changed => changed);
    
    console.log('🔍 Form changes analysis:', {
      changes,
      hasChanges,
      currentTitle: formData.title,
      originalTitle: originalFormData.title,
      currentDetails: formData.details,
      originalDetails: originalFormData.details
    });
    
    return hasChanges;
  };

  // Check if there are any unsaved changes (form changes or new note)
  const hasUnsavedChanges = () => {
    const formChanges = hasFormChanges();
    const noteChanges = newNote.trim().length > 0;
    
    console.log('📝 Unsaved changes check:', {
      formChanges,
      noteChanges,
      newNoteLength: newNote.length,
      newNoteContent: `"${newNote}"`
    });
    
    return formChanges || noteChanges;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\+?[\d\s\-\(\)]+$/.test(formData.phone.trim())) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (formData.ccEmail.trim() && !/\S+@\S+\.\S+/.test(formData.ccEmail)) {
      newErrors.ccEmail = 'Please enter a valid email address';
    }

    if (!formData.title.trim()) {
      newErrors.title = 'Request title is required';
    }

    if (!formData.details.trim()) {
      newErrors.details = 'Request details are required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !user || !id) return;

    setSaving(true);

    try {
      const ticketRef = doc(db, 'users', user.uid, 'tickets', id);
      
      // Check if any field has changed (excluding status since it's not editable)
      const hasChanges = hasFormChanges();

      if (hasChanges) {
        // Only update the ticket fields and modification time
        // Do NOT add any history entry automatically
        await updateDoc(ticketRef, {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          ccEmail: formData.ccEmail,
          title: formData.title,
          details: formData.details,
          category: formData.category,
          // status is intentionally excluded to keep it unchanged
          modifiedAt: serverTimestamp(),
          // Do NOT add any history entry here
        });

        // Update original form data to reflect saved state
        setOriginalFormData({ ...formData });
        
        console.log('✅ Ticket saved successfully');
        
        // Navigate back to dashboard after successful save
        router.back();
      } else {
        Alert.alert('No Changes', 'No changes were made to the ticket');
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
      Alert.alert('Error', 'Failed to update ticket. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !user || !id) return;

    setAddingNote(true);

    try {
      const ticketRef = doc(db, 'users', user.uid, 'tickets', id);
      
      const noteHistoryEntry: HistoryEntry = {
        id: Date.now().toString(),
        author: userData?.name || user.displayName || 'User',
        timestamp: new Date(),
        notes: newNote.trim(),
        type: 'note',
      };

      await updateDoc(ticketRef, {
        modifiedAt: serverTimestamp(),
        history: arrayUnion(noteHistoryEntry),
      });

      // Update local state
      if (ticket) {
        const updatedTicket = {
          ...ticket,
          history: [...(ticket.history || []), noteHistoryEntry],
        };
        setTicket(updatedTicket);
      }

      setNewNote('');
      setShowAddDetails(false);
      Alert.alert('Success', 'Note added successfully');
    } catch (error) {
      console.error('Error adding note:', error);
      Alert.alert('Error', 'Failed to add note. Please try again.');
    } finally {
      setAddingNote(false);
    }
  };

  const handleBackPress = () => {
    console.log('🔙 BACK BUTTON PRESSED at', new Date().toISOString());
    
    const unsavedChanges = hasUnsavedChanges();
    console.log('🔍 Unsaved changes result:', unsavedChanges);
    
    if (unsavedChanges) {
      console.log('⚠️ Showing confirmation dialog...');
      setShowConfirmDialog(true);
    } else {
      console.log('✅ No unsaved changes - navigating back immediately');
      router.back();
    }
  };

  const handleConfirmLeave = () => {
    console.log('✅ CONFIRMED: User wants to leave without saving');
    setShowConfirmDialog(false);
    // Clear any unsaved state before navigating
    setNewNote('');
    setShowAddDetails(false);
    router.back();
  };

  const handleCancelLeave = () => {
    console.log('❌ CANCELLED: User wants to stay and continue editing');
    setShowConfirmDialog(false);
    // Do nothing - stay on the current page
  };

  const updateFormData = (field: keyof FormData, value: string) => {
    console.log(`📝 Updating ${field}:`, {
      from: formData[field],
      to: value,
      timestamp: new Date().toISOString()
    });
    
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
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

  const getDisplayTicketId = () => {
    if (ticket?.ticketId) {
      return ticket.ticketId;
    }
    return ticket?.id.substring(0, 8).toUpperCase() || '';
  };

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B4C80" />
          <Text style={styles.loadingText}>Loading ticket...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ticket) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Ticket not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBackPress}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Ticket - {getDisplayTicketId()}</Text>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          {/* Personal Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            {/* Name Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Your name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                value={formData.name}
                onChangeText={(value) => updateFormData('name', value)}
                placeholder="Enter your full name"
                editable={!saving}
              />
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            {/* Email Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Your email address <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                value={formData.email}
                onChangeText={(value) => updateFormData('email', value)}
                placeholder="Enter your email address"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!saving}
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            {/* Phone Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Your phone number <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.phone && styles.inputError]}
                value={formData.phone}
                onChangeText={(value) => updateFormData('phone', value)}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
                editable={!saving}
              />
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
            </View>

            {/* CC Email Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Other email addresses to be included in the status updates
              </Text>
              <TextInput
                style={styles.input}
                value={formData.ccEmail}
                onChangeText={(value) => updateFormData('ccEmail', value)}
                placeholder="Enter additional email addresses"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!saving}
              />
            </View>
          </View>

          {/* Request Details Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Request Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Request Title <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.title && styles.inputError]}
                value={formData.title}
                onChangeText={(value) => updateFormData('title', value)}
                placeholder="Enter a brief title for your request"
                editable={!saving}
              />
              {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Request Category <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => updateFormData('category', 'Service')}
                  disabled={saving}
                  activeOpacity={0.7}
                >
                  <View style={styles.radioButton}>
                    {formData.category === 'Service' && <View style={styles.radioButtonSelected} />}
                  </View>
                  <Text style={styles.radioLabel}>Service</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => updateFormData('category', 'Technical')}
                  disabled={saving}
                  activeOpacity={0.7}
                >
                  <View style={styles.radioButton}>
                    {formData.category === 'Technical' && <View style={styles.radioButtonSelected} />}
                  </View>
                  <Text style={styles.radioLabel}>Technical</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Status <Text style={styles.disabledText}>(Read Only)</Text>
              </Text>
              <View style={[styles.statusDisplay, getStatusBadgeStyle(formData.status)]}>
                <Text style={[styles.statusDisplayText, { color: getStatusBadgeStyle(formData.status).color }]}>
                  {formData.status}
                </Text>
              </View>
              <Text style={styles.statusHint}>
                Status can only be changed by administrators
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Details of your request <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.textArea, errors.details && styles.inputError]}
                value={formData.details}
                onChangeText={(value) => updateFormData('details', value)}
                placeholder="Please provide detailed information about your request..."
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                editable={!saving}
              />
              {errors.details && <Text style={styles.errorText}>{errors.details}</Text>}
            </View>
          </View>

          {/* History Section */}
          <View style={styles.section}>
            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>History</Text>
              <TouchableOpacity
                style={styles.addDetailsButton}
                onPress={() => setShowAddDetails(!showAddDetails)}
                disabled={saving || addingNote}
                activeOpacity={0.7}
              >
                <Plus size={16} color="#fff" />
                <Text style={styles.addDetailsText}>ADD DETAILS</Text>
              </TouchableOpacity>
            </View>

            {showAddDetails && (
              <View style={styles.addDetailsContainer}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={styles.textArea}
                  value={newNote}
                  onChangeText={(text) => {
                    console.log(`📝 Note text changed to: "${text}"`);
                    setNewNote(text);
                  }}
                  placeholder="Add your notes here..."
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={!addingNote}
                />
                <View style={styles.noteActions}>
                  <TouchableOpacity
                    style={styles.cancelNoteButton}
                    onPress={() => {
                      setShowAddDetails(false);
                      setNewNote('');
                    }}
                    disabled={addingNote}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelNoteText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveNoteButton, addingNote && styles.saveNoteButtonDisabled]}
                    onPress={handleAddNote}
                    disabled={addingNote || !newNote.trim()}
                    activeOpacity={0.7}
                  >
                    {addingNote ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.saveNoteText}>Add Note</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.historyList}>
              {ticket.history && ticket.history.length > 0 ? (
                ticket.history.map((entry, index) => (
                  <View key={entry.id || index} style={styles.historyEntry}>
                    <View style={styles.historyEntryHeader}>
                      <Text style={styles.historyAuthor}>{entry.author}</Text>
                      <Text style={styles.historyDate}>{formatDate(entry.timestamp)}</Text>
                    </View>
                    <Text style={styles.historyNotes}>{entry.notes}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noHistoryText}>No history entries yet.</Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Custom Confirmation Dialog */}
      <ConfirmationDialog
        visible={showConfirmDialog}
        title="Discard Changes"
        message="You have unsaved changes. Are you sure you want to leave without saving?"
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  saveButton: {
    backgroundColor: '#3B4C80',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    minHeight: 40,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    lineHeight: 20,
  },
  required: {
    color: '#ef4444',
  },
  disabledText: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#374151',
    minHeight: 44,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#374151',
    minHeight: 120,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 24,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B4C80',
  },
  radioLabel: {
    fontSize: 16,
    color: '#374151',
  },
  statusDisplay: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    minWidth: 120,
    alignItems: 'center',
  },
  statusDisplayText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusHint: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  addDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B4C80',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  addDetailsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  addDetailsContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  noteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  cancelNoteButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  cancelNoteText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  saveNoteButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#3B4C80',
  },
  saveNoteButtonDisabled: {
    opacity: 0.7,
  },
  saveNoteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  historyList: {
    gap: 16,
  },
  historyEntry: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  historyEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  historyDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  historyNotes: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  noHistoryText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
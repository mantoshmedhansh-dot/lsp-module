import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SignatureCaptureProps {
  visible: boolean;
  onCapture: (signatureBase64: string) => void;
  onClose: () => void;
  receiverName?: string;
}

export function SignatureCapture({
  visible,
  onCapture,
  onClose,
  receiverName,
}: SignatureCaptureProps) {
  const signatureRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setIsEmpty(true);
  };

  const handleConfirm = () => {
    signatureRef.current?.readSignature();
  };

  const handleOK = (signature: string) => {
    if (signature) {
      onCapture(signature);
    }
  };

  const handleBegin = () => {
    setIsEmpty(false);
  };

  const webStyle = `.m-signature-pad {
    box-shadow: none;
    border: none;
  }
  .m-signature-pad--body {
    border: none;
  }
  .m-signature-pad--footer {
    display: none;
  }
  body, html {
    width: 100%;
    height: 100%;
  }`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.title}>Capture Signature</Text>
            <View style={styles.closeButton} />
          </View>

          {/* Receiver Info */}
          {receiverName && (
            <View style={styles.receiverInfo}>
              <Text style={styles.receiverLabel}>Received by:</Text>
              <Text style={styles.receiverName}>{receiverName}</Text>
            </View>
          )}

          {/* Signature Canvas */}
          <View style={styles.canvasContainer}>
            <View style={styles.canvasWrapper}>
              <SignatureCanvas
                ref={signatureRef}
                onOK={handleOK}
                onBegin={handleBegin}
                webStyle={webStyle}
                backgroundColor="#fff"
                penColor="#000"
                dotSize={1}
                minWidth={1}
                maxWidth={3}
                style={styles.canvas}
              />
              {isEmpty && (
                <View style={styles.placeholder}>
                  <Ionicons name="pencil-outline" size={32} color="#d1d5db" />
                  <Text style={styles.placeholderText}>Sign here</Text>
                </View>
              )}
            </View>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureLineText}>Signature</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.clearButton]}
              onPress={handleClear}
            >
              <Ionicons name="trash-outline" size={20} color="#666" />
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                isEmpty && styles.disabledButton,
              ]}
              onPress={handleConfirm}
              disabled={isEmpty}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    height: SCREEN_HEIGHT * 0.75,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    padding: 8,
    width: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  receiverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    gap: 8,
  },
  receiverLabel: {
    fontSize: 14,
    color: '#666',
  },
  receiverName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  canvasContainer: {
    flex: 1,
    padding: 16,
  },
  canvasWrapper: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    borderStyle: 'dashed',
    backgroundColor: '#fafafa',
    overflow: 'hidden',
    position: 'relative',
  },
  canvas: {
    flex: 1,
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#d1d5db',
  },
  signatureLine: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#111',
    marginHorizontal: 20,
  },
  signatureLineText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  clearButton: {
    backgroundColor: '#f3f4f6',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  disabledButton: {
    backgroundColor: '#93c5fd',
  },
});

export default SignatureCapture;

import React, { useEffect, useRef } from 'react';
import { Button } from '@govtechmy/myds-react/button';
import { AlertCircle } from 'lucide-react';

export interface ResetProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
}

export const ResetProgressModal: React.FC<ResetProgressModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Clear All Learner Progress?',
  description = 'This will reset your drill completions, sessions, oral scores, and hesitation records.',
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Auto-focus the safe "Cancel" action upon modal presentation
    const timer = setTimeout(() => {
      cancelBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Semantic Modal Focus Trap
      if (e.key === 'Tab') {
        const cancelBtn = cancelBtnRef.current;
        const confirmBtn = confirmBtnRef.current;

        if (e.shiftKey) {
          if (document.activeElement === cancelBtn) {
            e.preventDefault();
            confirmBtn?.focus();
          }
        } else {
          if (document.activeElement === confirmBtn) {
            e.preventDefault();
            cancelBtn?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--studio-overlay)',
        backdropFilter: 'var(--studio-glass-blur)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
      aria-describedby="reset-modal-desc"
    >
      <div style={{
        maxWidth: '460px',
        width: '100%',
        backgroundColor: 'var(--studio-surface)',
        border: '1px solid var(--studio-border)',
        borderRadius: '10px',
        boxShadow: 'var(--studio-shadow-float)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ 
            width: '36px', 
            height: '36px', 
            borderRadius: '50%', 
            backgroundColor: 'var(--studio-danger-subtle)', 
            color: 'var(--studio-danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertCircle size={20} />
          </div>
          <div>
            <h3 id="reset-modal-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--studio-text)' }}>
              {title}
            </h3>
            <p id="reset-modal-desc" style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--studio-text-muted)', lineHeight: 1.45 }}>
              {description}
            </p>
          </div>
        </div>

        <div style={{ 
          padding: '0.625rem 0.75rem', 
          borderRadius: '6px', 
          backgroundColor: 'var(--studio-surface-subtle)', 
          fontSize: '0.75rem', 
          color: 'var(--studio-text-muted)',
          border: '1px solid var(--studio-border)'
        }}>
          Application preferences (such as light/dark theme) will be preserved.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
          <Button 
            ref={cancelBtnRef}
            id="cancel-reset-btn"
            variant="default-outline" 
            size="small" 
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button 
            ref={confirmBtnRef}
            id="confirm-reset-btn"
            variant="danger-fill" 
            size="small" 
            onClick={onConfirm}
          >
            Yes, Reset All Progress
          </Button>
        </div>
      </div>
    </div>
  );
};
